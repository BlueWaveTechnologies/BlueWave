package bluewave.data;
import bluewave.utils.*;

import java.util.*;
import javaxt.json.*;

import org.locationtech.jts.geom.*;

//******************************************************************************
//**  Countries
//******************************************************************************
/**
 *   Provides static methods used to access entries in the countries.js file
 *
 ******************************************************************************/

public class Countries {

    private static SpatialIndex countryIndex;
    private static HashMap<Integer, JSONObject> countries;
    static {
        javaxt.io.Directory dir = bluewave.Config.getDirectory("webserver","webDir");

        try{
            countries = new HashMap<>();
            countryIndex = new SpatialIndex();
            javaxt.io.File countryFile = new javaxt.io.File(dir + "data/countries.js");
            String text = countryFile.getText();
            JSONObject json = new JSONObject(text.substring(text.indexOf("\n{")));
            TopoJson topoJson = new TopoJson(json, "countries");
            TopoJson.Entry[] entries = topoJson.getEntries();
            for (int i=0; i<entries.length; i++){
                TopoJson.Entry entry = entries[i];
                Geometry geom = entry.getGeometry();
                if (geom!=null) countryIndex.add(geom, i);
                countries.put(i, entry.getProperties());
            }
            countryIndex.build();
        }
        catch(Exception e){
            e.printStackTrace();
        }
    }


  //**************************************************************************
  //** getCountry
  //**************************************************************************
  /** Returns a country that intersects the given point
   */
    public static JSONObject getCountry(double lat, double lon){
        for (Long id : countryIndex.getIDs(JTS.createPoint(lat, lon))){
            return countries.get(id);
        }
        return new JSONObject();
    }

}