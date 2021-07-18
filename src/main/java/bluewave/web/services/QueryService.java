package bluewave.web.services;

import bluewave.graph.Neo4J;
import bluewave.utils.NotificationService;
import org.neo4j.driver.Session;
import org.neo4j.driver.Result;
import org.neo4j.driver.Record;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.ConcurrentHashMap;
import java.math.BigDecimal;
import java.io.IOException;

import javaxt.json.*;
import javaxt.express.*;
import javaxt.sql.Database;

import javaxt.http.servlet.HttpServletRequest;
import javaxt.http.servlet.HttpServletResponse;
import javaxt.http.websocket.WebSocketListener;

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

    private ConcurrentHashMap<Long, WebSocketListener> listeners;
    private static AtomicLong webSocketID;


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



      //Populate cache with saved queries
        HashMap<String, String> queries = new HashMap<>();
        for (javaxt.io.File file : jobDir.getFiles("*.cypher", true)){
            queries.put(file.getName(false), file.getText());
        }
        if (!queries.isEmpty()){
            for (javaxt.io.File file : jobDir.getFiles(true)){
                String format = file.getExtension();
                if (format.equals("json") || format.equals("csv") || format.equals("tsv")){
                    String query = queries.get(file.getName(false));
                    if (query!=null){
                        cache.put(format + "|" + query, file.toString());
                    }
                }
            }
        }


      //Add listener to the NotificationService to update the cache
        NotificationService.addListener(new NotificationService.Listener(){
            public void processEvent(String event, String info, long timestamp){
                if (event.equals("neo4J")){
                    JSONObject json = new JSONObject(info);
                    synchronized(cache){
                        ArrayList<String> deletions = new ArrayList<>();
                        Iterator<String> it = cache.keySet().iterator();
                        while (it.hasNext()){
                            String key = it.next();
                            String query = key.substring(key.indexOf("|")+1);
                            String file = cache.get(key).toString();
                            if (requiresUpdate(query, json)){
                                deletedCachedFiles(file);
                                deletions.add(key);
                            }
                        }

                        if (!deletions.isEmpty()){
                            for (String key : deletions){
                                console.log(key);
                                cache.remove(key);
                            }
                            cache.notifyAll();
                        }
                    }
                }
            }
        });



      //Set graph
        this.graph = graph;


      //Websocket stuff
        webSocketID = new AtomicLong(0);
        listeners = new ConcurrentHashMap<>();


      //Spawn threads used to execute queries
        int numThreads = 1; //TODO: Make configurable...
        for (int i=0; i<numThreads; i++){
            new Thread(new QueryProcessor(this)).start();
        }
    }


  //**************************************************************************
  //** getServiceResponse
  //**************************************************************************
    public ServiceResponse getServiceResponse(ServiceRequest request, Database database) {
        String path = request.getPath(0).toString();
        if (path!=null){
            String method = request.getRequest().getMethod();
            if (path.equals("jobs")){
                return list(request);
            }
            else if (path.equals("job")){
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
            else if (path.equals("cache")){
                if (method.equals("GET")){
                    return getCache(request);
                }
                else if (method.equals("DELETE")){
                    return deleteCache(request);
                }
                else{
                    return new ServiceResponse(501, "Not implemented");
                }
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
  //** createWebSocket
  //**************************************************************************
    public void createWebSocket(HttpServletRequest request, HttpServletResponse response) throws IOException {

        //if (!authorized(request)) throw new IOException("Not Authorized");

        new WebSocketListener(request, response){
            private Long id;
            public void onConnect(){
                id = webSocketID.incrementAndGet();
                synchronized(listeners){
                    listeners.put(id, this);
                }
            }
            public void onDisconnect(int statusCode, String reason){
                synchronized(listeners){
                    listeners.remove(id);
                }
            }
        };
    }


  //**************************************************************************
  //** notify
  //**************************************************************************
    private void notify(QueryJob job){
        String msg = job.id+","+job.getStatus();
        synchronized(listeners){
            Iterator<Long> it = listeners.keySet().iterator();
            while(it.hasNext()){
                Long id = it.next();
                WebSocketListener ws = listeners.get(id);
                ws.send(msg);
            }
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
            if (limit<1) limit = null;
            if (offset==null){
                Long page = getParameter("page", request).toLong();
                if (page!=null && limit!=null) offset = (page*limit)-limit;
            }



          //Collect misc params
            JSONObject params = new JSONObject();
            String format = getParameter("format",request).toString();
            params.set("format", format);
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
            notify(job);


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
        private long x = 0;
        private Long elapsedTime;
        private Long count;
        private JSONArray metadata;
        private boolean addMetadata = false;
        private boolean isClosed = false;
        private java.io.BufferedWriter writer;


        public Writer(QueryJob job){

            format = job.getOutputFormat();
            addMetadata = job.addMetadata();

            javaxt.io.File[] files = job.getOutputs();
            writer = files[0].getBufferedWriter("UTF-8");
            files[1].write(job.getQuery());


            if (format.equals("json")){
                write("{\"rows\":[");
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


                if (x>0) write(",");
                write(json.toString().replace("\"null\"", "null")); //<-- this is a bit of a hack...

            }
            else if (format.equals("tsv") || format.equals("csv")){

                ArrayList<String> fields = getFields(r);
                if (x==0){
                    String s = format.equals("tsv") ? "\t" : ",";
                    for (int i=0; i<fields.size(); i++){
                        if (i>0) write(s);
                        write(fields.get(i));
                    }
                    write("\r\n");
                }

                if (x>0) write("\r\n");


                String s = format.equals("tsv") ? "\t" : ",";
                for (int i=0; i<fields.size(); i++){
                    if (i>0) write(s);
                    String fieldName = fields.get(i);
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
                        else if (value instanceof java.util.Date) {
                            value = new javaxt.utils.Date(((java.util.Date) value)).toISOString();
                        }
                        else if (value instanceof java.util.Calendar) {
                            value = new javaxt.utils.Date(((java.util.Calendar) value)).toISOString();
                        }
                        else if (value instanceof java.util.Map) {
                            java.util.Map map = (java.util.Map) value;
                            value = "\"" + map + "\""; //<- this needs to be improved, values in the map can contain quotes
                        }
                        else{
                            //console.log(value.getClass());
                        }

                    }
                    write(value.toString());
                }

            }

            try{
                writer.flush();
            }
            catch(Exception e){
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

                write("]");


                if (addMetadata){
                    if (metadata!=null){
                        write(",\"metadata\":");
                        write(metadata.toString());
                    }
                }


                if (count!=null){
                    write(",\"total_rows\":");
                    write(count+"");
                }

                if (this.elapsedTime!=null){
                    double elapsedTime = (double)(this.elapsedTime)/1000d;
                    BigDecimal time = new BigDecimal(elapsedTime).setScale(3, BigDecimal.ROUND_HALF_UP);
                    write(",\"time\":");
                    write(time.toPlainString());
                }

                write("}");
            }
            try{
                writer.close();
            }
            catch(Exception e){}
        }

        private void write(String str){
            try{
                writer.write(str);
            }
            catch(Exception e){}
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
        String jobStatus = job.getStatus();
        if (jobStatus.equals("failed")){
            javaxt.io.File file = job.getOutputs()[0];
            String str = file.getText();
            response = new ServiceResponse(500, str);
            deleteJob(job, false);
        }
        else if (jobStatus.equals("complete")){
            javaxt.io.File file = job.getOutputs()[0];
            String query = job.getQuery();

          //Check whether to save output
            boolean saveOutput = false;
            long ellapsedTime = job.getEllapsedTime();
            if (ellapsedTime>15000){
                saveOutput = true;
            }


          //Update cache
            if (saveOutput){
                synchronized(cache){
                    cache.put(job.getFormat() + "|" + query, file.toString());
                    cache.notify();
                }
            }


            boolean returnFile = false;
            synchronized(cache) {
                String path = (String) cache.get(job.getFormat()+"|"+query);
                if (path!=null){
                    returnFile = true;
                    file = new javaxt.io.File(path);
                }
            }


            if (returnFile){
                response = new ServiceResponse(file);
            }
            else{
                String str = file.getText();
                response = new ServiceResponse(str);
                response.setContentType(file.getContentType());
            }

            deleteJob(job, saveOutput);
        }
        else{
            response = new ServiceResponse(jobStatus);
        }
        return response;
    }


  //**************************************************************************
  //** deleteJob
  //**************************************************************************
  /** Removes a job from the queue and deletes any output files that might
   *  have been created with the job.
   */
    private void deleteJob(QueryJob job, boolean saveOutput){

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

        if (!saveOutput){
            for (javaxt.io.File file : job.getOutputs()){
                file.delete();
            }
        }
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
            job.setStatus("canceled");
            notify(job);


          //TODO: Figure out how to cancel a query
            boolean jobCanceled = false;
//            if (!jobCanceled){
//                throw new Exception();
//            }


          //Update queue
            deleteJob(job, false);


          //return response
            return new ServiceResponse(job.toJson());
        }
        catch(Exception e){
            return new ServiceResponse(500, "failed to cancel query");
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

            StringBuilder str = new StringBuilder();
            for (String row : query.split("\n")){
                row = row.replace("\r", " ").replace("\n", " ").replace("\t", " ").trim();
                while (row.contains("  ")) row = row.replace("  ", " ");
                row = row.trim();
                if (row.length()==0 || row.startsWith("//")) continue;
                str.append(row);
                str.append(" ");
            }

            query = str.toString().trim();
            if (query.endsWith(";")) query = query.substring(0, query.length()-1).trim();

            //console.log(query);


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

        public Long getLimit(){
            return limit;
        }

        public Long getOffset(){
            return offset;
        }

        public String getFormat(){
            return format;
        }

        public Long getEllapsedTime(){
            return updated.getTime()-created.getTime();
        }

        public String getKey(){
            return userID + ":" + id;
        }

        public String getStatus(){
            return status;
        }

        public void setStatus(String status){
            this.status = status;
            updated = new javaxt.utils.Date();
        }

        public boolean isCanceled(){
            return status.equals("canceled");
        }

        public boolean isComplete(){
            return status.equals("complete");
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

        public javaxt.io.File[] getOutputs(){
            String path = jobDir.toString() + id + ".";
            return new javaxt.io.File[]{
                new javaxt.io.File(path + format),
                new javaxt.io.File(path + "cypher")
            };
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

        private QueryService queryService;

        public QueryProcessor(QueryService queryService){
            this.queryService = queryService;
        }

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

                      //Get query
                        String query = job.getQuery();


                      //Check if the cache has results for the query
                        synchronized(cache) {
                            String path = (String) cache.get(job.getFormat()+"|"+query);
                            if (path!=null){
                                javaxt.io.File file = new javaxt.io.File(path);
                                if (file.exists()){
                                    job.setStatus("complete");
                                    queryService.notify(job);
                                }
                            }
                        }


                      //Execute query as needed
                        if (!job.isComplete()){
                            Session session = null;
                            try{

                              //Update job status and set start time
                                job.setStatus("running");
                                long startTime = System.currentTimeMillis();
                                queryService.notify(job);


                              //Instantiate writer
                                Writer writer = new Writer(job);


                              //Open database connection and execute query
                                session = graph.getSession(true);
                                Result rs = session.run(query);
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
                                writer.close();


                              //Update job status
                                job.setStatus("complete");
                                queryService.notify(job);
                            }
                            catch(Exception e){
                                if (session!=null) session.close();

                                if (job.isCanceled()){
                                    for (javaxt.io.File file : job.getOutputs()){
                                        file.delete();
                                    }
                                }
                                else{
                                    job.setStatus("failed");
                                    queryService.notify(job);

                                    javaxt.io.File file = job.getOutputs()[0];
                                    file.delete();
                                    java.io.PrintStream ps = null;
                                    try {
                                        file.create();
                                        ps = new java.io.PrintStream(file.toFile());
                                        e.printStackTrace(ps);
                                        ps.close();
                                    }
                                    catch (Exception ex) {
                                        if (ps!=null) ps.close();
                                        file.write(e.getMessage());
                                    }

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


  //**************************************************************************
  //** getCache
  //**************************************************************************
    private ServiceResponse getCache(ServiceRequest request) {

      //Prevent non-admin users from seeing the cache
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (user.getAccessLevel()<5) return new ServiceResponse(403, "Not Authorized");


        return new ServiceResponse(501, "Not implemented");
    }


  //**************************************************************************
  //** deleteCache
  //**************************************************************************
    private ServiceResponse deleteCache(ServiceRequest request){

      //Prevent non-admin users from deleteing the cache
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (user.getAccessLevel()<5) return new ServiceResponse(403, "Not Authorized");


      //Update cache
        synchronized(cache){

          //Deleted cached files
            Iterator<String> it = cache.keySet().iterator();
            while (it.hasNext()){
                String key = it.next();
                String file = cache.get(key).toString();
                deletedCachedFiles(file);
            }

          //Clear hashmap
            cache.clear();
            cache.notifyAll();
        }
        return new ServiceResponse(200);
    }


  //**************************************************************************
  //** deletedCachedFiles
  //**************************************************************************
    private void deletedCachedFiles(String file){
        javaxt.io.File f = new javaxt.io.File(file);
        f.delete();
        new javaxt.io.File(f.getDirectory(), f.getName(false) + ".cypher").delete();
    }


  //**************************************************************************
  //** requiresUpdate
  //**************************************************************************
    private boolean requiresUpdate(String query, JSONObject info){
        Long timestamp = info.get("timestamp").toLong();
        String action = info.get("action").toString();
        String type = info.get("type").toString();
        JSONArray data = info.get("data").toJSONArray();
        String username = info.get("user").toString();


        if ((action.equals("create") || action.equals("delete")) && (type.equals("nodes"))){

          //Check if query contains node
            query = query.toLowerCase();
            for (int i=0; i<data.length(); i++){
                JSONArray entry = data.get(i).toJSONArray();
                if (entry.isEmpty()) continue;


                for (int j=1; j<entry.length(); j++){
                    String label = entry.get(j).toString();
                    if (label!=null){
                        label = label.toLowerCase();
                        if (query.contains(label)){
                            return true;
                        }
                    }
                }

            }

        }
        return false;
    }
}