package bluewave;
import bluewave.app.User;
import bluewave.graph.Neo4J;
import bluewave.web.WebApp;

import java.util.*;
import java.net.InetSocketAddress;

import javaxt.json.*;
import javaxt.io.Jar;
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
            Config.getFile(args.get("-config"), jarFile) :
            new javaxt.io.File(jar.getFile().getParentFile(), "config.json");

        if (!configFile.exists()) {
            System.out.println("Could not find config file. Use the \"-config\" parameter to specify a path to a config");
            return;
        }



      //Initialize config
        Config.init(configFile, jar);


      //Process command line args
        if (args.containsKey("-addUser")){
            addUser(args);
        }
        else if (args.containsKey("-import")){
            importFile(args);
        }
        else if (args.containsKey("-delete")){
            Neo4J graph = Config.getGraph();
            bluewave.graph.Maintenance.deleteNodes(args.get("-delete"), graph);
            graph.close();
        }
        else if (args.containsKey("-test")){
            test(args);
        }
        else{ //start server
            if (!Config.has("webserver")){
                throw new Exception("Config file is missing \"webserver\" config information");
            }
            else{
                JSONObject webConfig = Config.get("webserver").toJSONObject();
                ArrayList<InetSocketAddress> addresses = new ArrayList<>();
                Integer port = webConfig.get("port").toInteger();
                addresses.add(new InetSocketAddress("0.0.0.0", port==null ? 80 : port));
                new javaxt.http.Server(addresses, 250, new WebApp(webConfig)).start();
            }
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
        String pw = console.getPassword("Enter password >");
        String pw2 = console.getPassword("Confirm password >");
        if (!pw.equals(pw2)) {
            System.out.println("Passwords do not match. Please try again");
            addUser(args);
        }
        User user = new User();
        user.setUsername(name);
        user.setPassword(pw);
        user.setActive(true);
        user.setAccessLevel(accessLevel);
        user.save();
        System.out.println("User created");
    }


  //**************************************************************************
  //** importFile
  //**************************************************************************
    private static void importFile(HashMap<String, String> args) throws Exception {

      //Get file and extension
        String filePath = args.get("-import");
        javaxt.io.File file = new javaxt.io.File(filePath);
        if (!file.exists()) throw new IllegalArgumentException("-import file is invalid");
        String fileType = file.getExtension().toLowerCase();


      //Get node type
        String nodeType = args.get("-nodeType");
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


      //Import file
        Neo4J graph = Config.getGraph();
        if (fileType.equals("csv")){
            bluewave.graph.Import.importCSV(file, nodeType, keys, graph);
        }
        else if (fileType.equals("json")){
            String target = args.get("-target");
            bluewave.graph.Import.importJSON(file, nodeType, target, graph);
        }
        graph.close();
    }


  //**************************************************************************
  //** test
  //**************************************************************************
    private static void test(HashMap<String, String> args) throws Exception {
        String test = args.get("-test");
        if (test.equalsIgnoreCase("neo4j")){
            Neo4J graph = Config.getGraph();
            Session session = null;
            try{
                session = graph.getSession();
                String versionString = session.readTransaction( tx -> tx.run( "RETURN 1" ).consume().server().version() );
                System.out.println(versionString);

                String query = args.get("-query");
                if (query!=null){
                    query = bluewave.queries.Index.getQuery(query, "cypher");
                }

                if (query==null){
                    System.out.println("Nodes/Links:");
                    Result rs = session.run("MATCH (n) RETURN distinct labels(n)");
                    while (rs.hasNext()){
                        Record r = rs.next();
                        List labels = r.get(0).asList();
                        String label = labels.get(0).toString();
                        System.out.println(" -" + label);
                    }
                }
                else{
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record r = rs.next();
                        Iterator<String> it = r.keys().iterator();
                        while (it.hasNext()){
                            String key = it.next();
                            Value val = r.get(key);
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
        else{
            console.log("Unsupported test: " + test);
        }
    }
}