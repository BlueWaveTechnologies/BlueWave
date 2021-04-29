package bluewave.web.services;

import bluewave.graph.Neo4J;
import org.neo4j.driver.Session;
import org.neo4j.driver.Result;
import org.neo4j.driver.Record;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.math.BigDecimal;

import javaxt.json.*;
import javaxt.express.*;
import javaxt.sql.Database;

//******************************************************************************
//**  QueryService
//******************************************************************************
/**
 *   Provides a set of web methods used to query Neo4J
 *
 ******************************************************************************/

public class QueryService extends WebService {

    private Neo4J graph;
    private javaxt.io.Directory jobDir;
    private javaxt.io.Directory logDir;
    private Map<String, QueryJob> jobs = new ConcurrentHashMap<>();
    private List<String> pendingJobs = new LinkedList<>();
    private List<String> completedJobs = new LinkedList<>();

    private ConcurrentHashMap<String, Object> cache = new ConcurrentHashMap<>();


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public QueryService(Neo4J graph, JSONObject webConfig){


      //Set path to the jobs directory
        if (webConfig.has("jobDir")){
            jobDir = new javaxt.io.Directory(webConfig.get("jobDir").toString());
            jobDir = new javaxt.io.Directory(jobDir+"queries");
            if (!jobDir.exists()) jobDir.create();
            if (!jobDir.exists()) jobDir = null;
        }
        if (jobDir==null){
            throw new IllegalArgumentException("Invalid \"jobDir\"");
        }



      //Set path to the log directory
        if (webConfig.has("logDir")){
            logDir = new javaxt.io.Directory(webConfig.get("logDir").toString());
            logDir = new javaxt.io.Directory(logDir+"queries");
            if (!logDir.exists()) logDir.create();
            if (!logDir.exists()) logDir = null;
        }



      //Delete any orphan jobs
        for (javaxt.io.Directory dir : jobDir.getSubDirectories()){
            dir.delete();
        }


      //Set graph
        this.graph = graph;


      //Spawn threads used to execute queries
        int numThreads = 1; //TODO: Make configurable...
        for (int i=0; i<numThreads; i++){
            new Thread(new QueryProcessor()).start();
        }
    }


  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
    public ServiceResponse getServiceResponse(ServiceRequest request, Database database) {
        String path = request.getPath(0).toString();
        if (path!=null){
            if (path.equals("jobs")){
                return list(request);
            }
            else if (path.equals("job")){
                String method = request.getRequest().getMethod();
                if (method.equals("GET")){
                    return getJob(request);
                }
                else if (method.equals("POST")){
                    return query(request, true);
                }
                else if (method.equals("DELETE")){
                    return cancel(request);
                }
                else{
                    return new ServiceResponse(501, "Not implemented");
                }
            }
            else if (path.equals("nodes")){
                return getNodes();
            }
            else{
                return new ServiceResponse(501, "Not implemented");
            }
        }
        else{
            return query(request, false);
        }
    }


  //**************************************************************************
  //** query
  //**************************************************************************
    private ServiceResponse query(ServiceRequest request, boolean async) {
        try{

          //Get query
            String query = getParameter("q", request).toString();
            if (query==null) query = getParameter("query", request).toString();
            if (query==null) throw new IllegalArgumentException("Query is required");


          //Get Offset and Limit
            Long offset = getParameter("offset", request).toLong();
            Long limit = getParameter("limit", request).toLong();
            if (limit==null) limit = 25L;
            if (offset==null){
                Long page = getParameter("page", request).toLong();
                if (page!=null) offset = (page*limit)-limit;
            }



          //Collect misc params
            JSONObject params = new JSONObject();
            params.set("format", request.getParameter("format").toString());
            Boolean addMetadata = getParameter("metadata", request).toBoolean();
            if (addMetadata!=null && addMetadata==true){
                params.set("metadata", true);
            }
            Boolean count = getParameter("count", request).toBoolean();
            if (count!=null && count==true){
                params.set("count", true);
            }



          //Create job
            User user = (User) request.getUser();
            QueryJob job = new QueryJob(user.getID(), query, offset, limit, params);
            String key = job.getKey();
            job.log();


          //Update list of jobs
            synchronized(jobs) {
                jobs.put(key, job);
                jobs.notify();
            }


          //Update pendingJobs
            synchronized(pendingJobs) {
                pendingJobs.add(key);
                pendingJobs.notify();
            }


          //Generate response
            if (async){
                return new ServiceResponse(job.toJson());
            }
            else{
                synchronized (completedJobs) {
                    while (!completedJobs.contains(key)) {
                        try {
                            completedJobs.wait();
                        }
                        catch (InterruptedException e) {
                            break;
                        }
                    }
                }
                return getJobResponse(job);
            }
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }



  //**************************************************************************
  //** Writer
  //**************************************************************************
  /** Used to generate json, csv, tsv, etc using records from the database
   */
    private class Writer {

        private String format;
        private StringBuilder str;
        private long x = 0;
        private Long elapsedTime;
        private Long count;
        private JSONArray metadata;
        private boolean addMetadata = false;
        private boolean isClosed = false;

        public Writer(String format, boolean addMetadata){
            str = new StringBuilder();
            this.format = format;
            this.addMetadata = addMetadata;

            if (format.equals("json")){
                str.append("{\"rows\":[");
            }
        }

        public void write(Record r){
            if (isClosed) return; //throw exception?



            if (format.equals("json")){
                JSONObject json = new JSONObject();

                Iterator<String> it = r.keys().iterator();
                while (it.hasNext()){
                    String fieldName = it.next();
                    Object val = r.get(fieldName).asObject();
                    if (val==null){
                        val = "null";
                    }
                    else{
                        if (val instanceof String){
                            String s = (String) val;
                            if (s.trim().length()==0) val = "null";
                        }
                    }
                    json.set(fieldName, val);
                }


                if (x>0) str.append(",");
                str.append(json.toString().replace("\"null\"", "null")); //<-- this is a bit of a hack...

            }
            else if (format.equals("tsv") || format.equals("csv")){

                ArrayList<String> fields = getFields(r);
                if (x==0){
                    String s = format.equals("tsv") ? "\t" : ",";
                    for (int i=0; i<fields.size(); i++){
                        if (i>0) str.append(s);
                        str.append(fields.get(i));
                    }
                    str.append("\r\n");
                }


                String s = format.equals("tsv") ? "\t" : ",";
                for (int i=0; i<fields.size(); i++){
                    if (i>0) str.append(s);
                    String fieldName = fields.get(i).toString();
                    Object value = r.get(fieldName).asObject();
                    if (value==null){
                        value = "";
                    }
                    else{
                        if (value instanceof String){
                            String v = (String) value;
                            if (v.contains(s)){
                                value = "\"" + v + "\"";
                            }
                        }
                        if (value instanceof java.util.Date) {
                            value = new javaxt.utils.Date(((java.util.Date) value)).toISOString();
                        }
                        else if (value instanceof java.util.Calendar) {
                            value = new javaxt.utils.Date(((java.util.Calendar) value)).toISOString();
                        }

                    }
                    str.append(value);
                }
                str.append("\r\n");
            }

            x++;
        }


        public void includeMetadata(boolean b){
            addMetadata = b;
        }


        public void setElapsedTime(long elapsedTime){
            this.elapsedTime = elapsedTime;
        }


        public void setCount(long count){
            this.count = count;
        }


        public void close(){
            isClosed = true;
            if (format.equals("json")){

                str.append("]");


                if (addMetadata){
                    if (metadata!=null){
                        str.append(",\"metadata\":");
                        str.append(metadata);
                    }
                }


                if (count!=null){
                    str.append(",\"total_rows\":");
                    str.append(count);
                }

                if (this.elapsedTime!=null){
                    double elapsedTime = (double)(this.elapsedTime)/1000d;
                    BigDecimal time = new BigDecimal(elapsedTime).setScale(3, BigDecimal.ROUND_HALF_UP);
                    str.append(",\"time\":");
                    str.append(time);
                }

                str.append("}");
            }
        }


        public String toString(){
            if (!isClosed) close();
            return str.toString();
        }
    }


  //**************************************************************************
  //** list
  //**************************************************************************
  /** Returns an unordered list of jobs
   */
    private ServiceResponse list(ServiceRequest request) {

        User user = (User) request.getUser();
        JSONArray arr = new JSONArray();
        synchronized (jobs) {
            Iterator<String> it = jobs.keySet().iterator();
            while (it.hasNext()){
                String key = it.next();
                QueryJob job = jobs.get(key);
                long userID = job.userID;

              //Prevent non-admins seeing other user jobs
                if (user.getAccessLevel()<5){
                    if (userID!=user.getID()) continue;
                }

                arr.add(job.toJson());
            }
        }

        return new ServiceResponse(arr);
    }


  //**************************************************************************
  //** getJob
  //**************************************************************************
  /** Used to return the status or results for a given jobID. Example:
   *  [GET] sql/job/{jobID}
   */
    private ServiceResponse getJob(ServiceRequest request) {
        String id = request.getPath(1).toString();
        User user = (User) request.getUser();
        QueryJob job = getJob(id, user);
        if (job==null) return new ServiceResponse(404);
        return getJobResponse(job);
    }


  //**************************************************************************
  //** getJob
  //**************************************************************************
  /** Returns a job for a given jobID and user. Checks both the pending and
   *  completed job queues.
   */
    private QueryJob getJob(String jobID, User user){
        synchronized (jobs) {
            return jobs.get(user.getID() + ":" + jobID);
        }
    }


  //**************************************************************************
  //** getJobResponse
  //**************************************************************************
  /** Used to generate a ServiceResponse for a given job. If a job has failed
   *  or is complete, returns the output of the job. If the job is pending or
   *  running, simply returns the job status.
   */
    private ServiceResponse getJobResponse(QueryJob job){
        ServiceResponse response;
        if (job.status.equals("failed")){
            javaxt.io.File file = job.getOutput();
            String str = file.getText();
            response = new ServiceResponse(500, str);
            deleteJob(job);
        }
        else if (job.status.equals("complete")){
            javaxt.io.File file = job.getOutput();
            String str = file.getText();
            response = new ServiceResponse(str);
            response.setContentType(file.getContentType());
            deleteJob(job);
        }
        else{
            response = new ServiceResponse(job.status);
        }
        return response;
    }


  //**************************************************************************
  //** deleteJob
  //**************************************************************************
  /** Removes a job from the queue and deletes any output files that might
   *  have been created with the job.
   */
    private void deleteJob(QueryJob job){

        String key = job.getKey();
        synchronized(pendingJobs){
            pendingJobs.remove(key);
            pendingJobs.notify();
        }

        synchronized (completedJobs) {
            completedJobs.remove(key);
            completedJobs.notify();
        }

        synchronized (jobs) {
            jobs.remove(key);
            jobs.notify();
        }

        javaxt.io.File file = job.getOutput();
        file.delete();
    }


  //**************************************************************************
  //** cancel
  //**************************************************************************
  /** Used to cancel a pending or running job.
   */
    private ServiceResponse cancel(ServiceRequest request) {
        String id = request.getPath(1).toString();
        User user = (User) request.getUser();
        QueryJob job = getJob(id, user);
        if (job==null) return new ServiceResponse(404);


        String key = job.getKey();
        synchronized(pendingJobs){
            pendingJobs.remove(key);
            pendingJobs.notify();
        }



        try{

          //Update job status
            job.status = "canceled";
            job.updated = new javaxt.utils.Date();


          //TODO: Figure out how to cancel a query
            boolean jobCanceled = false;
//            if (!jobCanceled){
//                throw new Exception();
//            }


          //Update queue
            deleteJob(job);


          //return response
            return new ServiceResponse(job.toJson());
        }
        catch(Exception e){
            return new ServiceResponse(500, "failed to cancel query");
        }
    }


  //**************************************************************************
  //** getNodes
  //**************************************************************************
  /** Returns a list of nodes
   */
    public ServiceResponse getNodes() {

        synchronized(cache){
            Object obj = cache.get("nodes");
            if (obj!=null){
                return new ServiceResponse((JSONObject) obj);
            }
            else{
                Session session = null;
                try{

                  //Execute query
                    session = graph.getSession();
                    TreeSet<String> nodes = new TreeSet<>();
                    Result rs = session.run("MATCH (n) RETURN distinct labels(n)");
                    while (rs.hasNext()){
                        Record r = rs.next();
                        List labels = r.get(0).asList();
                        if (labels.isEmpty()) continue; //?
                        String label = labels.get(0).toString();
                        nodes.add(label);
                    }
                    session.close();


                  //Generate json
                    JSONArray arr = new JSONArray();
                    Iterator<String> it = nodes.iterator();
                    while (it.hasNext()){
                        String label = it.next();
                        JSONObject json = new JSONObject();
                        json.set("name", label);
                        arr.add(json);
                    }
                    JSONObject json = new JSONObject();
                    json.set("tables", arr);


                  //Update cache
                    cache.put("nodes", json);
                    cache.notify();

                  //Return response
                    return new ServiceResponse(json);
                }
                catch(Exception e){
                    if (session!=null) session.close();
                    return new ServiceResponse(e);
                }
            }
        }
    }


  //**************************************************************************
  //** getParameter
  //**************************************************************************
  /** Used to extract a parameter either from the URL query string or the json
   *  in the request payload.
   */
    private javaxt.utils.Value getParameter(String name, ServiceRequest request){
        if (request.getRequest().getMethod().equals("GET")){
            return request.getParameter(name);
        }
        else{
            JSONObject json = request.getJson();
            if (json.has(name)){
                return new javaxt.utils.Value(json.get(name).toObject());
            }
            else{
                return request.getParameter(name);
            }
        }
    }


  //**************************************************************************
  //** QueryJob
  //**************************************************************************
    public class QueryJob {

        private String id;
        private long userID;
        private String query;
        private Long offset;
        private Long limit;
        private javaxt.utils.Date created;
        private javaxt.utils.Date updated;
        private String status;
        private String format;
        private boolean countTotal = false;
        private boolean addMetadata = false;



        public QueryJob(long userID, String query, Long offset, Long limit, JSONObject params) {
            this.id = UUID.randomUUID().toString();
            this.userID = userID;

            query = query.replace("\r", " ").replace("\n", " ").replace("\t", " ").trim();
            while (query.contains("  ")) query = query.replace("  ", " ");
            query = query.trim();
            if (query.endsWith(";")) query = query.substring(0, query.length()-1).trim();

            console.log(query);


            this.query = query;
            this.offset = offset;
            this.limit = limit;
            this.created = new javaxt.utils.Date();
            this.updated = this.created.clone();
            this.status = "pending";

            String format = params.get("format").toString();
            if (format==null) format="";
            format = format.trim().toLowerCase();
            if (format.equals("csv") || format.equals("tsv")){
                this.format = format;
            }
            else this.format = "json";


            if (params.has("count")){
                countTotal = params.get("count").toBoolean();
            }

            if (params.has("metadata")){
                addMetadata = params.get("metadata").toBoolean();
            }
        }



        public String getKey(){
            return userID + ":" + id;
        }

        public boolean isCanceled(){
            return status.equals("canceled");
        }

        public String getQuery(){
            if (offset==null && limit==null){
                return query;
            }

          //Copy query
            String query = this.query;


          //Remove limit as needed
            Long currLimit = null;
            if (limit!=null){
                int idx = query.toUpperCase().lastIndexOf("LIMIT ");
                if (idx>0){
                    String a = query.substring(0, idx);
                    String b = query.substring(idx+"LIMIT ".length());

                    if (a.substring(a.length()-1).equals(" ")){
                        a = a.trim();
                        idx = b.indexOf(" ");
                        if (idx==-1) idx = b.length();
                        try{

                            if (idx==-1){
                                currLimit = Long.parseLong(b);
                                query = a;
                            }
                            else{
                                currLimit = Long.parseLong(b.substring(0, idx));
                                query = a + b.substring(idx);
                            }

                        }
                        catch(Exception e){
                        }
                    }
                }
            }
            Long limit = currLimit==null ? this.limit : currLimit;


          //Remove limit as needed
            Long currOffset = null;
            if (limit!=null){
                int idx = query.toUpperCase().lastIndexOf("OFFSET ");
                if (idx>0){
                    String a = query.substring(0, idx);
                    String b = query.substring(idx+"OFFSET ".length());

                    if (a.substring(a.length()-1).equals(" ")){
                        a = a.trim();
                        idx = b.indexOf(" ");
                        if (idx==-1) idx = b.length();
                        try{

                            if (idx==-1){
                                currLimit = Long.parseLong(b);
                                query = a;
                            }
                            else{
                                currLimit = Long.parseLong(b.substring(0, idx));
                                query = a + b.substring(idx);
                            }

                        }
                        catch(Exception e){
                        }
                    }
                }
            }
            Long offset = currOffset==null ? this.offset : currOffset;



          //Add limit and offset to the query and return
            if (offset!=null) query += " SKIP " + offset;
            if (limit!=null) query += " LIMIT " + limit;
            return query.trim();
        }

        public String getCountQuery(){
            String query = this.query;
            int idx = query.toUpperCase().lastIndexOf("RETURN ");
            String a = query.substring(0, idx);
            if (a.substring(a.length()-1).equals(" ")){
                return a.trim() + " RETURN count(*)";
            }
            else{ //Can we have a query without a valid return statement?
                return query + " RETURN count(*)";
            }
        }

        public boolean countTotal(){
            if (countTotal){
                if (format.equals("json")) return true;
            }
            return false;
        }

        public boolean addMetadata(){
            return addMetadata;
        }

        public String getOutputFormat(){
            return format;
        }

        public javaxt.io.File getOutput(){
            return new javaxt.io.File(jobDir.toString() + userID + "/" + id + "." + format);
        }


        public String getContentType(){
            if (format.equals("tsv")){
                return "text/plain";
            }
            else if (format.equals("csv"))
                return "text/csv";
            else{
                return "application/json";
            }
        }


        public void log(){
            if (logDir!=null){
                javaxt.io.File file = new javaxt.io.File(logDir.toString() + userID + "/" + id + ".json");
                file.write(toJson().toString());
            }
        }

        public JSONObject toJson() {
            JSONObject json = new JSONObject();
            json.set("user_id", userID);
            json.set("job_id", id);
            json.set("status", status);
            json.set("query", getQuery());
            json.set("created_at", created);
            json.set("updated_at", updated);
            return json;
        }
    }


  //**************************************************************************
  //** QueryProcessor
  //**************************************************************************
  /** Thread used to execute queries
   */
    private class QueryProcessor implements Runnable {

        public void run() {

            while (true) {

                Object obj = null;
                synchronized (pendingJobs) {
                    while (pendingJobs.isEmpty()) {
                        try {
                          pendingJobs.wait();
                        }
                        catch (InterruptedException e) {
                          return;
                        }
                    }
                    obj = pendingJobs.get(0);
                    if (obj!=null) pendingJobs.remove(0);
                    pendingJobs.notifyAll();
                }

                if (obj!=null){

                  //Find query job
                    String key = (String) obj;
                    QueryJob job = null;
                    synchronized (jobs) {
                        job = jobs.get(key);
                    }

                    if (job!=null && !job.isCanceled()){
                        Session session = null;
                        try{

                          //Update job status and set start time
                            job.status = "running";
                            job.updated = new javaxt.utils.Date();
                            long startTime = System.currentTimeMillis();


                          //Open database connection
                            session = graph.getSession(true);



                          //Execute query and generate response
                            String query = job.getQuery();
                            Writer writer = new Writer(job.getOutputFormat(), job.addMetadata());
                            Result rs = session.run(query);
                            //rs.open("--" + job.getKey() + "\n" + query, conn);
                            while (rs.hasNext()){
                                Record r = rs.next();
                                writer.write(r);
                            }

                            if (job.isCanceled()) throw new Exception();


                          //Count total records as needed
                            if (job.countTotal()){
                                rs = session.run(job.getCountQuery());
                                if (rs.hasNext()){
                                    Record r = rs.next();
                                    Long ttl = r.get(0).asLong();
                                    if (ttl!=null){
                                        writer.setCount(ttl);
                                    }
                                }
                            }
                            if (job.isCanceled()) throw new Exception();





                          //Close database connection
                            session.close();



                          //Set elapsed time
                            writer.setElapsedTime(System.currentTimeMillis()-startTime);


                          //Write output to a file
                            javaxt.io.File file = job.getOutput();
                            file.write(writer.toString());


                          //Update job status
                            job.status = "complete";
                            job.updated = new javaxt.utils.Date();
                        }
                        catch(Exception e){
                            if (session!=null) session.close();
                            javaxt.io.File file = job.getOutput();
                            if (job.isCanceled()){
                                file.delete();
                            }
                            else{
                                job.status = "failed";
                                job.updated = new javaxt.utils.Date();


                                java.io.PrintStream ps = null;
                                try {
                                    ps = new java.io.PrintStream(file.toFile());
                                    e.printStackTrace(ps);
                                    ps.close();
                                }
                                catch (Exception ex) {
                                    if (ps!=null) ps.close();
                                }
                            }
                        }


                      //Add job to the completedJobs
                        if (!job.isCanceled()){
                            synchronized(completedJobs){
                                completedJobs.add(job.getKey());
                                completedJobs.notify();
                            }
                        }
                    }
                }
                else{
                    return;
                }
            }
        }
    }


  //**************************************************************************
  //** getFields
  //**************************************************************************
    public static ArrayList<String> getFields(Record r){
        ArrayList<String> fields = new ArrayList<>();
        Iterator<String> it = r.keys().iterator();
        while (it.hasNext()){
            String key = it.next();
            if (key.equalsIgnoreCase("group_by")) continue;
            fields.add(key);
        }
        return fields;
    }
}