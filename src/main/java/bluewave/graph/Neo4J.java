package bluewave.graph;
import java.util.logging.Level;
import org.neo4j.driver.*;
import static org.neo4j.driver.SessionConfig.builder;
import java.util.Properties;
import javaxt.json.JSONObject;

//******************************************************************************
//**  Neo4J
//******************************************************************************
/**
 *   Used to represent connection information for a Neo4J database
 *
 ******************************************************************************/

public class Neo4J implements AutoCloseable {
    private Driver driver;
    private int port = 7687;
    private String host;
    private String username;
    private String password;
    private Properties properties;
    private String edition;
    private String version;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public Neo4J(){
        properties = new Properties();
    }


  //**************************************************************************
  //** clone
  //**************************************************************************
    public Neo4J clone(){
        Neo4J neo4j = new Neo4J();
        neo4j.host = host;
        neo4j.port = port;
        neo4j.username = username;
        neo4j.password = password;
        neo4j.properties = (Properties) properties.clone();
        neo4j.edition = edition;
        return neo4j;
    }


  //**************************************************************************
  //** getUsername
  //**************************************************************************
    public String getUsername(){
        return username;
    }


  //**************************************************************************
  //** setUsername
  //**************************************************************************
    public void setUsername(String username){
        if (driver!=null) driver.close();
        this.username = username;
    }


  //**************************************************************************
  //** getPassword
  //**************************************************************************
    public String getPassword(){
        return password;
    }


  //**************************************************************************
  //** setPassword
  //**************************************************************************
    public void setPassword(String password){
        if (driver!=null) driver.close();
        this.password = password;
    }


  //**************************************************************************
  //** getHost
  //**************************************************************************
    public String getHost(){
        return host;
    }


  //**************************************************************************
  //** setHost
  //**************************************************************************
    public void setHost(String host){
        if (driver!=null) driver.close();
        if (host.contains(":")){
            String[] arr = host.split(":");
            this.host = arr[0];
            this.port = Integer.parseInt(arr[1]);
        }
        else{
            this.host = host;
        }
    }


  //**************************************************************************
  //** getPort
  //**************************************************************************
    public int getPort(){
        return port;
    }


  //**************************************************************************
  //** setPort
  //**************************************************************************
    public void setPort(int port){
        if (driver!=null) driver.close();
        this.port = port;
    }


  //**************************************************************************
  //** getProperties
  //**************************************************************************
    public Properties getProperties(){
        return properties;
    }


  //**************************************************************************
  //** getSession
  //**************************************************************************
    public Session getSession(){
        return getSession(true);
    }


  //**************************************************************************
  //** getSession
  //**************************************************************************
    public Session getSession(boolean readOnly){
        if (readOnly){
            return getDriver().session();
        }
        else{
            return getDriver().session( builder().withDefaultAccessMode( AccessMode.WRITE ).build());
        }
    }


  //**************************************************************************
  //** getDriver
  //**************************************************************************
    private Driver getDriver(){
        if (driver==null){
            driver = GraphDatabase.driver(
                "bolt://" + host + ":" + port,
                AuthTokens.basic( username, password ),
                Config.builder().withLogging(Logging.javaUtilLogging(Level.SEVERE)).build()
            );
        }
        return driver;
    }


  //**************************************************************************
  //** close
  //**************************************************************************
    @Override
    public void close() throws Exception{
        if (driver!=null){
            driver.close();
            driver = null;
        }
        version = edition = null;
    }


  //**************************************************************************
  //** getVersion
  //**************************************************************************
  /** Returns the version number of the Neo4J server
   */
    public String getVersion() {
        if (version==null) getServerInfo();
        return version;
    }


  //**************************************************************************
  //** getEdition
  //**************************************************************************
  /** Returns the edition name of the Neo4J server (e.g. enterprise, community)
   */
    public String getEdition() {
        if (edition==null) getServerInfo();
        return edition;
    }


  //**************************************************************************
  //** getServerInfo
  //**************************************************************************
  /** Executes query to get the edition and version of the Neo4J server
   */
    private void getServerInfo() {
        Session session = null;
        try{
            session = getSession();
            Result rs = session.run("call dbms.components() yield versions, edition " +
            "unwind versions as version return version, edition");
            while (rs.hasNext()){
                org.neo4j.driver.Record r = rs.next();
                version = r.get(0).asString();
                edition = r.get(1).asString().toLowerCase();
            }
            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            //throw e;
        }
    }


  //**************************************************************************
  //** toJson
  //**************************************************************************
  /** Returns a json representation of this object
   */
    public JSONObject toJson(){
        JSONObject json = new JSONObject();
        json.set("username", getUsername());
        json.set("password", getPassword());
        json.set("host", getHost());
        json.set("port", getPort());
        json.set("version", getVersion());
        json.set("edition", getEdition());
        return json;
    }

}