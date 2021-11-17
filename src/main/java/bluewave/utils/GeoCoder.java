package bluewave.utils;
import bluewave.Config;
import java.util.*;
import java.math.BigDecimal;
import javaxt.json.*;

//******************************************************************************
//**  GeoCoder
//******************************************************************************
/**
 *   Used to convert addresses into lat/lon coordinates using Google Maps API.
 *   Note that Google is a paid service and should be used sparingly.
 *
 ******************************************************************************/

public class GeoCoder {
    
    private HashMap<String, BigDecimal[]> coords = new HashMap<>();
    private String apiKey;
    
  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public GeoCoder(){
        apiKey = Config.get("google").get("maps").get("key").toString();
    }
 
    
  //**************************************************************************
  //** getCoordinates
  //**************************************************************************
    public BigDecimal[] getCoordinates(String address){
        
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
            
            return new BigDecimal[]{
                coords.get("lat").toBigDecimal(),
                coords.get("lon").toBigDecimal()
            };
        }
        
        return null;
    }
}
