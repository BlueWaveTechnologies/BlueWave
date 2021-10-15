package bluewave.web.services;

import bluewave.app.User;
import bluewave.utils.DateUtils;
import bluewave.utils.NotificationService;
import bluewave.utils.NotificationService.Listener;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.HttpServletRequest;
import javaxt.http.servlet.HttpServletResponse;
import javaxt.http.servlet.ServletException;
import javaxt.http.websocket.WebSocketListener;

import javaxt.json.*;
import javaxt.sql.*;


//******************************************************************************
//**  ReportService
//******************************************************************************
/**
 *   Used to generate stats and data for various activity reports
 *
 ******************************************************************************/

public class ReportService extends WebService {

    private ConcurrentHashMap<Long, Long> activeUsers;
    private ConcurrentHashMap<Long, WebSocketListener> listeners;
    private static AtomicLong webSocketID;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ReportService(){

      //Websocket stuff
        webSocketID = new AtomicLong(0);
        listeners = new ConcurrentHashMap<>();


      //Initialize activeUsers
        activeUsers = new ConcurrentHashMap<>();
        try{
            for (User user : User.find("active=", true)){
                JSONObject info = user.getInfo();
                if (info!=null){
                    Long lastEvent = info.get("lastEvent").toLong();
                    if (lastEvent!=null) activeUsers.put(user.getID(), lastEvent*1000000);
                }
            }
        }
        catch(Exception e){}



      //Create timer task to periodically save user activity
        long interval = 2*60*1000; //2 minutes
        java.util.Timer timer = new java.util.Timer();
        timer.scheduleAtFixedRate( new java.util.TimerTask(){
            public void run(){
                long currTime = DateUtils.getCurrentTime();
                synchronized(activeUsers){
                    Iterator<Long> it = activeUsers.keySet().iterator();
                    while (it.hasNext()){
                        long userID = it.next();
                        long lastEvent = activeUsers.get(userID);
                        if (currTime-lastEvent<interval){
                            try{
                                User user = new User(userID);
                                JSONObject info = user.getInfo();
                                if (info==null){
                                    info = new JSONObject();
                                    user.setInfo(info);
                                }
                                info.set("lastEvent", DateUtils.getMilliseconds(lastEvent));
                                user.save();
                            }
                            catch(Exception e){
                                e.printStackTrace();
                            }
                        }
                    }
                }
            }
        }, 0, interval);




      //Add listener to the NotificationService to get WebRequests
        ReportService me = this;
        NotificationService.addListener(new Listener(){
            public void processEvent(String event, String info, long timestamp){

                if (event.equals("WebRequest")){
                    WebRequest request = new WebRequest(info);
                    String username = request.getValue("Authorization");
                    if (username!=null){
                        try{

                          //Get userID
                            if (username.startsWith("[") && username.endsWith("]")){
                                username = username.substring(1, username.length()-1);
                            }
                            else{
                                return;
                            }


                            User user = User.get("username=",username);
                            if (user==null) return;
                            long userID = user.getID();
                            boolean updateUser = false;


                          //Update activeUsers
                            synchronized(activeUsers){
                                Long t = activeUsers.get(userID);
                                if (t==null) t = 0L;
                                if (t>=timestamp) return;
                                if (t==0) updateUser = true;
                                activeUsers.put(userID, timestamp);
                                activeUsers.notify();
                            }

                          //Update user metadata if this is the first web request
                            if (updateUser){
                                JSONObject json = user.getInfo();
                                if (json==null){
                                    json = new JSONObject();
                                    user.setInfo(json);
                                }
                                json.set("lastEvent", DateUtils.getMilliseconds(timestamp));
                                user.save();
                            }


                          //Notify socket listeners
                            String action = event.toLowerCase();
                            me.notify(action+","+user.getClass().getSimpleName()+","+userID);
                        }
                        catch(Exception e){
                            e.printStackTrace();
                        }
                    }
                }
                else if (event.equals("LogOff")){
                    String username = info;
                    if (username!=null){
                        try{

                          //Get userID
                            User user = User.get("username=",username);
                            if (user==null) return;
                            long userID = user.getID();

                          //Update activeUsers
                            synchronized(activeUsers){
                                Long t = activeUsers.get(userID);
                                if (t==null) t = 0L;
                                if (t>=timestamp) return;
                                activeUsers.put(userID, timestamp);
                                activeUsers.notify();
                            }


                          //Update user metadata on logoff

                            JSONObject json = user.getInfo();
                            if (json==null){
                                json = new JSONObject();
                                user.setInfo(json);
                            }
                            json.set("lastEvent", DateUtils.getMilliseconds(timestamp));
                            user.save();


                          //Notify socket listeners
                            String action = event.toLowerCase();
                            me.notify(action+","+user.getClass().getSimpleName()+","+userID);
                        }
                        catch(Exception e){
                            e.printStackTrace();
                        }
                    }
                }


            }
        });
    }


  //**************************************************************************
  //** getActiveUsers
  //**************************************************************************
    public ServiceResponse getActiveUsers(ServiceRequest request, Database database)
        throws ServletException, IOException {

        if (!authorized(request.getRequest())) return new ServiceResponse(403, "Not Authorized");


        JSONObject json = new JSONObject();
        synchronized(activeUsers){
            Iterator<Long> it = activeUsers.keySet().iterator();
            while (it.hasNext()){
                long userID = it.next();
                long lastEvent = DateUtils.getMilliseconds(activeUsers.get(userID));
                json.set(userID+"", lastEvent);
            }
        }
        return new ServiceResponse(json);
    }


  //**************************************************************************
  //** createWebSocket
  //**************************************************************************
    public void createWebSocket(HttpServletRequest request, HttpServletResponse response) throws IOException {

        if (!authorized(request)) throw new IOException("Not Authorized");

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
  //** authorized
  //**************************************************************************
  /** Returns true if the user associated with the request is either an
   *  Administrator or Advanced User
   */
    private boolean authorized(HttpServletRequest request){
        bluewave.app.User user = (bluewave.app.User) request.getUserPrincipal();
        return (user.getAccessLevel()>3);
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
  //** WebRequest Class
  //**************************************************************************
  /** Used to parse web request headers generated in the main WebApp
   */
    private static class WebRequest {
        private String ip;
        private String host;
        private String method;
        private String url;
        private String path;
        private String protocol;
        private javaxt.utils.Date date;
        private String[] header;
        private String tld;
        private String domainName;

        public WebRequest(String requestHeaders){
            String[] arr = requestHeaders.trim().split("\r\n\r\n");

          //Parse request metadata
            String ip = null;
            String url = null;
            String op = null; //GET, POST, etc
            javaxt.utils.Date date = null;
            for (String row : arr[0].split("\r\n")){

                if (row.contains(":")){
                    String key = row.substring(0, row.indexOf(":")).trim();
                    String value = row.substring(row.indexOf(":")+1).trim();


                    if (key.equals("New Request From")){
                        ip = value;
                    }
                    else if (key.equalsIgnoreCase("Timestamp")){
                        try{
                            date = new javaxt.utils.Date(value);
                        }
                        catch(Exception e){
                            e.printStackTrace();
                        }
                    }
                    else{
                        op = key;
                        url = value;
                    }
                }
            }


            String header = arr[1];
            if (op!=null) op = op.toUpperCase();

            this.ip = ip;
            this.url = url;
            this.date = date;
            this.method = op;
            this.header = header.split("\r\n");


          //Parse host and extract domain name
            try{
                String str = url.substring(url.indexOf("://")+3);
                int idx = str.indexOf("/");
                if (idx>0){
                    host = str.substring(0, idx);
                    path = str.substring(idx+1);
                }
                else{
                    host = str;
                }

                host = host.toLowerCase();
                if (host.contains(".")){
                    arr = host.split("\\.");
                    tld = arr[arr.length-1]; //top level domain
                    domainName = arr[arr.length-2];
                }
            }
            catch(Exception e){
                e.printStackTrace();
            }
        }

        public String[] getValues(String name){
            java.util.ArrayList<String> values = new java.util.ArrayList<String>();
            for (String row : header){

                if (row.contains(":")){
                    String key = row.substring(0, row.indexOf(":")).trim();
                    String value = row.substring(row.indexOf(":")+1).trim();

                    if (key.equalsIgnoreCase(name)){
                        values.add(value);
                    }
                }
            }
            return values.toArray(new String[values.size()]);
        }
        public String getValue(String name){
            String[] values = this.getValues(name);
            return (values.length>0) ? values[0] : "";
        }
        public String getMethod(){
            return method;
        }
        public String getURL(){
            return url;
        }
        public String getPath(){
            return path;
        }
        public String getProtocol(){
            return protocol;
        }
        public javaxt.utils.Date getDate(){
            return date.clone();
        }
        public String getDomainName(){
            return domainName;
        }
        public String getIP(){
            return ip;
        }
    }
}