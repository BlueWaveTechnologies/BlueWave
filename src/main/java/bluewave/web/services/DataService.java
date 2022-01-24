package bluewave.web.services;
import bluewave.graph.Neo4J;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import javaxt.http.servlet.ServletException;
import javaxt.express.*;
import javaxt.sql.*;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;

//******************************************************************************
//**  DataService
//******************************************************************************
/**
 *   Used to generate CSV data associated with the path in the ServiceRequest.
 *   In most cases, the path represents a name of a query in the "queries"
 *   package. If a suitable query is not found, a file search is initiated to
 *   find a matching file in the data directory.
 *
 ******************************************************************************/

public class DataService extends WebService {

    private javaxt.io.Directory dir;
    private ConcurrentHashMap<String, ArrayList<HashMap<String, String>>> cache;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** @param dir Path to a data directory with data files (e.g. web/data)
   */
    public DataService(javaxt.io.Directory dir){
        this.dir = dir;
        this.cache = new ConcurrentHashMap<>();
    }


  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
  /** Returns data associated with the path in the ServiceRequest
   */
    public ServiceResponse getServiceResponse(ServiceRequest request, Database database) throws ServletException {

        String fileName = request.getPath(0).toString();
        String sql = bluewave.queries.Index.getQuery(fileName);
        if (sql==null){
            for (Object obj : dir.getChildren()){
                if (obj instanceof javaxt.io.File){
                    javaxt.io.File file = (javaxt.io.File) obj;
                    if (file.getName().equalsIgnoreCase(fileName)){
                        return new ServiceResponse(file);
                    }
                }
                else{
                    //name = ((javaxt.io.Directory) obj).getName();
                }
            }
            return new ServiceResponse(404);
        }
        else{



          //Check cache
            synchronized(cache){
                ArrayList<HashMap<String, String>> arr = cache.get(fileName.toLowerCase());
                if (arr!=null){
                    for (HashMap<String, String> params : arr){
                        boolean foundMatch = true;
                        Iterator<String> it = params.keySet().iterator();
                        while (it.hasNext()){
                            String key = it.next();
                            if (key.equals("_")) continue;
                            String val = params.get(key);

                            String requstedVal = request.getParameter(key).toString();
                            if (!val.equalsIgnoreCase(requstedVal)){
                                foundMatch = false;
                                break;
                            }
                        }
                        if (foundMatch) return new ServiceResponse(params.get("_"));
                    }
                }
            }



          //Check if there is a cypher query statement
            Neo4J graph = null;
            for (String str : sql.split(";")){
                str = str.trim();
                if (str.toUpperCase().startsWith("MATCH")){
                    sql = str;
                    bluewave.app.User user = (bluewave.app.User) request.getUser();
                    graph = bluewave.Config.getGraph(user);
                    break;
                }
            }



          //Update sql statement as needed
            HashSet<String> keys = new HashSet<>();
            String week;
            if (sql.contains("{week}")){
                week = request.getParameter("week").toString();
                if (week==null){
                    if (graph==null){
                        sql = sql.replace("'{week}'", "(select max(collection_week) from hospital_capacity)");
                    }
                    else{
                        //TODO: Can we do nested queries in cypher?
                    }
                }
                else{
                    sql = sql.replace("{week}", week);
                    keys.add("week");
                }
            }
            if (sql.contains("{prev_week}")){
                String prevWeek = request.getParameter("prevWeek").toString();
                if (prevWeek==null){
                    if (graph==null){
                        sql = sql.replace("'{prev_week}'",
                        "(select max(collection_week) from hospital_capacity where collection_week not in (select max(collection_week) from hospital_capacity))");
                    }
                    else{
                        //TODO: Can we do nested queries in cypher?
                    }
                }
                else{
                    sql = sql.replace("{prev_week}", prevWeek);
                    keys.add("prevWeek");
                }
            }
            if (sql.contains("{dates}")){
                String dates = request.getParameter("dates").toString();
                if (dates==null){
                    //TODO: Some default?
                }
                else{
                    StringBuilder str = new StringBuilder();
                    for (String date : dates.split(",")){
                        if (date.startsWith("'") && date.endsWith("'")){
                            date = date.substring(1, date.length()-1);
                        }
                        //TODO: test the date?
                        if (str.length()>0) str.append(",");
                        str.append("'" + date + "'");
                    }
                    sql = sql.replace("{dates}", str);
                    keys.add("dates");
                }
            }
            if (sql.contains("{country}")){
                String country = request.getParameter("country").toString();
                if (country!=null){
                    StringBuilder str = new StringBuilder();
                    for (String cc : country.split(",")){
                        cc = cc.trim();
                        if (cc.isEmpty()) continue;
                        if (cc.startsWith("'") && cc.endsWith("'")){
                            cc = cc.substring(1, cc.length()-1);
                        }
                        if (str.length()>0) str.append(",");
                        str.append("'" + cc + "'");
                    }
                    sql = sql.replace("{country}", str);
                    keys.add("country");
                }
            }
            

          //Generate response
            try{

              //Get csv
                String csv = graph==null ? getCSV(sql, database) : getCSV(sql, graph);

              //Update cache
                synchronized(cache){
                    ArrayList<HashMap<String, String>> arr = cache.get(fileName.toLowerCase());
                    if (arr==null){
                        arr = new ArrayList<>();
                        cache.put(fileName.toLowerCase(), arr);
                    }
                    HashMap<String, String> params = new HashMap<>();
                    arr.add(params);
                    for (String param : keys){
                        params.put(param, request.getParameter(param).toString());
                    }
                    params.put("_", csv);
                    cache.notify();
                }

              //Return csv
                return new ServiceResponse(csv);
            }
            catch(Exception e){
                return new ServiceResponse(e);
            }
        }
    }


  //**************************************************************************
  //** getCSV
  //**************************************************************************
  /** Used to generate a CSV file from Cypher query
   */
    public static String getCSV(String sql, Neo4J graph) throws Exception{
        Session session = null;
        try{
            session = graph.getSession();

            StringBuilder str = new StringBuilder();
            boolean addHeader = true;

            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();
                ArrayList<String> fields = QueryService.getFields(r);


              //Add header as needed
                if (addHeader){
                    for (int i=0; i<fields.size(); i++){
                        str.append(fields.get(i));
                        if (i<fields.size()-1) str.append(",");
                    }
                    str.append("\r\n");
                    addHeader = false;
                }


              //Add fields
                for (int i=0; i<fields.size(); i++){
                    String fieldName = fields.get(i);
                    Value val = new Value(r.get(fieldName).asObject());
                    if (!val.isNull()){
//                        if (fieldName.equals("date")){
//                            str.append(val.toDate().toISOString());
//                        }
//                        else{
                            String s = val.toString();
                            s = s.replace("\"", "\\\"");
                            if (s.contains(",")) s = "\"" + s + "\"";
                            str.append(s);
                    }

                    if (i<fields.size()-1) str.append(",");
                }
                str.append("\r\n");

            }

            session.close();

            return str.toString().trim();
        }
        catch(Exception e){
            if (session!=null) session.close();
            throw e;
        }
    }


  //**************************************************************************
  //** getCSV
  //**************************************************************************
  /** Used to generate a CSV file from SQL query
   */
    public static String getCSV(String sql, Database database) throws Exception{
        Connection conn = null;
        try{
            conn = database.getConnection();

            StringBuilder str = new StringBuilder();
            boolean addHeader = true;
            Recordset rs = new Recordset();
            rs.setFetchSize(1000);
            rs.open(sql, conn);
            while (rs.hasNext()){
                Field[] fields = rs.getFields();

              //Add header as needed
                if (addHeader){
                    for (int i=0; i<fields.length; i++){
                        Field field = fields[i];
                        str.append(field.getName());
                        if (i<fields.length-1) str.append(",");
                    }
                    str.append("\r\n");
                    addHeader = false;
                }


              //Add fields
                for (int i=0; i<fields.length; i++){
                    Field field = fields[i];


                    Value val = field.getValue();
                    if (!val.isNull()){
//                        if (field.getName().equals("date")){
//                            str.append(val.toDate().toISOString());
//                        }
//                        else{
                            String s = val.toString();
                            s = s.replace("\"", "\\\"");
                            if (s.contains(",")) s = "\"" + s + "\"";
                            str.append(s);
                    }

                    if (i<fields.length-1) str.append(",");
                }
                str.append("\r\n");

                rs.moveNext();
            }
            rs.close();
            conn.close();

            return str.toString().trim();
        }
        catch(Exception e){
            System.out.println(sql);
            if (conn!=null) conn.close();
            throw e;
        }
    }

}