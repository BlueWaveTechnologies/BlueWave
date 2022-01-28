package bluewave.web.services;
import bluewave.Config;
import bluewave.utils.FileIndex;
import static bluewave.utils.Python.*;

import java.util.*;
import java.io.FileOutputStream;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.nio.channels.WritableByteChannel;

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
            index = new FileIndex(getIndexDir().toString());
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


      //Compile sql statement
        StringBuilder sql = new StringBuilder();
        sql.append("select document.id, file.name, file.type, file.date, file.size ");
        sql.append("from APPLICATION.FILE JOIN APPLICATION.DOCUMENT ");
        sql.append("ON APPLICATION.FILE.ID=APPLICATION.DOCUMENT.FILE_ID ");
        if (q!=null){
            try{

                ArrayList<String> searchTerms = new ArrayList<>();
                searchTerms.add(q);

                TreeMap<Float, ArrayList<bluewave.app.Document>> results =
                    index.findDocuments(searchTerms, Math.toIntExact(limit));

                if (!results.isEmpty()){
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


      //Execute query and generate response
        StringBuilder str = new StringBuilder();
        str.append("id,name,type,date,size");
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
        if (user==null || user.getAccessLevel()<3) return new ServiceResponse(403, "Not Authorized");

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

                    javaxt.io.File file = getFile(name, user);
                    if (!file.exists()){
                        try{
                            int bufferSize = 2048;
                            FileOutputStream output = new FileOutputStream(file.toFile());
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


                          //Index the file
                            bluewave.app.Path path = getOrCreatePath(file.getDirectory());
                            pool.add(new Object[]{file, path});


                            json.set("result", "uploaded");
                        }
                        catch(Exception e){
                            json.set("result", "error");
                        }
                    }
                    else{
                        json.set("result", "exists");
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
    //** getThumbnail
    //**************************************************************************
    public ServiceResponse getThumbnail(ServiceRequest request, Database database)
            throws ServletException {

        //Get user
        bluewave.app.User user = (bluewave.app.User) request.getUser();

        //Get file
        String fileName = request.getParameter("fileName").toString();
        if (fileName==null || fileName.isBlank()) fileName = request.getParameter("file").toString();
        if (fileName==null || fileName.isBlank()) return new ServiceResponse(400, "file or fileName is required");
        javaxt.io.File file = getFile(fileName, user);
        if (!file.exists()) return new ServiceResponse(404);

        //Get pages
        String pages = request.getParameter("pages").toString();
        if (pages==null || pages.isBlank()) pages = request.getParameter("page").toString();
        if (pages==null || pages.isBlank()) return new ServiceResponse(400, "page or pages are required");

        //Get output directory
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

      //Get files
        ArrayList<javaxt.io.File> files = new ArrayList<>();
        for (String documentID : request.getParameter("documents").toString().split(",")){
            try{
                bluewave.app.Document document = new bluewave.app.Document(Long.parseLong(documentID));
                bluewave.app.File file = document.getFile();
                bluewave.app.Path path = file.getPath();
                javaxt.io.Directory dir = new javaxt.io.Directory(path.getDir());
                files.add(new javaxt.io.File(dir, file.getName()));
            }
            catch(Exception e){
            }
        }
        if (files.size()<2) return new ServiceResponse(400,
            "At least 2 documents are required");


      //Get script
        javaxt.io.File[] scripts = getScriptDir().getFiles("compare_pdfs.py", true);
        if (scripts.length==0) return new ServiceResponse(500, "Script not found");


        //Compile command line options
        ArrayList<String> params = new ArrayList<>();
        params.add("-f");
        for (javaxt.io.File file : files){
            params.add(file.toString());
        }


      //Execute script
        try{
            return new ServiceResponse(executeScript(scripts[0], params));
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
  //** getIndexDir
  //**************************************************************************
    private static javaxt.io.Directory getIndexDir() {
        javaxt.io.Directory indexDir = null;
        javaxt.io.Directory jobDir = Config.getDirectory("webserver", "jobDir");
        if (jobDir!=null){
            indexDir = new javaxt.io.Directory(jobDir.toString() + "index");
            indexDir.create();
        }
        if (indexDir==null || !indexDir.exists()){
            throw new IllegalArgumentException("Invalid \"jobDir\" defined in the \"webserver\" section of the config file");
        }
        return indexDir;
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