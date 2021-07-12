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
import javaxt.sql.Database;
import javaxt.json.*;

import java.util.*;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import java.awt.Color;
import java.awt.BasicStroke;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import javax.vecmath.Vector2d;

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
    private boolean test = true;


    private int tileSize = 256;
    private double initialResolution = 2 * Math.PI * 6378137 / tileSize;
    private double originShift = 2 * Math.PI * 6378137 / 2.0;
    private GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel());


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public GraphService(Neo4J graph, JSONObject webConfig){
        this.graph = graph;
        this.cache = new ConcurrentHashMap<>();

      //Set path to the cacheDir directory
        if (webConfig.has("jobDir")){
            cacheDir = new javaxt.io.Directory(webConfig.get("jobDir").toString());
            cacheDir = new javaxt.io.Directory(cacheDir+"graph");
            if (!cacheDir.exists()) cacheDir.create();
            if (!cacheDir.exists()) cacheDir = null;
        }
        if (cacheDir==null){
            throw new IllegalArgumentException("Invalid \"jobDir\"");
        }
    }


  //**************************************************************************
  //** getNodes
  //**************************************************************************
    public ServiceResponse getNodes(ServiceRequest request, Database database)
        throws ServletException, IOException {


        synchronized(cache){
            Object obj = cache.get("nodes");
            if (obj!=null){
                return new ServiceResponse((JSONArray) obj);
            }
            else{

                Session session = null;
                try {

                    JSONArray arr = new JSONArray();
                    String query = bluewave.queries.Index.getQuery("Nodes_And_Counts", "cypher");
                    session = graph.getSession();
                    Result rs = session.run(query);
                    int id = 0;
                    while (rs.hasNext()){
                        Record r = rs.next();
                        List labels = r.get(0).asList();
                        String label = labels.isEmpty()? "" : labels.get(0).toString();
                        Long count = r.get(1).asLong();
                        Long relations = r.get(2).asLong();
                        JSONObject json = new JSONObject();
                        json.set("node", label);
                        json.set("count", count);
                        json.set("relations", relations);
                        json.set("id", label);
                        arr.add(json);
                    }
                    session.close();


                    cache.put("nodes", arr);
                    cache.notify();

                    return new ServiceResponse(arr);
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }
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

                javaxt.io.File f = new javaxt.io.File(cacheDir, "network.json");
                if (test) f = new javaxt.io.File(cacheDir, "miserables.json");
                if (f.exists()){
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


                        f.write(str);
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


                javaxt.io.File f = new javaxt.io.File(cacheDir, "network.txt");
                if (test) f = new javaxt.io.File(cacheDir, "miserables.txt");
                if (f.exists()){
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
                    graph.saveAs(f);
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

}