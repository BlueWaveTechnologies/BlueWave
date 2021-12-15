package bluewave.graph;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import javaxt.json.JSONObject;

public class Utils {


  //**************************************************************************
  //** getJson
  //**************************************************************************
    public static JSONObject getJson(org.neo4j.driver.Value val){
        JSONObject json = new JSONObject();
        if (!val.isNull()){
            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
            json = new JSONObject(gson.toJson(val.asMap()));
        }
        return json;
    }


  //**************************************************************************
  //** getIdFromError
  //**************************************************************************
  /** Returns the node ID from an error message encountered during inserts.
   *  Example: "Node(4846531) already exists"
   */
    public static Long getIdFromError(Exception e){
      //Parse error string (super hacky)
        String err = e.getMessage().trim();
        if (err.contains("Node(") && err.contains(") already exists")){
            err = err.substring(err.indexOf("(")+1, err.indexOf(")"));
            return Long.parseLong(err);
        }
        return null;
    }
}