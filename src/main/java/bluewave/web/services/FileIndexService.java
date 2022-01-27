package bluewave.web.services;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.standard.StandardAnalyzer;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.Field.Store;
import org.apache.lucene.document.LongPoint;
import org.apache.lucene.document.StringField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexFileNames;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.index.Term;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;
import org.apache.pdfbox.cos.COSDocument;
import org.apache.pdfbox.io.RandomAccessBuffer;
import org.apache.pdfbox.pdfparser.PDFParser;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import bluewave.Config;
import javaxt.io.File;
import javaxt.json.JSONObject;
import javaxt.utils.Console;

public class FileIndexService {

    private String indexDirectoryPath;
    private Console console = new javaxt.utils.Console();
    private static Object wmonitor = new Object();
    private static Object smonitor = new Object();
    private static IndexWriter _indexWriter;
    private static IndexSearcher _indexSearcher;

    public IndexWriter instanceOfIndexWriter() {
        synchronized (wmonitor) {
            if (_indexWriter == null) {
                JSONObject config = Config.get("webserver").toJSONObject();
                javaxt.io.Directory jobDir = null;
                if (config.has("indexDir")) {
                    String dir = config.get("indexDir").toString().trim();
                    if (dir.length() > 0) {
                        indexDirectoryPath = dir;
                        jobDir = new javaxt.io.Directory(dir);
                        jobDir.create();
                    }
                }
                try {
                    org.apache.lucene.store.Directory dir =
                            FSDirectory.open(Paths.get(indexDirectoryPath));
                    Analyzer analyzer = new StandardAnalyzer();
                    IndexWriterConfig iwc = new IndexWriterConfig(analyzer);
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
                JSONObject config = Config.get("webserver").toJSONObject();
                javaxt.io.Directory jobDir = null;
                if (config.has("indexDir")) {
                    String dir = config.get("indexDir").toString().trim();
                    if (dir.length() > 0) {
                        indexDirectoryPath = dir;
                        jobDir = new javaxt.io.Directory(dir);
                        jobDir.create();
                    }
                }
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

    public void indexDocument(javaxt.io.File file) {
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
    private void indexDoc(IndexWriter writer, Path file, long lastModified) throws IOException {
        try (InputStream stream = Files.newInputStream(file)) {
            // make a new, empty document
            Document doc = new Document();

            // Add the path of the file as a field named "path". Use a
            // field that is indexed (i.e. searchable), but don't tokenize
            // the field into separate words and don't index term frequency
            // or positional information:
            console.log("indexDoc: path: " + file.getFileName().toString());
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
        if (FileIndexService.indexExists()) {
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

    public static boolean indexExists() {
        try {
            JSONObject config = Config.get("webserver").toJSONObject();
            if (config.has("indexDir")) {
                String dir = config.get("indexDir").toString().trim();
                if (dir != null && dir.length() > 0 && new javaxt.io.Directory(dir).exists()) {
                    Directory directory = FSDirectory.open(Paths.get(dir));
                    return DirectoryReader.indexExists(directory);
                }
            }
        } catch (Exception e) {
            new Console().log("indexExists: " + e);
        }
        return false;
    }
}
