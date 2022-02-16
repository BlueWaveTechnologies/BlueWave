package bluewave.web.services;
import bluewave.Config;
import bluewave.utils.FileIndex;
import static bluewave.utils.Python.*;

import java.util.*;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.nio.channels.WritableByteChannel;
import java.sql.SQLException;
import java.util.concurrent.ConcurrentHashMap;

import javaxt.http.servlet.ServletException;
import javaxt.http.servlet.FormInput;
import javaxt.http.servlet.FormValue;
import javaxt.utils.ThreadPool;
import javaxt.express.*;
import javaxt.sql.*;
import javaxt.json.*;


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


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public DocumentService(){

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
                            doc.setIndexStatus("indexed");
                        }
                        catch(Exception e){
                            doc.setIndexStatus("failed");
                        }
                        doc.save();
                    }
                }
                catch(Exception e){
                    //e.printStackTrace();
                }
            }
        }.start();


      //Create index of existing files. Use separate thread so the server doesn't hang
        try{
            index = new FileIndex(Config.getIndexDir());
            new Thread(new Runnable() {
                @Override
                public void run() {
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
            }).start();
        }
        catch(Exception e){
        }


        scripts = new ConcurrentHashMap<>();
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
                String fileName = request.getParameter("fileName").toString();
                if (fileName!=null){
                    return getFile(request, user);
                }
                else{
                    return getDocuments(request, database);
                }
            }
            else if (method.equals("POST")){
                return uploadFile(request, user);
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
  //** getDocuments
  //**************************************************************************
  /** Returns a csv document with a list of documents in the database
   */
    private ServiceResponse getDocuments(ServiceRequest request, Database database)
        throws ServletException {

      //Parse request
        Long offset = request.getOffset();
        Long limit = request.getLimit();
        if (limit==null || limit<1) limit = 50L;
        String orderBy = request.getParameter("orderby").toString();
        if (orderBy==null) orderBy = "name";
        String q = request.getParameter("q").toString();


      //Start compileing response
        StringBuilder str = new StringBuilder();
        str.append("id,name,type,date,size");


      //Compile sql statement
        StringBuilder sql = new StringBuilder();
        sql.append("select document.id, file.name, file.type, file.date, file.size ");
        sql.append("from APPLICATION.FILE JOIN APPLICATION.DOCUMENT ");
        sql.append("ON APPLICATION.FILE.ID=APPLICATION.DOCUMENT.FILE_ID ");
        if (q!=null){
            try{

                List<String> searchTerms = Arrays.asList(q.split(" "));

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


      //Execute query and update response
        Connection conn = null;
        try{
            conn = database.getConnection();
            Recordset rs = new Recordset();
            rs.open(sql.toString(), conn);
            JSONArray arr = new JSONArray();
            while (rs.hasNext()){
                str.append("\n");
                str.append(getString(rs));
                rs.moveNext();
            }
            rs.close();
            conn.close();
        }
        catch(Exception e){
            if (conn!=null) conn.close();
            return new ServiceResponse(e);
        }

        return new ServiceResponse(str.toString());
    }

    private String getString(Recordset rs){
        Long id = rs.getValue("id").toLong();
        String name=rs.getValue("name").toString();
        String type=rs.getValue("type").toString();
        javaxt.utils.Date date = rs.getValue("date").toDate();
        String dt = date==null ? "" : date.toISOString();
        Long size = rs.getValue("size").toLong();
        if (name.contains(",")) name = "\"" + name + "\"";
        return id+","+name+","+type+","+dt+","+size;
    }



  //**************************************************************************
  //** getFile
  //**************************************************************************
    private ServiceResponse getFile(ServiceRequest request, bluewave.app.User user)
            throws ServletException {

        String fileName = request.getParameter("fileName").toString();
        javaxt.io.File file = getFile(fileName, user);
        if (file.exists()){
            return new ServiceResponse(file);
        }
        else{
            return new ServiceResponse(404);
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
                console.log("New filename: "+ name);
                FormValue value = input.getValue();
                if (input.isFile()){
                    JSONObject json = new JSONObject();
                    json.set("name", name);


                  //Create temp file
                    javaxt.utils.Date d = new javaxt.utils.Date();
                    d.setTimeZone("UTC");
                    javaxt.io.File tempFile = new javaxt.io.File(
                        getUploadDir().toString() + user.getID() + "/" +
                        d.toString("yyyy/MM/dd") + "/" + d.getTime() + ".tmp"
                    );
                    if (!tempFile.exists()) tempFile.create();

                    try{

                      //Save temp file
                        int bufferSize = 2048;
                        FileOutputStream output = new FileOutputStream(tempFile.toFile());
                        final ReadableByteChannel inputChannel = Channels.newChannel(value.getInputStream());
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



                      //Check whether the file exists
                        boolean fileExists = false;
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
                            }
                        }


                      //Rename or delete the temp file
                        if (fileExists){
                            tempFile.delete();
                            json.set("result", "exists");
                        }
                        else{

                          //Rename the temp file
                            javaxt.io.File file = tempFile.rename(name);

                          //Save and Index the file
                            addFile(file);

                            //Set response
                            json.set("result", "uploaded");
                            
                        }
                    }
                    catch(Exception e){
                        //e.printStackTrace();
                        json.set("result", "error");
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
  //** addFile 
  //  Adds file to DB and Index
  //**************************************************************************
    private void addFile(javaxt.io.File file) throws SQLException {
            //Save the file in the database
            bluewave.app.Path path = getOrCreatePath(file.getDirectory());
            bluewave.app.File f = getOrCreateFile(file, path);
            bluewave.app.Document doc = getOrCreateDocument(f);
            doc.save();

            //Index the file
            pool.add(new Object[]{file, path});
    }


  //**************************************************************************
  //** searchImage2000
  //**************************************************************************
    public ServiceResponse searchImage2000(ServiceRequest request, Database database)
        throws ServletException {

        //Get user
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        String kNumber = request.getParameter("k").toString().trim();

        //Get script
        // TODO: confirm this script has the search-only feature in place
        javaxt.io.File[] scripts = getScriptDir().getFiles("api_download.py", true);
        if (scripts.length==0) return new ServiceResponse(500, "Script not found");

        //Compile command line options
        // TODO: Confirm the params for the search feature
        ArrayList<String> params = new ArrayList<>();
        params.add("-k");
        params.add(kNumber);
        params.add("-u");
        params.add(user.getUsername());

        //Execute script
        try{
            JSONObject result = executeScript(scripts[0], params);
            

        return new ServiceResponse(result);
        }
            catch(Exception e){
            return new ServiceResponse(e);
        }
}


  //**************************************************************************
  //** downloadImage2000Document
  // Precondition - confirm that the requested file does not exist in index
  //**************************************************************************
    public ServiceResponse downloadImage2000Document(ServiceRequest request, Database database)
            throws ServletException {

      //Get user
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        String kNumber = request.getParameter("k").toString().trim();

      //Get script
        javaxt.io.File[] scripts = getScriptDir().getFiles("api_download.py", true);
        if (scripts.length==0) return new ServiceResponse(500, "Script not found");


      //Compile command line options
        ArrayList<String> params = new ArrayList<>();
        params.add("-k");
        params.add(kNumber);
        params.add("-u");
        params.add(user.getUsername());
        params.add("-o");
        params.add(getUploadDir().toString());

      //Execute script
        try{
            JSONObject result = executeScript(scripts[0], params);
            if(!kNumber.contains(".pdf"))
                kNumber+= ".pdf";

            javaxt.io.File kNumberFile = new javaxt.io.File(
                    getUploadDir().toString() + kNumber);

            addFile(kNumberFile);

            return new ServiceResponse(result);
        }
        catch(Exception e){
            return new ServiceResponse(e);
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
            bluewave.app.File f = document.getFile();
            bluewave.app.Path path = f.getPath();
            javaxt.io.Directory dir = new javaxt.io.Directory(path.getDir());
            file = new javaxt.io.File(dir, f.getName());
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

        try{

          //Execute script
            JSONObject result = executeScript(scripts[0], params);
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
    private static javaxt.io.File getFile(String name, bluewave.app.User user){
        return new javaxt.io.File(getUploadDir(), name);
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
}