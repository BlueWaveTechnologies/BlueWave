package bluewave.utils;
import bluewave.graph.Neo4J;

import java.util.*;
import java.math.BigDecimal;

import javaxt.utils.Value;

import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;

public class Address {

  //**************************************************************************
  //** getCoords
  //**************************************************************************
  /** Returns lat/lon coordinates for a node with an address
   */
    public static BigDecimal[] getCoords(String node, String key, String id, Neo4J graph)
    throws Exception {

      //Compile query
        String query =
        "MATCH (n:" + node + ")-[r:has]->(a:address)\n" +
        "WHERE n." + key + "=" + id + "\n" +
        "RETURN a.lat as lat, a.lon as lon";


      //Execute query and return response
        Session session = null;
        try{
            session = graph.getSession();

            BigDecimal lat = null;
            BigDecimal lon = null;

            Result rs = session.run(query);
            if (rs.hasNext()){
                Record record = rs.next();

                lat = new Value(record.get("lat")).toBigDecimal();
                lon = new Value(record.get("lon")).toBigDecimal();

            }
            session.close();

            if (lat==null || lon==null) return null;
            return new BigDecimal[]{lat,lon};
        }
        catch(Exception e){
            if (session!=null) session.close();
            throw e;
        }
    }
}