package bluewave.web.services;
import bluewave.graph.Neo4J;
import static bluewave.utils.StringUtils.*;

import java.util.*;
//import java.math.BigDecimal;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;

import javaxt.sql.Database;
import javaxt.sql.Value;
import javaxt.json.*;


import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;


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
        if (establishment==null) establishment = "manufacturer";
        else establishment = establishment.toLowerCase();

        Integer threshold = request.getParameter("threshold").toInteger();
        if (threshold==null || threshold<0 || threshold>100) threshold = 0;


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


      //Update sql with additional keywords
        sql = sql.replace("{establishment}", establishment);
        sql = sql.replace("{threshold}", threshold+"");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


        String[] extraFields = new String[]{
        "num_entries", "quantity", "value",
        "manufacturer","shipper","importer","consignee","dii",
        "num_exams", "num_field_exams","num_label_exams", "num_field_fails", "num_label_fails",
        "num_bad_samples","num_hi_predict"
        };


      //Execute query
        HashMap<Long,HashMap<String, Value>> entries = new HashMap<>();
        HashMap<Long,String> facilities = new HashMap<>();
        Session session = null;
        try{
            session = graph.getSession();


          //Get entries
            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();

                Long fei = new Value(r.get("fei").asObject()).toLong();


                HashMap<String, Value> values = new HashMap<>();
                for (String field: extraFields){
                    values.put(field, new Value(r.get(field).asObject()));
                }
                entries.put(fei, values);
            }


          //Get establishment names
            StringBuilder str = new StringBuilder();
            str.append("MATCH (n:import_establishment)\n");
            str.append("WHERE n.fei IN[\n");
            Iterator<Long> it = entries.keySet().iterator();
            while (it.hasNext()){
                Long fei = it.next();
                str.append(fei);
                if (it.hasNext()) str.append(",");
            }
            str.append("]\n");
            str.append("RETURN n.fei as fei, n.name as name");
            sql = str.toString();
            rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();
                Long fei = new Value(r.get("fei").asObject()).toLong();
                String name = new Value(r.get("name").asObject()).toString();
                facilities.put(fei, name);
            }


            session.close();
        }
        catch(Exception e){
            e.printStackTrace();
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }



      //Fuzzy match facility names and combine entries
        HashMap<String, ArrayList<Long>> uniqueFacilities = mergeCompanies(facilities);




      //Generate csv output
        StringBuilder str = new StringBuilder(
        "name,fei,totalEntries,totalValue,totalQuantity,"+
        "manufacturer,shipper,importer,consignee,dii,"+
        "totalExams,fieldExams,labelExams,failedFieldExams,failedLabelExams," +
        "badSamples,highPredict");
        Iterator<String> it = uniqueFacilities.keySet().iterator();
        while (it.hasNext()){
            String name = it.next();


          //Combine values
            long totalShipments = 0;
            double totalQuantity = 0;
            double totalValue = 0;
            long totalExams = 0;
            long totalFieldExams = 0;
            long totalLabelExams = 0;
            long totalFailedFieldExams = 0;
            long totalFailedLabelExams = 0;
            long totalBadSamples = 0;
            long totalPredict = 0;

            HashSet<Long> manufacturer = new HashSet<>();
            HashSet<Long> shipper = new HashSet<>();
            HashSet<Long> importer = new HashSet<>();
            HashSet<Long> consignee = new HashSet<>();
            HashSet<Long> dii = new HashSet<>();


            for (Long fei : uniqueFacilities.get(name)){

                HashMap<String, Value> values = entries.get(fei);
                Long n = values.get("num_entries").toLong();
                Double q = values.get("quantity").toDouble();
                Double v = values.get("value").toDouble();
                Long exams = values.get("num_exams").toLong();
                Long fieldExams = values.get("num_field_exams").toLong();
                Long labelExams = values.get("num_label_exams").toLong();
                Long failedFieldExams = values.get("num_field_fails").toLong();
                Long failedLabelExams = values.get("num_label_fails").toLong();
                Long badSamples = values.get("num_bad_samples").toLong();
                Long predict = values.get("num_hi_predict").toLong();

                mergeList(manufacturer, (List) values.get("manufacturer").toObject());
                mergeList(shipper, (List) values.get("shipper").toObject());
                mergeList(importer, (List) values.get("importer").toObject());
                mergeList(consignee, (List) values.get("consignee").toObject());
                mergeList(dii, (List) values.get("dii").toObject());

                totalShipments+=n;
                totalQuantity+=q;
                totalValue+=v;
                totalExams+=exams;
                totalFieldExams+=fieldExams;
                totalLabelExams+=labelExams;
                totalFailedFieldExams+=failedFieldExams;
                totalFailedLabelExams+=failedLabelExams;
                totalBadSamples+=badSamples;
                totalPredict+=predict;
            }


          //Create csv entry
            str.append("\r\n");
            str.append(name.contains(",") ? "\"" + name + "\"" : name);
            str.append(",");

            ArrayList<Long> feis = uniqueFacilities.get(name);
            boolean addQuotes = feis.size()>1;
            if (addQuotes) str.append("\"");
            for (int i=0; i<feis.size(); i++){
                Long fei = feis.get(i);
                if (i>0) str.append(",");
                str.append(fei);
            }
            if (addQuotes) str.append("\"");
            str.append(",");

            str.append(totalShipments);
            str.append(",");
            str.append(totalValue);
            str.append(",");
            str.append(totalQuantity);

            str.append(",");
            str.append(getCSV(manufacturer));
            str.append(",");
            str.append(getCSV(shipper));
            str.append(",");
            str.append(getCSV(importer));
            str.append(",");
            str.append(getCSV(consignee));
            str.append(",");
            str.append(getCSV(dii));

            str.append(",");
            str.append(totalExams);
            str.append(",");
            str.append(totalFieldExams);
            str.append(",");
            str.append(totalLabelExams);
            str.append(",");
            str.append(totalFailedFieldExams);
            str.append(",");
            str.append(totalFailedLabelExams);
            str.append(",");
            str.append(totalBadSamples);
            str.append(",");
            str.append(totalPredict);
        }
        return new ServiceResponse(str.toString());
    }


  //**************************************************************************
  //** getEntries
  //**************************************************************************
    public ServiceResponse getEntries(ServiceRequest request, Database database)
    throws ServletException {

      //Get parameters
        String ids = request.getParameter("id").toString();
        if (ids==null) ids = new String(request.getPayload());
        if (ids==null) return new ServiceResponse(400, "id is required");

        String establishment = request.getParameter("establishment").toString();
        if (establishment==null) establishment = "manufacturer";
        else establishment = establishment.toLowerCase();


      //Get Offset and Limit
        Long offset = request.getParameter("offset").toLong();
        Long limit = request.getParameter("limit").toLong();
        if (limit==null) limit = 25L;
        if (limit<1) limit = null;
        if (offset==null){
            Long page = request.getParameter("page").toLong();
            if (page!=null && limit!=null) offset = (page*limit)-limit;
        }


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Compile query
        StringBuilder query = new StringBuilder("MATCH (n:import_entry) WHERE n.");
        query.append(establishment);
        query.append(" IN [");
        String[] arr = ids.split(",");
        for (int i=0; i<arr.length; i++){
            if (i>0) query.append(",");
            query.append("'" + arr[i] + "'");
        }
        query.append("] RETURN properties(n) as entry");

        if (offset!=null) query.append(" SKIP " + offset);
        if (limit!=null) query.append(" LIMIT " + limit);



      //Execute query and return response
        Session session = null;
        try{
            session = graph.getSession();


            LinkedHashSet<String> header = new LinkedHashSet<>();
            ArrayList<JSONObject> entries = new ArrayList<>();

            Result rs = session.run(query.toString());
            while (rs.hasNext()){
                Record record = rs.next();

                JSONObject entry = getJson(record.get("entry"));
                entries.add(entry);
                Iterator<String> it = entry.keys();
                while (it.hasNext()){
                    header.add(it.next());
                }
            }
            session.close();

            StringBuilder str = new StringBuilder();
            Iterator<String> it = header.iterator();
            while (it.hasNext()){
                str.append(it.next());
                if (it.hasNext()) str.append(",");
            }
            for (JSONObject entry : entries){
                str.append("\r\n");
                it = header.iterator();
                while (it.hasNext()){
                    String key = it.next();
                    Object value = entry.get(key).toObject();

                    if (value==null){
                        value = "";
                    }
                    else{
                        if (value instanceof String){
                            String v = (String) value;
                            if (v.contains(",")){
                                value = "\"" + v + "\"";
                            }
                        }
                    }


                    str.append(value);
                    if (it.hasNext()) str.append(",");
                }
            }

            return new ServiceResponse(str.toString());
        }
        catch(Exception e){
            e.printStackTrace();
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getHistory
  //**************************************************************************
    public ServiceResponse getHistory(ServiceRequest request, Database database)
    throws ServletException {

      //Get parameters
        String country = request.getParameter("country").toString();
        if (country==null) return new ServiceResponse(400, "country is required");

        Integer threshold = request.getParameter("threshold").toInteger();
        if (threshold==null || threshold<0 || threshold>100) threshold = 0;


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_Per_Day");


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


      //Update sql with additional keywords
        sql = sql.replace("{threshold}", threshold+"");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);




      //Execute query and generate response
        String[] fields = new String[]{"date","entries","quantity","value"};
        StringBuilder str = new StringBuilder(String.join(",", fields));
        Session session = null;
        try{
            session = graph.getSession();

            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();
                str.append("\r\n");

                for (int i=0; i<fields.length; i++){
                    if (i>0) str.append(",");
                    str.append(r.get(fields[i]).asObject());
                }
            }


            session.close();
        }
        catch(Exception e){
            e.printStackTrace();
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }

        return new ServiceResponse(str.toString());
    }


  //**************************************************************************
  //** getEstablishment
  //**************************************************************************
    public ServiceResponse getEstablishment(ServiceRequest request, Database database)
    throws ServletException {

      //Parse params
        String fei = request.getParameter("fei").toString();
        if (fei==null) return new ServiceResponse(400, "fei is required");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);



      //Compile query
        String query =
        "MATCH (n:import_establishment)-[r:has]->(a:address)\n" +
        "WHERE n.fei=" + fei + "\n" +
        "RETURN\n" +
        "properties(n) as establishment,\n" +
        "properties(a) as address";


      //Execute query and return response
        Session session = null;
        try{
            session = graph.getSession();

            JSONObject establishment = new JSONObject();
            Result rs = session.run(query);
            if (rs.hasNext()){
                Record record = rs.next();

                establishment = getJson(record.get("establishment"));
                JSONObject address = getJson(record.get("address"));
                establishment.set("address", address);
            }
            session.close();

            return new ServiceResponse(establishment);
        }
        catch(Exception e){
            e.printStackTrace();
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getEstablishmentNames
  //**************************************************************************
    public ServiceResponse getEstablishmentNames(ServiceRequest request, Database database)
    throws ServletException {
        String ids = request.getParameter("id").toString();
        if (ids==null) ids = new String(request.getPayload());
        if (ids==null) return new ServiceResponse(400, "id is required");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Get establishment names
        HashMap<Long,String> facilities = new HashMap<>();
        Session session = null;
        try{
            session = graph.getSession();


            StringBuilder str = new StringBuilder();
            str.append("MATCH (n:import_establishment)\n");
            str.append("WHERE n.fei IN[\n");
            str.append(ids);
            str.append("]\n");
            str.append("RETURN n.fei as fei, n.name as name");

            Result rs = session.run(str.toString());
            while (rs.hasNext()){
                Record r = rs.next();
                Long fei = new Value(r.get("fei").asObject()).toLong();
                String name = new Value(r.get("name").asObject()).toString();
                facilities.put(fei, name);
            }


            session.close();
        }
        catch(Exception e){
            e.printStackTrace();
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }



      //Fuzzy match facility names and combine entries
        HashMap<String, ArrayList<Long>> uniqueFacilities = mergeCompanies(facilities);



      //Generate csv response
        StringBuilder str = new StringBuilder("name,fei");
        Iterator<String> it = uniqueFacilities.keySet().iterator();
        while (it.hasNext()){
            String name = it.next();
            ArrayList<Long> feis = uniqueFacilities.get(name);
            str.append("\r\n");
            str.append(name.contains(",") ? "\"" + name + "\"" : name);
            str.append(",");
            str.append(getCSV(feis));

        }
        return new ServiceResponse(str.toString());
    }


    public ServiceResponse saveEstablishmentNames(ServiceRequest request, Database database)
    throws ServletException { return getEstablishmentNames(request, database); }

    private void mergeList(HashSet<Long> a, List b){
        for (int i=0; i<b.size(); i++){
            a.add(new Value(b.get(i)).toLong());
        }
    }


  //**************************************************************************
  //** getCSV
  //**************************************************************************
    private String getCSV(HashSet<Long> a){
        return getCSV(new ArrayList<>(a));
    }


  //**************************************************************************
  //** getCSV
  //**************************************************************************
    private String getCSV(List<Long> a){
        if (a.isEmpty()) return "";
        if (a.size()==1) return a.iterator().next()+"";
        StringBuilder str = new StringBuilder("\"");
        Iterator<Long> it = a.iterator();
        while (it.hasNext()) {
            str.append(it.next());
            if (it.hasNext()) str.append(",");
        }
        str.append("\"");
        return str.toString();
    }


  //**************************************************************************
  //** getJson
  //**************************************************************************
    private static JSONObject getJson(org.neo4j.driver.Value val){
        JSONObject json = new JSONObject();
        if (!val.isNull()){
            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
            json = new JSONObject(gson.toJson(val.asMap()));
        }
        return json;
    }
}