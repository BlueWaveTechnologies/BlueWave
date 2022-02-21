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

    private Entry[] entries;
    private double scaleX, scaleY, translateX, translateY;
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

      //Parse header
        JSONArray arcs = json.get("arcs").toJSONArray();
        JSONArray scale = json.get("transform").get("scale").toJSONArray();
        scaleX = scale.get(0).toDouble();
        scaleY = scale.get(1).toDouble();
        JSONArray translate = json.get("transform").get("translate").toJSONArray();
        translateX = translate.get(0).toDouble();
        translateY = translate.get(1).toDouble();


      //Get entries
        ArrayList<Entry> entries = new ArrayList<>();
        JSONArray geometries = json.get("objects").get(key).get("geometries").toJSONArray();
        for (int i=0; i<geometries.length(); i++){
            JSONObject geometry = geometries.get(i).toJSONObject();
            JSONObject properties = geometry.get("properties").toJSONObject();
            String geometryType = geometry.get("type").toString();
            JSONArray geometryArcs = geometry.get("arcs").toJSONArray();


          //Create JTS geometry
            Geometry geom = null;
            if (geometryType.equals("Polygon")){
                geom = createPolygon(geometryArcs, arcs);
            }
            else if (geometryType.equals("MultiPolygon")){
                ArrayList<Polygon> polygons = new ArrayList<>();
                for (int j=0; j<geometryArcs.length(); j++){
                    Polygon p = createPolygon(geometryArcs.get(j).toJSONArray(), arcs);
                    if (p!=null) polygons.add(p);
                    else{
                        console.log("Failed to create polygon for " + i, properties);
                    }
                }

                if (!polygons.isEmpty()){
                    if (polygons.size()==1) geom = polygons.get(0);
                    else{
                        geom = JTS.createMultiPolygon(polygons);
                    }
                }
            }
            else{
                //Unsupported geometry type
            }


          //Create entry
            Entry entry = new Entry();
            entry.properties = properties;
            entry.geometry = geom;
            entries.add(entry);


//          //Test geometry
//            try{
//                if (geom!=null){
//                    Double lat = properties.get("latitude").toDouble();
//                    Double lon = properties.get("longitude").toDouble();
//                    if (lat!=null && lon!=null){
//                        Point center = geometryFactory.createPoint(new Coordinate(lon, lat));
//                        if (!center.intersects(geom)){
//                            //console.log("Invalid centroid for " + i, properties);
//                        }
//                    }
//                }
//                else{
//                    console.log("**Failed to create geometry for " + i, properties);
//                }
//            }
//            catch(Exception e){
//            }

        }
        this.entries = entries.toArray(new Entry[entries.size()]);
    }


  //**************************************************************************
  //** getEntries
  //**************************************************************************
    public Entry[] getEntries(){
        return entries;
    }


  //**************************************************************************
  //** createPolygon
  //**************************************************************************
    private Polygon createPolygon(JSONArray geometryArcs, JSONArray arcs){

      //Generate list of coordinates
        ArrayList<Coordinate> coordinates = new ArrayList<>();
        for (int i=0; i<geometryArcs.length(); i++){
            JSONArray arr = geometryArcs.get(i).toJSONArray();
            if (arr==null){
                continue;
            }

            for (int j=0; j<arr.length(); j++){
                Integer arcID = arr.get(j).toInteger();
                //if (arcID==null) console.log("Missing arcID", arr.get(j));
                if (arcID==null) continue;
                if (arcID<0) arcID = ~arcID;

                JSONArray points = arcs.get(arcID).toJSONArray();
                if (points==null){
                    //console.log("Missing arc for entry " + arr.get(j));
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
        }


      //Create polygon
        if (coordinates.size()>2){
            coordinates.add(coordinates.get(0));
            return JTS.createPolygon(coordinates);
        }
        else{
            return null;
        }
    }
}