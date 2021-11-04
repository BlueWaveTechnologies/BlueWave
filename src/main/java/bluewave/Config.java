package bluewave;
import java.util.Properties;
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
        String schema = null;
        if (dbConfig.has("schema")){
            updateFile("schema", dbConfig, configFile);
            javaxt.io.File schemaFile = new javaxt.io.File(dbConfig.get("schema").toString());
            dbConfig.remove("schema");
            if (schemaFile.exists()){
                json.set("schema", schemaFile.getText());
            }
        }


      //Update relative paths in the web config
        JSONObject webConfig = json.get("webserver").toJSONObject();
        updateDir("webDir", webConfig, configFile, false);
        updateDir("logDir", webConfig, configFile, true);
        updateDir("jobDir", webConfig, configFile, true);
        updateDir("scriptDir", webConfig, configFile, false);
        updateFile("keystore", webConfig, configFile);


      //Update relative paths in the graph config
        JSONObject graphConfig = json.get("graph").toJSONObject();
        updateDir("localLog", graphConfig, configFile, true);
        updateDir("localCache", graphConfig, configFile, true);


      //Load config
        config.init(json);


        config.set("jar", jar);
    }


  //**************************************************************************
  //** initDatabase
  //**************************************************************************
  /** Used to initialize the database
   */
    public static void initDatabase() throws Exception {
        Database database = config.getDatabase();

        String schema = config.get("schema").toString();
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