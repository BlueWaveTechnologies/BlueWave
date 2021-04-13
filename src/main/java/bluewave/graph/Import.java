package bluewave.graph;

import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;

import javaxt.express.utils.CSV;
import javaxt.io.File;
import javaxt.utils.Value;
import javaxt.utils.ThreadPool;
import static javaxt.utils.Console.*;

import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.Transaction;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.ConcurrentHashMap;


public class Import {

    public static final String UTF8_BOM = "\uFEFF";


  //**************************************************************************
  //** importCSV
  //**************************************************************************
  /** Used to import a CSV file into a node/vertex in a Neo4J instance.
   */
    public static void importCSV(File csvFile, String vertex, Integer[] keys, Neo4J database) throws Exception {


      //Parse header and create query to insert records
        ArrayList<String> colNames = new ArrayList<>();
        String uniqueColName;
        StringBuilder query = new StringBuilder("CREATE (:" + vertex + " {");
        java.io.BufferedReader br = csvFile.getBufferedReader("UTF-8");
        String row = br.readLine();
        if (row.startsWith(UTF8_BOM)) {
            row = row.substring(1);
        }
        LinkedHashMap<String, Integer> header = new LinkedHashMap<>();
        CSV.Columns columns = CSV.getColumns(row, ",");
        for (int i=0; i<columns.length(); i++){
            String colName = columns.get(i).toString();
            colName = colName.replace("-", "N").replace("+", "P"); //custom replacement
            colNames.add(colName);

            header.put(colName, i);
            if (i>0) query.append(", ");
            query.append(colName);
            query.append(": $");
            query.append(colName);
        }
        if (keys==null){
            uniqueColName = null;
        }
        else{
            if (keys.length>1){
                uniqueColName = "unique_key_constraint";

              //Add an extra column/attribute to the insert query
                query.append(", ");
                query.append(uniqueColName);
                query.append(": $");
                query.append(uniqueColName);
            }
            else{
                uniqueColName = colNames.get(keys[0]);
            }
        }
        query.append("})");



      //Create index and key constraints
        if (keys!=null){
            Session session = null;
            try{
                session = database.getSession();

              //Create unique key constraint
                try{
                    session.run("CREATE CONSTRAINT ON (n:" + vertex + ") ASSERT n." + uniqueColName + " IS UNIQUE");
                }
                catch(Exception e){}


              //Create index
                try{
                    String cmd = "CREATE INDEX idx_" + vertex + " IF NOT EXISTS FOR (n:" + vertex + ") ON (";
                    for (int i=0; i<keys.length; i++){
                        if (i>0) cmd += ", ";
                        cmd += "n." + colNames.get(keys[0]);
                    }
                    cmd += ")";
                    session.run(cmd);
                }
                catch(Exception e){}
                session.close();
            }
            catch(Exception e){
                if (session!=null) session.close();
            }
        }


      //Instantiate the ThreadPool
        ThreadPool pool = new ThreadPool(20, 1000){
            public void process(Object obj){
                String row = (String) obj;
                try{
                    CSV.Columns columns = CSV.getColumns(row, ",");

                    Map<String, Object> params = new LinkedHashMap<>();
                    Iterator<String> it = header.keySet().iterator();
                    while (it.hasNext()){
                        String colName = it.next();
                        String colValue = columns.get(header.get(colName)).toString();
                        if (colValue!=null){
                            if (colValue.equals("-999999")) colValue = null;
                        }
                        params.put(colName, colValue);
                    }

                    if (keys!=null && keys.length>1){
                        String key = "";
                        for (int i : keys){
                            if (key.length()>0) key +="_";
                            key += columns.get(i).toString();
                        }
                        params.put(uniqueColName, key);
                    }

                    getSession().writeTransaction( tx -> addRow( tx, query.toString(), params ) );
                }
                catch(Exception e){
                    //console.log(e.getMessage());
                }
            }


            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();


      //Insert records
        while ((row = br.readLine()) != null){
            pool.add(row);
        }


      //Notify the pool that we have finished added records and Wait for threads to finish
        pool.done();
        pool.join();
    }


  //**************************************************************************
  //** importJSON
  //**************************************************************************
  /** Used to import a JSON file into a Neo4J instance
   *  @param jsonFile Path to a json file
   *  @param vertex Node name/label
   *  @param target Used to identify a specific path in the json object to
   *  start parsing (e.g. "/results")
   *  @param database Connection info to the database
   */
    public static void importJSON(File jsonFile, String vertex, String target, Neo4J database) throws Exception {

        /*
        Session session = null;
        try {
            session = database.getSession();
            JsonReader jr = new JsonReader(jsonFile.getBufferedReader());
            createNode(jr, vertex, target, null, new LinkedHashMap<>(), session);
            jr.close();
            session.close();
        }
        catch (Exception e) {
            if (session != null) session.close();
            throw e;
        }
        */

        ConcurrentHashMap<Long, Value> jobs = new ConcurrentHashMap<>();
        AtomicLong jobIDs = new AtomicLong(0);

        ThreadPool pool = new ThreadPool(12, 1000){

            public void process(Object obj){
                try{
                    Object[] arr = (Object[]) obj;
                    JsonReader jr = (JsonReader) arr[0];
                    String nodePrefix = (String) arr[1];
                    String target = (String) arr[2];
                    JsonToken currToken = (JsonToken) arr[3];
                    LinkedHashMap<String, Boolean> currPath = (LinkedHashMap<String, Boolean>) arr[4];
                    Long jobID = (Long) arr[5];
                    parseJson(jr, nodePrefix, target, currToken, currPath, jobID);
                }
                catch(Exception e){
                    e.printStackTrace();
                    //console.log(e.getMessage());
                }
            }


            private void parseJson(JsonReader jr, String nodePrefix, String target,
                JsonToken currToken, LinkedHashMap<String, Boolean> currPath, Long jobID) throws Exception {

                String jsonKey = "";
                String jsonString = "";
                Double jsonNumber = null;
                boolean endOfNode = false;
                Map<String, Object> params = new LinkedHashMap<>();
                List<Integer> nodeList = new ArrayList<>();
                boolean endOfFile = false;
                boolean hasJson = false;


              //Parse the path returned from the JsonReader and extract the last key.
              //Note that the path uses dot–notation. Example: $.store.book[0].title
              //Reference: http://goessner.net/articles/JsonPath/
                String jsonPath = jr.getPath();
                String[] paths = jsonPath.substring(1).split("\\.");
                String nodeName = paths.length==0 ? "" : paths[paths.length-1];
                int idx = nodeName.lastIndexOf("[");
                if (nodeName.endsWith("]") && idx>0){
                    try{
                        Integer.parseInt(nodeName.substring(idx+1, nodeName.length()-1));
                        nodeName = nodeName.substring(0, idx);
                    }
                    catch(Exception e){}
                }



              //Update the currPath
                if (!nodeName.isEmpty()){

                  //Check if the currToken is an array
                    boolean isArray = currToken==JsonToken.BEGIN_ARRAY;


                  //Special case: currToken is a duplicate of the previous token except
                  //the type is now a BEGIN_OBJECT. We want to mark is as an array.
                    Iterator<String> it = currPath.keySet().iterator();
                    while (it.hasNext()){
                        String key = it.next();
                        if (!it.hasNext()){
                            boolean lastValIsArray = currPath.get(key);
                            if (key.equals(nodeName) && lastValIsArray){
                                isArray = true;
                            }
                        }
                    }


                  //Update path
                    currPath.put(nodeName, isArray);
                }



              //Parse JSON
                try {
                    while (!endOfFile && !endOfNode) {
                        JsonToken nextToken = jr.peek();
                        Object n = null;
                        LinkedHashMap<String, Boolean> path;
                        Iterator<String> it;
                        long id;


                        //BEGIN_ARRAY, END_ARRAY, BEGIN_OBJECT, END_OBJECT, NAME, STRING, NUMBER, BOOLEAN, NULL, END_DOCUMENT;
                        switch (nextToken) {
                            case BEGIN_ARRAY:
                                jr.beginArray();

                                path = new LinkedHashMap<>();
                                it = currPath.keySet().iterator();
                                while (it.hasNext()){
                                    String key = it.next();
                                    path.put(key, currPath.get(key));
                                }


                                id = jobIDs.incrementAndGet();
                                parseJson(jr, nodePrefix, target, nextToken, path, id);
                                synchronized(jobs){
                                    while (!jobs.containsKey(id)){
                                        jobs.wait();
                                    }
                                    n = jobs.remove(id).toObject();
                                    jobs.notifyAll();
                                }


                                if (n != null) {
                                    if (n instanceof Integer){
                                        nodeList.add((int) n);
                                    }
                                    else if (n instanceof List){
                                        List<Integer> _nodeList = (List<Integer>)n;
                                        nodeList.addAll(_nodeList);
                                    }
                                    else{
                                        Map<String, Object> _params = (Map<String, Object>) n;
                                        params.putAll(_params);
                                    }
                                }

                                break;
                            case END_ARRAY:
                                jr.endArray();
                                endOfNode = true;
                                break;
                            case NAME:
                                jsonKey = escape(jr.nextName());
                                break;
                            case STRING:
                                jsonString = escape(jr.nextString());
                                if (jsonKey.isEmpty()) { //or currToken==JsonToken.BEGIN_ARRAY?

                                    ArrayList<String> arr = (ArrayList<String>) params.get("value");
                                    if (arr == null) {
                                        arr = new ArrayList<String>();
                                        params.put("value", arr);
                                    }
                                    arr.add(jsonString);

                                } else {
                                    if (jsonString!=null){
                                        if (jsonString.trim().isEmpty()) jsonString = null;
                                    }
                                    params.put(jsonKey, jsonString);
                                }
                                break;
                            case NUMBER:
                                jsonNumber = jr.nextDouble();
                                if (jsonKey.isEmpty()) { //or currToken==JsonToken.BEGIN_ARRAY?
                                    ArrayList<Double> arr = (ArrayList<Double>) params.get("value");
                                    if (arr == null) {
                                        arr = new ArrayList<Double>();
                                        params.put("value", arr);
                                    }
                                    arr.add(jsonNumber);
                                }
                                else{
                                    params.put(jsonKey, jsonNumber);
                                }
                                break;
                            case BOOLEAN:
                                //TODO
                                break;
                            case END_DOCUMENT:
                                endOfFile = true;
                                jr.close();
                                this.done(); //notify the pool that we have finished added records
                                break;
                            case BEGIN_OBJECT:
                                hasJson = true;
                                jr.beginObject();


                                path = new LinkedHashMap<>();
                                it = currPath.keySet().iterator();
                                while (it.hasNext()){
                                    String key = it.next();
                                    path.put(key, currPath.get(key));
                                }



                                id = jobIDs.incrementAndGet();
                                parseJson(jr, nodePrefix, target, nextToken, path, id);
                                synchronized(jobs){
                                    while (!jobs.containsKey(id)){
                                        jobs.wait();
                                    }
                                    n = jobs.remove(id).toObject();
                                    jobs.notifyAll();
                                }

                                if (n != null) {
                                    if (n instanceof Integer){
                                        nodeList.add((int) n);
                                    }
                                }


                                break;
                            case END_OBJECT:
                                jr.endObject();
                                endOfNode = true;
                                break;
                            default:
                        }
                    }

                } catch (Exception e) {
                    e.printStackTrace();
                }


              //If the currToken is null, don't create a node
                if (currToken==null){
                    update(jobID, null);
                    return;
                }



              //Don't create a node if the currToken is a JSON array that contains
              //simple objects (string, numbers, etc). Return params instead.
                if (currToken==JsonToken.BEGIN_ARRAY && !hasJson){
                    Map<String, Object> _params = new LinkedHashMap<>();
                    _params.put(nodeName, params.get("value"));
                    update(jobID, _params);
                    return;
                }



              //Create node label
                String nodeLabel = getNodeLabel(currPath, nodePrefix);
                //console.log("|" + nodeLabel + "|", jr.getPath());


              //Check whether to create a node
                boolean createNode;
                if (target==null){
                    createNode = true;
                }
                else{
                    if (target.equals("/")){
                        createNode = true;
                    }
                    else{
                        if (target.startsWith("/")) target = target.substring(1);
                        if (target.endsWith("/")) target = target.substring(0, target.length()-1);
                        String[] arr = target.split("/");
                        String[] nodes = currPath.keySet().toArray(new String[currPath.size()]);
                        if (nodes.length<arr.length){
                            createNode = false;
                        }
                        else{

                          //Check whether the path starts with the target
                            createNode = true;
                            for (int i=0; i<arr.length; i++){
                                if (!arr[i].equals(nodes[i])){
                                    createNode = false;
                                    break;
                                }
                            }


                          //Update node label
                            if (createNode){
                                LinkedHashMap<String, Boolean> path = new LinkedHashMap<>();
                                for (int i=arr.length; i<nodes.length; i++){
                                    String key = nodes[i];
                                    Boolean isArray = currPath.get(key);
                                    path.put(key, isArray);
                                }
                                nodeLabel = getNodeLabel(path, nodePrefix);
                            }

                        }
                    }
                }


                if (createNode && currToken==JsonToken.BEGIN_ARRAY){
                    update(jobID, nodeList);
                    return;
                }


                if (currToken==JsonToken.BEGIN_ARRAY || nodeLabel.isEmpty()) createNode = false;



              //Create node as needed
                if (createNode){
                    //console.log("+"+nodeLabel);


                    List<String> where = new ArrayList<>();
                    List<String> properties = new ArrayList<>();
                    for (Map.Entry<String, Object> paramEntry : params.entrySet()) {
                        Object val =  paramEntry.getValue();
                        if (val==null) continue;
                        properties.add(paramEntry.getKey()+ ": '" + paramEntry.getValue() + "'");
                        where.add("n." + paramEntry.getKey() + "= '" + paramEntry.getValue() + "'");
                    }

                    Integer nodeID = null;
                    Session session = getSession();



                    if (where.isEmpty()){
                        String query = "MATCH (n:" + nodeLabel + ") RETURN id(n)";
                        Result result = session.run(query);
                        if (result.hasNext()) {
                            //nodeID = result.next().get(0).asInt();
                            //create node?
                        }
                    }
                    else{
                        String query = "MATCH (n:" + nodeLabel + ") WHERE " + String.join(" AND ", where) + " RETURN id(n), properties(n)";
                        Result result = session.run(query);
                        if (result.hasNext()) {
                            nodeID = result.next().get(0).asInt();
                            //TODO: Check properties
                            createNode = false;
                        }
                    }

                    if (createNode){

                      //Create node
                        String query = "CREATE (a: " + nodeLabel + " {" + String.join(", ", properties) + "}) RETURN id(a)";
                        Result result = session.run(query);
                        if (result.hasNext()) {
                            nodeID = result.single().get(0).asInt();
                        }


                      //Create edges
                        for (Integer id : nodeList) {
                            query = "MATCH (r), (s) WHERE id(r) =" + nodeID + " AND id(s) = " + id + " MERGE(r)-[:has]->(s)";
                            session.run(query);
                        }

                    }


                    update(jobID, nodeID);

                }
                else{
                    update(jobID, null);

                }
            }

            private void update(long jobID, Object obj){
                synchronized(jobs){
                    jobs.put(jobID, new Value(obj));
                    jobs.notifyAll();
                }
            }


            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();


        JsonReader jr = new JsonReader(jsonFile.getBufferedReader());
        pool.add(new Object[]{jr, vertex, target, null, new LinkedHashMap<>(), jobIDs.get()});
        pool.join();
    }


  //**************************************************************************
  //** getNodeLabel
  //**************************************************************************
  /** Returns a node label for a given path. Uses an underscore character to
   *  separate node names in the path. If a node in the path corresponds to a
   *  JSON array, the node name is updated to it's singular form.
   */
    private static String getNodeLabel(LinkedHashMap<String, Boolean> currPath, String nodePrefix){
        String nodeLabel = "";
        if (nodePrefix!=null){
            nodePrefix = nodePrefix.trim();
            if (nodePrefix.length()>0){
                nodeLabel = nodePrefix;
                if (!currPath.isEmpty()) nodeLabel+="_";
            }
        }
        Iterator<String> it = currPath.keySet().iterator();
        while (it.hasNext()){
            String key = it.next();
            Boolean isArray = currPath.get(key);
            if (isArray){
                if (key.endsWith("ies")){ //Categories == Category
                    key = (key.substring(0, key.length()-3) + "y");
                }
                else if (key.endsWith("ses")){ //Classes == Class
                    key = (key.substring(0, key.length()-2));
                }
                else if (key.endsWith("s")){ //Sources == Source
                    key = (key.substring(0, key.length()-1));
                }
            }
            nodeLabel += key;
            if (it.hasNext()) nodeLabel += "_";
        }
        return nodeLabel;
    }


  //**************************************************************************
  //** escape
  //**************************************************************************
    private static String escape(String raw) {
        String escaped = raw;
        escaped = escaped.replace("\\", "\\\\");
        escaped = escaped.replace("\"", "\\\"");
        escaped = escaped.replace("\b", "\\b");
        escaped = escaped.replace("\f", "\\f");
        escaped = escaped.replace("\n", "\\n");
        escaped = escaped.replace("\r", "\\r");
        escaped = escaped.replace("\t", "\\t");
        escaped = escaped.replace("\'", "\\'");

        return escaped;
    }


  //**************************************************************************
  //** addRow
  //**************************************************************************
    private static Result addRow(final Transaction tx, final String query, Map<String, Object> params){
        return tx.run( query, params );
    }

}