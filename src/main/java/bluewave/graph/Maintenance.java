package bluewave.graph;

import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

import static javaxt.utils.Console.*;

import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;

//******************************************************************************
//**  Maintenance Class
//******************************************************************************
/**
 *   Provides static methods used to clean-up the database
 *
 ******************************************************************************/

public class Maintenance {


  //**************************************************************************
  //** createUser
  //**************************************************************************
  /** Used to create a new user account in the graph database
   */
    public static void createUser(String username, String password, Neo4J graph) throws Exception {
        String cmd = "CREATE USER " + username + " IF NOT EXISTS SET PASSWORD '" + password + "'";
        try{
            execute(cmd, graph);
            console.log("Successfully created user: " + cmd);
        }
        catch(Exception e){
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** deleteUser
  //**************************************************************************
  /** Used to delete a user account in the graph database
   */
    public static void deleteUser(String username, Neo4J graph) throws Exception{
        String cmd = "DROP USER " + username + " IF EXISTS";
        try{
            execute(cmd, graph);
            console.log("Successfully deleted user: " + cmd);
        }
        catch(Exception e){
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** setUserRole
  //**************************************************************************
    public static void setRole(String username, String role, Neo4J graph) throws Exception{
        String cmd = "GRANT ROLE " + role + " TO " + username;
        try{
            execute(cmd, graph);
            console.log("Successfully updated user: " + cmd);
        }
        catch(Exception e){
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** setPassword
  //**************************************************************************
    public static void setPassword(String username, String password, Neo4J graph) throws Exception{
        String cmd = "ALTER USER " + username + " IF EXISTS SET PASSWORD '" + password + "'";
        try{
            execute(cmd, graph);
            console.log("Successfully updated user: " + cmd);
        }
        catch(Exception e){
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** createIndex
  //**************************************************************************
  /** Used to create an index for a property on a node
   */
    public static void createIndex(String nodeName, String columnName, Neo4J graph) throws Exception {

        String indexName = "idx_" + nodeName + "_" + columnName;
        try{
            String cmd = "CREATE INDEX " + indexName + " IF NOT EXISTS FOR (n:" + nodeName + ") ON (";
            cmd += "n." + columnName;
            cmd += ")";
            execute(cmd, graph);
            console.log("Successfully created index: " + indexName);
        }
        catch(Exception e){
            throw e;
        }
    }

    
  //**************************************************************************
  //** execute
  //**************************************************************************
    private static void execute(String cmd, Neo4J graph) throws Exception {
        Session session = null;
        try{
            session = graph.getSession();
            session.run(cmd);
            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            throw e;
        }
    }
    

  //**************************************************************************
  //** deleteNodes
  //**************************************************************************
  /** Used to delete nodes from the graph
   *  @param nodeName Name of a node to delete (e.g "hospital_capacity").
   *  Accepts wildcard filters (e.g "hospital_*")
   */
    public static void deleteNodes(String nodeName, Neo4J graph) throws Exception {
        Pattern regex = Pattern.compile(getRegEx(nodeName), Pattern.CASE_INSENSITIVE);
        Session session = null;
        try{
            session = graph.getSession();

            ArrayList<String> nodes = new ArrayList<>();
            Result rs = session.run("MATCH (n) RETURN distinct labels(n)");
            while (rs.hasNext()){
                Record r = rs.next();
                List labels = r.get(0).asList();
                if (labels.isEmpty()) continue; //?
                String label = labels.get(0).toString();
                Matcher matcher = regex.matcher(label);
                if (matcher.find()){
                    nodes.add(label);
                }
            }

            for (String node : nodes){
                String cmd = "MATCH (n:" + node + ") DETACH DELETE n";
                console.log(cmd);
                session.run(cmd);
            }

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            throw e;
        }
    }


  //**************************************************************************
  //** getRegEx
  //**************************************************************************
  /** Used to convert a wildcard (e.g. "*.txt") into a regular expression.
   *  Credit: https://www.rgagnon.com/javadetails/java-0515.html
   */
    private static String getRegEx(String wildcard){
        wildcard = wildcard.trim();
        StringBuffer s = new StringBuffer(wildcard.length());
        s.append('^');
        for (int i = 0, is = wildcard.length(); i < is; i++) {
            char c = wildcard.charAt(i);
            switch(c) {
                case '*':
                    s.append(".*");
                    break;
                case '?':
                    s.append(".");
                    break;
                    // escape special regexp-characters
                case '(': case ')': case '[': case ']': case '$':
                case '^': case '.': case '{': case '}': case '|':
                case '\\':
                    s.append("\\");
                    s.append(c);
                    break;
                default:
                    s.append(c);
                    break;
            }
        }
        s.append('$');
        return(s.toString());
    }

}