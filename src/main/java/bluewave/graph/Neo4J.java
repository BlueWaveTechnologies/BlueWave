package bluewave.graph;
import java.util.logging.Level;
import org.neo4j.driver.*;
import static org.neo4j.driver.SessionConfig.builder;
import java.util.Properties;

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
    }

}