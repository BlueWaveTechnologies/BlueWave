package bluewave.web;
import bluewave.web.services.ReportService;
import bluewave.web.services.QueryService;
import bluewave.web.services.DashboardService;
import bluewave.web.services.GraphService;
import bluewave.web.services.MapService;
import bluewave.web.services.DataService;
import bluewave.graph.Neo4J;

import javaxt.express.*;
import javaxt.http.servlet.HttpServletRequest;
import javaxt.http.servlet.HttpServletResponse;
import javaxt.http.servlet.ServletException;
import javaxt.io.Jar;
import javaxt.sql.*;

import javaxt.http.websocket.WebSocketListener;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.io.IOException;


public class WebServices extends WebService {

    private Database database;
    private DashboardService dashboardService;
    private MapService mapService;
    private ReportService reportService;
    private DataService dataService;
    private QueryService queryService;
    private GraphService graphService;

    private ConcurrentHashMap<Long, WebSocketListener> listeners;
    private static AtomicLong webSocketID;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public WebServices(javaxt.io.Directory web) throws Exception {

      //Register models that this service will support
        for (Class c : new Jar(this).getClasses()){
            if (javaxt.sql.Model.class.isAssignableFrom(c)){
                addClass(c);
            }
        }


      //Get database
        database = Config.getDatabase();
        Neo4J graph = Config.getGraph();


      //Instantiate additional web services
        dashboardService = new DashboardService(this, web, database);
        mapService = new MapService();
        reportService = new ReportService();
        dataService = new DataService(new javaxt.io.Directory(web + "data"));
        queryService = new QueryService(graph, Config.get("webserver").toJSONObject());
        graphService = new GraphService(graph);



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
                    response.write(file.toFile(), file.getContentType(), true);
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


        try{
            request.authenticate();
        }
        catch(Exception e){
            return new ServiceResponse(403, "Not Authorized");
        }


        WebService ws;
        ServiceRequest serviceRequest = null;
        if (service.equals("map")){
            ws = mapService;
        }
        else if (service.equals("report")){
            ws = reportService;
        }
        else if (service.equals("data")){
            ws = dataService;
        }
        else if (service.equals("query")){
            ws = queryService;
        }
        else if (service.equals("graph")){
            ws = graphService;
        }
        else{
            serviceRequest = new ServiceRequest(request);
            ws = this;

          //Special case for dashboard/thumbnail requests
            if (service.equals("dashboard")){
                String p = serviceRequest.getPath(1).toString();
                if (p!=null && p.equalsIgnoreCase("thumbnail")){
                    serviceRequest = new ServiceRequest(service, request);
                    ws = dashboardService;
                }
            }
        }
        if (serviceRequest==null) serviceRequest = new ServiceRequest(service, request);
        return ws.getServiceResponse(serviceRequest, database);
    }



  //**************************************************************************
  //** getRecordset
  //**************************************************************************
    protected Recordset getRecordset(ServiceRequest serviceRequest, String op, Class c, String sql, Connection conn) throws Exception {
        bluewave.app.User user = (bluewave.app.User) serviceRequest.getUser();
        if (user.getAccessLevel()<5){
            if (op.equals("create") || op.equals("update") || op.equals("delete")){
                if (user.getAccessLevel()<3){
                    throw new ServletException(401, "Unauthorized");
                }
            }


            SQLEditor where = new SQLEditor(sql);
            if (c.equals(bluewave.app.User.class)){

                if (op.equals("get") || op.equals("list")){

                  //Allow users to see themselves
                    where.append("id=" + user.getID());
                }
                else{

                  //Non-admin users can't edit users, including themselves
                    throw new ServletException(401, "Unauthorized");
                }
            }
            else if (c.equals(bluewave.app.UserPreference.class)){
                where.append("user_id=" + user.getID());
            }
            else if (c.equals(bluewave.app.Dashboard.class)){
                if (op.equals("get") || op.equals("list")){
                }
                else{ //"create", "update", "delete"
                    if (user.getAccessLevel()<5){
                        throw new ServletException(401, "Unauthorized");
                    }
                }
            }
            else{
                //console.log(c);
            }

            sql = where.getSQL();
        }

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
  //** SQLEditor
  //**************************************************************************
    private class SQLEditor {
        private javaxt.sql.Parser parser;
        private String sql;
        public SQLEditor(String sql){
            this.sql = sql;
        }
        public void append(String whereClause){
            if (parser==null) parser = new javaxt.sql.Parser(sql);
            String where = parser.getWhereString();
            if (where==null) where = "";
            else where += " and ";
            where += whereClause;
            parser.setWhere(where);
            sql = parser.toString();
        }
        public void remove(){
            if (parser==null) parser = new javaxt.sql.Parser(sql);
            parser.setWhere(null);
        }
        public String getSQL(){
            return sql;
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


      //Create web socket
        if (service.equals("report")){
            reportService.createWebSocket(request, response);
        }
        else{
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
    }


  //**************************************************************************
  //** onCreate
  //**************************************************************************
    public void onCreate(Object obj){
        notify("create",obj);
    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
    public void onUpdate(Object obj){
        notify("update",obj);
    };


  //**************************************************************************
  //** onDelete
  //**************************************************************************
    public void onDelete(Object obj){
        notify("delete",obj);
    };


  //**************************************************************************
  //** notify
  //**************************************************************************
    public void notify(String action, Object obj){
        Model model = (Model) obj;
        synchronized(listeners){
            Iterator<Long> it = listeners.keySet().iterator();
            while(it.hasNext()){
                Long id = it.next();
                WebSocketListener ws = listeners.get(id);
                ws.send(action+","+model.getClass().getSimpleName()+","+model.getID());
            }
        }
    }

}