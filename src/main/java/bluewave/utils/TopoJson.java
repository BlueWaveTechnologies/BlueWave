package bluewave.utils;
import java.util.*;
import javaxt.json.*;
import static javaxt.utils.Console.console;
import org.locationtech.jts.geom.*;

//******************************************************************************
//**  TopoJson
//******************************************************************************
/**
 *   Used to parse a TopoJson files and extract entries
 *
 ******************************************************************************/

public class TopoJson {

    private ArrayList<Entry> entries;
    private JSONArray arcs;
    private double scaleX, scaleY, translateX, translateY;
    private static PrecisionModel precisionModel = new PrecisionModel();
    private static GeometryFactory geometryFactory = new GeometryFactory(precisionModel, 4326);
    public class Entry {
        private JSONObject properties;
        private Geometry geometry;
        public JSONObject getProperties(){ return properties; }
        public Geometry getGeometry(){ return geometry; }
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public TopoJson(JSONObject json, String key){
        entries = new ArrayList<>();

        JSONArray countries = json.get("objects").get(key).get("geometries").toJSONArray();
        arcs = json.get("arcs").toJSONArray();
        JSONArray scale = json.get("transform").get("scale").toJSONArray();
        scaleX = scale.get(0).toDouble();
        scaleY = scale.get(1).toDouble();
        JSONArray translate = json.get("transform").get("translate").toJSONArray();
        translateX = translate.get(0).toDouble();
        translateY = translate.get(1).toDouble();

//        console.log(scale, translate);
//        console.log("Found " + countries.length() + " countries and " + arcs.length() + " arcs");

        
        for (int i=0; i<countries.length(); i++){
            JSONObject country = countries.get(i).toJSONObject();
            JSONObject properties = country.get("properties").toJSONObject();

            Entry entry = new Entry();
            entry.properties = properties;


//            String countryName = properties.get("name").toString();
//            String countryCode = properties.get("code").toString();


            String geometryType = country.get("type").toString();
            JSONArray countryArcs = country.get("arcs").toJSONArray();

            Geometry geom = null;
            if (geometryType.equals("Polygon")){
                geom = createPolygon(countryArcs.get(0).toJSONArray());
            }
            else if (geometryType.equals("MultiPolygon")){
                ArrayList<Polygon> polygons = new ArrayList<>();
                for (int j=0; j<countryArcs.length(); j++){
                    Polygon p = createPolygon(countryArcs.get(j).toJSONArray());
                    if (p!=null) polygons.add(p);
                    else{
//                        console.log("Failed to create polygon for " + i, countryCode, countryName);
                    }
                }

                if (!polygons.isEmpty()){
                    if (polygons.size()==1) geom = polygons.get(0);
                    else{
                        geom = geometryFactory.createMultiPolygon(polygons.toArray(new Polygon[polygons.size()]));
                    }
                }
            }
            else{

            }

            entry.geometry = geom;


//            try{
//                if (geom!=null){
//                    Double lat = properties.get("latitude").toDouble();
//                    Double lon = properties.get("longitude").toDouble();
//                    if (lat!=null && lon!=null){
//                        Point center = geometryFactory.createPoint(new Coordinate(lon, lat));
//                        if (!center.intersects(geom)){
//                            //console.log("Invalid centroid for " + i, countryCode, countryName);
//                        }
//                    }
//                }
//                else{
//                    console.log("**Failed to create geometry for " + i, countryCode, countryName);
//                }
//            }
//            catch(Exception e){
//            }



            entries.add(entry);
        }
    }


  //**************************************************************************
  //** getEntries
  //**************************************************************************
    public ArrayList<Entry> getEntries(){
        return entries;
    }


  //**************************************************************************
  //** createPolygon
  //**************************************************************************
    private Polygon createPolygon(JSONArray countryArcs){

      //Generate list of coordinates
        ArrayList<Coordinate> coordinates = new ArrayList<>();
        for (int j=0; j<countryArcs.length(); j++){
            Integer arcID = countryArcs.get(j).toInteger();
            if (arcID==null) continue;

            JSONArray points = arcs.get(arcID).toJSONArray();
            if (points==null){
                //console.log("Missing arc for entry " + i);
                continue;
            }

            double x = 0;
            double y = 0;

            for (int k=0; k<points.length(); k++){
                JSONArray point = points.get(k).toJSONArray();
                double x1 = point.get(0).toDouble();
                double y1 = point.get(1).toDouble();
                //console.log(x1, y1);

                x1 = (x+=x1) * scaleX + translateX;
                y1 = (y+=y1) * scaleY + translateY;

                coordinates.add(new Coordinate(x1, y1));
            }
        }


      //Create polygon
        if (coordinates.size()>2){
            coordinates.add(coordinates.get(0));
            return geometryFactory.createPolygon(coordinates.toArray(new Coordinate[coordinates.size()]));
        }
        else{
            return null;
        }
    }
}