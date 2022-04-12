package bluewave.data;
import bluewave.utils.*;

import java.util.*;
import javaxt.json.*;

import org.locationtech.jts.geom.*;
import static javaxt.utils.Console.console;


//******************************************************************************
//**  Countries
//******************************************************************************
/**
 *   Provides static methods used to access entries in the countries.js file
 *
 ******************************************************************************/

public class Countries {

    public static SpatialIndex countryIndex = createSpatialIndex();
    public static HashMap<Long, JSONObject> countries;
    private static SpatialIndex createSpatialIndex() {
        javaxt.io.Directory dir = bluewave.Config.getDirectory("webserver","webDir");

        try{
            countries = new HashMap<>();
            countryIndex = new SpatialIndex();
            javaxt.io.File countryFile = new javaxt.io.File(dir + "data/countries.js");
            String text = countryFile.getText();
            JSONObject json = new JSONObject(text.substring(text.indexOf("\n{")));
            TopoJson topoJson = new TopoJson(json, "countries");
            Long id = 0L;
            for (TopoJson.Entry entry : topoJson.getEntries()){
                id++;
                Geometry geom = entry.getGeometry();
                JSONObject properties = entry.getProperties();
                if (geom!=null){
                    countryIndex.add(geom, id);
                    properties.set("geometry", geom);
                }
                countries.put(id, properties);
                if (geom==null){
                    //console.log("missing geom for ", properties);
                }
            }
            countryIndex.build();
        }
        catch(Exception e){
            e.printStackTrace();
        }
        return countryIndex;
    }


  //**************************************************************************
  //** getCountry
  //**************************************************************************
  /** Returns a country that intersects the given point
   */
    public static JSONObject getCountry(Point point){
        for (Long id : countryIndex.getIDs(point)){
            return countries.get(id);
        }
        return new JSONObject();
    }


  //**************************************************************************
  //** getCountry
  //**************************************************************************
  /** Returns a country that intersects the given point
   */
    public static JSONObject getCountry(double lat, double lon){
        return getCountry(JTS.createPoint(lat, lon));
    }


  //**************************************************************************
  //** getCountry
  //**************************************************************************
  /** Returns a country with a given country code
   */
    public static JSONObject getCountry(String countryCode){
        Iterator<Long> it = countries.keySet().iterator();
        while (it.hasNext()){
            Long id = it.next();
            JSONObject properties = countries.get(id);
            JSONValue val = properties.get("code");
            if (!val.isNull()){
                if (val.toString().equals(countryCode)){
                    return properties;
                }
            }
        }
        return null;
    }
}