package bluewave.utils;

//Java imports
import java.util.*;
import java.io.StringReader;
import java.nio.file.Paths;

//JavaXT imports
import javaxt.json.JSONArray;
import javaxt.json.JSONObject;
import static javaxt.utils.Console.console;

//Lucene imports
import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.CharArraySet;
import org.apache.lucene.analysis.TokenStream;
import org.apache.lucene.analysis.en.EnglishAnalyzer;
import org.apache.lucene.analysis.miscellaneous.PerFieldAnalyzerWrapper;
import org.apache.lucene.analysis.shingle.ShingleAnalyzerWrapper;
import org.apache.lucene.analysis.standard.StandardAnalyzer;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.FieldType;
import org.apache.lucene.document.Field.Store;
import org.apache.lucene.document.LongPoint;
import org.apache.lucene.document.StringField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexOptions;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexableField;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.index.Term;
import org.apache.lucene.queryparser.classic.MultiFieldQueryParser;
import org.apache.lucene.queryparser.classic.QueryParser;
import org.apache.lucene.search.BooleanClause;
import org.apache.lucene.search.BooleanQuery;
import org.apache.lucene.search.BoostQuery;
import org.apache.lucene.search.Explanation;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.ScoreDoc;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.search.TopDocs;
import org.apache.lucene.search.WildcardQuery;
import org.apache.lucene.search.BooleanClause.Occur;
import org.apache.lucene.search.highlight.Highlighter;
import org.apache.lucene.search.highlight.QueryScorer;
import org.apache.lucene.search.highlight.SimpleFragmenter;
import org.apache.lucene.search.highlight.SimpleHTMLFormatter;
import org.apache.lucene.search.highlight.SimpleSpanFragmenter;
import org.apache.lucene.search.vectorhighlight.FastVectorHighlighter;
import org.apache.lucene.search.vectorhighlight.FieldQuery;
import org.apache.lucene.search.vectorhighlight.SimpleFragListBuilder;
import org.apache.lucene.search.vectorhighlight.SimpleFragmentsBuilder;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;

//PDFBox imports
import org.apache.pdfbox.cos.COSDocument;
import org.apache.pdfbox.io.RandomAccessBuffer;
import org.apache.pdfbox.pdfparser.PDFParser;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.text.PDFTextStripper;



//******************************************************************************
//**  FileIndex
//******************************************************************************
/**
 *   Used to create and manage an searchable file index. The file index is
 *   persisted in a directory on the file system.
 *
 ******************************************************************************/

public class FileIndex {

    private Directory dir;
    private Object wmonitor = new Object();
    private Object smonitor = new Object();
    private IndexWriter _indexWriter;
    private IndexSearcher _indexSearcher;
    private PerFieldAnalyzerWrapper perFieldAnalyzerWrapper = null;
    private FieldType customFieldForVectors = null;
    private DirectoryReader directoryReader = null;

    public static final String FIELD_NAME = "name";
    public static final String FIELD_CONTENTS = "contents";
    public static final String FIELD_PATH = "path";
    public static final String FIELD_MODIFIED = "modified";
    public static final String FIELD_DOCUMENT_ID = "documentID";
    public static final String FIELD_SUBJECT = "subject";
    public static final String FIELD_KEYWORDS = "keywords";
    public static final int FRAGMENT_CHAR_SIZE = 150;
    public static final int NUM_HIGHLIGHT_FRAGS_PER_HIT = 1;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public FileIndex(String path) throws Exception {
        this(new javaxt.io.Directory(path));
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public FileIndex(javaxt.io.Directory path) throws Exception {
        dir = FSDirectory.open(Paths.get(path.toString()));
        StandardAnalyzer standardAnalyzer = new StandardAnalyzer(getStopWords());
        ShingleAnalyzerWrapper shingleAnalyzerWrapper = new ShingleAnalyzerWrapper(standardAnalyzer, 2, 4);
        Map<String,Analyzer> analyzerPerFieldMap = new HashMap<>();
//        analyzerPerFieldMap.put(FIELD_CONTENTS, shingleAnalyzerWrapper);
        analyzerPerFieldMap.put(FIELD_CONTENTS, standardAnalyzer);
        analyzerPerFieldMap.put(FIELD_NAME, standardAnalyzer);
        perFieldAnalyzerWrapper = new PerFieldAnalyzerWrapper(standardAnalyzer, analyzerPerFieldMap);

        customFieldForVectors = new FieldType();
        customFieldForVectors.setIndexOptions(IndexOptions.DOCS_AND_FREQS_AND_POSITIONS_AND_OFFSETS);
        customFieldForVectors.setStored(true);
        customFieldForVectors.setStoreTermVectors(true);
        customFieldForVectors.setStoreTermVectorPayloads(true);
        customFieldForVectors.setStoreTermVectorOffsets(true);
        customFieldForVectors.setStoreTermVectorPositions(true);

        if(!path.isEmpty()) {
            removeOrphanDocs();
        }
    }


  //**************************************************************************
  //** getSize
  //**************************************************************************
  /** Return the number of documents in the index
   */
    public int getSize() {
        return instanceOfIndexSearcher().getIndexReader().numDocs();
    }


  //**************************************************************************
  //** removeOrphanDocs
  //**************************************************************************
  /** Used to remove any docs that might have been moved or deleted
   */
    private void removeOrphanDocs() {
        //Remove any docs that might have been moved or deleted
        IndexReader reader = instanceOfIndexSearcher().getIndexReader();
        for (int i=0; i<reader.maxDoc(); i++) {
            try {
                Document doc = reader.document(i);
                javaxt.io.File file = new javaxt.io.File(doc.get(FIELD_PATH));
                if (!file.exists()) {
                    removeFile(file);
                }
            }
            catch(Exception e) {

            }
        }
    }


  //**************************************************************************
  //** findFiles
  //**************************************************************************
  /** Used to find files in the index using a given set of keywords
   */
    public TreeMap<Float, ArrayList<javaxt.io.File>> findFiles(String... searchTerms) throws Exception {
        ArrayList<String> arr = new ArrayList<>();
        for (String term : searchTerms) arr.add(term);
        return findFiles(arr, 10);
    }


  //**************************************************************************
  //** findFiles
  //**************************************************************************
  /** Used to find files in the index using a given set of keywords
   */
    public TreeMap<Float, ArrayList<javaxt.io.File>> findFiles(ArrayList<String> searchTerms, Integer limit) throws Exception {
        TreeMap<Float, ArrayList<javaxt.io.File>> searchResults = new TreeMap<>();
        IndexSearcher searcher = instanceOfIndexSearcher();
        if (searcher != null) {
            List<ResultWrapper> results = getTopDocs(searchTerms, limit);
            for(ResultWrapper resultWrapper: results) {
                ScoreDoc scoreDoc = resultWrapper.scoreDoc;
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
        return searchResults;
    }


  //**************************************************************************
  //** findFiles
  //**************************************************************************
  /** Used to find bluewave documents in the index using a given set of keywords
   */
    public TreeMap<Float, ArrayList<bluewave.app.Document>> findDocuments(List<String> searchTerms, Integer limit) throws Exception {
        TreeMap<Float, ArrayList<bluewave.app.Document>> searchResults = new TreeMap<>();
        IndexSearcher searcher = instanceOfIndexSearcher();
        if (searcher != null) {
            List<ResultWrapper> results = getTopDocs(searchTerms, limit);
            for (ResultWrapper resultWrapper: results) {
                ScoreDoc scoreDoc = resultWrapper.scoreDoc;
                Document doc = searcher.doc(scoreDoc.doc);

                float score = scoreDoc.score;
                Long documentID = Long.parseLong(doc.get(FIELD_DOCUMENT_ID));
                bluewave.app.Document d = new bluewave.app.Document(documentID);

                javaxt.json.JSONObject searchMetadata = new javaxt.json.JSONObject();
                javaxt.json.JSONObject info = d.getInfo();
                if (info==null){
                    info = new javaxt.json.JSONObject();
                    d.setInfo(info);
                }
                searchMetadata.set("score", score);
                searchMetadata.set("frequency", resultWrapper.frequency);
                searchMetadata.set("highlightFragment", resultWrapper.highlightFragment);
                searchMetadata.set("explainDetails", resultWrapper.explainDetails);
                info.set("searchMetadata", searchMetadata);

                ArrayList<bluewave.app.Document> documents = searchResults.get(score);
                if (documents==null){
                    documents = new ArrayList<>();
                    searchResults.put(score, documents);
                }
                documents.add(d);
            }
        }
        return searchResults;
    }

  //**************************************************************************
  //** getTopDocs
  //**************************************************************************
    private List<ResultWrapper> getTopDocs(List<String> searchTerms, Integer limit) throws Exception {
        List<ResultWrapper> results = new ArrayList<>();
        
        String searchTerm = searchTerms.get(0);
      //Compile query
//        BooleanQuery.Builder bqBuilder = new BooleanQuery.Builder();
//        Query contentsQuery = null;
//        for (String term : searchTerms) {
//            
//            console.log("term: " + term);
//            console.log("escaped term: " + QueryParser.escape(term));
//
//            WildcardQuery nameQuery = new WildcardQuery(new Term(FIELD_NAME, WildcardQuery.WILDCARD_STRING + QueryParser.escape(term).toLowerCase() + WildcardQuery.WILDCARD_STRING));
//            BooleanClause wildcardBooleanClause = new BooleanClause(new BoostQuery(nameQuery, 2.0f), BooleanClause.Occur.SHOULD);
//            bqBuilder.add(wildcardBooleanClause);
//
//            Query contentsPhraseQuery = new QueryParser(FIELD_CONTENTS, new StandardAnalyzer(getStopWords())).createPhraseQuery(FIELD_CONTENTS, QueryParser.escape(term).toLowerCase());
//            bqBuilder.add(new BooleanClause(contentsPhraseQuery, BooleanClause.Occur.SHOULD));
//
//            contentsQuery = new QueryParser(FIELD_CONTENTS, perFieldAnalyzerWrapper).parse(QueryParser.escape(term).toLowerCase());
//            bqBuilder.add(new BooleanClause(contentsQuery, BooleanClause.Occur.SHOULD));
//
//            Query keywordQuery = new QueryParser(FIELD_KEYWORDS, perFieldAnalyzerWrapper).parse(QueryParser.escape(term).toLowerCase());
//            bqBuilder.add(new BooleanClause(keywordQuery, BooleanClause.Occur.SHOULD));
//
//            Query subjectQuery = new QueryParser(FIELD_SUBJECT, perFieldAnalyzerWrapper).parse(QueryParser.escape(term).toLowerCase());
//            bqBuilder.add(new BooleanClause(subjectQuery, BooleanClause.Occur.SHOULD));
//        }
//        BooleanQuery bbq = bqBuilder.build();

        Query query = new MultiFieldQueryParser(new String[]{FIELD_NAME, FIELD_CONTENTS, FIELD_KEYWORDS, FIELD_SUBJECT}, perFieldAnalyzerWrapper).parse(searchTerm);

      //Execute search
        IndexSearcher searcher = instanceOfIndexSearcher();
        if (searcher==null) return results;
        if (limit==null || limit<1) limit = 10;
        TopDocs hits = searcher.search(query, limit);
        console.log("Hits: " + hits.totalHits.value + " -- search_term: ", searchTerms);


      //Create highlighter
        QueryScorer scorer = new QueryScorer(query);
        Highlighter highlighter = new Highlighter(new SimpleHTMLFormatter(), scorer);
        highlighter.setTextFragmenter(new SimpleFragmenter( FRAGMENT_CHAR_SIZE));

        QueryScorer phraseScorer = new QueryScorer(query);
        phraseScorer.setExpandMultiTermQuery(false);
        Highlighter phraseHighlighter = new Highlighter(new SimpleHTMLFormatter(), phraseScorer);
        phraseHighlighter.setTextFragmenter(new SimpleSpanFragmenter(phraseScorer, FRAGMENT_CHAR_SIZE));

      //Generate response
        for (ScoreDoc scoreDoc : hits.scoreDocs) {
            ResultWrapper resultWrapper = new ResultWrapper();
            resultWrapper.scoreDoc = scoreDoc;
            int docid = scoreDoc.doc;
            Document doc = searcher.doc(docid);
            Explanation ex = searcher.explain(query, docid);
            JSONArray explainDetails = new JSONArray();
            for(Explanation explanation : ex.getDetails()) {
                JSONArray explains = parse(explanation);
                for(Object explain : explains) {
                    explainDetails.add(explain);
                }
            }
            resultWrapper.explainDetails = explainDetails;

          //Generate highlightFragment
            for (String term : searchTerms) {

                // Contents
                IndexableField field = doc.getField(FIELD_CONTENTS);
                String fragment = getHighlights(field, doc, phraseHighlighter);
                if(fragment == null) {
                    fragment = getVectorHighlight(query, searcher.getIndexReader(), docid, FIELD_CONTENTS, term);
                }
                resultWrapper.highlightFragment = fragment;

                // Name
                if(resultWrapper.highlightFragment == null || resultWrapper.highlightFragment.isBlank()) {
                    field = doc.getField(FIELD_NAME);
                    fragment = getHighlights(field, doc, highlighter);
                    resultWrapper.highlightFragment = fragment;
                }

                // Keywords
                if(resultWrapper.highlightFragment == null || resultWrapper.highlightFragment.isBlank()) {
                    field = doc.getField(FIELD_KEYWORDS);
                    fragment = getHighlights(field, doc, highlighter);
                    resultWrapper.highlightFragment = fragment;
                }

                // Subject
                if(resultWrapper.highlightFragment == null || resultWrapper.highlightFragment.isBlank()) {
                    field = doc.getField(FIELD_SUBJECT);
                    fragment = getHighlights(field, doc, highlighter);
                    resultWrapper.highlightFragment = fragment;
                }
            }

            results.add(resultWrapper);
        }

        return results;
    }

    private String getHighlights(final IndexableField field, Document doc, Highlighter highlighter) {
        if (field!=null){
            try {

                String text = doc.get(field.name());
                if(text != null && !text.isBlank()) {
                    TokenStream stream = perFieldAnalyzerWrapper.tokenStream(field.name(), new StringReader(text));
                    return  highlighter.getBestFragment(stream, text);
                }
            }catch(Exception e) {
                console.log("ERROR: " + e);
            }
        }
        return null;
    }

    private String getVectorHighlight(Query query, IndexReader indexReader, int docId, String fieldName, String searchTerm ) {
        String[] PRE_TAGS = new String[]{"<b>"};
        String[] POST_TAGS = new String[]{"</b>"};
        FastVectorHighlighter fastVectorHighlighter = new FastVectorHighlighter(true, true,new SimpleFragListBuilder(1), new SimpleFragmentsBuilder(PRE_TAGS, POST_TAGS) );
        try {
            FieldQuery fieldQuery = fastVectorHighlighter.getFieldQuery(query, indexReader);
            return fastVectorHighlighter.getBestFragment(fieldQuery, indexReader, docId, fieldName, FRAGMENT_CHAR_SIZE);
        }catch(Exception e) {
            console.log("ERROR: " + e);
        }
        return null;
    }

    private IndexWriter instanceOfIndexWriter() {
        synchronized (wmonitor) {
            if (_indexWriter == null || !_indexWriter.isOpen()) {
                try {
                   IndexWriterConfig iwc = new IndexWriterConfig(perFieldAnalyzerWrapper);
                    iwc.setOpenMode(OpenMode.CREATE_OR_APPEND);
                    _indexWriter = new IndexWriter(dir, iwc);
                } catch (Exception e) {
                    console.log("ERROR: " + e);
                }
            }
        }
        return _indexWriter;
    }

    private IndexSearcher instanceOfIndexSearcher() {
        synchronized (smonitor) {
            if (_indexSearcher == null) {
                try {
                    directoryReader = DirectoryReader.open(dir);
                    _indexSearcher = new IndexSearcher(directoryReader);
                } catch (Exception e) {
                    console.log("ERROR: " + e);
                }
            } else {
                try {
                    DirectoryReader directoryReaderTemp = DirectoryReader.openIfChanged(directoryReader);
                    if(directoryReaderTemp != null) {
                        IndexSearcher indexSearcherTemp = new IndexSearcher(directoryReaderTemp);
                        try {
                            if(directoryReader != null) {
                                directoryReader.close();
                            }
                        } catch(Exception e) {
                            console.log("ERROR: " + e);
                        }
                        directoryReader = directoryReaderTemp;
                        _indexSearcher = indexSearcherTemp;
                    }
                } catch (Exception e) {
                    console.log("ERROR: " + e);
                }
            }
        }
        return _indexSearcher;
    }


  //**************************************************************************
  //** addFile
  //**************************************************************************
  /** Used to add a file to the index
   */
    public void addFile(javaxt.io.File file) throws Exception {
        addDocument(null, file);
    }


  //**************************************************************************
  //** addDocument
  //**************************************************************************
  /** Used to add a bluewave document, backed by a file to the index
   */
    public synchronized void addDocument(bluewave.app.Document d, javaxt.io.File file) throws Exception {
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
            PDDocument pdDocument = new PDDocument(cd);
            if (d!=null) d.setPageCount(pdDocument.getNumberOfPages());
            PDDocumentInformation info = pdDocument.getDocumentInformation();

            if(info.getSubject() != null && !info.getSubject().isBlank())
                doc.add(new TextField(FIELD_SUBJECT, info.getSubject(), Store.YES));

            if(info.getKeywords() != null && !info.getKeywords().isBlank())
                doc.add(new TextField(FIELD_KEYWORDS, info.getKeywords(), Store.YES));

            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(pdDocument);
            cd.close();
            doc.add(new Field(FIELD_CONTENTS, text, customFieldForVectors));
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
        writer.addDocument(doc);
        writer.commit();

        // NOTE: if you want to maximize search performance,
        // you can optionally call forceMerge here. This can be
        // a terribly costly operation, so generally it's only
        // worth it when your index is relatively static (ie
        // you're done adding documents to it):
        //
        // writer.forceMerge(1);

    }


  //**************************************************************************
  //** removeFile
  //**************************************************************************
  /** Used to remove a file from the index
   */
    public boolean removeFile(javaxt.io.File file) throws Exception {
        return remove(new Term(FIELD_PATH, file.toString() ));
    }


  //**************************************************************************
  //** removeDocument
  //**************************************************************************
  /** Used to remove a bluewave document from the index
   */
    public boolean removeDocument(long documentId) throws Exception {
        return remove(new Term( FIELD_DOCUMENT_ID, documentId+"" ));
    }


  //**************************************************************************
  //** remove
  //**************************************************************************
  /** Used to remove an entry from the index using a given search term
   */
    private boolean remove(Term term) throws Exception {
        BooleanQuery.Builder bqBuilder = new BooleanQuery.Builder();
        bqBuilder.add(new TermQuery(term), Occur.MUST);
        IndexWriter writer = instanceOfIndexWriter();
        writer.deleteDocuments(bqBuilder.build());
        long status = writer.commit();
        if(status == -1) return false;
        return true;
    }


  //**************************************************************************
  //** hasFile
  //**************************************************************************
  /** Returns true of the given file is in the index
   */
    public boolean hasFile(javaxt.io.File file) {
        if (indexExists()) {
            IndexSearcher searcher = instanceOfIndexSearcher();

            if (searcher != null) {
                try {
                    TopDocs results = searcher.search(new TermQuery(new Term(FIELD_PATH, file.toString())), 1);
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

    private class ResultWrapper {
        ScoreDoc scoreDoc;
        Float frequency;
        String highlightFragment;
        JSONArray explainDetails;
    }

    private CharArraySet getStopWords() {
        List<String>stopWords = new ArrayList<>();
        Iterator it = EnglishAnalyzer.ENGLISH_STOP_WORDS_SET.iterator();
        while(it.hasNext()) {
            char[] chars = (char[]) it.next();
            stopWords.add(new String(chars));
        }

        /**
         * Add more words to the list here
         * stopWords.add("someword")
         */


        // console.log("STOP WORD LIST");
        // for(String str: stopWords)
        //     console.log(str);

        return new CharArraySet(stopWords, false);
    }

    private JSONArray parse(Explanation _explanation) {
        if(_explanation == null) return null;

        JSONArray explains = new JSONArray();
        Explanation[]explanationDetails = _explanation.getDetails();
        String description = desc(_explanation.getDescription());
        if(description != null) {
            String [] desc = description.split(":");
            JSONObject explain = new JSONObject();
            explain.set("field", desc[0]);
            explain.set("term", desc[1]);
            for (Explanation explanation : explanationDetails) {
                Explanation[]subExplanationDetails = explanation.getDetails();
                for(Explanation subExplanation : subExplanationDetails) {
                    for(Explanation subSubExplanation : subExplanation.getDetails()) {
                        if(subSubExplanation.getDescription().contains("freq") || subSubExplanation.getDescription().contains("phraseFreq")) {
                            explain.set("frequency", subSubExplanation.getValue().toString());
                            explains.add(explain);
                        }
                    }
                }
            }
        } else {
            description = null;
            for (Explanation explanation : explanationDetails) {
                Explanation[]subExplanationDetails = explanation.getDetails();
                description = desc(explanation.getDescription());
                if(description != null) {
                    String [] desc = description.split(":");
                    JSONObject explain = new JSONObject();
                    explain.set("field", desc[0]);
                    explain.set("term", desc[1]);
                    for(Explanation subExplanation : subExplanationDetails) {
                        for(Explanation subSubExplanation : subExplanation.getDetails()) {
                            for(Explanation subSubSubExplanation : subSubExplanation.getDetails()) {
                                if(subSubSubExplanation.getDescription().contains("freq,") || subSubSubExplanation.getDescription().contains("phraseFreq")) {
                                    explain.set("frequency", subSubSubExplanation.getValue().toString());
                                    explains.add(explain);
                                }
                            }
                        }
                    }
                }
            }
        }
        // console.log("Explains: " + explains.toString());
        return explains;
    }

    /**
     * Single term description
     * @param line
     * @return
     */
    private String desc(String line) {
        String startTag = "weight(";
        if(line == null || line.isBlank() || !line.contains(startTag))
            return null;

        int startIndex = line.indexOf(startTag) + startTag.length();
        int endIndex = line.indexOf(")", startIndex);
        String substring = line.substring(startIndex, endIndex);
        endIndex = substring.lastIndexOf("in");
        substring = substring.substring(0, endIndex);

        return substring;
    }

}