package bluewave.web.services;

import java.io.IOException;
import java.util.Iterator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.express.services.QueryService.QueryJob;

import javaxt.http.servlet.HttpServletRequest;
import javaxt.http.servlet.HttpServletResponse;
import javaxt.http.websocket.WebSocketListener;

import javaxt.json.JSONObject;
import javaxt.sql.Database;

//******************************************************************************
//**  AdminService
//******************************************************************************
/**
 *   Used to manage settings and query the application database
 *
 ******************************************************************************/

public class AdminService extends WebService {

    private javaxt.express.services.QueryService queryService;
    private ConcurrentHashMap<Long, WebSocketListener> listeners;
    private static AtomicLong webSocketID;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public AdminService(javaxt.sql.Database database, JSONObject config){

      //Websocket stuff
        webSocketID = new AtomicLong(0);
        listeners = new ConcurrentHashMap<>();


      //Instantiate the QueryService
        AdminService me = this;
        queryService = new javaxt.express.services.QueryService(database, getJobDir(config), getLogDir(config)){
            public void notify(QueryJob job){
                me.notify(job);
            }
        };
    }


  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
    public ServiceResponse getServiceResponse(ServiceRequest request, Database database) {

        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (user==null || user.getAccessLevel()<5) return new ServiceResponse(403, "Not Authorized");

        String path = request.getPath(0).toString();
        if (path!=null){
            if (path.equals("job") || path.equals("jobs") || path.equals("tables")){
                return queryService.getServiceResponse(request, database);
            }
            else{
                return new ServiceResponse(501, "Not implemented");
            }
        }
        else{
            return new ServiceResponse(501, "Not implemented");
        }
    }



  //**************************************************************************
  //** createWebSocket
  //**************************************************************************
    public void createWebSocket(HttpServletRequest request, HttpServletResponse response) throws IOException {

        bluewave.app.User user = (bluewave.app.User) request.getUserPrincipal();
        if (user==null || user.getAccessLevel()<5) throw new IOException("Not Authorized");


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
    private void notify(QueryJob job){

        String msg = job.getID()+","+job.getStatus();
        synchronized(listeners){
            Iterator<Long> it = listeners.keySet().iterator();
            while(it.hasNext()){
                Long id = it.next();
                WebSocketListener ws = listeners.get(id);
                ws.send(msg);
            }
        }
    }


    private static javaxt.io.Directory getJobDir(JSONObject config){
        javaxt.io.Directory jobDir = null;
        if (config.has("jobDir")){
            String dir = config.get("jobDir").toString().trim();
            if (dir.length()>0){
                jobDir = new javaxt.io.Directory(dir);
                jobDir = new javaxt.io.Directory(jobDir.toString() + "sql");
                jobDir.create();
            }
        }
        if (jobDir==null || !jobDir.exists()){
            throw new IllegalArgumentException("Invalid \"jobDir\" defined in the \"webserver\" section of the config file");
        }
        console.log("jobDir: " + jobDir);
        return jobDir;
    }


    private static javaxt.io.Directory getLogDir(JSONObject config){
        javaxt.io.Directory logDir = null;
        if (config.has("logDir")){
            String dir = config.get("logDir").toString().trim();
            if (dir.length()>0){
                logDir = new javaxt.io.Directory(dir);
                logDir = new javaxt.io.Directory(logDir.toString() + "sql");
                logDir.create();
                if (logDir.exists()) console.log("logDir: " + logDir);
            }
        }
        return logDir;
    }
}