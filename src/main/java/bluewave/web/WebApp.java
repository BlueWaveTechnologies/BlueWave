package bluewave.web;
import bluewave.Config;

import java.util.*;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.security.KeyStore;

import javaxt.express.*;
import javaxt.http.servlet.*;
import javaxt.io.Jar;
import javaxt.json.*;
import static javaxt.utils.Console.*;

import bluewave.utils.NotificationService;

import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

//******************************************************************************
//**  WebApp
//******************************************************************************
/**
 *   HttpServlet used to process http and websocket requests.
 *
 ******************************************************************************/

public class WebApp extends HttpServlet {

    private javaxt.io.Directory web;
    private FileManager fileManager;
    private WebServices ws;
    private Logger logger;
    private String appName;
    private String appStyle;
    private String auth;
    private ArrayList<InetSocketAddress> addresses;
    private Integer maxThreads;
    private JSONObject config;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Constructor that assumes a config.json sits next to the jar file
   */
    public WebApp() throws Exception {

      //Get config file
        Jar jar = new Jar(this.getClass());
        javaxt.io.File configFile =
            new javaxt.io.File(jar.getFile().getParentFile(), "config.json");


      //Initialize config
        Config.load(configFile, jar);
        Config.initDatabase();


      //Initialize this class
        JSONObject webConfig = Config.get("webserver").toJSONObject();
        parseConfig(webConfig);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public WebApp(JSONObject config) throws Exception {
        parseConfig(config);
    }


  //**************************************************************************
  //** init
  //**************************************************************************
    private void parseConfig(JSONObject config) throws Exception {
        this.config = config;


      //Set path to the web directory
        if (config.has("webDir")){
            String webDir = config.get("webDir").toString();
            web = new javaxt.io.Directory(webDir);
            if (!web.exists() || webDir.length()==0){
                throw new IllegalArgumentException("Invalid \"webDir\" defined in config file");
            }
        }


      //Get authentication scheme
        this.auth = "BASIC";
        String auth = config.get("auth").toString();
        if (auth!=null){
            auth = auth.trim().toUpperCase();
            if (auth.equals("NTLM")) this.auth = auth;
            if (auth.equals("DISABLED")) this.auth = null;
        }




      //Instantiate authenticator
        if (this.auth==null){ //create custom authenticator for when auth is disabled
            String[] credentials = new String[]{"bluewave","bluewave"};
            bluewave.app.User user = new bluewave.app.User();
            user.setUsername(credentials[0]);
            user.setPassword(credentials[1]);
            user.setAccessLevel(2);
            setAuthenticator(new javaxt.http.servlet.Authenticator(){
                public String getAuthType(){ return ""; }
                public boolean isUserInRole(String role){ return true; }
                public bluewave.app.User getPrinciple(){ return user; }
                public void authenticate() throws ServletException {}
                public String[] getCredentials() { return credentials; };
                public javaxt.http.servlet.Authenticator newInstance(HttpServletRequest request){ return this; }
            });
        }
        else{ //typically we end up here
            setAuthenticator(new Authenticator());
        }


      //Get branding (optional)
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


      //Get keystore (optional)
        KeyStore keystore = null;
        char[] keypass = null;
        if (config.has("keystore") && config.has("keypass")){
            try{
                keypass = config.get("keypass").toString().toCharArray();
                keystore = KeyStore.getInstance("JKS");
                keystore.load(new java.io.FileInputStream(config.get("keystore").toString()), keypass);
            }
            catch(Exception e){
                keystore = null;
                keypass = null;
            }
        }


      //Get logging info (optional)
        if (config.has("logDir")){
            String logDir = config.get("logDir").toString();
            javaxt.io.Directory dir = new javaxt.io.Directory(logDir);
            if (!dir.exists()) dir.create();
            if (dir.exists()){
                dir = new javaxt.io.Directory(dir + "web");
                if (!dir.exists()) dir.create();
                logger = new Logger(dir.toFile());
            }
            else console.log("Invalid \"logDir\" defined in config file");
        }


      //Generate list of socket addresses to bind to
        addresses = new ArrayList<>();
        Integer port = config.get("port").toInteger();
        if (port==null){
            addresses.add(new InetSocketAddress("0.0.0.0", 80));
            if (keystore!=null){
                try{
                    setKeyStore(keystore, new String(keypass));
                    setTrustStore(keystore);
                    addresses.add(new InetSocketAddress("0.0.0.0", 443));
                }
                catch(Exception e){
                    //e.printStackTrace();
                }
            }
        }
        else{
            addresses.add(new InetSocketAddress("0.0.0.0", port));
        }


      //Get max threads
        maxThreads = config.get("maxThreads").toInteger();
        if (maxThreads==null || maxThreads<0) maxThreads = 250;
    }


  //**************************************************************************
  //** start
  //**************************************************************************
  /** Used to start the web server and related services
   */
    public void start(){
        start(false);
    }


  //**************************************************************************
  //** start
  //**************************************************************************
  /** Used to start the web server and related services
   *  @param embedded If true, will not start an HTTP server. This method is
   *  used to embed the application in another web server.
   */
    public void start(boolean embedded){

      //Start the notification service
        NotificationService.start();


      //Instantiate file manager
        fileManager = new FileManager(web);


      //Instantiate web services
        try{
            ws = new WebServices(web, config);
        }
        catch(Exception e){
            throw new RuntimeException(e);
        }


      //Start logger
        if (logger!=null) new Thread(logger).start();



      //Start web server
        if (embedded || addresses==null || addresses.isEmpty()) return;
        new javaxt.http.Server(addresses, maxThreads, this).start();

    }


  //**************************************************************************
  //** processRequest
  //**************************************************************************
  /** Used to process http get and post requests.
   */
    public void processRequest(HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {



      //Check if the server support HTTPS
        if (this.supportsHttps()){

          //Set "Content-Security-Policy"
            response.setHeader("Content-Security-Policy", "upgrade-insecure-requests");


          //Redirect http request to https as needed
            javaxt.utils.URL url = new javaxt.utils.URL(request.getURL());
            if (!url.getProtocol().equalsIgnoreCase("https")){
                url.setProtocol("https");
                response.sendRedirect(url.toString(), true);
                return;
            }
        }



      //Get path from url, excluding servlet path and leading "/" character
        String path = request.getPathInfo();
        if (path!=null) path = path.substring(1);


      //Get first "directory" in the path
        String service = path==null ? "" : path.toLowerCase();
        if (service.contains("/")) service = service.substring(0, service.indexOf("/"));


      //Get credentials
        String[] credentials = request.getCredentials();


      //Log the request
        String requestHeaders = getRequestHeaders(request);
        if (logger!=null) logger.log(requestHeaders);
        NotificationService.notify("WebRequest", requestHeaders);



      //Send NTLM response as needed
        boolean ntlm = (auth!=null && auth.equals("NTLM"));
        if (ntlm){
            String ua = request.getHeader("user-agent");
            if (ua!=null){
                if (ua.contains("MSIE ") || ua.contains("Trident/") || ua.contains("Edge/") || ua.contains("Edg/")){
                    if (Authenticator.sendNTLMResponse(request, response)) return;
                }
                else{
                    ntlm = false;
                }
            }
        }



      //Generate response
        if (service.equals("login")){
            if (credentials==null){
                if (ntlm){
                    response.setStatus(401, "Access Denied");
                    response.setHeader("WWW-Authenticate", "NTLM");
                }
                else{
                    response.setStatus(401, "Access Denied");
                    response.setHeader("WWW-Authenticate", "Basic realm=\"Access Denied\""); //<--Prompt the user for thier credentials
                    response.setHeader("Cache-Control", "no-cache, no-transform");
                    response.setContentType("text/plain");
                    response.write("Unauthorized");
                }
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
            String username = (credentials!=null) ? credentials[0] : null;
            Authenticator.updateCache(username, null);
            NotificationService.notify("LogOff", username);

            if (ntlm){
                response.setStatus(401, "Access Denied");
                response.setHeader("WWW-Authenticate", "NTLM");
            }
            else{
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
        else if (service.equals("user") && auth==null){
            bluewave.app.User user = (bluewave.app.User) request.getUserPrincipal();
            response.setContentType("application/json");
            response.write(user.toJson().toString());
        }
        else if (service.equals("appinfo")){
            response.setContentType("application/json");
            JSONObject appInfo = new JSONObject();
            appInfo.set("name", appName);
            JSONValue browsers = Config.get("webserver").get("browsers");
            appInfo.set("supportedBrowsers", browsers);
            response.write(appInfo.toString());
        }
        else if (service.equals("extensions")){

            JSONArray extensions = new JSONArray();
            for (bluewave.Plugin plugin : Config.getPlugins()){
                extensions.add(plugin.getExtensions());
            }

            response.setContentType("application/json");
            response.write(extensions.toString());
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


              //Special case for plugins
                for (bluewave.Plugin plugin : Config.getPlugins()){
                    StringBuilder pluginPath = new StringBuilder(
                    plugin.getDirectory().toString().replace("\\", "/") + "web");

                    for (String p : path.replace("\\", "/").split("/")){
                        if (p.equals(".") || p.equals("..")){
                            break;
                        }
                        pluginPath.append("/" + p);
                    }

                    javaxt.io.File f = new javaxt.io.File(pluginPath.toString());
                    if (f.exists()){
                        fileManager.sendFile(f, request, response);
                        return;
                    }
                }



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


              //Special case: URL shortcuts to bluewave dashboards
                if (!path.contains("/")){
                    javaxt.io.File file = new javaxt.io.File(web + "app/dashboards/" + path +".js");
                    if (!file.exists()) file = new javaxt.io.File(web + "app/analytics/" + path +".js");
                    if (file.exists()){
                        file = new javaxt.io.File(web, "index.html");
                        fileManager.sendFile(file, request, response);
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
                bluewave.app.User user = (bluewave.app.User) request.getUserPrincipal();
                if (user.getAccessLevel()<2) throw new Exception();
            }
            catch(Exception e){
                response.setStatus(403, "Not Authorized");
                response.setContentType("text/plain");
                response.write("Unauthorized");
                return;
            }


            sendMain(path, request, response);
            return;
        }


      //Add custom app style
        if (path.endsWith("branding.css")){
            response.write(appStyle);
            return;
        }


      //Special case for Certbot. When generating certificates using the
      //certonly command, Certbot creates a hidden directory in the web root.
      //The web server must return the files in this hidden directory. However,
      //the filemanager does not allow access to hidden directories so we need
      //to handle these requests manually.
        if (path.startsWith(".well-known")){
            console.log(path);
            java.io.File file = new java.io.File(web + path);
            console.log(file + "\t" + file.exists());

          //Send file
            if (file.exists()){
                response.write(file, javaxt.io.File.getContentType(file.getName()), true);
            }
            else{
                response.setStatus(404);
                response.setContentType("text/plain");
            }
            return;
        }


        fileManager.sendFile(request, response);
    }


  //**************************************************************************
  //** sendMain
  //**************************************************************************
  /** Used to send the main.html file to the client. Appends any plugin
   *  includes as needed.
   */
    private void sendMain(String path, HttpServletRequest request, HttpServletResponse response)
        throws ServletException, IOException {

      //Get file
        javaxt.io.File htmlFile = new javaxt.io.File(web, "main.html");


      //Get all the includes associated with the plugins
        HashMap<javaxt.io.File, ArrayList<Node>> includes = new HashMap<>();
        for (bluewave.Plugin plugin : Config.getPlugins()){
            ArrayList<Node> arr = new ArrayList<>();
            for (Node node : plugin.getIncludes()){
                arr.add(node);
            }
            if (!arr.isEmpty()){

              //Create a phantom file reference in the web directory for the
              //MapPath method in fileManager.updateLinks() to work correctly
                javaxt.io.File xmlFile =
                new javaxt.io.File(plugin.getDirectory() + "web/foo.txt");

              //Update includes
                includes.put(xmlFile, arr);
            }
        }



        if (includes.isEmpty()){
            fileManager.sendFile(htmlFile, request, response);
        }
        else{


          //Convert html to xml. Assumes the html file is xhtml. Note that the
          //parser will be extremely slow if there is a !DOCTYPE declaration.
            String xhtml = htmlFile.getText().trim();
            int idx = xhtml.toUpperCase().indexOf("<!DOCTYPE");
            if (idx>-1){
                xhtml = xhtml.substring(idx+"<!DOCTYPE".length()).trim();
                xhtml = xhtml.substring(xhtml.indexOf(">")+1).trim();
            }
            org.w3c.dom.Document xml = javaxt.xml.DOM.createDocument(xhtml);


            try{


              //Update links to scripts and css files
                long lastUpdate = fileManager.updateLinks(htmlFile, xml);


              //Add additional includes
                Node head = javaxt.xml.DOM.getElementsByTagName("head", xml)[0];
                Iterator<javaxt.io.File> it = includes.keySet().iterator();
                while (it.hasNext()){
                    javaxt.io.File xmlFile = it.next();
                    ArrayList<Node> arr = includes.get(xmlFile);
                    long l = fileManager.updateLinks(xmlFile, arr);
                    if (l>lastUpdate) lastUpdate = l;
                    for (Node include : arr){
                        Node n = xml.importNode(include, true);
                        head.appendChild(n);
                    }
                }


              //Replace all self enclosing tags
                Node outerNode = javaxt.xml.DOM.getOuterNode(xml);
                NodeList nodeList = outerNode.getChildNodes();
                for (int i=0; i<nodeList.getLength(); i++){
                    Node node = nodeList.item(i);
                    String nodeName = node.getNodeName().toLowerCase();
                    if (nodeName.equals("head") || nodeName.equals("body")){
                        fileManager.updateNodes(node.getChildNodes(), xml);
                    }
                }


              //Convert xml to string
                String html = javaxt.xml.DOM.getText(xml);
                html = html.replace("<!-- -->", ""); //replace empty comments
                html = html.substring(html.indexOf(">")+1); //remove xml header


              //Set content type and send response
                response.setContentType("text/html");
                fileManager.sendResponse(html, lastUpdate, request, response);

            }
            catch(Exception e){
                response.setStatus(500);
                response.write("Internal server error: " + e.getMessage());
            }

        }
    }


  //**************************************************************************
  //** getRequestHeaders
  //**************************************************************************
  /** Used to convert http request headers and metadata into a string for
   *  logging purposes. Updates the "Authorization" header to hide passwords.
   */
    private String getRequestHeaders(HttpServletRequest request) {

        String clientIP = request.getRemoteAddr();
        if (clientIP.startsWith("/") && clientIP.length()>1) clientIP = clientIP.substring(1);


        javaxt.utils.Date date = null;
        if (logger==null){
            date = new javaxt.utils.Date();
            date.setTimeZone("UTC");
        }
        else{
            date = logger.getDate();
        }


        StringBuilder str = new StringBuilder();
        str.append("New Request From: " + clientIP + "\r\n");
        str.append(request.getMethod() + ": " + request.getURL() + "\r\n");
        str.append("TimeStamp: " + date + "\r\n");
        str.append("\r\n");

        java.util.Enumeration<String> headers = request.getHeaderNames();
        while (headers.hasMoreElements()){
            String key = headers.nextElement();
            String val = request.getHeader(key);

            if (key.equals("Authorization")){
                java.security.Principal user = request.getUserPrincipal();
                if (user!=null){
                    val = "[" + request.getUserPrincipal().getName() + "]";
                }
            }

            str.append(key);
            str.append(": ");
            str.append(val);
            str.append("\r\n");
        }
        str.append("\r\n"); //extra carriage return for the logger

        return str.toString();
    }
}