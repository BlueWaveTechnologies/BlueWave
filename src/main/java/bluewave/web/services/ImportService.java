package bluewave.web.services;
import bluewave.graph.Neo4J;

import java.util.*;
//import java.math.BigDecimal;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;

import javaxt.sql.Database;
import javaxt.sql.Value;


import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;

import me.xdrop.fuzzywuzzy.FuzzySearch;


public class ImportService extends WebService {


  //**************************************************************************
  //** getSummary
  //**************************************************************************
  /** Used to generate an import summary for a given country, product, and 
   *  date range
   */
    public ServiceResponse getSummary(ServiceRequest request, Database database) 
    throws ServletException {
        
      //Get parameters
        String country = request.getParameter("country").toString();
        if (country==null) return new ServiceResponse(400, "country is required");
        
        String establishment = request.getParameter("establishment").toString();
        if (establishment==null) establishment = "Manufacturer"; //should be lower case
        
        Double threshold = request.getParameter("threshold").toDouble();
        if (threshold!=null && threshold<=0) threshold = null;
        
        
      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_By_Country");
        
        
      //Update sql with country keyword
        if (country!=null){
            StringBuilder str = new StringBuilder();
            for (String cc : country.split(",")){
                cc = cc.trim();
                if (cc.isEmpty()) continue;
                if (cc.startsWith("'") && cc.endsWith("'")){
                    cc = cc.substring(1, cc.length()-1);
                }
                if (str.length()>0) str.append(",");
                str.append("'" + cc + "'");
            }
            sql = sql.replace("{country}", str);
        }        
        
        
      //Update sql with establishment keyword
        sql = sql.replace("{establishment}", establishment);
        
        
      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);        
        
        
        
      //Execute query   
        HashMap<Long,Object[]> entries = new HashMap<>();
        HashMap<Long,String> facilities = new HashMap<>();
        Session session = null;
        try{
            session = graph.getSession();


          //Get entries
            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();

                Long fei = new Value(r.get("fei").asObject()).toLong();
                Long numShipments = new Value(r.get("num_entries").asObject()).toLong();
                List quantities = r.get("quantities").asList();
                
                entries.put(fei, new Object[]{numShipments, quantities});
            }
            
            
          //Get establishment names
            StringBuilder str = new StringBuilder();
            str.append("MATCH (n:facility)\n");
            str.append("WHERE n.fei IN[\n");
            Iterator<Long> it = entries.keySet().iterator();
            while (it.hasNext()){
                long fei = it.next();
                str.append(fei);
                if (it.hasNext()) str.append(",");
facilities.put(fei, fei+""); //for testing only
            }
            str.append("]\n");
            str.append("RETURN n.fei as fei, n.name as name");
            sql = str.toString();
//            rs = session.run(sql);
//            while (rs.hasNext()){
//                Record r = rs.next();
//                Long fei = new Value(r.get("fei").asObject()).toLong();
//                String name = new Value(r.get("name").asObject()).toString();
//                facilities.put(fei, name);
//            }
            

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }      
        

        
        
      //Fuzzy match facility names and combine entries
        HashMap<String, Object[]> combinedEntries = new HashMap<>();        
        HashMap<String, ArrayList<Long>> uniqueFacilities = mergeFacilities(facilities);
        
        Iterator<String> it = uniqueFacilities.keySet().iterator();
        while (it.hasNext()){
            String name = it.next();           
            long numShipments = 0;
            List quantities = null;
            
            for (Long fei : uniqueFacilities.get(name)){
                
                Object[] obj = entries.get(fei);
                Long n = (Long) obj[0];
                List q = (List) obj[1];
                
                numShipments+= n;
                if (quantities==null) quantities = q;
                else quantities.addAll(q);                
            }            
            
            combinedEntries.put(name, new Object[]{numShipments, quantities});
        }
        
    
        
      //For each facility...
        StringBuilder str = new StringBuilder("name,numShipments,totalValue,totalQuantity");
        it = combinedEntries.keySet().iterator();
        while (it.hasNext()){
            String name = it.next();
            Object[] obj = combinedEntries.get(name);
            long numShipments = (Long) obj[0];
            List quantities = (List) obj[1];
            long totalValue = 0;
            long totalQuantity = 0;
            



            
          //Compute total quantity and value  
            if (threshold!=null){


              //Group quantities by product code
                HashMap<String, ArrayList<ArrayList<Double>>> nums = new HashMap<>();                        
                Iterator i2 = quantities.iterator();
                while (i2.hasNext()){
                    String val = i2.next().toString();
                    String[] arr = val.split("/");
                    String productCode = (String) arr[0];
                    Double amount = new Value(arr[1]).toDouble();
                    Double quantity = new Value(arr[2]).toDouble();
                    Double unitPrice = 0D;

                    if (amount==null) amount = 0D;
                    if (quantity==null) quantity = 0D;                
                    if (amount>0 && quantity>0) unitPrice = amount/quantity;


                    ArrayList<ArrayList<Double>> a = nums.get(productCode);
                    if (a==null){
                        a = new ArrayList<>();
                        a.add(new ArrayList<Double>());
                        a.add(new ArrayList<Double>());
                        a.add(new ArrayList<Double>());
                        nums.put(productCode, a);
                    }

                    a.get(0).add(amount);
                    a.get(1).add(quantity);
                    a.get(2).add(unitPrice);
                }



              //Compute total quantity and value            
                i2 = nums.keySet().iterator();
                while (i2.hasNext()){
                    String productCode = i2.next().toString();
                    ArrayList<ArrayList<Double>> a = nums.get(productCode);


                  //Generate a list of unitPrices > 0
                    ArrayList<Double> unitPrices = new ArrayList<>();
                    double total = 0;
                    for (Double unitPrice : a.get(2)){
                        if (unitPrice>0){ 
                            unitPrices.add(unitPrice);
                            total += unitPrice;
                        }
                    }

                    int numSamples = unitPrices.size();



                  //Work out the Mean (the simple average of the numbers)
                    double mean = total / (double) numSamples;


                  //Then for each number: subtract the Mean and square the result
                    double sum = 0.0;
                    for (double unitPrice : unitPrices){
                        sum += Math.pow(unitPrice - mean, 2);
                    }


                  //Then compute the square root of the mean of the squared differences
                    double std = Math.sqrt(sum/numSamples);



                  //Calculate z-score
                    unitPrices = a.get(2);
                    for (int i=0; i<unitPrices.size(); i++){                        
                        double unitPrice = unitPrices.get(i);

                        boolean add = true;
                        if (numSamples==1){
                            add = true;
                        }
                        else{                        

                            double z = ((double) unitPrice - mean)/std; //z-score
                            if (z<0) z = -z;

                            add = z<=threshold;
                        }

                        if (add){
                            totalValue += a.get(0).get(i);
                            totalQuantity += a.get(1).get(i);
                        }
                    }


                }
            }
            else{
                
                
                Iterator i2 = quantities.iterator();
                while (i2.hasNext()){
                    String val = i2.next().toString();
                    String[] arr = val.split("/");

                    Double amount = new Value(arr[1]).toDouble();
                    Double quantity = new Value(arr[2]).toDouble();

                    if (amount==null) amount = 0D;
                    if (quantity==null) quantity = 0D; 
                    
                    totalValue += amount;
                    totalQuantity += quantity;                    
                }
                
            }
            
            
            str.append("\r\n");
            str.append(name);
            str.append(",");
            str.append(numShipments);
            str.append(",");
            str.append(totalValue);
            str.append(",");
            str.append(totalQuantity);            

        }
        
        
        
        return new ServiceResponse(str.toString());
    }
    
    
    
  //**************************************************************************
  //** mergeFacilities
  //**************************************************************************
    private HashMap<String, ArrayList<Long>> mergeFacilities(HashMap<Long,String> facilities){        
        HashMap<String, ArrayList<Long>> results = new HashMap<>();
        
        
        Iterator<Long> it = facilities.keySet().iterator();
        while (it.hasNext()){
            Long id = it.next();
            String name = facilities.get(id);
            
            ArrayList<Long> ids = results.get(name);
            if (ids==null){
                ids = new ArrayList<>();
                results.put(name, ids);
                ids.add(id);
            }
            else{
            
            
//                Iterator<Long> i2 = facilities.keySet().iterator();
//                while (i2.hasNext()){
//                    String n = facilities.get(i2.next());
//
//                    double wordScore = FuzzySearch.tokenSortPartialRatio(name, n);
//                    if (wordScore>90){
//
//                        break;
//                    }                  
//                }
            
            }
        }
        
      
        
        
        return results;        
    }     

}