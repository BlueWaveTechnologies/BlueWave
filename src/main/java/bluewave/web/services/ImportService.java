package bluewave.web.services;
import bluewave.graph.Neo4J;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;

import javaxt.sql.Database;

public class ImportService extends WebService {


    private Neo4J graph;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ImportService(Neo4J graph){
        this.graph = graph;
    }


  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
  /** Returns data associated with the path in the ServiceRequest
   */
    public ServiceResponse getServiceResponse(ServiceRequest request, Database database) throws ServletException {

      //Get user associated with the request
        bluewave.app.User user = (bluewave.app.User) request.getUser();


      //Prevent non-admin users from importing
        if (user.getAccessLevel()<5) throw new ServletException(403, "Not Authorized");



      //Parse path
        String path = request.getParameter("path").toString();
        if (path!=null) path = path.replace("\\", "/").trim();
        if (path==null || path.isEmpty()) return new ServiceResponse(400, "path is required");



      //Get file and extension
        javaxt.io.File file = new javaxt.io.File(path);
        if (!file.exists()) return new ServiceResponse(400, "path is invalid");
        String fileType = file.getExtension().toLowerCase();


      //Get node type
        String nodeType = request.getParameter("node").toString();
        if (nodeType==null) nodeType = request.getParameter("vertex").toString();
        if (nodeType==null) return new ServiceResponse(400, "node or vertex is required");


      //Get unique keys
        Integer[] keys = null;
        if (request.hasParameter("keys")){
            String[] arr = request.getParameter("keys").toString().split(",");
            keys = new Integer[arr.length];
            for (int i=0; i<arr.length; i++){
                keys[i] = Integer.parseInt(arr[i]);
            }
        }


      //Import file
        try{
            if (fileType.equals("csv")){
                bluewave.graph.Import.importCSV(file, nodeType, keys, graph);
            }
            else if (fileType.equals("json")){
                String target = request.getParameter("target").toString();
                bluewave.graph.Import.importJSON(file, nodeType, target, graph);
            }
            else{
                return new ServiceResponse(400, "unsupported file type");
            }
            return new ServiceResponse(200);
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }

    }

}