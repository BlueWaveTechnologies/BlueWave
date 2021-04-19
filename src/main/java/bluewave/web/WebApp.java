package bluewave.web;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.*;

import javaxt.express.*;
import javaxt.http.servlet.*;
import javaxt.io.Jar;
import javaxt.json.*;
import static javaxt.utils.Console.*;

public class WebApp extends HttpServlet {

    private javaxt.io.Directory web;
    private FileManager fileManager;
    private WebServices ws;
    private ArrayList<InetSocketAddress> addresses;
    private String appName;
    private String appStyle;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public WebApp() throws Exception {

      //Get config file
        Jar jar = new Jar(this.getClass());
        javaxt.io.File configFile =
            new javaxt.io.File(jar.getFile().getParentFile(), "config.json");


      //Initialize config
        Config.init(configFile, jar);


      //Initialize this class
        JSONObject webConfig = Config.get("webserver").toJSONObject();
        init(webConfig);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public WebApp(JSONObject config) throws Exception {
        init(config);
    }


  //**************************************************************************
  //** init
  //**************************************************************************
    private void init(JSONObject config) throws Exception {

      //Set path to the web directory
        if (config.has("webDir")){
            String webDir = config.get("webDir").toString();
            web = new javaxt.io.Directory(webDir);
            if (!web.exists() || webDir.length()==0){
                throw new IllegalArgumentException("Invalid \"webDir\" defined in config file");
            }
        }


      //Instantiate file manager
        fileManager = new FileManager(web);


      //Instantiate web services
        ws = new WebServices(web);


      //Instantiate authenticator
        setAuthenticator(new Authenticator());


      //Generate list of socket addresses to bind to
        addresses = new ArrayList<>();
        Integer port = config.get("port").toInteger();
        addresses.add(new InetSocketAddress("0.0.0.0", port==null ? 80 : port));


      //Get branding
        if (config.has("branding")){
            JSONObject branding = config.get("branding").toJSONObject();
            appName = branding.get("appName").toString();
            appStyle = branding.get("appStyle").toString();
            if (appStyle!=null){
                appStyle = appStyle.trim();
                if (appStyle.startsWith("/")) appStyle = appStyle.substring(1);
                javaxt.io.File f = new javaxt.io.File(web + appStyle);
                if (f.exists()) appStyle = f.getText();
                else appStyle = null;
            }
        }
        if (appName==null) appName = "BlueWave";
        if (appStyle==null) appStyle = "";
    }


  //**************************************************************************
  //** start
  //**************************************************************************
  /** Used to start the web server
   */
    public void start(){
        int threads = 50;
        javaxt.http.Server server = new javaxt.http.Server(addresses, threads, this);
        server.start();
    }


  //**************************************************************************
  //** processRequest
  //**************************************************************************
  /** Used to process http get and post requests.
   */
    public void processRequest(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {


      //Get path from url, excluding servlet path and leading "/" character
        String path = request.getPathInfo();
        if (path!=null) path = path.substring(1);


      //Get first "directory" in the path
        String service = path==null ? "" : path.toLowerCase();
        if (service.contains("/")) service = service.substring(0, service.indexOf("/"));


      //Get credentials
        String[] credentials = request.getCredentials();


      //Generate response
        if (service.equals("login")){
            if (credentials==null){
                response.setStatus(401, "Access Denied");
                response.setHeader("WWW-Authenticate", "Basic realm=\"Access Denied\""); //<--Prompt the user for thier credentials
                response.setHeader("Cache-Control", "no-cache, no-transform");
                response.setContentType("text/plain");
                response.write("Unauthorized");
            }
            else{
                try{
                    request.authenticate();
                    response.setContentType("application/json");
                    response.write(((bluewave.app.User) request.getUserPrincipal()).toJson().toString());
                }
                catch(Exception e){
                    response.setStatus(403, "Not Authorized");
                    response.setHeader("Cache-Control", "no-cache, no-transform");
                    response.setContentType("text/plain");
                    response.write("Unauthorized");
                }
            }
        }
        else if (service.equals("logoff") || service.equalsIgnoreCase("logout")){
            response.setStatus(401, "Access Denied");
            Boolean prompt = new javaxt.utils.Value(request.getParameter("prompt")).toBoolean(); //<--Hack for Firefox
            if (prompt!=null && prompt==true){
                response.setHeader("WWW-Authenticate", "Basic realm=\"" +
                "This site is restricted. Please enter your username and password.\"");
            }
            response.setHeader("Cache-Control", "no-cache, no-transform");
            response.setContentType("text/plain");
            response.write("Unauthorized");
        }
        else if (service.equals("whoami")){
            String username = (credentials!=null) ? credentials[0] : null;
            if (username==null || username.equals("logout")) throw new ServletException(400);
            else{
                response.setHeader("Cache-Control", "no-cache, no-transform");
                response.setContentType("text/plain");
                response.write(username);
            }
        }
        else if (service.equals("appinfo")){
            response.write("{\"name\":\"" + appName + "\"}");
        }
        else if (service.equals("data")){
            ws.processRequest(service, request, response);
        }
        else{

          //Send static file if we can
            if (service.length()==0){

              //If the service is empty, send welcome file (e.g. index.html)
                fileManager.sendFile(request, response);
                return;
            }
            else{

              //Check if the service matches a file or folder in the web directory.
              //If so, send the static file as requested. Note that the current
              //implementation searches the web directory for each http request,
              //which is terribly inefficient. We need some sort of caching with
              //a file watcher...
                for (Object obj : web.getChildren()){
                    String name = null;
                    if (obj instanceof javaxt.io.File){
                        name = ((javaxt.io.File) obj).getName();
                    }
                    else{
                        name = ((javaxt.io.Directory) obj).getName();
                    }
                    if (service.equalsIgnoreCase(name)){
                        sendFile(path, request, response);
                        return;
                    }
                }
            }

          //If we're still here, we either have a bad file request or a web
          //service request. In either case, send the request to the
          //webservices endpoint to process.
            ws.processRequest(service, request, response);

        }
    }

  //**************************************************************************
  //** sendFile
  //**************************************************************************
    private void sendFile(String path, HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {


      //Authenticate users requesting sensitive files
        if (path.endsWith("main.html")){
            try{
                request.authenticate();
                User user = (User) request.getUserPrincipal();
                if (user.getAccessLevel()<3) throw new Exception();
            }
            catch(Exception e){
                response.setStatus(403, "Not Authorized");
                response.setContentType("text/plain");
                response.write("Unauthorized");
                return;
            }
        }


      //Add custom app style
        if (path.endsWith("branding.css")){
            response.write(appStyle);
            return;
        }


        fileManager.sendFile(request, response);
    }
}