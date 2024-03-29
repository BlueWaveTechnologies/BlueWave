package bluewave;
import bluewave.app.User;
import bluewave.graph.Neo4J;
import bluewave.web.WebApp;
import static bluewave.utils.StringUtils.*;

import java.util.*;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.net.InetSocketAddress;

import javaxt.sql.*;
import javaxt.json.*;
import javaxt.io.Jar;
import javaxt.express.ConfigFile;
import static javaxt.utils.Console.*;

import org.neo4j.driver.*;



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
            ConfigFile.getFile(args.get("-config"), jarFile) :
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
        else if (args.containsKey("-export")){
            export(args);
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


              //Create new admin user as needed
                boolean authEnabled = true;
                String auth = webConfig.get("auth").toString();
                if (auth!=null){
                    if (auth.equalsIgnoreCase("DISABLED")) authEnabled=false;
                }
                if (authEnabled){
                    User adminUser = User.get("access_level=",5,"active=",true);
                    if (adminUser==null){
                        System.out.println("Auth enabled but missing admin user.");
                        String username = console.getUserName("Enter username: ");
                        String password = getPassword(args);

                        User user = new User();
                        user.setUsername(username);
                        user.setPassword(password);
                        user.setActive(true);
                        user.setAccessLevel(5);
                        user.save();
                        System.out.println("User created");

                    }
                }



              //Get port (optional)
                if (args.containsKey("-port")){
                    Integer port = Integer.parseInt(args.get("-port"));
                    if (port!=null) webConfig.set("port", port);
                }


              //Start web app
                new WebApp(webConfig).start();
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
            ConfigFile.updateFile("path", dbConfig, configFile);
            String path = dbConfig.get("path").toString().replace("\\", "/");
            dbConfig.set("host", path);
            dbConfig.remove("path");
        }


        javaxt.express.Config config = new javaxt.express.Config();
        config.init(json);
        Database database = config.getDatabase();



      //Split updates into individual statements
        ArrayList<String> statements = new ArrayList<>();
        for (String s : updates.split(";")){

            StringBuilder str = new StringBuilder();
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
        try (Connection conn = database.getConnection()){

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
        else if (str.equals("index")){
            Config.initDatabase();
            for (bluewave.app.Document d : bluewave.app.Document.find()){
                d.delete();
            }
            for (bluewave.app.File f : bluewave.app.File.find()){
                f.delete();
            }
        }
        else if (str.equals("table")){
            String name = args.get("-name");

            Config.initDatabase();
            Database database = Config.getDatabase();
            try (Connection conn = database.getConnection()){
                conn.execute("drop table " + name + " cascade");
            }
            System.out.println("Successfully dropped table");
        }
        else{
            System.out.println("Unsupported delete option: " + str);
        }
    }


  //**************************************************************************
  //** export
  //**************************************************************************
    private static void export(HashMap<String, String> args) throws Exception {
        String str = args.get("-export").toLowerCase();
        if (str.equals("table")){

            String tableName = args.get("-name").toLowerCase();
            String path = args.get("-path").toLowerCase();

            javaxt.io.Directory dir = new javaxt.io.Directory(path);
            javaxt.io.File file = new javaxt.io.File(dir, tableName + ".csv");
            file.create();


            Config.initDatabase();


            try (java.io.BufferedWriter out = file.getBufferedWriter("UTF-8")){

                boolean addHeader = true;
                for (javaxt.sql.Record record : Config.getDatabase().getRecords(
                "select * from " + tableName)){

                    Field[] fields = record.getFields();
                    if (addHeader){
                        for (int i=0; i<fields.length; i++){
                            if (i>0) out.write(",");
                            out.write(fields[i].getName());
                        }
                        addHeader = false;
                    }

                    out.write("\n");
                    for (int i=0; i<fields.length; i++){
                        if (i>0) out.write(",");
                        String val = fields[i].getValue().toString();
                        if (val!=null){
                            if (val.contains(",")) val = "\"" + val + "\"";
                            out.write(val);
                        }
                    }

                }
            }


        }
        else if (str.equals("countries")){

            String path = args.get("-path").toLowerCase();

            javaxt.io.Directory dir = new javaxt.io.Directory(path);
            javaxt.io.File file = new javaxt.io.File(dir, "countries.csv");
            file.create();

            try (java.io.BufferedWriter out = file.getBufferedWriter("UTF-8")){

                out.write("Name,ISO_Code,Latitude,Longitude");
                String[] keys = new String[]{"name","code","latitude","longitude"};

                javaxt.io.Directory web = bluewave.Config.getDirectory("webserver","webDir");
                javaxt.io.File countryFile = new javaxt.io.File(web + "data/countries.js");
                String text = countryFile.getText();
                JSONObject json = new JSONObject(text.substring(text.indexOf("\n{")));
                bluewave.utils.TopoJson topoJson = new bluewave.utils.TopoJson(json, "countries");
                for (bluewave.utils.TopoJson.Entry entry : topoJson.getEntries()){
                    JSONObject properties = entry.getProperties();
                    //console.log(properties.toString(2));

                    out.write("\r\n");
                    for (int i=0; i<keys.length; i++){
                        String key = keys[i];
                        String val = properties.get(key).toString();
                        if (val==null) val = "";
                        if (val.contains(",")) val = "\"" + val + "\"";
                        if (i>0) out.write(",");
                        out.write(val);
                    }
                }
            }
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
        else if (test.equalsIgnoreCase("database")){
            Config.initDatabase();
            Database database = Config.getDatabase();
            System.out.println(database);
            for (Table table : database.getTables()){
                System.out.println(table);
            }
        }
        else if (test.equals("company")){

            String name = args.get("-name");
            console.log(name);
            console.log(getCompanyName(name));
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