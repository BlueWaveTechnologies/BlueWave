package bluewave.web.services;
import bluewave.Config;
import java.io.FileOutputStream;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.nio.channels.WritableByteChannel;
import javaxt.http.servlet.ServletException;
import javaxt.http.servlet.FormInput;
import javaxt.http.servlet.FormValue;
import javaxt.express.*;
import javaxt.sql.*;
import javaxt.json.*;


public class DocumentService extends WebService {

  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
    public ServiceResponse getServiceResponse(ServiceRequest request, Database database) throws ServletException {
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (request.getRequest().getMethod().equals("POST")){
            return uploadFile(request, user);
        }
        else{
            return new ServiceResponse(501, "Not implemented");
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
  //** getFile
  //**************************************************************************
    private static javaxt.io.File getFile(String name, bluewave.app.User user){
        return new javaxt.io.File(getUploadDir(), name);
    }


  //**************************************************************************
  //** getUploadDir
  //**************************************************************************
    private static javaxt.io.Directory getUploadDir(){
        JSONObject config = Config.get("webserver").toJSONObject();
        javaxt.io.Directory jobDir = null;
        if (config.has("jobDir")){
            String dir = config.get("jobDir").toString().trim();
            if (dir.length()>0){
                jobDir = new javaxt.io.Directory(dir);
                jobDir = new javaxt.io.Directory(jobDir.toString() + "uploads");
                jobDir.create();
            }
        }
        if (jobDir==null || !jobDir.exists()){
            throw new IllegalArgumentException("Invalid \"jobDir\" defined in the \"webserver\" section of the config file");
        }
        return jobDir;
    }

}