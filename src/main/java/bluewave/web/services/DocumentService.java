package bluewave.web.services;
import javaxt.express.*;
import javaxt.http.servlet.ServletException;
import javaxt.http.servlet.FormInput;
import javaxt.http.servlet.FormValue;
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
  //** getSettings
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
                    console.log(name);
                    //images.put(name, new javaxt.io.Image(value.getInputStream()));
                    JSONObject json = new JSONObject();
                    results.add(json);
                }
            }


            return new ServiceResponse(results);

        }
        catch(Exception e){
            return new ServiceResponse(e);
        }


    }

}