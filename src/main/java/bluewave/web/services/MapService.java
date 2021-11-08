package bluewave.web.services;
import bluewave.Config;
import bluewave.utils.SpatialIndex;

import java.io.IOException;
import java.util.*;
import java.awt.*;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;

import javaxt.json.*;
import javaxt.sql.*;
import javaxt.express.utils.CSV;

//jts includes
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.io.WKTReader;

//scripting includes
import javax.script.*;
import jdk.nashorn.api.scripting.ScriptObjectMirror;


//******************************************************************************
//**  MapService
//******************************************************************************
/**
 *   Web service used to create map data
 *
 ******************************************************************************/

public class MapService extends WebService {

    private HashMap<Long, String> hospitalIDs = new HashMap<>();
    private HashMap<Long, Point> hospitalPoints = new HashMap<>();
    private SpatialIndex hospitalIndex = new SpatialIndex();
    private ArrayList<String> faFonts = new ArrayList<>();
    private HashMap<String, String> faIcons = new HashMap<>();
    private ScriptObjectMirror faLookup = null;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public MapService(){


      //Load FontAwesome fonts from the web directory
        String fontawesome = Config.get("webserver").get("webDir") + "lib/fontawesome";
        javaxt.io.Directory fontDir = new javaxt.io.Directory(fontawesome);
        try{
            GraphicsEnvironment ge = GraphicsEnvironment.getLocalGraphicsEnvironment();
            for (javaxt.io.File file : fontDir.getFiles("*.ttf", true)){
                Font font = Font.createFont(Font.TRUETYPE_FONT, file.toFile());
                ge.registerFont(font);
            }

            for (String fontFamily : GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames()){
                if (fontFamily.startsWith("Font Awesome")) faFonts.add(fontFamily);
            }
        }
        catch (Exception e){
        }


      //Evaluate fa.js script
        try{
            javaxt.io.File faScript = new javaxt.io.File(fontawesome, "fa.js");
            ScriptEngineManager factory = new ScriptEngineManager();
            ScriptEngine engine = factory.getEngineByName("nashorn");
            Compilable compilable = (Compilable) engine;
            CompiledScript script = compilable.compile(faScript.getText());
            Bindings bindings = engine.createBindings();
            script.eval(bindings);
            faLookup = (ScriptObjectMirror) bindings.get("fa");
        }
        catch(Exception e){
        }



      //Create spatial index of hospital points
        try{
            String sql = bluewave.queries.Index.getQuery("Hospital_Points", "cypher");
            String csv = DataService.getCSV(sql, Config.getGraph(null));
            String[] rows = csv.split("\n");
            long hospitalID = 0;
            for (int i=1; i<rows.length; i++){
                String row = rows[i].trim();
                if (row.length()==0) continue;
                CSV.Columns col = CSV.getColumns(row, ",");
                String id = col.get(0).toString();
                Double lat = col.get(1).toDouble();
                Double lon = col.get(2).toDouble();
                if (lat!=null && lon!=null){
                    Point pt = SpatialIndex.createPoint(lat, lon);
                    hospitalIndex.add(pt, hospitalID);
                    hospitalPoints.put(hospitalID, pt);
                    hospitalIDs.put(hospitalID, id);
                    hospitalID++;
                }
            }
            hospitalIndex.build();
        }
        catch(Exception e){
            console.log("Failed to create spatial index: " + e.getMessage());
        }
    }


  //**************************************************************************
  //** getBasemaps
  //**************************************************************************
    public ServiceResponse getBasemaps(ServiceRequest request, Database database)
        throws ServletException, IOException {
        return new ServiceResponse(Config.get("basemaps").toJSONArray());
    }


  //**************************************************************************
  //** getMarker
  //**************************************************************************
    public ServiceResponse getMarker(ServiceRequest request, Database database)
        throws ServletException, IOException {

      //Parse args
        Integer size = request.getParameter("size").toInteger();
        if (size==null) size = 36;

        String color = request.getParameter("color").toString();
        if (color==null) color = "#ef5646";
        Color rgb = hex2Rgb(color);


        String icon = request.getParameter("icon").toString();
        String text = request.getParameter("text").toString();


      //Create image and get graphics
        double width = size;
        double height = width*1.37;
        javaxt.io.Image img = new javaxt.io.Image(cint(width), cint(height));
        Graphics2D g2d = img.getBufferedImage().createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setColor(rgb);


      //Big circle
        double r = size/2d;
        double cx = r;
        double cy = r;
        double yIntercept = cy+(r/2.0);
        double[] points = getPointsIntersectingCircle(r, cx, cy, 0, yIntercept);
        double ul = points[0];
        double ur = points[1];
        if (ul>ur){
            double temp = ul;
            ul = ur;
            ur = temp;
        }
        g2d.fillOval(0, 0, cint(r*2), cint(r*2));


      //Small circle
        double r2 = r*0.15;
        double c2y = height-r2;
        double yIntercept2 = c2y;//-(r2/2.0);
        points = getPointsIntersectingCircle(r2, cx, c2y, 0, yIntercept2);
        double ll = points[0];
        double lr = points[1];
        if (ll>lr){
            double temp = ll;
            ll = lr;
            lr = temp;
        }
        g2d.fillOval(cint(cx-r2), cint(c2y-r2), cint(r2*2), cint(r2*2));


      //Trapazoid
        int top = cint(yIntercept);
        int bottom =  cint(Math.ceil(yIntercept2));
        int[] xPoints = {cint(ul), cint(ll), cint(lr), cint(ur)};
        int[] yPoints = {top, bottom, bottom, top};
        g2d.fillPolygon(xPoints, yPoints, 4);




      //Add icon as needed
        if (icon!=null){
            icon = icon.toLowerCase();

            //<i class="fas fa-star"></i> same as fa-star-solid; and unicode of f005

            Font font = null;
            try{
                if (icon.startsWith("fa-")){

                    String style = "solid";
                    String[] arr = icon.substring(3).split("-");
                    icon = "";
                    for (int i=0; i<arr.length; i++){
                        String str = arr[i];
                        if (i==arr.length-1){
                            if (str.equals("solid")){
                                style = str;
                                break;
                            }
                        }
                        if (i>0) icon += "-";
                        icon+=str;
                    }


                    for (String fontFamily : faFonts){
                        if (style.equals("solid")){
                            if (fontFamily.contains("Solid")){
                                font = new Font(fontFamily, Font.TRUETYPE_FONT, cint(r));
                                icon = fa(icon);
                                break;
                            }
                        }
                    }
                }
            }
            catch(Exception e){
                //e.printStackTrace();
            }


            if (icon!=null){
                FontMetrics fm;
                if (font!=null){
                    g2d.setFont(font);
                    fm = g2d.getFontMetrics(font);
                }
                else{
                    fm = g2d.getFontMetrics();
                }
                int textWidth = fm.stringWidth(icon);
                int textHeight = fm.getHeight();
                int descent = fm.getDescent();
                textHeight = textHeight-descent;

                int xOffset = cint(cx-(textWidth/2.0));
                int yOffset = cint(cy+(textHeight/2.0));

                g2d.setColor(Color.WHITE);
                g2d.drawString(icon, xOffset, yOffset);
            }
        }




        return new ServiceResponse(img.getByteArray("png"));
    }



  //**************************************************************************
  //** getHospitals
  //**************************************************************************
    public ServiceResponse getHospitals(ServiceRequest request, Database database)
        throws ServletException, IOException {


        Geometry geom;
        try{
            if (request.hasParameter("geom")){
                geom = new WKTReader().read(request.getParameter("geom").toString());
            }
            else{
                return new ServiceResponse(400, "Missing extents");
            }
        }
        catch(Exception e){
            return new ServiceResponse(400, "Invalid extents");
        }


        JSONArray arr = new JSONArray();
        for (long hospitalID : hospitalIndex.getIDs(geom)){
            String id = hospitalIDs.get(hospitalID);
            Point pt = hospitalPoints.get(hospitalID);
            JSONObject json = new JSONObject();
            json.set("id", id);
            json.set("lat", pt.getY());
            json.set("lon", pt.getX());
            arr.add(json);
        }
        return new ServiceResponse(arr);
    }


  //**************************************************************************
  //** getCoordinate
  //**************************************************************************
  /** Returns a lat/lon coordinate for a given address
   */
    public ServiceResponse getCoordinate(ServiceRequest request, Database database)
        throws ServletException, IOException {


      //Extract parameters
        String address = request.getParameter("address").toString();
        String apiKey = Config.get("google").get("maps").get("key").toString();


      //Construct url to hit the google maps geocoding service:
        StringBuffer url = new StringBuffer();
        url.append("https://maps.google.com/maps/api/geocode/json?");
        url.append("address=");
        url.append(address);
        url.append("&sensor=false");
        url.append("&key=");
        url.append(apiKey);


      //Send request to the geocoding service and parse response
        javaxt.http.Response response = new javaxt.http.Request(url.toString().replace(" ", "%20")).getResponse();
        JSONObject json = new JSONObject(response.getText());
        JSONArray results = json.get("results").toJSONArray();
        for (int i=0; i<results.length(); i++){
            JSONObject result = results.get(i).toJSONObject();
            JSONObject coords = result.get("geometry").get("location").toJSONObject();
            coords.set("lon", coords.remove("lng"));
            return new ServiceResponse(coords);
        }


      //If we're still here, return a 404 response
        return new ServiceResponse(404);
    }


  //**************************************************************************
  //** getTile
  //**************************************************************************
  /** Gets a image from a remote map server and returns it as a local image
   */
    public ServiceResponse getTile(ServiceRequest request, Database database)
        throws ServletException, IOException {
        String url = request.getParameter("url").toString();
        String format = "png"; //get format from response header?
        javaxt.io.Image img = new javaxt.http.Request(url).getResponse().getImage();
        byte[] bytes = img.getByteArray(format);
        ServiceResponse response = new ServiceResponse(bytes);
        response.setContentType("image/"+format);
        response.setContentLength(bytes.length);
        return response;
    }


  //**************************************************************************
  //** fa
  //**************************************************************************
    private String fa(String icon) throws Exception{
        if (faIcons.containsKey(icon)){
            return faIcons.get(icon);
        }
        else{
            String i = (String) faLookup.call(null, icon);
            faIcons.put(icon, i);
            return i;
        }
    }


  //**************************************************************************
  //** hex2Rgb
  //**************************************************************************
    private static Color hex2Rgb(String colorStr) {
        return new Color(
            Integer.valueOf( colorStr.substring( 1, 3 ), 16 ),
            Integer.valueOf( colorStr.substring( 3, 5 ), 16 ),
            Integer.valueOf( colorStr.substring( 5, 7 ), 16 ) );
    }

  //**************************************************************************
  //** cint
  //**************************************************************************
  /** Converts a double to an integer. Rounds the double to the nearest int.
   */
    private static int cint(Double d){
        return (int)Math.round(d);
    }


  //**************************************************************************
  //** getPointsIntersectingCircle
  //**************************************************************************
    private static double[] getPointsIntersectingCircle(double r, double cx, double cy, double m, double n) {
        // circle: (x - cx)^2 + (y - cy)^2 = r^2
        // line: y = m * x + n
        // r: circle radius
        // cx: x value of circle centre
        // cy: y value of circle centre
        // m: slope
        // n: y-intercept

        double a = 1 + sq(m);
        double b = -cx * 2 + (m * (n - cy)) * 2;
        double c = sq(cx) + sq(n - cy) - sq(r);

        // get discriminant
        double d = sq(b) - 4 * a * c;
        if (d >= 0) {
            // insert into quadratic formula
            double[] intersections = new double[]{
                (-b + Math.sqrt(sq(b) - 4 * a * c)) / (2 * a),
                (-b - Math.sqrt(sq(b) - 4 * a * c)) / (2 * a)
            };
            if (d == 0) {
                // only 1 intersection
                return new double[]{intersections[0]};
            }
            return intersections;
        }
        // no intersection
        return new double[0];
    }

    private static double sq(double x){
        return x*x;
    }

}