package bluewave.web;
import bluewave.Config;
import bluewave.Plugin;
import bluewave.graph.Neo4J;
import bluewave.web.services.*;
import bluewave.utils.SQLEditor;

import javaxt.express.*;
import javaxt.http.servlet.HttpServletRequest;
import javaxt.http.servlet.HttpServletResponse;
import javaxt.http.servlet.ServletException;
import javaxt.json.JSONObject;
import javaxt.io.Jar;
import javaxt.sql.*;

import javaxt.http.websocket.WebSocketListener;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.io.IOException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;


//XML parser for plugins
import static javaxt.xml.DOM.*;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;



public class WebServices extends WebService {

    private Database database;
    private ConcurrentHashMap<String, WebService> webservices;
    private DashboardService dashboardService;

    private ConcurrentHashMap<Long, WebSocketListener> listeners;
    private static AtomicLong webSocketID;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public WebServices(javaxt.io.Directory web, JSONObject webConfig) throws Exception {

      //Register models that this service will support
        for (Class c : new Jar(this).getClasses()){
            if (javaxt.sql.Model.class.isAssignableFrom(c)){
                addClass(c);
            }
        }

      //Get graph
        Neo4J graph = Config.getGraph(null);

      //Get local database
        database = Config.getDatabase();


      //Sync bluewave user accounts with the graph database
        if (graph!=null){
            try{
                bluewave.graph.Maintenance.syncUsers(graph);
            }
            catch(Exception e){
            }
        }



      //Instantiate web services
        dashboardService = new DashboardService(this, web, database);
        webservices = new ConcurrentHashMap<>();
        webservices.put("admin", new AdminService(database, webConfig));
        webservices.put("map", new MapService());
        webservices.put("report", new ReportService());
        webservices.put("data", new DataService(new javaxt.io.Directory(web + "data")));
        webservices.put("query", new QueryService(webConfig));


      //Special case for the document service
        DocumentService documentService = new DocumentService();
        webservices.put("document", documentService);
        webservices.put("documents", documentService);


      //Instantiate additional webservices
        if (graph!=null){
            webservices.put("graph", new GraphService());
            webservices.put("import", new ImportService());
            loadPlugins();
        }
        else{
            console.log("Graph services offline");
        }



      //Websocket stuff
        webSocketID = new AtomicLong(0);
        listeners = new ConcurrentHashMap<>();
    }


  //**************************************************************************
  //** processRequest
  //**************************************************************************
  /** Used to process an HTTP request and generate an HTTP response.
   *  @param service The first "directory" found in the path, after the
   *  servlet context.
   */
    protected void processRequest(String service, HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {


        if (request.isWebSocket()){
            createWebSocket(service, request, response);
        }
        else{

          //Send response to the client
            ServiceResponse serviceResponse = getServiceResponse(service, request);
            int status = serviceResponse.getStatus();
            if (status==304){
                response.setStatus(304);
            }
            else if (status==307){
                response.setStatus(307);
                String location = new String((byte[]) serviceResponse.getResponse());
                response.setHeader("Location", location);
                String msg =
                "<head>" +
                "<title>Document Moved</title>" +
                "</head>" +
                "<body>" +
                "<h1>Object Moved</h1>" +
                "This document may be found <a href=\"" + location + "\">here</a>" +
                "</body>";
                response.write(msg);
            }
            else{

              //Set general response headers
                response.setContentType(serviceResponse.getContentType());
                response.setStatus(status);
                String cacheControl = serviceResponse.getCacheControl(); //e.g. "no-cache, no-transform"
                if (cacheControl!=null) response.setHeader("Cache-Control", cacheControl);



              //Set authentication header as needed
                String authMessage = serviceResponse.getAuthMessage();
                String authType = request.getAuthType();
                if (authMessage!=null && authType!=null){
                    //"WWW-Authenticate", "Basic realm=\"Access Denied\""
                    if (authType.equalsIgnoreCase("BASIC")){
                        response.setHeader("WWW-Authenticate", "Basic realm=\"" + authMessage + "\"");
                    }
                }


              //Send body
                Object obj = serviceResponse.getResponse();
                if (obj instanceof javaxt.io.File){
                    javaxt.io.File file = (javaxt.io.File) obj;
                    javaxt.utils.Date date = serviceResponse.getDate();
                    if (date!=null){
                        javaxt.utils.URL url = new javaxt.utils.URL(request.getURL());
                        long currVersion = date.toLong();
                        long requestedVersion = 0;
                        try{ requestedVersion = Long.parseLong(url.getParameter("v")); }
                        catch(Exception e){}

                        if (requestedVersion < currVersion){
                            url.setParameter("v", currVersion+"");
                            response.sendRedirect(url.toString(), true);
                            return;
                        }
                        else if (requestedVersion==currVersion){
                            response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                        }
                    }


                  //Set fileName and contentType. Note that when a fileName is
                  //provided, the server responds with an attachment. Example:
                  //Content-Disposition: attachment;filename=...
                    String contentType = file.getContentType();
                    String fileName = null;

                    response.write(file.toFile(), fileName, contentType, true);
                }
                else if (obj instanceof java.io.InputStream){
                  //Set Content-Length response header
                    Long contentLength = serviceResponse.getContentLength();
                    if (contentLength!=null){
                        response.setHeader("Content-Length", contentLength+"");
                    }

                    java.io.InputStream inputStream = (java.io.InputStream) obj;
                    response.write(inputStream, true);
                    inputStream.close();
                }
                else{
                    response.write((byte[]) obj, true);
                }

            }
        }
    }


  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
  /** Maps a ServiceRequest to a WebService. Returns a ServiceResponse object
   *  to send back to the client.
   */
    private ServiceResponse getServiceResponse(String service, HttpServletRequest request)
        throws ServletException {


      //Authenticate user
        try{
            request.authenticate();
        }
        catch(Exception e){
            return new ServiceResponse(403, "Not Authorized");
        }


      //Find a webservice associated with the request
        WebService ws = webservices.get(service);
        ServiceRequest serviceRequest = null;
        if (ws==null){

            serviceRequest = new ServiceRequest(request);
            ws = this;

          //Special case for dashboard/thumbnail requests
            if (service.startsWith("dashboard")){
                ws = dashboardService;
                String p = serviceRequest.getPath(1).toString();
                if (p!=null){
                    if (p.equalsIgnoreCase("thumbnail") || p.equalsIgnoreCase("groups") ||
                        p.equalsIgnoreCase("group") || p.equalsIgnoreCase("permissions")){
                        serviceRequest = new ServiceRequest(service, request);
                    }
                }
            }
        }


      //Return response
        if (serviceRequest==null) serviceRequest = new ServiceRequest(service, request);
        return ws.getServiceResponse(serviceRequest, database);
    }


  //**************************************************************************
  //** getRecordset
  //**************************************************************************
  /** Used to apply filters when accessing models
   */
    protected Recordset getRecordset(ServiceRequest serviceRequest, String op, Class c, String sql, Connection conn) throws Exception {
        bluewave.app.User user = (bluewave.app.User) serviceRequest.getUser();
        SQLEditor sqlEditor = new SQLEditor(sql, c);

      //Set filters for accessing users
        if (c.equals(bluewave.app.User.class)){
            if (op.equals("list")){

              //Remove password field
                sqlEditor.removeField("password");
            }
            else if (op.equals("get")){

              //Remove password field for most requests - except admins (admins need to have password to save users)
                if (user.getAccessLevel()<5){
                    sqlEditor.removeField("password");
                }
            }
            else{

              //Non-admin users can't edit users, including themselves
                if (user.getAccessLevel()<5){
                    throw new ServletException(401, "Unauthorized");
                }
            }
        }

      //Only users can modify thier preferences
        else if (c.equals(bluewave.app.UserPreference.class)){
            sqlEditor.addConstraint("user_id=" + user.getID());
        }

        else {
            if (user.getAccessLevel()<5){
                if (op.equals("create") || op.equals("update") || op.equals("delete")){
                    if (user.getAccessLevel()<3){
                        throw new ServletException(401, "Unauthorized");
                    }
                }
            }
        }


      //Update sql
        sql = sqlEditor.getSQL();


      //Execute query and return recordset
        Recordset rs = new Recordset();
        if (op.equals("list")) rs.setFetchSize(1000);
        try{
            rs.open(sql, conn);
            return rs;
        }
        catch(Exception e){
            console.log(sql);
            throw e;
        }
    }


  //**************************************************************************
  //** createWebSocket
  //**************************************************************************
    private void createWebSocket(String service, HttpServletRequest request, HttpServletResponse response) throws IOException {

      //Authenticate request
        try{
            request.authenticate();
        }
        catch(Exception e){
            response.sendError(403, "Not Authorized");
            return;
        }


      //Check if the webservice associated with this request has its own
      //createWebSocket() method and invoke it
        WebService ws = webservices.get(service);
        if (ws!=null){
            for (Method m : ws.getClass().getDeclaredMethods()){
                if (Modifier.isPrivate(m.getModifiers())) continue;
                if (m.getName().equalsIgnoreCase("createWebSocket")){
                    Class<?>[] params = m.getParameterTypes();
                    if (params.length==2){

                        if (HttpServletRequest.class.isAssignableFrom(params[0]) &&
                            HttpServletResponse.class.isAssignableFrom(params[1])
                        ){
                            try{
                                m.setAccessible(true);
                                m.invoke(this, new Object[]{request, response});
                            }
                            catch(Exception e){
                                throw new IOException(e);
                            }

                            return;
                        }
                    }
                }
            }
        }


      //If we're still here, create web socket for this service
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
  //** onCreate
  //**************************************************************************
    public void onCreate(Object obj, ServiceRequest request){
        notify("create", (Model) obj, (bluewave.app.User) request.getUser());
    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
    public void onUpdate(Object obj, ServiceRequest request){
        notify("update", (Model) obj, (bluewave.app.User) request.getUser());
    };


  //**************************************************************************
  //** onDelete
  //**************************************************************************
    public void onDelete(Object obj, ServiceRequest request){
        notify("delete", (Model) obj, (bluewave.app.User) request.getUser());
    };


  //**************************************************************************
  //** notify
  //**************************************************************************
    public void notify(String action, Model model, bluewave.app.User user){
        Long userID = user==null ? null : user.getID();
        synchronized(listeners){
            Iterator<Long> it = listeners.keySet().iterator();
            while(it.hasNext()){
                WebSocketListener ws = listeners.get(it.next());
                ws.send(action+","+model.getClass().getSimpleName()+","+model.getID()+","+userID);
            }
        }
    }


  //**************************************************************************
  //** loadPlugins
  //**************************************************************************
    private void loadPlugins(){
        for (Plugin plugin : Config.getPlugins()){
            HashMap<String, String> webservices = plugin.getWebServices();
            Iterator<String> it = webservices.keySet().iterator();
            while (it.hasNext()){
                String endpoint = it.next();
                String className = webservices.get(endpoint);
                loadJarFiles(plugin.getDirectory(), className, endpoint);
                WebService ws = this.webservices.get(endpoint.toLowerCase());
                if (ws==null) console.log("Failed to load plugin", endpoint, className);
            }
        }
    }


  //**************************************************************************
  //** loadJarFiles
  //**************************************************************************
    private void loadJarFiles(javaxt.io.Directory currDir, String className, String endpoint){

      //Load all the jar files found in the lib directory
        ClassLoader classLoader = ClassLoader.getSystemClassLoader();
        javaxt.io.Directory libDir = new javaxt.io.Directory(currDir + "lib");
        for (javaxt.io.File k : libDir.getFiles("*.jar")){
            try {
                java.net.URL url = k.toFile().toURI().toURL();
                Method method = classLoader.getClass().getDeclaredMethod("addURL", java.net.URL.class);
                method.setAccessible(true);
                method.invoke(classLoader, url);
            }
            catch (Exception e) {
                try{
                    Method method = classLoader.getClass().getDeclaredMethod("appendToClassPathForInstrumentation", String.class);
                    method.setAccessible(true);
                    method.invoke(classLoader, k.toString());
                }
                catch(Exception ex){
                    ex.toString();
                }
            }
        }


      //Load the jar file associated with the className
        for (javaxt.io.File jarFile : currDir.getFiles("*.jar")){
            try{
                java.net.URLClassLoader child = new java.net.URLClassLoader(
                new java.net.URL[]{jarFile.toFile().toURL()}, Server.class.getClassLoader());
                WebService ws = (WebService) Class.forName(className, true, child).newInstance();

                synchronized(webservices){
                    webservices.put(endpoint.toLowerCase(), ws);
                }

                break;
            }
            catch(Exception e){

            }
        }

    }
}