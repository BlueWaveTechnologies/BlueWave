package bluewave.web.services;
import bluewave.Config;
import bluewave.utils.SpatialIndex;

import java.io.IOException;
import java.util.*;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;

import javaxt.json.*;
import javaxt.sql.*;
import javaxt.express.utils.CSV;

//jts includes
import org.locationtech.jts.geom.*;
import org.locationtech.jts.io.WKTReader;


//drawing imports
import java.awt.Graphics2D;
import java.awt.Color;
import java.awt.RenderingHints;


public class MapService extends WebService {

    private HashMap<Long, String> hospitalIDs = new HashMap<>();
    private HashMap<Long, Point> hospitalPoints = new HashMap<>();
    private SpatialIndex hospitalIndex = new SpatialIndex();


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public MapService(){

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
        Integer size = request.getParameter("size").toInteger();
        if (size==null) size = 36;

        String color = request.getParameter("color").toString();
        if (color==null) color = "#ef5646";
        Color rgb = hex2Rgb(color);

        javaxt.io.Image img = new javaxt.io.Image(size, size);
        Graphics2D g2d = img.getBufferedImage().createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);


        double r = size/2d;


        g2d.setColor(rgb);
        g2d.fillOval(0, 0, size, size);
        g2d.setColor(Color.WHITE);

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
    private int cint(Double d){
        return (int)Math.round(d);
    }

}