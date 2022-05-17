package bluewave;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javaxt.express.utils.DbUtils;
import static javaxt.utils.Console.console;
import javaxt.json.*;
import javaxt.sql.*;


//******************************************************************************
//**  Config Class
//******************************************************************************
/**
 *   Provides thread-safe, static methods used to get and set application
 *   variables.
 *
 ******************************************************************************/

public class Config {

    private static javaxt.express.Config config = new javaxt.express.Config();
    private Config(){}


  //**************************************************************************
  //** load
  //**************************************************************************
  /** Used to load a config file (JSON) and update config settings
   */
    public static void load(javaxt.io.File configFile, javaxt.io.Jar jar) throws Exception {

      //Parse config file
        JSONObject json = new JSONObject(configFile.getText());


      //Get database config
        JSONObject dbConfig = json.get("database").toJSONObject();


      //Update path to the database (H2 only)
        if (dbConfig.has("path")){
            updateFile("path", dbConfig, configFile);
            String path = dbConfig.get("path").toString().replace("\\", "/");
            dbConfig.set("host", path);
            dbConfig.remove("path");
        }


      //Get schema
        javaxt.io.File schemaFile = null;
        if (dbConfig.has("schema")){
            updateFile("schema", dbConfig, configFile);
            schemaFile = new javaxt.io.File(dbConfig.get("schema").toString());
            dbConfig.remove("schema");
        }


      //Update relative paths in the web config
        JSONObject webConfig = json.get("webserver").toJSONObject();
        updateDir("webDir", webConfig, configFile, false);
        updateDir("logDir", webConfig, configFile, true);
        updateDir("jobDir", webConfig, configFile, true);
        updateDir("scriptDir", webConfig, configFile, false);
        updateDir("pluginDir", webConfig, configFile, false);
        updateFile("keystore", webConfig, configFile);


      //Update relative paths in the graph config
        JSONObject graphConfig = json.get("graph").toJSONObject();
        updateDir("localLog", graphConfig, configFile, true);
        updateDir("localCache", graphConfig, configFile, true);


      //Load config
        config.init(json);


      //Add additional properties to the config
        config.set("jar", jar);
        config.set("configFile", configFile);
        Properties props = config.getDatabase().getProperties();
        if (props==null){
            props = new Properties();
            config.getDatabase().setProperties(props);
        }
        props.put("schema", schemaFile);
    }


  //**************************************************************************
  //** initDatabase
  //**************************************************************************
  /** Used to initialize the database
   */
    public static void initDatabase() throws Exception {
        Database database = config.getDatabase();


      //Get database schema
        String schema = null;
        Object obj = config.getDatabase().getProperties().get("schema");
        if (obj!=null){
            javaxt.io.File schemaFile = (javaxt.io.File) obj;
            if (schemaFile.exists()){
                schema = schemaFile.getText();
            }
        }
        if (schema==null) throw new Exception("Schema not found");


      //Initialize schema (create tables, indexes, etc)
        DbUtils.initSchema(database, schema, null);


      //Inititalize connection pool
        database.initConnectionPool();


      //Initialize models
        javaxt.io.Jar jar = (javaxt.io.Jar) config.get("jar").toObject();
        Model.init(jar, database.getConnectionPool());
    }


  //**************************************************************************
  //** has
  //**************************************************************************
  /** Returns true if the config has a given key.
   */
    public static boolean has(String key){
        return config.has(key);
    }


  //**************************************************************************
  //** get
  //**************************************************************************
  /** Returns the value for a given key.
   */
    public static JSONValue get(String key){
        return config.get(key);
    }


  //**************************************************************************
  //** set
  //**************************************************************************
    public static void set(String key, Object value){
        config.set(key, value);
    }


  //**************************************************************************
  //** save
  //**************************************************************************
    public static void save(){
        javaxt.io.File configFile = (javaxt.io.File) config.get("configFile").toObject();
        configFile.write(toJson().toString(4));
    }


  //**************************************************************************
  //** toJson
  //**************************************************************************
    public static JSONObject toJson(){

      //Get config file path
        javaxt.io.File configFile = (javaxt.io.File) config.get("configFile").toObject();
        String configPath = configFile.getDirectory().toString().replace("\\", "/");
        int len = configPath.length();


      //Get json formatted config data
        JSONObject json = config.toJson();


      //Remove keys that should not be saved
        json.remove("schema");
        json.remove("jar");


      //Update json for the database config
        JSONObject database = json.get("database").toJSONObject();
        if (database.get("driver").toString().equalsIgnoreCase("H2")){
            String host = database.get("host").toString().replace("\\", "/");
            if (host.startsWith(configPath)) host = host.substring(len);
            database.set("path", host);
            database.remove("host");
            Object obj = config.getDatabase().getProperties().get("schema");
            if (obj!=null){
                javaxt.io.File schemaFile = (javaxt.io.File) obj;
                String schema = schemaFile.toString().replace("\\", "/");
                if (schema.startsWith(configPath)) schema = schema.substring(len);
                database.set("schema", schema);
            }
        }


      //Update json for the graph config
        bluewave.graph.Neo4J graph = getGraph(null);
        JSONObject db = new JSONObject();
        db.set("host", graph.getHost() + ":" + graph.getPort());
        db.set("username", graph.getUsername());
        db.set("password", graph.getPassword());
        Properties properties = graph.getProperties();
        for (String key : new String[]{"localLog", "localCache"}){
            String path = properties.get(key).toString().replace("\\", "/");
            if (path.startsWith(configPath)) path = path.substring(len);
            db.set(key, path);
        }
        json.set("graph", db);


      //Update json for the web config
        JSONObject webConfig = json.get("webserver").toJSONObject();
        for (String key : new String[]{"webDir", "logDir", "jobDir", "keystore"}){
            String path = webConfig.get(key).toString();
            if (path!=null){
                path = path.replace("\\", "/");
                if (path.startsWith(configPath)) path = path.substring(len);
                webConfig.set(key, path);
            }
        }


        return json;
    }


  //**************************************************************************
  //** getDatabase
  //**************************************************************************
    public static javaxt.sql.Database getDatabase(){
        return config.getDatabase();
    }


  //**************************************************************************
  //** getGraph
  //**************************************************************************
    public static bluewave.graph.Neo4J getGraph(bluewave.app.User user){
        String key = "graph";
        JSONValue val = get(key);
        if (val==null) return null;


        String[] credentials;
        if (user!=null) credentials = user.getGraphCredentials();
        else credentials = new String[]{"neo4j"};
        String username = credentials[0];


        if (val.toObject() instanceof ConcurrentHashMap){
            ConcurrentHashMap map = (ConcurrentHashMap) val.toObject();

            Object obj = map.get(username);
            if (obj==null){
                bluewave.graph.Neo4J neo4j = ((bluewave.graph.Neo4J) map.get("neo4j")).clone();
                neo4j.setUsername(username);
                neo4j.setPassword(credentials[1]);
                synchronized(map){
                    map.put(username, neo4j);
                    map.notify();
                }
                return neo4j;
            }
            else{
                return (bluewave.graph.Neo4J) obj;
            }
        }
        else{

            JSONObject json = get(key).toJSONObject();
            if (json==null) return null;
            bluewave.graph.Neo4J neo4j = new bluewave.graph.Neo4J();
            neo4j.setHost(json.get("host").toString());
            neo4j.setUsername(json.get("username").toString());
            neo4j.setPassword(json.get("password").toString());
            Properties properties = neo4j.getProperties();
            properties.put("localLog", json.get("localLog"));
            properties.put("localCache", json.get("localCache"));

            ConcurrentHashMap<String, bluewave.graph.Neo4J> map = new ConcurrentHashMap<>();
            map.put("neo4j", neo4j);
            config.set(key, map);

            if (user!=null){
                neo4j = neo4j.clone();
                neo4j.setUsername(username);
                neo4j.setPassword(credentials[1]);
                map.put(username, neo4j);
            }

            return neo4j;
        }
    }


  //**************************************************************************
  //** getLDAP
  //**************************************************************************
    public static bluewave.auth.LDAP getLDAP(){
        String key = "ldap";
        JSONValue val = get(key);
        if (val==null) return null;
        if (val.toObject() instanceof bluewave.auth.LDAP){
            return (bluewave.auth.LDAP) val.toObject();
        }
        else{
            bluewave.auth.LDAP ldap = new bluewave.auth.LDAP();
            JSONObject json = get(key).toJSONObject();
            ldap.setHost(json.get("host").toString());
            ldap.setDomain(json.get("domain").toString());
            config.set(key, ldap);
            return ldap;
        }
    }


  //**************************************************************************
  //** getIndexDir
  //**************************************************************************
    public static javaxt.io.Directory getIndexDir() {
        javaxt.io.Directory indexDir = null;
        javaxt.io.Directory jobDir = getDirectory("webserver", "jobDir");
        if (jobDir!=null){
            indexDir = new javaxt.io.Directory(jobDir.toString() + "index");
            indexDir.create();
        }
        if (indexDir==null || !indexDir.exists()){
            throw new IllegalArgumentException("Invalid \"jobDir\" defined in the \"webserver\" section of the config file");
        }
        return indexDir;
    }

    
  //**************************************************************************
  //** getPlugins
  //**************************************************************************
    public static ArrayList<Plugin> getPlugins(){       
        ArrayList<Plugin> plugins = new ArrayList<>();
        try{
            javaxt.io.Directory pluginDir = getDirectory("webserver", "pluginDir");
            if (pluginDir!=null){
                for (javaxt.io.File xmlFile : pluginDir.getFiles("plugin.xml", true)){
                    plugins.add(new Plugin(xmlFile));
                }
            }
        }
        catch(Exception e){}
        return plugins;
    }


  //**************************************************************************
  //** getDirectory
  //**************************************************************************
  /** Simple helper class used to get a directory specified in the config file
   *  javaxt.io.Directory jobDir = Config.getDirectory("webserver", "jobDir");
   */
    public static javaxt.io.Directory getDirectory(String... keys){
        try{
            JSONValue config = null;
            for (String key : keys){
                if (config==null) config = Config.get(key);
                else config = config.get(key);
                if (config==null) return null;
            }

            String dir = config.toString().trim();
            return new javaxt.io.Directory(dir);
        }
        catch(Exception e){
            return null;
        }
    }


  //**************************************************************************
  //** getFile
  //**************************************************************************
  /** Returns a File for a given path
   *  @param path Full canonical path to a file or a relative path (relative
   *  to the jarFile)
   */
    public static javaxt.io.File getFile(String path, javaxt.io.File jarFile){
        javaxt.io.File file = new javaxt.io.File(path);
        if (!file.exists()){
            file = new javaxt.io.File(jarFile.MapPath(path));
        }
        return file;
    }


  //**************************************************************************
  //** updateDir
  //**************************************************************************
  /** Used to update a path to a directory defined in a config file. Resolves
   *  both canonical and relative paths (relative to the configFile).
   */
    public static void updateDir(String key, JSONObject config, javaxt.io.File configFile, boolean create){
        if (config!=null && config.has(key)){
            String path = config.get(key).toString();
            if (path==null){
                config.remove(key);
            }
            else{
                path = path.trim();
                if (path.length()==0){
                    config.remove(key);
                }
                else{

                    javaxt.io.Directory dir = new javaxt.io.Directory(path);
                    if (dir.exists()){
                        try{
                            java.io.File f = new java.io.File(path);
                            javaxt.io.Directory d = new javaxt.io.Directory(f.getCanonicalFile());
                            if (!dir.toString().equals(d.toString())){
                                dir = d;
                            }
                        }
                        catch(Exception e){
                        }
                    }
                    else{
                        dir = new javaxt.io.Directory(new java.io.File(configFile.MapPath(path)));
                    }


                    if (!dir.exists() && create) dir.create();


                    if (dir.exists()){
                        config.set(key, dir.toString());
                    }
                    else{
                        config.remove(key);
                    }
                }
            }
        }
    }


  //**************************************************************************
  //** updateFile
  //**************************************************************************
  /** Used to update a path to a file defined in a config file. Resolves
   *  both canonical and relative paths (relative to the configFile).
   */
    public static void updateFile(String key, JSONObject config, javaxt.io.File configFile){
        if (config.has(key)){
            String path = config.get(key).toString();
            if (path==null){
                config.remove(key);
            }
            else{
                path = path.trim();
                if (path.length()==0){
                    config.remove(key);
                }
                else{

                    javaxt.io.File file = new javaxt.io.File(path);
                    if (file.exists()){
                        try{
                            java.io.File f = new java.io.File(path);
                            javaxt.io.File _file = new javaxt.io.File(f.getCanonicalFile());
                            if (!file.toString().equals(_file.toString())){
                                file = _file;
                            }
                        }
                        catch(Exception e){
                        }
                    }
                    else{
                        file = new javaxt.io.File(configFile.MapPath(path));
                    }

                    config.set(key, file.toString());
//                    if (file.exists()){
//                        config.set(key, file.toString());
//                    }
//                    else{
//                        config.remove(key);
//                    }
                }
            }
        }
    }

}