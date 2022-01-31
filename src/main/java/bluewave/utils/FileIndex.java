package bluewave.utils;

import java.util.*;
import java.nio.file.Paths;
import static javaxt.utils.Console.console;

import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.standard.StandardAnalyzer;
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
import org.apache.lucene.search.BoostQuery;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.search.WildcardQuery;
import org.apache.lucene.search.BooleanClause.Occur;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;
import org.apache.pdfbox.cos.COSDocument;
import org.apache.pdfbox.io.RandomAccessBuffer;
import org.apache.pdfbox.pdfparser.PDFParser;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;


public class FileIndex {

    private Directory dir;
    private Object wmonitor = new Object();
    private Object smonitor = new Object();
    private IndexWriter _indexWriter;
    private IndexSearcher _indexSearcher;
    private Analyzer analyzer = new StandardAnalyzer();
    
    public static final String FIELD_NAME = "name";
    public static final String FIELD_CONTENTS = "contents";
    public static final String FIELD_PATH = "path";
    public static final String FIELD_MODIFIED = "modified";
    public static final String FIELD_DOCUMENT_ID = "documentID";

    public FileIndex(String path) throws Exception {
        this(new javaxt.io.Directory(path));
    }

    public FileIndex(javaxt.io.Directory path) throws Exception {
        dir = FSDirectory.open(Paths.get(path.toString()));
    }

    public TreeMap<Float, ArrayList<javaxt.io.File>> findFiles(String... searchTerms) throws Exception {
        ArrayList<String> arr = new ArrayList<>();
        for (String term : searchTerms) arr.add(term);
        return findFiles(arr, 10);
    }

    public TreeMap<Float, ArrayList<javaxt.io.File>> findFiles(ArrayList<String> searchTerms, Integer limit) throws Exception {
        TreeMap<Float, ArrayList<javaxt.io.File>> searchResults = new TreeMap<>();
        IndexSearcher searcher = instanceOfIndexSearcher();
        if (searcher != null) {
            TopDocs results = getTopDocs(searchTerms, limit);
            if (results != null) {
                for (int i = 0; i < results.scoreDocs.length; i++) {
                    ScoreDoc scoreDoc = results.scoreDocs[i];
                    Document doc = searcher.doc(scoreDoc.doc);
                    float score = scoreDoc.score;
                    javaxt.io.File file = new javaxt.io.File(doc.get(FIELD_PATH));
                    ArrayList<javaxt.io.File> files = searchResults.get(score);
                    if (files==null){
                        files = new ArrayList<>();
                        searchResults.put(score, files);
                    }
                    files.add(file);
                }
            }
        }
        return searchResults;
    }


    public TreeMap<Float, ArrayList<bluewave.app.Document>> findDocuments(ArrayList<String> searchTerms, Integer limit) throws Exception {
        TreeMap<Float, ArrayList<bluewave.app.Document>> searchResults = new TreeMap<>();
        IndexSearcher searcher = instanceOfIndexSearcher();
        if (searcher != null) {
            TopDocs results = getTopDocs(searchTerms, limit);
            if (results != null) {
                for (int i = 0; i < results.scoreDocs.length; i++) {
                    ScoreDoc scoreDoc = results.scoreDocs[i];

                    Document doc = searcher.doc(scoreDoc.doc);

                    float score = scoreDoc.score;

                    Long documentID = Long.parseLong(doc.get(FIELD_DOCUMENT_ID));
                    bluewave.app.Document d = new bluewave.app.Document(documentID);
                    ArrayList<bluewave.app.Document> documents = searchResults.get(score);
                    if (documents==null){
                        documents = new ArrayList<>();
                        searchResults.put(score, documents);
                    }
                    documents.add(d);
                }
            }
        }
        return searchResults;
    }

    public TopDocs getTopDocs(ArrayList<String> searchTerms, Integer limit) throws Exception {
        if (limit==null || limit<1) limit = 10;

        TreeMap<Float, ArrayList<bluewave.app.Document>> searchResults = new TreeMap<>();
        IndexSearcher searcher = instanceOfIndexSearcher();
        if (searcher != null) {

            BooleanQuery.Builder bqBuilder = new BooleanQuery.Builder();
            for (String term : searchTerms) {

                WildcardQuery wildcardQuery = new WildcardQuery(new Term(FIELD_NAME, WildcardQuery.WILDCARD_STRING + QueryParser.escape(term).toLowerCase() + WildcardQuery.WILDCARD_STRING));
                BooleanClause wildcardBooleanClause = new BooleanClause(new BoostQuery(wildcardQuery, 2.0f), BooleanClause.Occur.SHOULD);
                bqBuilder.add(wildcardBooleanClause);

                QueryParser contentsParser = new QueryParser(FIELD_CONTENTS, analyzer);
                BooleanClause bc = new BooleanClause(contentsParser.parse(QueryParser.escape(term).toLowerCase()),
                        BooleanClause.Occur.SHOULD);
                bqBuilder.add(bc);

            }
            BooleanQuery bbq = bqBuilder.build();
            return searcher.search(bbq, limit);
        }
        return null;
    }
    

    private IndexWriter instanceOfIndexWriter() {
        synchronized (wmonitor) {
            if (_indexWriter == null) {
                try {
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
                try {
                    _indexSearcher = new IndexSearcher(DirectoryReader.open(dir));
                } catch (Exception e) {
                    console.log("ERROR: " + e);
                }
            }
        }
        return _indexSearcher;
    }

    public boolean removeFile(long documentId) {
        try {
            BooleanQuery.Builder bqBuilder = new BooleanQuery.Builder();
            bqBuilder.add(new TermQuery( new Term( FIELD_DOCUMENT_ID, documentId+"" ) ), Occur.MUST);
            IndexWriter writer = instanceOfIndexWriter();
            writer.deleteDocuments(bqBuilder.build());
            long status = writer.commit();
            if(status == -1) 
                return false;
            return true;
        } catch(Exception e) {
            console.log("ERROR: " + e);
        }
        return false;
    }

    public void addFile(javaxt.io.File file) throws Exception {
        addDocument(null, file);
    }

    public void addDocument(bluewave.app.Document d, javaxt.io.File file) throws Exception {
        if (hasFile(file)) return;

        // make a new, empty document
        Document doc = new Document();

        // Add the path of the file as a field named "path". Use a
        // field that is indexed (i.e. searchable), but don't tokenize
        // the field into separate words and don't index term frequency
        // or positional information:
        doc.add(new StringField(FIELD_PATH, file.toString(), Field.Store.YES));

        // Make the document name tokenized and searchable
        doc.add(new TextField(FIELD_NAME, file.getName(false), Field.Store.YES));
        
        // Add the last modified date of the file a field named "modified".
        // Use a LongPoint that is indexed (i.e. efficiently filterable with
        // PointRangeQuery). This indexes to milli-second resolution, which
        // is often too fine. You could instead create a number based on
        // year/month/day/hour/minutes/seconds, down the resolution you require.
        // For example the long value 2011021714 would mean
        // February 17, 2011, 2-3 PM.
        doc.add(new LongPoint(FIELD_MODIFIED, file.getDate().getTime()));



        if (d!=null) doc.add(new StringField(FIELD_DOCUMENT_ID, d.getID()+"", Field.Store.YES));

        if (file.getExtension().equalsIgnoreCase("pdf")) {

            PDFParser parser = new PDFParser(new RandomAccessBuffer(file.getInputStream()));
            parser.parse();
            COSDocument cd = parser.getDocument();
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(new PDDocument(cd));
            cd.close();
            doc.add(new TextField(FIELD_CONTENTS, text, Store.NO));
        }
        else {

            String contentType = file.getContentType();
            if (contentType.startsWith("text")){

                // Add the contents of the file to a field named "contents". Specify a Reader,
                // so that the text of the file is tokenized and indexed, but not stored.
                // Note that FileReader expects the file to be in UTF-8 encoding.
                // If that's not the case searching for special characters will fail.
                doc.add(new TextField(FIELD_CONTENTS, file.getBufferedReader()));
            }
        }

        IndexWriter writer = instanceOfIndexWriter();
        if (writer.getConfig().getOpenMode() == OpenMode.CREATE) {
            // New index, so we just add the document (no old document can be there):
            console.log("adding " + file);
            writer.addDocument(doc);
        } else {
            // Existing index (an old copy of this document may have been indexed) so
            // we use updateDocument instead to replace the old one matching the exact
            // path, if present:
            console.log("updating " + file);
            writer.updateDocument(new Term(FIELD_PATH, file.toString()), doc);
        }
        writer.commit();


        // NOTE: if you want to maximize search performance,
        // you can optionally call forceMerge here. This can be
        // a terribly costly operation, so generally it's only
        // worth it when your index is relatively static (ie
        // you're done adding documents to it):
        //
        // writer.forceMerge(1);

    }

    public boolean hasFile(javaxt.io.File file) {
        if (indexExists()) {
            IndexSearcher searcher = instanceOfIndexSearcher();
            
            if (searcher != null) {
                try {
                    TopDocs results = searcher.search(new TermQuery(new Term("path", file.toString())), 1);
                    if (results.totalHits.value > 0) {
                        return true;
                    }
                } catch (Exception e) {

                }
            }
        }
        return false;
    }

    private boolean indexExists() {
        try {

            return DirectoryReader.indexExists(dir);
        } catch (Exception e) {
            console.log("indexExists: " + e);
        }
        return false;
    }
}
