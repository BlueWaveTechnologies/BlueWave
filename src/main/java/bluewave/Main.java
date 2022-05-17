package bluewave;
import bluewave.app.User;
import bluewave.data.*;
import bluewave.graph.Neo4J;
import bluewave.web.WebApp;
import bluewave.web.services.DocumentService;

import static bluewave.utils.StringUtils.*;

import java.util.*;
import com.google.gson.JsonObject;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.net.InetSocketAddress;

import javaxt.sql.*;
import javaxt.json.*;
import javaxt.io.File;
import javaxt.io.Jar;
import static javaxt.utils.Console.*;

import org.neo4j.driver.*;
import javaxt.express.utils.CSV;

//******************************************************************************
//**  Main
//******************************************************************************
/**
 *  Command line interface used to start the web server or to run specialized
 *  functions (e.g. import, addUser, etc).
 *
 ******************************************************************************/

public class Main {

  //**************************************************************************
  //** Main
  //**************************************************************************
  /** Entry point for the application.
   */
    public static void main(String[] arr) throws Exception {
        HashMap<String, String> args = console.parseArgs(arr);


      //Get jar file and schema
        Jar jar = new Jar(Main.class);
        javaxt.io.File jarFile = new javaxt.io.File(jar.getFile());


      //Get config file
        javaxt.io.File configFile = (args.containsKey("-config")) ?
            Config.getFile(args.get("-config"), jarFile) :
            new javaxt.io.File(jar.getFile().getParentFile(), "config.json");

        if (!configFile.exists()) {
            System.out.println("Could not find config file. Use the \"-config\" parameter to specify a path to a config");
            return;
        }


      //Run update scripts as needed
        if (args.containsKey("-updateSchema")){
            String updates = new javaxt.io.File(args.get("-updateSchema")).getText();
            updateSchema(updates, configFile);
            System.out.println("Successfully updated schema!");
            return;
        }



      //Initialize config
        Config.load(configFile, jar);



      //Check if any of the plugins wants to process the command line args
        for (Plugin plugin : Config.getPlugins()){
            javaxt.io.File file = plugin.getJarFile();
            if (file==null) continue;

            JSONArray methods = plugin.getMainMethods();

            for (int i=0; i<methods.length(); i++){
                JSONObject json = methods.get(i).toJSONObject();
                String s = json.get("switch").toString();
                String str = args.get("-" + s);
                if (str!=null){
                    String arg = json.get("arg").toString();
                    if (str.equalsIgnoreCase(arg)){

                        String className = json.get("class").toString();
                        String method = json.get("method").toString();

                        plugin.loadLibraries();
                        try{
                            java.net.URLClassLoader child = new java.net.URLClassLoader(
                            new java.net.URL[]{file.toFile().toURL()}, Main.class.getClassLoader());
                            Class cls = Class.forName(className, true, child);
                            for (Method m : cls.getDeclaredMethods()){
                                int modifiers = m.getModifiers();
                                if (Modifier.isPrivate(modifiers)) continue;
                                if (!Modifier.isStatic(modifiers)) continue;
                                if (m.getName().equalsIgnoreCase(method)){
                                    Class<?>[] params = m.getParameterTypes();
                                    if (params.length==1){
                                        Object[] inputs = new Object[]{args};
                                        try{
                                            m.invoke(null, inputs);
                                        }
                                        catch(Exception e){
                                            e.printStackTrace();
                                        }
                                        return;
                                    }
                                }
                            }
                        }
                        catch(Exception e){
                            //e.printStackTrace();
                        }
                    }
                }
            }
        }



      //Process command line args
        if (args.containsKey("-addUser")){
            Config.initDatabase();
            addUser(args);
        }
        else if (args.containsKey("-updatePassword")){
            Config.initDatabase();
            updatePassword(args);
        }
        else if (args.containsKey("-load")){
            loadData(args);
        }
        else if (args.containsKey("-delete")){
            delete(args);
        }
        else if (args.containsKey("-createIndex")){
            createIndex(args);
        }
        else if (args.containsKey("-test")){
            test(args);
        }
        else{ //start server
            if (!Config.has("webserver")){
                throw new Exception("Config file is missing \"webserver\" config information");
            }
            else{
                Config.initDatabase();
                JSONObject webConfig = Config.get("webserver").toJSONObject();
                ArrayList<InetSocketAddress> addresses = new ArrayList<>();
                Integer port = webConfig.get("port").toInteger();
                addresses.add(new InetSocketAddress("0.0.0.0", port==null ? 80 : port));
                new javaxt.http.Server(addresses, 250, new WebApp(webConfig)).start();

                // bluewave.graph.Maintenance.syncUsers(Config.getGraph(null));
            }
        }
    }


  //**************************************************************************
  //** updateSchema
  //**************************************************************************
    private static void updateSchema(String updates, javaxt.io.File configFile) throws Exception {


      //Get database config
        JSONObject json = new JSONObject(configFile.getText());
        JSONObject dbConfig = json.get("database").toJSONObject();


      //Update path to the database (H2 only)
        if (dbConfig.has("path")){
            Config.updateFile("path", dbConfig, configFile);
            String path = dbConfig.get("path").toString().replace("\\", "/");
            dbConfig.set("host", path);
            dbConfig.remove("path");
        }


        javaxt.express.Config config = new javaxt.express.Config();
        config.init(json);
        Database database = config.getDatabase();



      //Split updates into individual statements
        ArrayList<String> statements = new ArrayList<String>();
        for (String s : updates.split(";")){

            StringBuffer str = new StringBuffer();
            for (String i : s.split("\r\n")){
                if (!i.trim().startsWith("--") && !i.trim().startsWith("COMMENT ")){
                    str.append(i + "\r\n");
                }
            }

            String cmd = str.toString().trim();
            if (cmd.length()>0){
                statements.add(rtrim(str.toString()) + ";");
            }
        }



      //Execute statements
        Connection conn = null;
        try{
            conn = database.getConnection();

            java.sql.Statement stmt = conn.getConnection().createStatement();
            for (String cmd : statements){
                System.out.println(cmd);
                try{
                    stmt.execute(cmd);
                }
                catch(java.sql.SQLException e){

                    throw e;
                }
            }
            stmt.close();

            conn.close();
        }
        catch(Exception e){
            if (conn!=null) conn.close();
            throw e;
        }
    }


  //**************************************************************************
  //** addUser
  //**************************************************************************
    private static void addUser(HashMap<String, String> args) throws Exception {
        String name = args.get("-addUser");

        int accessLevel = 3;
        if (args.containsKey("-accessLevel")){
            try{
                accessLevel = Integer.parseInt(args.get("-accessLevel"));
                if (accessLevel<1 || accessLevel>5) accessLevel = 3;
            }
            catch(Exception e){}
        }

        System.out.println("Create new user \"" + name + "\"");
        String pw = getPassword(args);

        User user = new User();
        user.setUsername(name);
        user.setPassword(pw);
        user.setActive(true);
        user.setAccessLevel(accessLevel);
        user.save();
        System.out.println("User created");
    }


  //**************************************************************************
  //** updatePassword
  //**************************************************************************
    private static void updatePassword(HashMap<String, String> args) throws Exception {
        String name = args.get("-updatePassword");

        User user = User.get("username=", name);
        if (user==null){
            System.out.println("User not found");
            return;
        }

//        String currentPassword = console.getPassword("Current password >");
//        if (!user.authenticate(currentPassword)){
//            System.out.println("Sorry, incorrect password");
//            return;
//        }

        String pw = getPassword(args);
        user.setPassword(pw);
        user.save();
        System.out.println("Password changed");
    }


  //**************************************************************************
  //** getPassword
  //**************************************************************************
    private static String getPassword(HashMap<String, String> args) throws Exception {
        String pw = console.getPassword("Enter password: ");
        String pw2 = console.getPassword("Confirm password: ");
        if (!pw.equals(pw2)) {
            System.out.println("Passwords do not match. Please try again");
            getPassword(args);
        }
        return pw;
    }


  //**************************************************************************
  //** loadData
  //**************************************************************************
    private static void loadData(HashMap<String, String> args) throws Exception {
        String str = args.get("-load");
        java.io.File f = new java.io.File(str);
        if (f.isFile()) importFile(args);
        else{
            //import directory?
        }
    }


  //**************************************************************************
  //** importFile
  //**************************************************************************
    private static void importFile(HashMap<String, String> args) throws Exception {

      //Get file and extension
        String filePath = args.get("-load");
        javaxt.io.File file = new javaxt.io.File(filePath);
        if (!file.exists()) throw new IllegalArgumentException("-load file is invalid");
        String fileType = file.getExtension().toLowerCase();
        if (fileType.equals("gz")){
            String fileName = file.getName(false);
            fileType = fileName.substring(fileName.lastIndexOf(".")+1);
        }


      //Get node type
        String nodeType = args.get("-nodeType");
        if (nodeType==null) nodeType = args.get("-node");
        if (nodeType==null) nodeType = args.get("-vertex");
        if (nodeType==null) throw new IllegalArgumentException("-nodeType or -vertex is required");


      //Get unique keys
        Integer[] keys = null;
        if (args.containsKey("-keys")){
            String[] arr = args.get("-keys").split(",");
            keys = new Integer[arr.length];
            for (int i=0; i<arr.length; i++){
                keys[i] = Integer.parseInt(arr[i]);
            }
        }


      //Get number of threads
        String numThreads = args.get("-threads");
        if (numThreads==null) numThreads = args.get("-t");
        if (numThreads==null) numThreads = "1";


      //Import file
        Neo4J graph = Config.getGraph(null);
        if (fileType.equals("csv")){
            bluewave.graph.Import.importCSV(file, nodeType, keys, Integer.parseInt(numThreads), graph);
        }
        else if (fileType.equals("json")){
            String target = args.get("-target");
            bluewave.graph.Import.importJSON(file, nodeType, target, graph);
        }
        graph.close();
    }


  //**************************************************************************
  //** delete
  //**************************************************************************
    private static void delete(HashMap<String, String> args) throws Exception {
        String str = args.get("-delete").toLowerCase();
        if (str.equals("user")){

            Config.initDatabase();
            User user = null;
            try{
                user = new User(Long.parseLong(args.get("-id")));
            }
            catch(Exception e){
                e.printStackTrace();
                try{
                    user = User.get("username=", args.get("-username"));
                }
                catch(Exception ex){
                    ex.printStackTrace();
                }
            }

            user.delete();

        }
        else if (str.equals("nodes")){
            Neo4J graph = Config.getGraph(null);
            bluewave.graph.Maintenance.deleteNodes(args.get("-label"), graph);
            graph.close();
        }
        else if (str.equals("dashboard")){
            Config.initDatabase();
            for (String s : args.get("-id").split(",")){
                try{
                    Long id = Long.parseLong(s);
                    new bluewave.app.Dashboard(id).delete();
                }
                catch(Exception e){
                    console.log("Failed to delete " + s);
                }
            }
        }
        else if (str.equalsIgnoreCase("DocumentComparison")){
            Config.initDatabase();
            for (bluewave.app.DocumentComparison dc : bluewave.app.DocumentComparison.find()){
                dc.delete();
            }
        }
        else if (str.equals("index")){
            Config.initDatabase();
            for (bluewave.app.DocumentComparison dc : bluewave.app.DocumentComparison.find()){
                dc.delete();
            }
            for (bluewave.app.Document d : bluewave.app.Document.find()){
                d.delete();
            }
            for (bluewave.app.File f : bluewave.app.File.find()){
                f.delete();
            }
            javaxt.io.Directory dir = Config.getIndexDir();
            boolean deletedDir = dir.delete();
            if (deletedDir){
                System.out.println("Sucessfully deleted index: " + dir);
            }
            else{
                System.out.println("Failed to delete index: " + dir);
            }
        }
        else{
            System.out.println("Unsupported delete option: " + str);
        }
    }


  //**************************************************************************
  //** createIndex
  //**************************************************************************
    private static void createIndex(HashMap<String, String> args) throws Exception {

        String[] arr = args.get("-createIndex").split("\\.");
        String nodeName = arr[0];
        String field = arr[1];

        Neo4J graph = Config.getGraph(null);
        try{
            bluewave.graph.Maintenance.createIndex(nodeName, field, graph);
        }
        catch(Exception e){
            e.printStackTrace();
        }
        graph.close();
    }


  //**************************************************************************
  //** test
  //**************************************************************************
    private static void test(HashMap<String, String> args) throws Exception {
        String test = args.get("-test");
        if (test==null) test = "";
        if (test.equalsIgnoreCase("neo4j")){
            Neo4J graph = Config.getGraph(null);
            Session session = null;
            try{
                session = graph.getSession();

              //Get Neo4J server version and edition
                String versionString = null;
                try{
                    String q = "call dbms.components() yield name, versions, edition unwind versions as version return name, version, edition;";
                    Result rs = session.run(q);
                    if (rs.hasNext()){
                        org.neo4j.driver.Record r = rs.next();
                        versionString = r.get(0).asString() + "/" + r.get(1).asString() + " (" + r.get(2).asString() + ")";
                    }
                }
                catch(Exception e){}
                if (versionString==null) System.out.println("Unknown Neo4J version");
                else System.out.println(versionString);



                String query = args.get("-query");
                if (query!=null){
                    query = bluewave.queries.Index.getQuery(query, "cypher");
                }

                if (query==null){
                    System.out.println("Nodes/Links:");
                    Result rs = session.run("MATCH (n) RETURN distinct labels(n)");
                    while (rs.hasNext()){
                        org.neo4j.driver.Record r = rs.next();
                        List labels = r.get(0).asList();
                        if (labels.isEmpty()) continue;
                        String label = labels.get(0).toString();
                        System.out.println(" -" + label);
                    }
                }
                else{
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        org.neo4j.driver.Record r = rs.next();
                        Iterator<String> it = r.keys().iterator();
                        while (it.hasNext()){
                            String key = it.next();
                            org.neo4j.driver.Value val = r.get(key);
                            console.log(key, val);
                        }
                    }
                }
                session.close();
            }
            catch(Exception e){
                if (session!=null) session.close();
                throw e;
            }
            graph.close();
        }
        else if (test.equalsIgnoreCase("premier")){
            bluewave.data.Premier.testConnect(args.get("-username"), args.get("-password"));
        }
        else if (test.equals("company")){

            String name = args.get("-name");
            console.log(name);
            console.log(getCompanyName(name));

        }
        else if (test.equalsIgnoreCase("document")){
            javaxt.io.Directory jobDir = Config.getDirectory("webserver", "jobDir");
            javaxt.io.Directory indexDir = new javaxt.io.Directory(jobDir.toString() + "index");
            javaxt.io.Directory searchDir = Config.getDirectory("webserver", "uploadDir");
            if (searchDir==null) searchDir = new javaxt.io.Directory(jobDir.toString()+"uploads");

            console.log("Searching:", searchDir);
            console.log("Using Index:", indexDir);

            bluewave.utils.FileIndex index = new bluewave.utils.FileIndex(indexDir);
            for (javaxt.io.File file : searchDir.getFiles("*.pdf", true)){
                try{
                    index.addFile(file);
                }
                catch(Exception e){
                    //e.printStackTrace();
                }
            }


            int totalHits = 0;
            TreeMap<Float, ArrayList<javaxt.io.File>> results = index.findFiles(args.get("-query"));
            Iterator<Float> it = results.descendingKeySet().iterator();
            while (it.hasNext()){
                float score = it.next();
                ArrayList<javaxt.io.File> files = results.get(score);
                for (javaxt.io.File file : files){
                    console.log(score, file);
                    totalHits++;
                }
            }

            console.log("done! hits: " + totalHits);
        }
        else if (test.equalsIgnoreCase("syncUsers")){
            bluewave.graph.Maintenance.syncUsers(Config.getGraph(null));
        }
        else{
            console.log("Unsupported test: " + test);
        }
    }


  //**************************************************************************
  //** rtrim
  //**************************************************************************
    private static String rtrim(String s) {
        int i = s.length()-1;
        while (i >= 0 && Character.isWhitespace(s.charAt(i))) {
            i--;
        }
        return s.substring(0,i+1);
    }
}