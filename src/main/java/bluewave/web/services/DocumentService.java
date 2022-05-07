package bluewave.web.services;
import bluewave.Config;
import bluewave.utils.FileIndex;
import static bluewave.utils.Python.*;

import java.util.*;
import java.io.IOException;
import java.io.FileOutputStream;
import java.io.BufferedInputStream;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.nio.channels.WritableByteChannel;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;


import javaxt.http.servlet.*;
import javaxt.http.servlet.FormInput;
import javaxt.http.servlet.FormValue;
import javaxt.http.websocket.WebSocketListener;
import javaxt.utils.ThreadPool;
import javaxt.express.*;
import javaxt.sql.*;
import javaxt.json.*;


import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.multipdf.PDFMergerUtility;



//******************************************************************************
//**  DocumentService
//******************************************************************************
/**
 *   Used to upload, download, and analyze documents
 *
 ******************************************************************************/

public class DocumentService extends WebService {

    private ThreadPool pool;
    private FileIndex index;
    private ConcurrentHashMap<String, JSONObject> scripts;
    private ConcurrentHashMap<Long, WebSocketListener> listeners;
    private static AtomicLong webSocketID;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public DocumentService(){

      //Websocket stuff
        webSocketID = new AtomicLong(0);
        listeners = new ConcurrentHashMap<>();
        DocumentService me = this;


      //Start thread pool used to index files
        int numThreads = 20;
        int poolSize = 1000;
        pool = new ThreadPool(numThreads, poolSize){
            public void process(Object obj){
                try{
                    Object[] arr = (Object[]) obj;
                    javaxt.io.File file = (javaxt.io.File) arr[0];
                    bluewave.app.Path path = (bluewave.app.Path) arr[1];

                    bluewave.app.File f = getOrCreateFile(file, path);
                    bluewave.app.Document doc = getOrCreateDocument(f);
                    String indexStatus = doc.getIndexStatus();
                    if (indexStatus==null && index!=null){
                        try{
                            index.addDocument(doc, file);
                            indexStatus = "indexed";
                            me.notify("indexUpdate," + index.getSize() + "," + Config.getIndexDir().getSize());
                        }
                        catch(Exception e){
                            indexStatus = "failed";
                        }
                        doc.setIndexStatus(indexStatus);
                        doc.save();
                    }
                }
                catch(Exception e){
                    //e.printStackTrace();
                }
            }
        }.start();


      //Create index of existing files. Use separate thread so the server doesn't hang
        new Thread(new Runnable() {
            @Override
            public void run() {
                try{
                    index = new FileIndex(Config.getIndexDir());
                    updateIndex();
                }
                catch(Exception e){
                    e.printStackTrace();
                }
            }
        }).start();



        scripts = new ConcurrentHashMap<>();
    }


  //**************************************************************************
  //** createWebSocket
  //**************************************************************************
    public void createWebSocket(HttpServletRequest request, HttpServletResponse response) throws IOException {

        new WebSocketListener(request, response){
            private Long id;
            public void onConnect(){
                id = webSocketID.incrementAndGet();
                synchronized(listeners){
                    listeners.put(id, this);
                }
            }
            public void onDisconnect(int statusCode, String reason){
                synchronized(listeners){
                    listeners.remove(id);
                }
            }
        };
    }


  //**************************************************************************
  //** notify
  //**************************************************************************
    private void notify(String msg){
        synchronized(listeners){
            Iterator<Long> it = listeners.keySet().iterator();
            while(it.hasNext()){
                Long id = it.next();
                WebSocketListener ws = listeners.get(id);
                ws.send(msg);
            }
        }
    }


  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
    public ServiceResponse getServiceResponse(ServiceRequest request, Database database)
            throws ServletException {

        String method = request.getMethod();
        if (method.isBlank()){
            method = request.getRequest().getMethod();
            bluewave.app.User user = (bluewave.app.User) request.getUser();

            if (method.equals("GET")){
                if (request.hasParameter("id")){
                    return getFile(request, user);
                }
                else{
                    return getDocuments(request, database);
                }
            }
            else if (method.equals("POST")){
                Boolean uploadEnabled = Config.get("webserver").get("uploadEnabled").toBoolean();
                if (uploadEnabled==true){
                    return uploadFile(request, user);
                }
                else{
                    return new ServiceResponse(501, "Not implemented");
                }
            }
            else{
                return new ServiceResponse(501, "Not implemented");
            }
        }
        else{
            return super.getServiceResponse(request, database);
        }
    }


  //**************************************************************************
  //** getIndex
  //**************************************************************************
  /** Returns index metadata
   */
    public ServiceResponse getIndex(ServiceRequest request, Database database) throws ServletException {
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (user.getAccessLevel()<5) return new ServiceResponse(401, "Not Authorized");
        javaxt.io.Directory dir = Config.getIndexDir();
        JSONObject json = new JSONObject();
        json.set("path", dir.toString());
        json.set("size", dir.getSize());
        json.set("count", index.getSize());
        return new ServiceResponse(json);
    }


  //**************************************************************************
  //** getDocuments
  //**************************************************************************
  /** Returns a csv document with a list of documents in the database
   */
    private ServiceResponse getDocuments(ServiceRequest request, Database database)
        throws ServletException {

      //Parse request
        Long offset = request.getOffset();
        if (offset==null || offset<0) offset = 0L;
        Long limit = request.getLimit();
        if (limit==null || limit<1) limit = 50L;
        String orderBy = request.getParameter("orderby").toString();
        if (orderBy==null) orderBy = "name";
        String[] q = request.getRequest().getParameterValues("q");
        Boolean remote = request.getParameter("remote").toBoolean();
        if (remote==null) remote = false;


      //Start compiling response
        StringBuilder str = new StringBuilder();
        str.append("id,name,type,date,size");


        if (remote){

            str.append(",info");

            String url = "https://i2ksearch-mig.fda.gov/query/i2k/?version=2.2&wt=json&json.nl=arrarr";
            for (String s : q) url += "&q=" + encode(s);
            url += "&fq=folder_type:" + encode("(PMN)");
            //url += "&fq=!folder_type:" + encode("(DocMan)");
            url+=
            "&start=" + offset +
            "&rows=" + limit +
            "&hl=true&hl.fl=pages&hl.fragsize=85&hl.snippets=4&"; //text highlighting

            javaxt.http.Response response = getResponse(url);
            if (response.getStatus()==200){
                JSONObject json = new JSONObject(response.getText());
                JSONArray docs = json.get("response").get("docs").toJSONArray();
                for (int i=0; i<docs.length(); i++){
                    JSONObject doc = docs.get(i).toJSONObject();
                    String id = doc.get("id").toString();
                    String contentType = doc.get("a_content_type").toString();
                    String folderID = doc.get("folder_id").toString();
                    String folderSubType = doc.get("folder_sub_type").toString();
                    if (folderSubType==null) folderSubType = "UNKNOWN";
                    String name = folderID + "/" + folderSubType + "/" + id + "." + contentType;

                    Long size = doc.get("contentSize").toLong();
                    String dt = doc.get("r_creation_date").toString();
                    JSONArray pages = doc.get("pages").toJSONArray();
                    String highlightFragment = pages.length()==0 ? null : pages.get(0).toString();
                    for (int j=0; j<pages.length(); j++){
                        String page = pages.get(j).toString();
                        if (page==null) continue;
                        boolean foundMatch = false;
                        String p = page.toLowerCase();
                        for (String s : q){
                            int idx = p.indexOf(s.toLowerCase());
                            if (idx>-1){

                                String a = page.substring(0, idx);
                                String b = page.substring(idx, idx+s.length());
                                String c = page.substring(idx+1+s.length());


                                idx = a.lastIndexOf(" ");
                                if (idx>-1){
                                    a = a.substring(idx);
                                    if (a.length()>10) a = a.substring(a.length()-10);
                                }

                                highlightFragment = a + "<b>" + b + "</b>" + c;
                                if (highlightFragment.length()>400) highlightFragment = highlightFragment.substring(0, 400);


                                foundMatch = true;
                                break;
                            }
                        }
                        if (foundMatch){
                            break;
                        }
                    }

                    JSONObject searchMetadata = new JSONObject();
                    //searchMetadata.set("score", score);
                    //searchMetadata.set("frequency", frequency);
                    searchMetadata.set("highlightFragment", highlightFragment);
                    //searchMetadata.set("explainDetails", explainDetails);

                    str.append("\n");
                    str.append(id);
                    str.append(",");
                    str.append(name);
                    str.append(",");
                    str.append("Remote");
                    str.append(",");
                    str.append(dt);
                    str.append(",");
                    str.append(size);
                    str.append(",");
                    str.append(encode(searchMetadata));
                }
            }
            else{
                return new ServiceResponse(500, response.getText());
            }
        }
        else{

          //Compile sql statement
            StringBuilder sql = new StringBuilder();
            sql.append("select document.id, file.name, file.type, file.date, file.size ");
            sql.append("from APPLICATION.FILE JOIN APPLICATION.DOCUMENT ");
            sql.append("ON APPLICATION.FILE.ID=APPLICATION.DOCUMENT.FILE_ID ");
            HashMap<Long, JSONObject> searchMetadata = new HashMap<>();
            if (q!=null){
                try{

                    List<String> searchTerms = new ArrayList<>();
                    for (String s : q) searchTerms.add(s);


                    TreeMap<Float, ArrayList<bluewave.app.Document>> results =
                        index.findDocuments(searchTerms, Math.toIntExact(limit));

                    if (results.isEmpty()){
                        return new ServiceResponse(str.toString());
                    }
                    else{
                        String documentIDs = "";
                        Iterator<Float> it = results.descendingKeySet().iterator();
                        while (it.hasNext()){
                            float score = it.next();
                            ArrayList<bluewave.app.Document> documents = results.get(score);
                            for (bluewave.app.Document document : documents){
                                if (documentIDs.length()>0) documentIDs += ",";
                                documentIDs += document.getID() + "";

                                JSONObject info = document.getInfo();
                                if (info!=null){
                                    JSONObject md = info.get("searchMetadata").toJSONObject();
                                    if (md!=null) searchMetadata.put(document.getID(), md);
                                }
                            }
                        }
                        sql.append("WHERE document.id in (");
                        sql.append(documentIDs);
                        sql.append(")");
                    }
                }
                catch(Exception e){
                    e.printStackTrace();
                    return new ServiceResponse(e);
                }
            }

            if (orderBy!=null) sql.append(" ORDER BY " + orderBy);
            if (offset!=null) sql.append(" OFFSET " + offset);
            sql.append(" LIMIT " + limit);


            if (!searchMetadata.isEmpty()) str.append(",info");


          //Execute query and update response
            Connection conn = null;
            try{
                conn = database.getConnection();
                Recordset rs = new Recordset();
                rs.open(sql.toString(), conn);
                while (rs.hasNext()){
                    str.append("\n");
                    str.append(getString(rs));
                    if (!searchMetadata.isEmpty()) str.append(",");
                    JSONObject md = searchMetadata.get(rs.getValue("id").toLong());
                    str.append(encode(md));
                    rs.moveNext();
                }
                rs.close();
                conn.close();
            }
            catch(Exception e){
                if (conn!=null) conn.close();
                return new ServiceResponse(e);
            }
        }

        return new ServiceResponse(str.toString());
    }

    private String getString(Recordset rs){
        Long id = rs.getValue("id").toLong();
        String name=rs.getValue("name").toString();
        //String type=rs.getValue("type").toString();
        String type = "Local";
        javaxt.utils.Date date = rs.getValue("date").toDate();
        String dt = date==null ? "" : date.toISOString();
        Long size = rs.getValue("size").toLong();
        if (name.contains(",")) name = "\"" + name + "\"";
        return id+","+name+","+type+","+dt+","+size;
    }


  //**************************************************************************
  //** getFile
  //**************************************************************************
  /** Returns a file from the database. Optionally, can be used to return a
   *  url to a remote file
   */
    private ServiceResponse getFile(ServiceRequest request, bluewave.app.User user)
        throws ServletException {

        Boolean remote = request.getParameter("remote").toBoolean();
        if (remote==null) remote = false;

        if (remote){
            String id = request.getParameter("id").toString();
            String url = "https://i2kplus.fda.gov/documentumservice/rest/view/" + id;
            return new ServiceResponse(url);
        }
        else{
            try{
                Long documentID = request.getID();
                bluewave.app.Document document = new bluewave.app.Document(documentID);
                javaxt.io.File file = getFile(document);
                if (!file.exists()) return new ServiceResponse(404);
                else return new ServiceResponse(file);
            }
            catch(Exception e){
                return new ServiceResponse(e);
            }
        }
    }


  //**************************************************************************
  //** getFolder
  //**************************************************************************
  /** Returns a PDF file containing all files in a document "folder"
   */
    public ServiceResponse getFolder(ServiceRequest request, Database database)
        throws ServletException {

        try{

          //Parse params
            String folderName = request.getParameter("name").toString();
            if (folderName==null) return new ServiceResponse(400, "folder is required");
            int idx = folderName.indexOf(".");
            if (idx>0) folderName = folderName.substring(0, idx);
            String fileName = folderName + ".pdf";
            Boolean returnID = request.getParameter("returnID").toBoolean();
            if (returnID==null) returnID = false;


          //Find file in the database and return early if possible
            for (bluewave.app.File f : bluewave.app.File.find("name=",fileName)){
                javaxt.io.File file = new javaxt.io.File(f.getPath().getDir() + f.getName());
                if (file.getName().equalsIgnoreCase(fileName) && file.exists()){
                    if (isValidPDF(file)){
                        notify("createFolder," + folderName + "," + 1 + "," + 1);
                        if (returnID){
                            bluewave.app.Document[] arr = bluewave.app.Document.find("FILE_ID=",f.getID());
                            return new ServiceResponse(arr[0].getID()+"");
                        }
                        else{
                            return new ServiceResponse(file);
                        }
                    }
                }
            }


            javaxt.io.Directory dir = new javaxt.io.Directory(
                getUploadDir().toString() + folderName
            );

            javaxt.io.File file = new javaxt.io.File(dir, fileName);
            if (file.exists() && isValidPDF(file)){
                notify("createFolder," + folderName + "," + 1 + "," + 1);
                if (returnID){
                    //Find file?
                }
                else{
                    return new ServiceResponse(file);
                }
            }



          //Get document IDs associated with the folder
            TreeMap<Long, String> documentIDs = new TreeMap<>();
            String url = "https://i2ksearch-mig.fda.gov/query/i2k/?version=2.2&wt=json&json.nl=arrarr" +
            "&q=folder_id:" + folderName +
            "&fl=id,folder_id,r_creation_date,a_content_type" +
            "&start=0" +
            "&rows=500";

            javaxt.http.Response response = getResponse(url);
            if (response.getStatus()==200){
                JSONObject json = new JSONObject(response.getText());
                JSONArray docs = json.get("response").get("docs").toJSONArray();
                for (int i=0; i<docs.length(); i++){
                    JSONObject doc = docs.get(i).toJSONObject();
                    String id = doc.get("id").toString();
                    String folderID = doc.get("folder_id").toString();
                    String dt = doc.get("r_creation_date").toString();
                    String contentType = doc.get("a_content_type").toString();
                    if (contentType.equalsIgnoreCase("pdf")){
                        documentIDs.put(new javaxt.utils.Date(dt).getTime(), id);
                    }
                }
            }


            int totalSteps = documentIDs.size()+1;
            int step = 0;


          //Get component files
            ArrayList<PDDocument> documents = new ArrayList<>();
            ArrayList<javaxt.io.File> files = new ArrayList<>();
            Iterator<Long> it = documentIDs.keySet().iterator();
            while (it.hasNext()){
                String id = documentIDs.get(it.next());

                javaxt.io.File tempFile = new javaxt.io.File(dir, id);
                try{
                    PDDocument document = downloadPDF(id, tempFile);
                    documents.add(document);
                    files.add(tempFile);
                }
                catch(Exception e){

                  //Try downloading the file again
                    try{
                        tempFile.delete();
                        PDDocument document = downloadPDF(id, tempFile);
                        documents.add(document);
                        files.add(tempFile);
                    }
                    catch(Exception ex){
                        console.log("Invalid PDF", tempFile);
                        tempFile.rename(tempFile.getName() + ".err");
                    }
                }
                step++;
                notify("createFolder," + folderName + "," + step + "," + totalSteps);
            }

            if (documents.isEmpty()){
                return new ServiceResponse(500, "No files were downloaded");
            }


          //Merge files into a single PDF
            if (documents.size()==1){
                file = files.get(0);
            }
            else{

                PDFMergerUtility pdfMergerUtility = new PDFMergerUtility();
                for (PDDocument document : documents){

                    try{

                        PDAcroForm form = document.getDocumentCatalog().getAcroForm();
                        if (form != null) {
                            document.setAllSecurityToBeRemoved(true);
                            try{
                                form.flatten();
                            }
                            catch(Exception e){
                                //e.printStackTrace();
                            }

                            if (form.hasXFA()) {
                                form.setXFA(null);
                            }
                        }

                        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                        document.save(out);
                        java.io.InputStream is = new java.io.ByteArrayInputStream(out.toByteArray());
                        pdfMergerUtility.addSource(is);

                    }
                    catch(Exception e){
                        e.printStackTrace();
                    }
                }

                java.io.OutputStream out = file.getOutputStream();
                pdfMergerUtility.setDestinationStream(out);
                pdfMergerUtility.mergeDocuments(null);
                out.close();
            }

            step++;
            notify("createFolder," + folderName + "," + step + "," + totalSteps);


            if (file.exists() && isValidPDF(file)){


              //Save combined file in the database
                bluewave.app.Path path = getOrCreatePath(file.getDirectory());
                bluewave.app.File f = getOrCreateFile(file, path);
                bluewave.app.Document doc = getOrCreateDocument(f);
                doc.save();


              //Index the file
                synchronized(pool){
                    pool.add(new Object[]{file, path});
                    pool.notify();
                }


              //Return response
                if (returnID){
                    return new ServiceResponse(doc.getID()+"");
                }
                else{
                    return new ServiceResponse(file);
                }

            }
            else{
                return new ServiceResponse(500, "Failed to merge PDF");
            }
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** downloadFile
  //**************************************************************************
  /** Used to download and return a PDF document from a remote server
   */
    private PDDocument downloadPDF(String id, javaxt.io.File file) throws Exception {


        if (!file.exists()){
            file.create();

            String url = "https://i2kplus.fda.gov/documentumservice/rest/view/" + id;
            javaxt.http.Response response = getResponse(url);
            if (response.getStatus()==200){
                java.io.InputStream is = response.getInputStream();
                saveFile(is, file);
                is.close();
            }
        }

        try{
            PDDocument document = PDDocument.load(file.toFile());
            float v = document.getVersion();
            return document;
        }
        catch(Exception e){
            throw new Exception("Invalid PDF " + file);
        }
    }


  //**************************************************************************
  //** isValidPDF
  //**************************************************************************
  /** Returns true if the given file is a valid PDF document
   */
    private boolean isValidPDF(javaxt.io.File file){
        try{
            PDDocument document = PDDocument.load(file.toFile());
            float v = document.getVersion();
            return true;
        }
        catch(Exception e){
            return false;
        }
    }


  //**************************************************************************
  //** uploadFile
  //**************************************************************************
    private ServiceResponse uploadFile(ServiceRequest request, bluewave.app.User user)
        throws ServletException {

        if (user==null || (user.getAccessLevel()<3 && user.getID()!=null)){
            return new ServiceResponse(403, "Not Authorized");
        }

        try{
            JSONArray results = new JSONArray();
            java.util.Iterator<FormInput> it = request.getRequest().getFormInputs();
            while (it.hasNext()){
                FormInput input = it.next();
                String name = input.getName();
                FormValue value = input.getValue();
                if (input.isFile()){

                    JSONObject json = new JSONObject();
                    json.set("name", name);

                    try{
                        uploadFile(name, value.getInputStream(), user);
                        json.set("results", "uploaded");
                    }
                    catch(Exception e){
                        json.set("results", "error");
                    }

                    results.add(json);
                }
            }
            return new ServiceResponse(results);
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** saveFile
  //**************************************************************************
    private void saveFile(java.io.InputStream is, javaxt.io.File tempFile) throws Exception {

        int bufferSize = 2048;
        FileOutputStream output = new FileOutputStream(tempFile.toFile());
        final ReadableByteChannel inputChannel = Channels.newChannel(is);
        final WritableByteChannel outputChannel = Channels.newChannel(output);
        final java.nio.ByteBuffer buffer = java.nio.ByteBuffer.allocateDirect(bufferSize);
        int ttl = 0;

        while (inputChannel.read(buffer) != -1) {
            buffer.flip();
            ttl+=outputChannel.write(buffer);
            buffer.compact();
        }
        buffer.flip();
        while (buffer.hasRemaining()) {
            ttl+=outputChannel.write(buffer);
        }

        //console.log(ttl);

        inputChannel.close();
        outputChannel.close();
    }


  //**************************************************************************
  //** uploadFile
  //**************************************************************************
    private javaxt.io.File uploadFile(String name, java.io.InputStream is, bluewave.app.User user) throws Exception {


      //Create temp file
        javaxt.utils.Date d = new javaxt.utils.Date();
        d.setTimeZone("UTC");
        javaxt.io.File tempFile = new javaxt.io.File(
            getUploadDir().toString() + user.getID() + "/" +
            d.toString("yyyy/MM/dd") + "/" + d.getTime() + ".tmp"
        );
        if (!tempFile.exists()) tempFile.create();



      //Save temp file
        saveFile(is, tempFile);




      //Check whether the file exists
        boolean fileExists = false;
        javaxt.io.File ret = null;
        int bufferSize = 2048;
        String hash = tempFile.getMD5(); //faster than getSHA1()
        for (bluewave.app.File f : bluewave.app.File.find("hash=",hash)){
            javaxt.io.File file = new javaxt.io.File(f.getPath().getDir() + f.getName());
            if (file.getName().equalsIgnoreCase(name) && file.exists()){
                BufferedInputStream file1Reader = new BufferedInputStream(file.getInputStream());
                BufferedInputStream file2Reader = new BufferedInputStream(tempFile.getInputStream());
                byte[] fileBytes1 = new byte[bufferSize];
                byte[] fileBytes2 = new byte[bufferSize];
                boolean fileContentDifferenceFound = false;
                int readFile1 = file1Reader.read(fileBytes1, 0, bufferSize);
                int readFile2 = file2Reader.read(fileBytes2, 0, bufferSize);
                while(
                    readFile1 != -1 && file1Reader.available() != 0 &&
                    readFile2 != -1 && file2Reader.available() != 0 )
                {
                    if(!Arrays.equals(fileBytes1, fileBytes2)) {
                        fileContentDifferenceFound = true;
                        break;
                    }
                    readFile1 = file1Reader.read(fileBytes1, 0, bufferSize);
                    readFile2 = file2Reader.read(fileBytes2, 0, bufferSize);
                }

                fileExists = !fileContentDifferenceFound;

                if (fileExists) ret = file;
            }
        }


      //Rename or delete the temp file
        if (fileExists){
            tempFile.delete();
            return ret;
        }
        else{

          //Rename the temp file
            javaxt.io.File file = tempFile.rename(name);


          //Save the file in the database
            bluewave.app.Path path = getOrCreatePath(file.getDirectory());
            bluewave.app.File f = getOrCreateFile(file, path);
            bluewave.app.Document doc = getOrCreateDocument(f);
            doc.save();


          //Index the file
            synchronized(pool){
                pool.add(new Object[]{file, path});
                pool.notify();
            }


          //Return file
            return file;
        }
    }


  //**************************************************************************
  //** getThumbnail
  //**************************************************************************
    public ServiceResponse getThumbnail(ServiceRequest request, Database database)
        throws ServletException {

      //Get user
        bluewave.app.User user = (bluewave.app.User) request.getUser();


      //Parse request
        Long documentID = request.getParameter("documentID").toLong();
        if (documentID==null) return new ServiceResponse(400, "documentID is required");
        String pages = request.getParameter("pages").toString();
        if (pages==null || pages.isBlank()) pages = request.getParameter("page").toString();
        if (pages==null || pages.isBlank()) return new ServiceResponse(400, "page or pages are required");


      //Get file
        javaxt.io.File file;
        try{
            bluewave.app.Document document = new bluewave.app.Document(documentID);
            file = getFile(document);
            if (!file.exists()) return new ServiceResponse(404);
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }


      //Set output directory
        javaxt.io.Directory outputDir = new javaxt.io.Directory(file.getDirectory()+file.getName(false));
        if (!outputDir.exists()) outputDir.create();

      //Get script
        javaxt.io.File[] scripts = getScriptDir().getFiles("pdf_to_img.py", true);
        if (scripts.length==0) return new ServiceResponse(500, "Script not found");


      //Compile command line options
        ArrayList<String> params = new ArrayList<>();
        params.add("-f");
        params.add(file.toString());
        params.add("-p");
        params.add(pages);
        params.add("-o");
        params.add(outputDir.toString());


      //Execute script
        try{
            executeScript(scripts[0], params);
            String[] arr = pages.split(",");
            javaxt.io.File f = new javaxt.io.File(outputDir, arr[0]+".png");
            return new ServiceResponse(f);
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getSimilarity
  //**************************************************************************
    public ServiceResponse getSimilarity(ServiceRequest request, Database database)
        throws ServletException {

        bluewave.app.User user = (bluewave.app.User) request.getUser();


      //Get requested document IDs
        String[] documentIDs = request.getParameter("documents").toString().split(",");
        if (documentIDs == null || documentIDs.length<2)
            return new ServiceResponse(400, "At least 2 documents are required");


      //Get python script
        String scriptName = "compare_pdfs.py";
        javaxt.io.File[] scripts = getScriptDir().getFiles(scriptName, true);
        if (scripts.length==0) return new ServiceResponse(500, "Script not found");
        javaxt.io.File script = scripts[0];


      //Get script verion
        String scriptVersion = null;
        long lastModified = script.getDate().getTime();
        synchronized(this.scripts){
            try{
                JSONObject info = this.scripts.get(script.getName());
                if (info==null){
                    info = new JSONObject();
                    info.set("lastModified", lastModified);
                    info.set("version", getScriptVersion(script));
                    this.scripts.put(scriptName, info);
                }
                else{
                    if (lastModified>info.get("lastModified").toLong()){
                        info.set("lastModified", lastModified);
                        info.set("version", getScriptVersion(script));
                    }
                }

                scriptVersion = info.get("version").toString();
            }
            catch(Exception e){
                //Failed to get version
            }
            this.scripts.notifyAll();
        }



      //Check cache
        ArrayList<bluewave.app.DocumentComparison> docs = new ArrayList<>();
        if (documentIDs.length==2){
            String cacheQuery =
            "select ID, INFO from APPLICATION.DOCUMENT_COMPARISON " +
            "where (A_ID="+documentIDs[0]+" AND B_ID="+documentIDs[1]+") " +
               "OR (A_ID="+documentIDs[1]+" AND B_ID="+documentIDs[0]+")";

            Connection conn = null;
            try {

              //Execute query
                HashMap<Long, String> results = new HashMap<>();
                conn = database.getConnection();
                Recordset rs = new Recordset();
                rs.open(cacheQuery, conn);
                while (rs.hasNext()){
                    Long id = rs.getValue("ID").toLong();
                    String info = rs.getValue("INFO").toString();
                    results.put(id, info);
                    rs.moveNext();
                }
                rs.close();
                conn.close();


              //Parse json and return results if appropriate
                Iterator<Long> it = results.keySet().iterator();
                while (it.hasNext()){
                    Long id = it.next();
                    String info = results.get(id);
                    if (info!=null){
                        JSONObject result = new JSONObject(info);
                        String version = result.get("version").toString();
                        if (version!=null){
                            if (version.equals(scriptVersion)){
                                return new ServiceResponse(result);
                            }
                        }
                    }
                }


              //Get current DocumentComparison from the database
                it = results.keySet().iterator();
                while (it.hasNext()){
                    docs.add(new bluewave.app.DocumentComparison(it.next()));
                }
            }
            catch(Exception e) {
                if(conn!=null) conn.close();
                return new ServiceResponse(e);
            }
        }


      //Generate list of files and documents
        ArrayList<javaxt.io.File> files = new ArrayList<>();
        ArrayList<bluewave.app.Document> documents = new ArrayList<>();
        for (String str : documentIDs){
            try{
                Long documentID = Long.parseLong(str);
                bluewave.app.Document document = new bluewave.app.Document(documentID);
                bluewave.app.File file = document.getFile();
                bluewave.app.Path path = file.getPath();
                javaxt.io.Directory dir = new javaxt.io.Directory(path.getDir());
                files.add(new javaxt.io.File(dir, file.getName()));
                documents.add(document);
            }
            catch(Exception e){
                return new ServiceResponse(e);
            }
        }
        if (files.size()<2) return new ServiceResponse(400, "At least 2 documents are required");




      //Compile command line options
        ArrayList<String> params = new ArrayList<>();
        params.add("-f");
        for (javaxt.io.File file : files){
            params.add(file.toString());
        }


      //Execute script and return response
        try{

          //Execute script
            JSONObject result = executeScript(script, params);


          //Replace file paths and insert documentID
            JSONArray arr = result.get("files").toJSONArray();
            for (int i=0; i<arr.length(); i++){
                JSONObject json = arr.get(i).toJSONObject();
                String fileName = json.get("filename").toString();
                String filePath = json.get("path_to_file").toString();
                javaxt.io.File f = new javaxt.io.File(filePath, fileName);
                bluewave.app.Document document = null;
                for (int j=0; j<files.size(); j++){
                    javaxt.io.File file = files.get(j);
                    if (file.toString().replace("\\", "/").equals(f.toString().replace("\\", "/"))){
                        document = documents.get(j);
                        break;
                    }
                }
                json.set("document_id", document.getID());
                json.remove("path_to_file");
            }



          //Cache the results
            if (documents.size()==2){

                if (docs.isEmpty()){
                    bluewave.app.DocumentComparison dc = new bluewave.app.DocumentComparison();
                    dc.setA(documents.get(0));
                    dc.setB(documents.get(1));
                    docs.add(dc);
                }

                for (bluewave.app.DocumentComparison dc : docs){
                    dc.setInfo(result);
                    dc.save();
                }
            }


          //Return response
            return new ServiceResponse(result);
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getFile
  //**************************************************************************
    private static javaxt.io.File getFile(bluewave.app.Document document){
        bluewave.app.File f = document.getFile();
        bluewave.app.Path path = f.getPath();
        javaxt.io.Directory dir = new javaxt.io.Directory(path.getDir());
        return new javaxt.io.File(dir, f.getName());
    }


  //**************************************************************************
  //** getUploadDir
  //**************************************************************************
    private static javaxt.io.Directory getUploadDir(){

        javaxt.io.Directory uploadDir = Config.getDirectory("webserver", "uploadDir");
        if (uploadDir==null) {
            javaxt.io.Directory jobDir = Config.getDirectory("webserver", "jobDir");
            if (jobDir!=null){
                uploadDir = new javaxt.io.Directory(jobDir.toString() + "uploads");
                uploadDir.create();
            }
        }
        else{
            uploadDir.create();
        }

        if (uploadDir==null || !uploadDir.exists()){
            throw new IllegalArgumentException("Invalid \"jobDir\" defined in the \"webserver\" section of the config file");
        }
        return uploadDir;
    }


  //**************************************************************************
  //** getOrCreatePath
  //**************************************************************************
    private bluewave.app.Path getOrCreatePath(javaxt.io.Directory dir){
        String p = dir.toString();

        try{
            return bluewave.app.Path.find("dir=", p)[0];
        }
        catch(Exception e){
        }

        try{
            bluewave.app.Path path = new bluewave.app.Path();
            path.setDir(p);
            path.save();
            path.getID();
            return path;
        }
        catch(Exception e){
        }

        return null;
    }


  //**************************************************************************
  //** getOrCreateFile
  //**************************************************************************
    private bluewave.app.File getOrCreateFile(javaxt.io.File file, bluewave.app.Path path){
        try{
            return bluewave.app.File.find(
                "name=", file.getName(),
                "path_id=", path.getID()
            )[0];
        }
        catch(Exception e){
        }

        try{
            bluewave.app.File f = new bluewave.app.File();
            f.setName(file.getName());
            f.setSize(file.getSize());
            f.setDate(new javaxt.utils.Date(file.getDate()));
            f.setType(file.getContentType());
            f.setHash(file.getMD5());
            f.setPath(path);
            f.save();
            return f;
        }
        catch(Exception e){
        }
        return null;
    }


  //**************************************************************************
  //** getOrCreateDocument
  //**************************************************************************
    private bluewave.app.Document getOrCreateDocument(bluewave.app.File f){

        try{
            return bluewave.app.Document.find(
                "file_id=", f.getID()
            )[0];
        }
        catch(Exception e){
        }


        try{
            bluewave.app.Document doc = new bluewave.app.Document();
            doc.setFile(f);
            doc.save();
            return doc;
        }
        catch(Exception e){
        }

        return null;
    }


  //**************************************************************************
  //** encode
  //**************************************************************************
  /** Returns a csv-safe version of a JSON object
   */
    private String encode(JSONObject md) {
        try{
            if (md!=null){
                return encode(md.toString());
            }
        }
        catch(Exception e){}
        return null;
    }

    private String encode(String s){
        try{
            return (java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20"));
        }
        catch(Exception e){}
        return null;
    }


  //**************************************************************************
  //** getResponse
  //**************************************************************************
  /** Returns a HTTP response from a remote document server (Image2000)
   */
    private javaxt.http.Response getResponse(String url){
        String edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36 Edg/99.0.1150.30";
        javaxt.http.Request r = new javaxt.http.Request(url);
        r.setConnectTimeout(5000);
        r.setReadTimeout(5000);
        r.validateSSLCertificates(false);
        r.setHeader("User-Agent", edge);
        r.setNumRedirects(0);
        javaxt.http.Response response = r.getResponse();
        if (response.getStatus()==200) return response;
        else{
            String cookie = response.getHeader("Set-Cookie");
            if (cookie!=null){
                r = new javaxt.http.Request(url);
                r.setConnectTimeout(5000);
                r.setReadTimeout(5000);
                r.validateSSLCertificates(false);
                r.setHeader("User-Agent", edge);
                r.setNumRedirects(0);
                r.setHeader("Cookie", cookie);
                response = r.getResponse();
                if (response.getStatus()==200) return response;
                //else console.log(r);
            }
            return response;
        }
    }


  //**************************************************************************
  //** getRemoteSearchStatus
  //**************************************************************************
    public ServiceResponse getRemoteSearchStatus(ServiceRequest request, Database database) throws ServletException {
        Boolean remoteSearch = Config.get("webserver").get("remoteSearch").toBoolean();
        return new ServiceResponse(remoteSearch == null ? "false" : remoteSearch +"");
    }


  //**************************************************************************
  //** getRefreshDocumentIndex
  //**************************************************************************
    public ServiceResponse getRefreshDocumentIndex(ServiceRequest request, Database database) throws ServletException {
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (user.getAccessLevel()<5) return new ServiceResponse(401, "Not Authorized");
        try {
           updateIndex();
           return new ServiceResponse(200);
        }
        catch(Exception e) {
           return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** updateIndex
  //**************************************************************************
  /** Used to add/remove items from the index
   */
    private void updateIndex() throws Exception {

      //Remove any docs that might have been moved or deleted from the upload directory
        for (bluewave.app.Document doc : bluewave.app.Document.find()){
            bluewave.app.File f = doc.getFile();
            javaxt.io.Directory dir = new javaxt.io.Directory(f.getPath().getDir());
            javaxt.io.File file = new javaxt.io.File(dir, f.getName());
            if (!file.exists()){


              //Remove any document comparisons associated with the file
                Long docId = doc.getID();
                Map<String, Long> constraints = new HashMap<>();
                constraints.put("a_id=", docId);
                constraints.put("b_id=", docId);
                for (bluewave.app.DocumentComparison dc : bluewave.app.DocumentComparison.find(constraints)){
                    dc.delete();
                }


              //Remove document from the database
                doc.delete();


              //Remove from index
                index.removeFile(file);
                notify("indexUpdate," + index.getSize() + "," + Config.getIndexDir().getSize());
            }
        }


      //Add new documents to the index
        HashMap<javaxt.io.Directory, bluewave.app.Path> paths = new HashMap<>();
        for (javaxt.io.File file : getUploadDir().getFiles("*.pdf", true)){
            javaxt.io.Directory dir = file.getDirectory();
            bluewave.app.Path path = paths.get(dir);
            if (path==null) path = getOrCreatePath(dir);
            if (path!=null){
                paths.put(dir, path);
                pool.add(new Object[]{file, path});
            }
        }

    }
}