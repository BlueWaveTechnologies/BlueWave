package bluewave.utils;

import java.util.*;
import java.math.BigDecimal;

import javaxt.json.JSONArray;
import javaxt.json.JSONObject;

import org.gavaghan.geodesy.*;

//******************************************************************************
//**  Routing
//******************************************************************************
/**
 *   Provides static methods used to calculate routes on the earth
 *
 ******************************************************************************/

public class Routing {

    private static GeodeticCalculator geoCalc = new GeodeticCalculator();
    private static Ellipsoid wgs84 = Ellipsoid.WGS84;

  //**************************************************************************
  //** getGreatCircleRoute
  //**************************************************************************
  /** Used to compute a great-circle route between two points on the earth
   *  @param numPoints Number of points in the route. The more points, the
   *  smoother the line will be
   */
    public static JSONObject getGreatCircleRoute(BigDecimal[] start, BigDecimal[] end, int numPoints) throws Exception {

      //Create start/end points
        GlobalCoordinates c1 = new GlobalCoordinates(start[0].doubleValue(), start[1].doubleValue());
        GlobalCoordinates c2 = new GlobalCoordinates(end[0].doubleValue(), end[1].doubleValue());


      //Calculate initial bearing and distance between the 2 points
        GeodeticCurve geoCurve = geoCalc.calculateGeodeticCurve(wgs84, c1, c2);
        double distance = geoCurve.getEllipsoidalDistance(); //meters
        double segmentLength = distance/(double) numPoints;
        double bearing = geoCurve.getAzimuth();


      //Create properties
        JSONObject properties = new JSONObject();
        properties.set("distance", distance);
        properties.set("bearing", bearing);


      //Generate coordinates
        ArrayList<Double[]> coords = new ArrayList<>();
        coords.add(new Double[]{c1.getLongitude(),c1.getLatitude()});
        GlobalCoordinates prevPoint = c1;
        for (int i=0; i<numPoints; i++){

            GlobalCoordinates c = geoCalc.calculateEndingGlobalCoordinates(wgs84, prevPoint, bearing, segmentLength);
            geoCurve = geoCalc.calculateGeodeticCurve(wgs84, c, c2);
            bearing = geoCurve.getAzimuth();
            prevPoint = c;

            coords.add(new Double[]{c.getLongitude(),c.getLatitude()});
        }
        coords.add(new Double[]{c2.getLongitude(),c2.getLatitude()});


      //Create geometry
        JSONObject geometry = new JSONObject();
        geometry.set("type", "LineString");
        JSONArray coordinates = new JSONArray();
        geometry.set("coordinates", coordinates);
        for (Double[] coord : coords){
            JSONArray coordinate = new JSONArray();
            coordinate.add(coord[0]);
            coordinate.add(coord[1]);
            coordinates.add(coordinate);
        }


      //Create geoJson
        JSONObject geoJson = new JSONObject();
        geoJson.set("type", "FeatureCollection");
        JSONArray features = new JSONArray();
        geoJson.set("features", features);

        JSONObject feature = new JSONObject();
        feature.set("type","Feature");
        feature.set("geometry", geometry);
        feature.set("properties", properties);
        features.add(feature);

        return geoJson;
    }


  //**************************************************************************
  //** getShippingRoute
  //**************************************************************************
  /** Used to compute a shipping route between two points on the earth
   *  @param shippingMethod Mode of transport (land, sea, air)
   */
    public static JSONObject getShippingRoute(BigDecimal[] start, BigDecimal[] end, String shippingMethod) throws Exception {
      //Get script
        javaxt.io.File[] scripts = Python.getScripts("shipment_route.py");
        if (scripts.length==0) throw new Exception("Script not found");


      //Compile command line options
        ArrayList<String> params = new ArrayList<>();
        params.add("-o="+start[0]+","+start[1]);
        params.add("-d="+end[0]+","+end[1]);
        params.add("--entrymode="+shippingMethod);


      //Execute script and return results
        JSONObject geoJson = Python.executeScript(scripts[0], params);
        return geoJson;
    }

}