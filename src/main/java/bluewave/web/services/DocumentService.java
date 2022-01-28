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
                    javaxt.io.File file = (javaxt.io.File) obj;
                    if (index!=null) index.addFile(file);
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
                    for (javaxt.io.File file : getUploadDir().getFiles("*.pdf", true)){
                        pool.add(file);
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
                    return getFiles(request, user);
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
  //** getFiles
  //**************************************************************************
  /** Returns a csv document with a list of files
   */
    private ServiceResponse getFiles(ServiceRequest request, bluewave.app.User user)
        throws ServletException {

        Integer limit = Math.toIntExact(request.getLimit());
        if (limit==null || limit<1) limit = 50;

        StringBuilder str = new StringBuilder();
        str.append("name,type,date,size");

        String q = request.getParameter("q").toString();
        if (q==null){

            int numItems = 0;
            javaxt.io.Directory dir = getUploadDir();
            for (Object obj : dir.getChildren(true, "*.pdf")){
                if (obj instanceof javaxt.io.File){
                    javaxt.io.File f = (javaxt.io.File) obj;
                    str.append("\n");
                    str.append(getString(f));
                    numItems++;
                }
                else if (obj instanceof javaxt.io.Directory){
                    javaxt.io.Directory d = (javaxt.io.Directory) obj;
                    String name=d.getName();
                    String type="d";
                    java.util.Date date = d.getDate();
                    Long size = -1L;
                }

                if (numItems==limit) break;
            }
            return new ServiceResponse(str.toString());
        }
        else{
            try{

                ArrayList<String> searchTerms = new ArrayList<>();
                searchTerms.add(q);

                TreeMap<Float, ArrayList<javaxt.io.File>> results = index.findFiles(searchTerms, limit);
                Iterator<Float> it = results.descendingKeySet().iterator();
                while (it.hasNext()){
                    float score = it.next();
                    ArrayList<javaxt.io.File> files = results.get(score);
                    for (javaxt.io.File file : files){
                        str.append("\n");
                        str.append(getString(file));
                    }
                }
                return new ServiceResponse(str.toString());
            }
            catch(Exception e){
                return new ServiceResponse(e);
            }
        }
    }

    private String getString(javaxt.io.File f){
        String name=f.getName();
        String type="f";
        java.util.Date date = f.getDate();
        Long size = f.getSize();
        if (name.contains(",")) name = "\"" + name + "\"";
        return name+","+type+","+new javaxt.utils.Date(date).toISOString()+","+size;
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
                            pool.add(file);

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
        for (String fileName : request.getParameter("files").toString().split(",")){
            javaxt.io.File file = getFile(fileName, user);
            if (file.exists()) files.add(file);
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
        return jobDir;
    }
}