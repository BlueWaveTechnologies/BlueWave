package bluewave.web.services;
import bluewave.graph.fdp.Edge;
import bluewave.graph.fdp.Vertex;
import bluewave.graph.fdp.ForceDirectedGraph;
import bluewave.graph.Neo4J;
import bluewave.utils.NotificationService;
import bluewave.utils.SpatialIndex;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import javaxt.express.*;
import javaxt.http.servlet.ServletException;
import javaxt.sql.*;
import javaxt.json.*;

import java.util.*;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import java.awt.Color;
import java.awt.BasicStroke;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import javax.vecmath.Vector2d;

import java.sql.Clob;
import java.sql.PreparedStatement;

import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;

import org.locationtech.jts.geom.*;

//******************************************************************************
//**  GraphService
//******************************************************************************
/**
 *   WebService used to support graph analysis and visualization
 *
 ******************************************************************************/

public class GraphService extends WebService {

    private Neo4J graph;
    private ConcurrentHashMap<String, Object> cache;
    private javaxt.io.Directory cacheDir;
    private Database logDB;
    private boolean test = true;


    private int tileSize = 256;
    private double initialResolution = 2 * Math.PI * 6378137 / tileSize;
    private double originShift = 2 * Math.PI * 6378137 / 2.0;
    private GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel());


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public GraphService(){
        this.graph = bluewave.Config.getGraph(null);
        this.cache = new ConcurrentHashMap<>();
        Properties properties = graph.getProperties();


      //Set path to the cacheDir directory
        String localCache = properties.get("localCache").toString();
        if (localCache!=null){
            cacheDir = new javaxt.io.Directory(localCache);
            if (!cacheDir.exists()) cacheDir.create();
            if (!cacheDir.exists()) cacheDir = null;
        }


      //Initialize local log database
        String localLog = properties.get("localLog").toString();
        if (localLog!=null){
            String path = localLog.replace("\\", "/");
            javaxt.io.Directory dbDir = new javaxt.io.Directory(path);
            dbDir.create();
            if (dbDir.exists())
            try{
                path = new java.io.File(dbDir.toString()+"database").getCanonicalPath();
                logDB = new javaxt.sql.Database();
                logDB.setDriver("H2");
                logDB.setHost(path);
                logDB.setConnectionPoolSize(25);
                initDatabase();
            }
            catch(Exception e){
                logDB = null;
                e.printStackTrace();
            }
        }


      //Prepopulate cache
        try{
            getNodes();
            getProperties();
        }
        catch(Exception e){}


      //Add listener to the NotificationService to update the cache
        NotificationService.addListener(new NotificationService.Listener(){
            public void processEvent(String event, String info, long timestamp){
                if (event.equals("neo4J")){
                    if (info.equals("newserver")){
                        deleteCache();
                    }
                    else{
                        JSONObject json = new JSONObject(info);
                        logEvent(json);
                        updateCache(json);
                    }
                }
            }
        });
    }


  //**************************************************************************
  //** saveUpdate
  //**************************************************************************
  /** REST endpoint to receive status messages from the Graph (e.g. Neo4J)
   */
    public ServiceResponse saveUpdate(ServiceRequest request, Database database)
        throws ServletException, IOException {


      //Check if client is authorized to make this request
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (!user.getUsername().equalsIgnoreCase("neo4j")){
            return new ServiceResponse(403, "Not Authorized");
        }


      //Parse the message and notify
        try{
            JSONArray arr = new JSONArray(new String(request.getPayload()));
            JSONObject event = new JSONObject();
            event.set("timestamp", arr.get(0).toLong()); //nanoseconds
            event.set("action", arr.get(1).toString());
            event.set("type", arr.get(2).toString());
            event.set("data", arr.get(3).toJSONArray());
            event.set("user", arr.get(4).toString());
            NotificationService.notify("neo4J", event.toString());
        }
        catch(Exception e){
            //don't return errors to the client!
        }

        return new ServiceResponse(200);
    }


  //**************************************************************************
  //** getNodes
  //**************************************************************************
    public ServiceResponse getNodes(ServiceRequest request, Database database)
        throws ServletException, IOException {
        try{
            return new ServiceResponse(getNodes());
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getNodes
  //**************************************************************************
    private JSONArray getNodes() throws Exception {
        synchronized(cache){
            Object obj = cache.get("nodes");
            if (obj!=null){
                return (JSONArray) obj;
            }
            else{
                JSONArray arr = new JSONArray();

                javaxt.io.File f = null;
                if (cacheDir!=null){
                    f = new javaxt.io.File(cacheDir, "nodes.json");
                }

                if (f!=null && f.exists()){
                    arr = new JSONArray(f.getText());
                    for (int i=0; i<arr.length(); i++){
                        JSONObject node = arr.get(i).toJSONObject();
                        Long c = node.get("count").toLong();
                        Long r = node.get("relations").toLong();
                        AtomicLong count = new AtomicLong(c==null ? 0 : c);
                        AtomicLong relations = new AtomicLong(r==null ? 0 : r);
                        node.set("count", count);
                        node.set("relations", relations);
                    }
                }
                else{

                    Session session = null;
                    try {

                      //Execute query
                        String query = bluewave.queries.Index.getQuery("Nodes_And_Counts", "cypher");
                        session = graph.getSession();
                        Result rs = session.run(query);
                        while (rs.hasNext()){
                            Record r = rs.next();
                            List labels = r.get(0).asList();
                            String label = labels.isEmpty()? "" : labels.get(0).toString();
                            AtomicLong count = new AtomicLong(r.get(1).asLong());
                            AtomicLong relations = new AtomicLong(r.get(2).asLong());
                            JSONObject json = new JSONObject();
                            json.set("node", label);
                            json.set("count", count);
                            json.set("relations", relations);
                            json.set("id", label);
                            arr.add(json);
                        }
                        session.close();


                      //Write file
                        if (f!=null){
                            f.create();
                            f.write(arr.toString());
                        }
                    }
                    catch (Exception e) {
                        if (session != null) session.close();
                        throw e;
                    }
                }



              //Update cache
                cache.put("nodes", arr);
                cache.notify();


                return arr;

            }
        }
    }


  //**************************************************************************
  //** getProperties
  //**************************************************************************
    public ServiceResponse getProperties(ServiceRequest request, Database database)
        throws ServletException, IOException {
        try{
            return new ServiceResponse(getProperties());
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getProperties
  //**************************************************************************
    private JSONArray getProperties() throws Exception {
        synchronized(cache){
            Object obj = cache.get("properties");
            if (obj!=null){
                return (JSONArray) obj;
            }
            else{
                JSONArray arr = new JSONArray();

                javaxt.io.File f = null;
                if (cacheDir!=null){
                    f = new javaxt.io.File(cacheDir, "properties.json");
                }

                if (f!=null && f.exists()){
                    arr = new JSONArray(f.getText());
                }
                else{

                    Session session = null;
                    try {

                      //Execute query
                        String query = bluewave.queries.Index.getQuery("Nodes_And_Properties", "cypher");
                        session = graph.getSession();
                        Result rs = session.run(query);
                        while (rs.hasNext()){
                            Record r = rs.next();
                            String label = r.get(0).asString();
                            List props = r.get(1).asList();
                            JSONObject json = new JSONObject();
                            json.set("node", label);
                            JSONArray properties = new JSONArray();
                            json.set("properties", properties);
                            for (Object p : props){
                                properties.add(p);
                            }
                            arr.add(json);
                        }
                        session.close();


                      //Write file
                        if (f!=null){
                            f.create();
                            f.write(arr.toString());
                        }
                    }
                    catch (Exception e) {
                        if (session != null) session.close();
                        throw e;
                    }
                }



              //Update cache
                cache.put("properties", arr);
                cache.notify();


                return arr;

            }
        }
    }


  //**************************************************************************
  //** getRelationships
  //**************************************************************************
    public ServiceResponse getRelationships(ServiceRequest request, Database database) throws ServletException, IOException {
        Session session = null;
        try {

            if (request.hasParameter("id")) {
                //Parse parameters
                Long id = request.getParameter("id").toLong();
                if (id==null) return new ServiceResponse(400, "ID is required");
                //Get query and replace id
                String query = bluewave.queries.Index.getQuery("Nodes_And_Edges_By_Selected_Node", "cypher");
                query = query.replace("{id}", id+"");
                //Generate response (json string)
                String json = "{}";
                session = graph.getSession();
                Result rs = session.run(query);
                if (rs.hasNext()){
                    Record record = rs.next();
                    Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                    json = gson.toJson(record.get(0).asMap());
                }
                session.close();
                //Return response
                ServiceResponse response = new ServiceResponse(json);
                response.setContentType("application/json");
                return response;
            }
            else if (request.hasParameter("nodeType")){
                //Parse parameters
                String nodeType = request.getParameter("nodeType").toString();
                if (nodeType==null) return new ServiceResponse(400, "nodeType is required");

                //Get query and replace id
                String query = bluewave.queries.Index.getQuery("Edges_By_Selected_Pack", "cypher");
                query = query.replace("{packLabel}", nodeType+"");

                //Generate response (json string)
                String json = "{}";
                session = graph.getSession();
                Result rs = session.run(query);
                if (rs.hasNext()){
                    Record record = rs.next();
                    Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                    json = gson.toJson(record.get(0).asMap());
                }
                session.close();

                //Return response
                ServiceResponse response = new ServiceResponse(json);
                response.setContentType("application/json");
                return response;
            }
            return new ServiceResponse(400, "Invalid parameters");
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getNetwork
  //**************************************************************************
    public ServiceResponse getNetwork(ServiceRequest request, Database database)
        throws ServletException, IOException {
        try {

          //Get network
            JSONObject json = getNetwork();


          //Transform json as needed
            String format = request.getParameter("format").toString();
            if (format!=null){
                if (format.equalsIgnoreCase("gexf")){
                    StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
                    xml.append("<gexf xmlns=\"http://www.gexf.net/1.2draft\" version=\"1.2\">\n");
                    xml.append("<graph mode=\"static\" defaultedgetype=\"directed\">\n");

                    JSONArray nodes = json.get("nodes").toJSONArray();
                    JSONArray links = json.get("links").toJSONArray();

                    if (!nodes.isEmpty()){
                        xml.append("<nodes>\n");
                        for (int i=0; i<nodes.length(); i++){
                            JSONObject node = nodes.get(i).toJSONObject();
                            String id = node.get("id").toString();
                            JSONArray labels = node.get("labels").toJSONArray();
                            String label = labels.get(0).toString();
                            for (int j=1; j<labels.length(); j++){
                                label+=","+labels.get(j).toString();
                            }

                            xml.append("<node id=\"");
                            xml.append(id);
                            xml.append("\" label=\"");
                            xml.append(label);
                            xml.append("\" />\n");
                        }
                        xml.append("</nodes>\n");
                    }

                    if (!links.isEmpty()){
                        xml.append("<edges>\n");
                        for (int i=0; i<links.length(); i++){
                            JSONObject link = links.get(i).toJSONObject();
                            String source = link.get("source").toString();
                            String target = link.get("target").toString();
                            xml.append("<edge id=\"");
                            xml.append(i);
                            xml.append("\" source=\"");
                            xml.append(source);
                            xml.append("\" target=\"");
                            xml.append(target);
                            xml.append("\" />\n");
                        }
                        xml.append("</edges>\n");
                    }

                    xml.append("</graph>\n");
                    xml.append("</gexf>");
                    ServiceResponse response = new ServiceResponse(xml.toString());
                    response.setContentType("application/xml");
                    return response;
                }
            }


          //Return response
            return new ServiceResponse(json);
        }
        catch (Exception e) {
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getNetwork
  //**************************************************************************
    private JSONObject getNetwork() throws Exception {

        JSONObject json;
        synchronized(cache){
            Object obj = cache.get("network");
            if (obj!=null){
                json = (JSONObject) obj;
            }
            else{
                String str = null;

                javaxt.io.File f = null;
                if (cacheDir!=null){
                    f = new javaxt.io.File(cacheDir, "network.json");
                    if (test) f = new javaxt.io.File(cacheDir, "miserables.json");
                }

                if (f!=null && f.exists()){
                    str = f.getText();
                }
                else{

                    Session session = null;
                    try {

                      //Get query
                        String query = bluewave.queries.Index.getQuery("Nodes_And_Edges", "cypher");


                      //Execute query
                        session = graph.getSession();
                        Result result = session.run(query);
                        if (result.hasNext()) {
                            Record record = result.next();
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            str = gson.toJson(record.get(0).asMap());
                        }
                        session.close();


                        if (f!=null) f.write(str);
                    }
                    catch (Exception e) {
                        if (session != null) session.close();
                        throw e;
                    }

                }

              //Convert results to JSON
                if (str==null) json = new JSONObject();
                else json = new JSONObject(str);


              //Update cache
                cache.put("network", json);
                cache.notify();

            }
        }

        return json;
    }


  //**************************************************************************
  //** getGraph
  //**************************************************************************
    private ForceDirectedGraph getGraph() throws Exception {


        ForceDirectedGraph graph;
        synchronized(cache){
            Object obj = cache.get("graph");
            if (obj!=null){
                graph = (ForceDirectedGraph) obj;
            }
            else{

                long t = System.currentTimeMillis();

                javaxt.io.File f = null;
                if (cacheDir!=null){
                    f = new javaxt.io.File(cacheDir, "network.txt");
                    if (test) f = new javaxt.io.File(cacheDir, "miserables.txt");
                }

                if (f!=null && f.exists()){
                    graph = new ForceDirectedGraph(f);
                }
                else{
                    JSONObject json = getNetwork();
                    console.log("Network: " + (System.currentTimeMillis()-t));
                    JSONArray nodes = json.get("nodes").toJSONArray();
                    JSONArray links = json.get("links").toJSONArray();

                    graph = new ForceDirectedGraph();
                    HashMap<String, Vertex> verticies = new HashMap<>();

                    for (int i=0; i<nodes.length(); i++){
                        JSONObject node = nodes.get(i).toJSONObject();
                        String id = node.get("id").toString();
                        JSONArray labels = node.get("labels").toJSONArray();

                        String label = null;
                        if (labels!=null){
                            label = labels.get(0).toString();
                            for (int j=1; j<labels.length(); j++){
                                label+=","+labels.get(j).toString();
                            }
                        }

                        Vertex v = new Vertex();
                        v.setProperty("id", id);
                        v.setProperty("label", label);
                        graph.addVertex(v);
                        verticies.put(id, v);
                    }

                    for (int i=0; i<links.length(); i++){
                        JSONObject link = links.get(i).toJSONObject();
                        String source = link.get("source").toString();
                        String target = link.get("target").toString();

                        Vertex v = verticies.get(source);
                        Vertex u = verticies.get(target);

                        graph.addEdge(v, u);
                    }


                    graph.build();
                    console.log("Ellapsed time: " + (System.currentTimeMillis()-t));


                  //Save file
                    if (f!=null) graph.saveAs(f);
                }


              //Update cache
                cache.put("graph", graph);
                cache.notify();
            }
        }

        return graph;
    }


  //**************************************************************************
  //** getSpatialIndex
  //**************************************************************************
    private SpatialIndex getSpatialIndex() throws Exception {

        SpatialIndex spatialIndex;
        synchronized(cache){
            Object obj = cache.get("spatialIndex");
            if (obj!=null){
                spatialIndex = (SpatialIndex) obj;
            }
            else{
                ForceDirectedGraph graph = getGraph();

                spatialIndex = new SpatialIndex();
                HashMap<Long, Object> map = new HashMap<>();
                long id = 0;

                for (Edge e : graph.getEdges()) {
                    Vertex v = e.getV();
                    Vertex u = e.getU();
                    Vector2d uPos = u.getPos();
                    Vector2d vPos = v.getPos();

                    double x1 = uPos.x;
                    double y1 = uPos.y;
                    double x2 = vPos.x;
                    double y2 = vPos.y;

                    Geometry geom =
                    geometryFactory.createLineString(new Coordinate[]{
                        new Coordinate(x1, y1),
                        new Coordinate(x2, y2)
                    });
                    e.setProperty("geom", geom);
                    spatialIndex.add(geom, id);
                    map.put(id, e);
                    id++;
                }


                for (Vertex v : graph.getVertices()) {
                    Geometry geom =
                    geometryFactory.createPoint(new Coordinate(v.getPos().x, v.getPos().y));
                    v.setProperty("geom", geom);
                    spatialIndex.add(geom, id);
                    map.put(id, v);
                    id++;
                }

                spatialIndex.build();
                spatialIndex.addMap(map);

                cache.put("spatialIndex", spatialIndex);
                cache.notify();
            }

        }
        return spatialIndex;
    }


  //**************************************************************************
  //** getExtents
  //**************************************************************************
    public ServiceResponse getExtents(ServiceRequest request, Database database)
        throws ServletException, IOException {

        try{
            SpatialIndex spatialIndex = getSpatialIndex();
            Envelope envelope = spatialIndex.getExtents();
            return new ServiceResponse(
                envelope.getMinX() + " " + envelope.getMinY() + ", " +
                envelope.getMaxX() + " " + envelope.getMaxY());
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getImage
  //**************************************************************************
    public ServiceResponse getImage(ServiceRequest request, Database database)
        throws ServletException, IOException {

        try{

          //Create image
            javaxt.io.Image img = new javaxt.io.Image(tileSize, tileSize);
            Graphics2D g2d = img.getBufferedImage().createGraphics();

          //Enable anti-alias
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                                 RenderingHints.VALUE_ANTIALIAS_ON);


          //Parse path
            int z = request.getPath(1).toInteger();
            int x = request.getPath(2).toInteger();
            int y = request.getPath(3).toInteger();


          //Get bounding rectangle
            Coordinate topLeft = tileTopLeft(x, y, z);
            Coordinate lowerRight = tileTopLeft(x+1, y+1, z);
            Envelope envelope = new Envelope(topLeft, lowerRight);
            Geometry rect = geometryFactory.toGeometry(envelope);


          //Compute tile stats
            double ULx = topLeft.getX();
            double ULy = topLeft.getY();
            double width = diff(ULx,lowerRight.getX());
            double height = diff(ULy,lowerRight.getY());
            double resX = (double)tileSize/width;
            double resY = (double)tileSize/height;


          //Get spatial index
            SpatialIndex spatialIndex = getSpatialIndex();
            HashMap<Long, Object> map = spatialIndex.getMap();


          //Expand evelope slightly (ideally, should be based on node size)
            envelope.expandBy(width*0.25);


          //Find nodes and edges that intersect the bounding rectangle. Render
          //edges as they are found. Nodes will be rendered later.
            ArrayList<Vertex> vertices = new ArrayList<>();
            for (long id : spatialIndex.getIDs(envelope)){
                Object obj = map.get(id);
                if (obj instanceof Edge){
                    Edge e = (Edge) obj;
                    LineString line = (LineString) e.getProperty("geom");
                    Geometry g = line.intersection(rect);
                    if (g instanceof LineString){
                        line = (LineString) g;
                        Coordinate[] coords = line.getCoordinates();
                        if (coords.length>1){
                            int x1 = (int) Math.round( diff(ULx,coords[0].getX()) * resX);
                            int y1 = (int) Math.round( diff(ULy,coords[0].getY()) * resY);
                            int x2 = (int) Math.round( diff(ULx,coords[1].getX()) * resX);
                            int y2 = (int) Math.round( diff(ULy,coords[1].getY()) * resY);
                            g2d.setStroke(new BasicStroke(1));
                            g2d.setColor(Color.gray);
                            g2d.drawLine(x1, y1, x2, y2);
                        }
                    }
                    else{
                        //MultiLineString?
                        console.log(g.getClass());
                    }
                }
                else if (obj instanceof Vertex){
                    Vertex v = (Vertex) obj;
                    Point pt = (Point) v.getProperty("geom");
                    if (pt.intersects(rect)){
                        vertices.add(v);
                    }
                }
            }


          //Render nodes
            for (Vertex v : vertices){
                Point pt = (Point) v.getProperty("geom");
                int x1 = (int) Math.round( diff(ULx,pt.getX()) * resX);
                int y1 = (int) Math.round( diff(ULy,pt.getY()) * resY);
                int r;

              //Draw white outline
                r = 4;
                g2d.setColor(Color.white);
                g2d.fillOval(x1-r, y1-r, r*2, r*2);

              //Draw fill
                r = 3;
                g2d.setColor(Color.red);
                g2d.fillOval(x1-r, y1-r, r*2, r*2);
            }



            //img.addText(z+"/"+x+"/"+y, 10, 128);
            ServiceResponse response = new ServiceResponse(img.getByteArray("png"));
            response.setContentType("image/png");
            return response;
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getSelect
  //**************************************************************************
    public ServiceResponse getSelect(ServiceRequest request, Database database)
        throws ServletException, IOException {

        String point = request.getParameter("point").toString();
        if (point==null) return new ServiceResponse(400, "Point is required");

        try{

          //Parse point and great geom
            String[] pt = point.split(",");
            double x = Double.parseDouble(pt[0]);
            double y = Double.parseDouble(pt[1]);
            Geometry c = geometryFactory.createPoint(new Coordinate(x, y));


          //Get spatial index
            SpatialIndex spatialIndex = getSpatialIndex();
            HashMap<Long, Object> map = spatialIndex.getMap();


          //Find vertices
            TreeMap<Double, Vertex> results = new TreeMap<>();
            for (long id : spatialIndex.getIDs(c.buffer(6))){
                Object obj = map.get(id);
                if (obj instanceof Vertex){
                    Vertex v = (Vertex) obj;
                    Point p = (Point) v.getProperty("geom");
                    double d = p.distance(c);
                    results.put(d, v);
                }
            }


            JSONArray arr = new JSONArray();
            Iterator<Double> it = results.keySet().iterator();
            while (it.hasNext()){
                double d = it.next();
                Vertex v = results.get(d);
                Point p = (Point) v.getProperty("geom");
                JSONObject json = new JSONObject();
                json.set("id", v.getProperty("id"));
                json.set("label", v.getProperty("label"));
                json.set("x", p.getX());
                json.set("y", p.getY());
                arr.add(json);
            }

            return new ServiceResponse(arr);
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** diff
  //**************************************************************************
  /** Returns the difference between to numbers
   */
    private static double diff(double a, double b){
        return Math.abs(a-b);
    }

    private Coordinate tileTopLeft(int tx, int ty, int zoomLevel) {
        int px = tx * tileSize;
        int py = ty * tileSize;
        Coordinate result = pixelsToMeters(px, py, zoomLevel);
        return result;
    }

    private Coordinate pixelsToMeters(double px, double py, int zoomLevel) {
        double res = initialResolution / (1 << zoomLevel);
        double mx = px * res - originShift;
        double my = -py * res + originShift;
        return new Coordinate(mx, my);
    }


  //**************************************************************************
  //** getCache
  //**************************************************************************
    public ServiceResponse getCache(ServiceRequest request, Database database)
        throws ServletException, IOException {

      //Prevent non-admin users from seeing the cache
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (user.getAccessLevel()<5) return new ServiceResponse(403, "Not Authorized");


        JSONArray arr = new JSONArray();
        synchronized(cache){
            Iterator<String> it = cache.keySet().iterator();
            while (it.hasNext()){
                arr.add(it.next());
            }
        }
        return new ServiceResponse(arr);
    }


  //**************************************************************************
  //** deleteCache
  //**************************************************************************
    public ServiceResponse deleteCache(ServiceRequest request, Database database)
        throws ServletException, IOException {

      //Prevent non-admin users from deleting the cache
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        if (user==null || user.getAccessLevel()<5) return new ServiceResponse(403, "Not Authorized");

      //Delete cache
        deleteCache();

      //Return response
        return new ServiceResponse(200);
    }


  //**************************************************************************
  //** deleteCache
  //**************************************************************************
    private void deleteCache(){
        synchronized(cache){
            if (cacheDir!=null){
                Iterator<String> it = cache.keySet().iterator();
                while (it.hasNext()){
                    String key = it.next();
                    javaxt.io.File f = new javaxt.io.File(cacheDir, key + ".json");
                    if (f.exists()) f.delete();
                }
            }
            cache.clear();
            cache.notify();
        }
    }


  //**************************************************************************
  //** updateCache
  //**************************************************************************
    private void updateCache(JSONObject info){

        Long timestamp = info.get("timestamp").toLong();
        String action = info.get("action").toString();
        String type = info.get("type").toString();
        JSONArray data = info.get("data").toJSONArray();
        String username = info.get("user").toString();


        if ((action.equals("create") || action.equals("delete")) && (type.equals("nodes") || type.equals("relationships")))
        synchronized(cache){
            try{

              //Update nodes
                JSONArray nodes = getNodes();
                boolean updateFile = false;
                for (int i=0; i<data.length(); i++){
                    JSONArray entry = data.get(i).toJSONArray();
                    if (entry.isEmpty()) continue;


                    HashSet<String> labels = new HashSet<>();
                    for (int j=1; j<entry.length(); j++){
                        String label = entry.get(j).toString();
                        if (label!=null) label = label.toLowerCase();
                        labels.add(label);
                    }

                    boolean foundMatch = false;
                    for (int j=0; j<nodes.length(); j++){
                        JSONObject node = nodes.get(j).toJSONObject();

                        String label = node.get("node").toString();
                        if (label!=null && labels.contains(label.toLowerCase())){
                            if (type.equals("nodes")){
                                AtomicLong count = (AtomicLong) node.get("count").toObject();
                                Long a = count.get();
                                if (action.equals("create")){
                                    count.incrementAndGet();
                                }
                                else{
                                    Long n = count.decrementAndGet();
                                    if (n==0){
                                        //TODO: Remove node
                                    }
                                }
                                Long b = count.get();
                                console.log((b>a ? "increased " : "decreased ") + label + " to " + b);
                                updateFile = true;
                            }
                            else if (type.equals("relationships")){
                                AtomicLong relations = (AtomicLong) node.get("relations").toObject();
                            }

                            foundMatch = true;
                            break;
                        }
                    }


                    if (!foundMatch){
                        if (action.equals("create") && (type.equals("nodes"))){
                            console.log("add node!");
                            String label = entry.get(1).toString();
                            AtomicLong count = new AtomicLong(1);
                            AtomicLong relations = new AtomicLong(0);
                            JSONObject json = new JSONObject();
                            json.set("node", label);
                            json.set("count", count);
                            json.set("relations", relations);
                            json.set("id", label);
                            nodes.add(json);
                            updateFile = true;
                        }
                    }
                }


                if (updateFile && cacheDir!=null){
                    javaxt.io.File f = new javaxt.io.File(cacheDir, "nodes.json");
                    f.write(nodes.toString());
                }



              //TODO: Update properties



              //TODO: Update network


                cache.notifyAll();

            }
            catch(Exception e){
                e.printStackTrace();
            }
        }
    }

    
  //**************************************************************************
  //** getIngest
  //**************************************************************************
  /** Used to ingest a file found on the server
   */
    public ServiceResponse getIngest(ServiceRequest request, Database database) throws ServletException {

      //Get user associated with the request
        bluewave.app.User user = (bluewave.app.User) request.getUser();


      //Prevent non-admin users from importing
        if (user.getAccessLevel()<5) throw new ServletException(403, "Not Authorized");



      //Parse path
        String path = request.getParameter("path").toString();
        if (path!=null) path = path.replace("\\", "/").trim();
        if (path==null || path.isEmpty()) return new ServiceResponse(400, "path is required");



      //Get file and extension
        javaxt.io.File file = new javaxt.io.File(path);
        if (!file.exists()) return new ServiceResponse(400, "path is invalid");
        String fileType = file.getExtension().toLowerCase();


      //Get node type
        String nodeType = request.getParameter("node").toString();
        if (nodeType==null) nodeType = request.getParameter("vertex").toString();
        if (nodeType==null) return new ServiceResponse(400, "node or vertex is required");


      //Get unique keys
        Integer[] keys = null;
        if (request.hasParameter("keys")){
            String[] arr = request.getParameter("keys").toString().split(",");
            keys = new Integer[arr.length];
            for (int i=0; i<arr.length; i++){
                keys[i] = Integer.parseInt(arr[i]);
            }
        }


      //Import file
        try{
            bluewave.graph.Neo4J graph = bluewave.Config.getGraph(user);
            if (fileType.equals("csv")){
                bluewave.graph.Import.importCSV(file, nodeType, keys, 12, graph);
            }
            else if (fileType.equals("json")){
                String target = request.getParameter("target").toString();
                bluewave.graph.Import.importJSON(file, nodeType, target, graph);
            }
            else{
                return new ServiceResponse(400, "unsupported file type");
            }
            return new ServiceResponse(200);
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }

    }
    

  //**************************************************************************
  //** initDatabase
  //**************************************************************************
  /** Used to initialize the log database
   */
    private void initDatabase() throws Exception {


      //Create tables as needed
        Connection conn = null;
        try{
            conn = logDB.getConnection();

            boolean initSchema;
            javaxt.io.File db = new javaxt.io.File(logDB.getHost() + ".mv.db");
            if (!db.exists()){
                initSchema = true;
            }
            else{
                Table[] tables = Database.getTables(conn);
                initSchema = tables.length==0;
            }


            if (initSchema){
                db.getDirectory().create();

                String cmd =
                "CREATE TABLE IF NOT EXISTS TRANSACTION( " +
                "id bigint auto_increment, " +
                "action varchar(10), "+
                "type varchar(25), " +
                "data clob, " +
                "username varchar(35), " +
                "timestamp LONG);";

                java.sql.Statement stmt = conn.getConnection().createStatement();
                stmt.execute(cmd);
                stmt.close();
            }


            conn.close();
        }
        catch(Exception e){
            if (conn!=null) conn.close();
            throw e;
        }


      //Inititalize connection pool
        logDB.initConnectionPool();
    }


  //**************************************************************************
  //** logEvent
  //**************************************************************************
  /** Used to log a transaction in the log database
   */
    private void logEvent(JSONObject info){
        if (logDB==null) return;

        Long timestamp = info.get("timestamp").toLong();
        String action = info.get("action").toString();
        String type = info.get("type").toString();
        JSONArray data = info.get("data").toJSONArray();
        String user = info.get("user").toString();


        Connection conn = null;
        try{
            conn = logDB.getConnection();
            java.sql.Connection c = conn.getConnection();

            PreparedStatement preparedStatement = c.prepareStatement(
            "INSERT INTO TRANSACTION (action, type, data, username, timestamp) " +
            "VALUES (?, ?, ?, ?, ?)");

            Clob clob = c.createClob();
            clob.setString(1, data.toString());

            preparedStatement.setString(1, action);
            preparedStatement.setString(2, type);
            preparedStatement.setClob(3, clob);
            preparedStatement.setString(4, user);
            preparedStatement.setLong(5, timestamp);
            preparedStatement.executeUpdate();
            preparedStatement.close();

            conn.close();
        }
        catch(Exception e){
            if (conn!=null) conn.close();
        }

    }

}