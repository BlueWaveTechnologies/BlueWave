package bluewave.web.services;

import bluewave.app.User;
import bluewave.utils.NotificationService;
import bluewave.utils.NotificationService.Listener;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.express.utils.*;
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

    private ConcurrentHashMap<Long, WebSocketListener> listeners;
    private static AtomicLong webSocketID;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ReportService(){

      //Websocket stuff
        webSocketID = new AtomicLong(0);
        listeners = new ConcurrentHashMap<>();


      //Add listener to the NotificationService to get WebRequests
        ReportService me = this;
        NotificationService.addListener(new Listener(){
            public void processEvent(String event, String requestHeaders){
                if (event.equals("WebRequest")){
                    WebRequest request = new WebRequest(requestHeaders);
                    String username = request.getValue("Authorization");
                    if (username!=null){
                        try{
                            username = username.substring(1, username.length()-1);
                            User user = User.get("username=",username);
                            String action = "activity";
                            me.notify(action+","+user.getClass().getSimpleName()+","+user.getID());
                        }
                        catch(Exception e){
                        }
                    }
                }
            }
        });
    }


  //**************************************************************************
  //** createWebSocket
  //**************************************************************************
    public void createWebSocket(HttpServletRequest request, HttpServletResponse response) throws IOException {
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
    private void notify(String msg){
        synchronized(listeners){
            Iterator<Long> it = listeners.keySet().iterator();
            while(it.hasNext()){
                Long id = it.next();
                WebSocketListener ws = listeners.get(id);
                console.log(msg);
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