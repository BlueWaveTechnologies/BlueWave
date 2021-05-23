package bluewave;
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
  //** init
  //**************************************************************************
  /** Used to load a config file (JSON) and initialize the database
   */
    public static void init(javaxt.io.File configFile, javaxt.io.Jar jar) throws Exception {


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
        javaxt.io.File schema = null;
        if (dbConfig.has("schema")){
            updateFile("schema", dbConfig, configFile);
            schema = new javaxt.io.File(dbConfig.get("schema").toString());
            dbConfig.remove("schema");
        }
        if (schema==null || !schema.exists()) throw new Exception("Schema not found");


      //Update relative paths in the web config
        JSONObject webConfig = json.get("webserver").toJSONObject();
        updateDir("webDir", webConfig, configFile, false);
        updateDir("logDir", webConfig, configFile, true);
        updateDir("jobDir", webConfig, configFile, true);
        updateFile("keystore", webConfig, configFile);


      //Load config
        config.init(json);


      //Get database connection info
        Database database = getDatabase();


      //Initialize schema (create tables, indexes, etc)
        DbUtils.initSchema(database, schema.getText(), null);


      //Inititalize connection pool
        database.initConnectionPool();


      //Initialize models
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
    public static bluewave.graph.Neo4J getGraph(){
        String key = "graph";
        JSONValue val = get(key);
        if (val==null) return null;
        if (val.toObject() instanceof bluewave.graph.Neo4J){
            return (bluewave.graph.Neo4J) val.toObject();
        }
        else{
            bluewave.graph.Neo4J database = new bluewave.graph.Neo4J();
            JSONObject json = get(key).toJSONObject();
            database.setHost(json.get("host").toString());
            database.setUsername(json.get("username").toString());
            database.setPassword(json.get("password").toString());
            config.set(key, database);
            return database;
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
                    if (!dir.exists()) dir = new javaxt.io.Directory(configFile.MapPath(path));

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
                    if (!file.exists()) file = new javaxt.io.File(configFile.MapPath(path));

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