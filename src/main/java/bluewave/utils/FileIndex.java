package bluewave.utils;

import static javaxt.utils.Console.console;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.LowerCaseFilter;
import org.apache.lucene.analysis.TokenStream;
import org.apache.lucene.analysis.Tokenizer;
import org.apache.lucene.analysis.icu.ICUNormalizer2Filter;
import org.apache.lucene.analysis.icu.segmentation.ICUTokenizer;
import org.apache.lucene.analysis.miscellaneous.ASCIIFoldingFilter;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.Field.Store;
import org.apache.lucene.document.LongPoint;
import org.apache.lucene.document.StringField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.index.Term;
import org.apache.lucene.queryparser.classic.QueryParser;
import org.apache.lucene.search.BooleanClause;
import org.apache.lucene.search.BooleanQuery;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;
import org.apache.pdfbox.cos.COSDocument;
import org.apache.pdfbox.io.RandomAccessBuffer;
import org.apache.pdfbox.pdfparser.PDFParser;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import javaxt.json.JSONObject;

public class FileIndex {

    private String indexDirectoryPath;

    private Object wmonitor = new Object();
    private Object smonitor = new Object();
    private IndexWriter _indexWriter;
    private IndexSearcher _indexSearcher;
    private Analyzer customAnalyzer = new Analyzer() {
        @Override
        protected TokenStreamComponents createComponents(String fieldName) {
            final Tokenizer source = new ICUTokenizer();
            TokenStream tokenStream = source;
            tokenStream = new LowerCaseFilter(tokenStream);
            tokenStream = new ICUNormalizer2Filter(tokenStream);
            tokenStream = new ASCIIFoldingFilter(tokenStream);
            return new TokenStreamComponents(source, tokenStream);
        }
    };

    public FileIndex(String path) {
        indexDirectoryPath = path;
    }

    public SearchResults findFiles(String q) {
        console.log("findFiles: " + q);
        SearchResults searchResult = null;
        IndexSearcher searcher = instanceOfIndexSearcher();
        if (searcher != null) {
            try {
                TopDocs results = null;
                if (q != null) {
                    String[] searchTerms = q.split(" ");
                    BooleanQuery.Builder bqBuilder = new BooleanQuery.Builder();
                    for (String term : searchTerms) {

                        QueryParser contentsParser = new QueryParser("contents", customAnalyzer);
                        BooleanClause bc = new BooleanClause(contentsParser.parse(term),
                                BooleanClause.Occur.SHOULD);
                        bqBuilder.add(bc);

                        QueryParser pathParser = new QueryParser("path", customAnalyzer);
                        BooleanClause fbc = new BooleanClause(pathParser.parse(term),
                                BooleanClause.Occur.SHOULD);
                        bqBuilder.add(fbc);
                    }
                    BooleanQuery bbq = bqBuilder.build();

                    results = searcher.search(bbq, 10);
                }
                JSONObject searchHit = null;
                searchResult = new SearchResults(results.totalHits.value);
                for (int i = 0; i < results.scoreDocs.length; i++) {
                    ScoreDoc scoreDoc = results.scoreDocs[i];
                    Document doc = searcher.doc(scoreDoc.doc);
                    searchHit = new JSONObject();
                    searchHit.set("id", scoreDoc.doc);
                    searchHit.set("score", scoreDoc.score);
                    searchHit.set("path", doc.get("path"));
                    searchResult.add(searchHit);
                }
            } catch (Exception e) {
                console.log("ERROR findFiles: " + e);
            }
        }

        return searchResult;
    }

    private IndexWriter instanceOfIndexWriter() {
        synchronized (wmonitor) {
            if (_indexWriter == null) {
                try {
                    org.apache.lucene.store.Directory dir =
                            FSDirectory.open(Paths.get(indexDirectoryPath));
                    IndexWriterConfig iwc = new IndexWriterConfig(customAnalyzer);
                    iwc.setOpenMode(OpenMode.CREATE_OR_APPEND);
                    _indexWriter = new IndexWriter(dir, iwc);
                } catch (Exception e) {
                    console.log("ERROR: " + e);
                }
            }
        }
        return _indexWriter;
    }

    public IndexSearcher instanceOfIndexSearcher() {
        synchronized (smonitor) {
            if (_indexSearcher == null) {
                try {
                    org.apache.lucene.store.Directory dir =
                            FSDirectory.open(Paths.get(indexDirectoryPath));
                    _indexSearcher = new IndexSearcher(DirectoryReader.open(dir));
                } catch (Exception e) {
                    console.log("ERROR: " + e);
                }
            }
        }
        return _indexSearcher;
    }

    public void addFile(javaxt.io.File file) {
        try {

            Path path = file.toFile().toPath();
            IndexWriter writer = instanceOfIndexWriter();
            if (writer != null) {
                indexDoc(writer, path, Files.getLastModifiedTime(path).toMillis());
            }

            // NOTE: if you want to maximize search performance,
            // you can optionally call forceMerge here. This can be
            // a terribly costly operation, so generally it's only
            // worth it when your index is relatively static (ie
            // you're done adding documents to it):
            //
            // writer.forceMerge(1);

        } catch (Throwable t) {
            console.log("ERROR: " + t);
        }
    }

    /** Indexes a single document */
    private static void indexDoc(IndexWriter writer, Path file, long lastModified) throws IOException {
        try (InputStream stream = Files.newInputStream(file)) {
            // make a new, empty document
            Document doc = new Document();

            // Add the path of the file as a field named "path". Use a
            // field that is indexed (i.e. searchable), but don't tokenize
            // the field into separate words and don't index term frequency
            // or positional information:
            Field pathField =
                    new StringField("path", file.getFileName().toString(), Field.Store.YES);
            doc.add(pathField);

            // Add the last modified date of the file a field named "modified".
            // Use a LongPoint that is indexed (i.e. efficiently filterable with
            // PointRangeQuery). This indexes to milli-second resolution, which
            // is often too fine. You could instead create a number based on
            // year/month/day/hour/minutes/seconds, down the resolution you require.
            // For example the long value 2011021714 would mean
            // February 17, 2011, 2-3 PM.
            doc.add(new LongPoint("modified", lastModified));

            if (file.toString().contains(".pdf")) {

                PDFParser parser = new PDFParser(new RandomAccessBuffer(stream));
                parser.parse();
                COSDocument cd = parser.getDocument();
                PDFTextStripper stripper = new PDFTextStripper();
                String text = stripper.getText(new PDDocument(cd));
                cd.close();
                doc.add(new TextField("contents", text, Store.YES));
            } else {
                // Add the contents of the file to a field named "contents". Specify a Reader,
                // so that the text of the file is tokenized and indexed, but not stored.
                // Note that FileReader expects the file to be in UTF-8 encoding.
                // If that's not the case searching for special characters will fail.
                doc.add(new TextField("contents",
                        new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))));
            }

            if (writer.getConfig().getOpenMode() == OpenMode.CREATE) {
                // New index, so we just add the document (no old document can be there):
                console.log("adding " + file);
                writer.addDocument(doc);
            } else {
                // Existing index (an old copy of this document may have been indexed) so
                // we use updateDocument instead to replace the old one matching the exact
                // path, if present:
                console.log("updating " + file);
                writer.updateDocument(new Term("path", file.toString()), doc);
            }
            writer.commit();
        }
    }

    public boolean hasDocumentBeenIndexed(String fileName) {
        console.log("hasDocumentBeenIndexed: " + fileName);

        if (indexExists()) {
            IndexSearcher searcher = instanceOfIndexSearcher();

            if (searcher != null) {
                try {
                    TopDocs results = searcher.search(new TermQuery(new Term("path", fileName)), 1);
                    console.log("results: " + results.totalHits);
                    for (int i = 0; i < results.scoreDocs.length; i++) {
                        ScoreDoc tempDoc = results.scoreDocs[i];
                        console.log("docId: " + tempDoc.doc + " doc score: " + tempDoc.score);
                    }
                    if (results.totalHits.value > 0) {
                        return true;
                    }
                } catch (Exception e) {

                }
            } else {
                console.log("hasDocumentBeenIndexed: searcher == null");
            }
        }
        return false;
    }

    private boolean indexExists() {
        try {
            Directory directory = FSDirectory.open(Paths.get(indexDirectoryPath));
            return DirectoryReader.indexExists(directory);
        } catch (Exception e) {
            console.log("indexExists: " + e);
        }
        return false;
    }
}
