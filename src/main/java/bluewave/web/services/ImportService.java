package bluewave.web.services;

import bluewave.graph.Neo4J;
import static bluewave.graph.Utils.*;

import bluewave.utils.Routing;
import bluewave.utils.Address;
import bluewave.utils.JTS;
import static bluewave.utils.StringUtils.*;
import bluewave.data.Countries;

import java.util.*;
import java.math.BigDecimal;
import java.util.concurrent.ConcurrentHashMap;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;

import javaxt.sql.Database;
import javaxt.sql.Value;
import javaxt.json.*;
import javaxt.utils.ThreadPool;

import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;

import org.locationtech.jts.geom.*;


//******************************************************************************
//**  ImportSummary
//******************************************************************************
/**
 *   Used generate reports using imports data
 *
 ******************************************************************************/

public class ImportService extends WebService {


    private ConcurrentHashMap<Long, String> firmNames;
    private ConcurrentHashMap<Long, Point> firmLocations;
    private ConcurrentHashMap<Long, String> firmCountries;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ImportService() throws Exception {
        firmNames = new ConcurrentHashMap<>();
        firmLocations = new ConcurrentHashMap<>();
        firmCountries = new ConcurrentHashMap<>();
        Neo4J graph = bluewave.Config.getGraph(null);
        if (graph!=null) updateFirmNames(graph);
    }


  //**************************************************************************
  //** updateFirmNames
  //**************************************************************************
  /** Used to generate a list of firm names using fuzzy matching by country
   */
    private void updateFirmNames(Neo4J graph) throws Exception {

        HashMap<Long, String> facilities = new HashMap<>();
        HashMap<Long, Point> coordinates = new HashMap<>();


      //Get establishment names and coordinates
        Session session = null;
        try{
            session = graph.getSession();

            StringBuilder str = new StringBuilder();
            str.append("MATCH (n:import_establishment)\n");
            str.append("OPTIONAL MATCH (n)-[r:has]->(a:address)\n");
            str.append("RETURN n.fei as fei, n.name as name, a.lat as lat, a.lon as lon");
            Result rs = session.run(str.toString());
            while (rs.hasNext()){
                Record r = rs.next();
                Long fei = new Value(r.get("fei").asObject()).toLong();
                String name = new Value(r.get("name").asObject()).toString();
                Double lat = new Value(r.get("lat").asObject()).toDouble();
                Double lon = new Value(r.get("lon").asObject()).toDouble();
                facilities.put(fei, name);
                try{
                    if (lat.equals(0D) && lon.equals(0D)) throw new Exception();
                    coordinates.put(fei, JTS.createPoint(lat, lon));
                }
                catch(Exception e){
                    //console.log("No coordinate for " + fei);
                }
            }

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            throw e;
        }


      //Update firmLocations
        synchronized (firmLocations){
            Iterator<Long> it = coordinates.keySet().iterator();
            while (it.hasNext()){
                Long fei = it.next();
                Point point = coordinates.get(fei);
                if (point==null) continue;
                firmLocations.put(fei, point);
            }
            firmLocations.notify();
        }



      //Group facilities by country code
        HashMap<String, HashSet<Long>> facilitiesByCountry = new HashMap<>();
        try {
            Iterator<Long> it = facilities.keySet().iterator();
            while (it.hasNext()){
                Long fei = it.next();
                Point point = coordinates.get(fei);

              //Get country code
                String countryCode = null;
                if (point!=null){
                    JSONObject country = Countries.getCountry(point);
                    if (country!=null){
                        countryCode = country.get("code").toString();
                    }
                }
                if (countryCode==null) countryCode = "Unknown";


              //Update facilitiesByCountry
                HashSet<Long> feis = facilitiesByCountry.get(countryCode);
                if (feis==null){
                    feis = new HashSet<>();
                    facilitiesByCountry.put(countryCode, feis);
                }
                feis.add(fei);
            }
        }
        catch(Exception e){
            e.printStackTrace();
        }


      //Update firmCountries
        synchronized (firmCountries){
            Iterator<String> it = facilitiesByCountry.keySet().iterator();
            while (it.hasNext()){
                String countryCode = it.next();
                for (Long fei : facilitiesByCountry.get(countryCode)){
                    firmCountries.put(fei, countryCode);
                }
            }
            firmCountries.notify();
        }


      //Fuzzy match facility names by country
        ThreadPool pool = new ThreadPool(6){
            public void process(Object obj){
                String countryCode = (String) obj;

                HashSet<Long> feis = facilitiesByCountry.get(countryCode);
                HashMap<Long, String> f = new HashMap<>();
                Iterator<Long> i2 = feis.iterator();
                while (i2.hasNext()){
                    Long fei = i2.next();
                    f.put(fei, facilities.get(fei));
                }


                HashMap<String, ArrayList<Long>> uf = mergeCompanies(f);
                int reduction = f.size()-uf.size();
                if (reduction>0)
                console.log("Combined " + reduction + " firms in " + countryCode);

                synchronized(firmNames){
                    Iterator<String> it = uf.keySet().iterator();
                    while (it.hasNext()){
                        String name = it.next();
                        for (Long fei : uf.get(name)){
                            firmNames.put(fei, name);
                        }
                    }
                    firmNames.notify();
                }
            }
        }.start();
        Iterator<String> it = facilitiesByCountry.keySet().iterator();
        while (it.hasNext()){
            String countryCode = it.next();
            pool.add(countryCode);
        }
        pool.done();
        pool.join();
    }


  //**************************************************************************
  //** getSummary
  //**************************************************************************
  /** Used to generate an import summary for a given country, product, and
   *  date range. Applies a fuzzy match to group establishments.
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
        "num_lines", "quantity", "value",
        "manufacturer","shipper","importer","consignee","dii",
        "num_exams", "num_field_exams","num_field_fails",
        "num_label_exams","num_label_fails",
        "num_samples","num_bad_samples","num_hi_predict"
        };


      //Execute query and group results by firm name
        HashMap<Long,HashMap<String, Value>> entries = new HashMap<>();
        Session session = null;
        try{
            session = graph.getSession();
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
            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }



      //Get facility names
        HashMap<String, ArrayList<Long>> uniqueFacilities = new HashMap<>();
        synchronized(firmNames){
            Iterator<Long> i2 = entries.keySet().iterator();
            while (i2.hasNext()){
                Long fei = i2.next();
                String name = firmNames.get(fei);
                ArrayList<Long> arr = uniqueFacilities.get(name);
                if (arr==null){
                    arr = new ArrayList<>();
                    uniqueFacilities.put(name, arr);
                }
                arr.add(fei);
            }
        }



      //Generate csv output
        StringBuilder str = new StringBuilder(
        "name,fei,totalLines,totalValue,totalQuantity,"+
        "manufacturer,shipper,importer,consignee,dii,"+
        "totalExams,fieldExams,labelExams,failedFieldExams,failedLabelExams," +
        "totalSamples,badSamples,highPredict");
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
            long totalSamples = 0;
            long totalBadSamples = 0;
            long totalPredict = 0;

            HashSet<Long> manufacturer = new HashSet<>();
            HashSet<Long> shipper = new HashSet<>();
            HashSet<Long> importer = new HashSet<>();
            HashSet<Long> consignee = new HashSet<>();
            HashSet<Long> dii = new HashSet<>();


            for (Long fei : uniqueFacilities.get(name)){

                HashMap<String, Value> values = entries.get(fei);
                Long n = values.get("num_lines").toLong();
                Double q = values.get("quantity").toDouble();
                Double v = values.get("value").toDouble();
                Long exams = values.get("num_exams").toLong();
                Long fieldExams = values.get("num_field_exams").toLong();
                Long labelExams = values.get("num_label_exams").toLong();
                Long failedFieldExams = values.get("num_field_fails").toLong();
                Long failedLabelExams = values.get("num_label_fails").toLong();
                Long samples = values.get("num_samples").toLong();
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
                totalSamples+=samples;
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
            str.append(totalSamples);
            str.append(",");
            str.append(totalBadSamples);
            str.append(",");
            str.append(totalPredict);
        }
        return new ServiceResponse(str.toString());
    }


  //**************************************************************************
  //** getLines
  //**************************************************************************
    public ServiceResponse getLines(ServiceRequest request, Database database)
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
        StringBuilder query = new StringBuilder("MATCH (n:import_line) WHERE n.");
        query.append(establishment);
        query.append(" IN [");
        String[] arr = ids.split(",");
        for (int i=0; i<arr.length; i++){
            if (i>0) query.append(",");
            query.append(arr[i]);
        }
        query.append("] RETURN properties(n) as line");

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

                JSONObject entry = getJson(record.get("line"));
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
  //** getProducts
  //**************************************************************************
  /** Returns a list of products and quantities for a given establishment
   *  type and fei
   */
    public ServiceResponse getProducts(ServiceRequest request, Database database)
    throws ServletException {

      //Get parameters
        String establishment = request.getParameter("establishment").toString();
        if (establishment==null) establishment = "manufacturer";
        else establishment = establishment.toLowerCase();

        String id = request.getParameter("id").toString();
        if (id==null) id = request.getParameter("fei").toString();
        if (id==null) return new ServiceResponse(400, "id or fei is required");


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_By_Product");


      //Update sql with additional keywords
        sql = sql.replace("{establishment}", establishment);
        sql = sql.replace("{fei}", id+"");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Execute query and generate response
        String[] fields = new String[]{"fei","product_code","product_name","lines","quantity","value"};
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
                    Object val = r.get(fields[i]).asObject();
                    if (fields[i].equals("product_name")){
                        if (val!=null){
                            String productName = (String) val;
                            if (productName.contains(",")) productName = "\"" + productName + "\"";
                            val = productName;
                        }
                    }

                    str.append(val);
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
  //** getProductCode
  //**************************************************************************
  /** Returns a list of total lines, quantities, and values by product code
   */
    public ServiceResponse getProductCode(ServiceRequest request, Database database)
    throws ServletException {

        String extraColumn = request.getParameter("include").toString();
        if (extraColumn==null) extraColumn = "";
        extraColumn = extraColumn.trim().toLowerCase();
        //TODO: check if the extraColumn exists in the database


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_By_ProductCode");
        if (!extraColumn.isEmpty()){
            sql += ", n." + extraColumn + " as " + extraColumn;
        }


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Execute query and generate response
        String[] fields = new String[]{"product_code","lines","quantity","value"};
        if (!extraColumn.isEmpty()){
            fields = Arrays.copyOf(fields, fields.length+1);
            fields[fields.length-1] = extraColumn;
        }

        ArrayList<HashMap<String, Value>> records = new ArrayList<>();
        Session session = null;
        try{
            session = graph.getSession();

            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();

                HashMap<String, Value> values = new HashMap<>();
                for (String field : r.keys()){
                    Value val = new Value(r.get(field).asObject());
                    values.put(field, val);
                }
                records.add(values);
            }


            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }


        if (extraColumn.equals("manufacturer") || extraColumn.equals("consignee")){
            HashMap<String, HashMap<String, Value>> group = new HashMap<>();
            synchronized (firmNames){
                for (HashMap<String, Value> record : records){
                    Long fei = record.get(extraColumn).toLong();
                    String name = firmNames.get(fei);
                    String productCode = record.get("product_code").toString();


                    Float lines = record.get("lines").toFloat();
                    if (lines==null) lines = 0f;
                    Float quantity = record.get("quantity").toFloat();
                    if (quantity==null) quantity = 0f;
                    Float value = record.get("value").toFloat();
                    if (value==null) value = 0f;

                    String key = productCode + "->" + name;
                    HashMap<String, Value> g = group.get(key);
                    if (g==null){
                        g = new HashMap<>();
                        g.put(extraColumn, new Value(name));
                        g.put("product_code", new Value(productCode));
                        g.put("lines", new Value(lines));
                        g.put("quantity", new Value(quantity));
                        g.put("value", new Value(value));
                        group.put(key, g);
                    }
                    else{
                        g.put("lines", new Value(lines+g.get("lines").toLong()));
                        g.put("quantity", new Value(lines+g.get("quantity").toLong()));
                        g.put("value", new Value(lines+g.get("value").toLong()));
                    }
                }
            }
            records = new ArrayList<>();
            Iterator<String> it = group.keySet().iterator();
            while (it.hasNext()){
                HashMap<String, Value> record = group.get(it.next());
                records.add(record);
            }
        }

        StringBuilder str = new StringBuilder(String.join(",", fields));
        for (HashMap<String, Value> record : records){
            str.append("\r\n");
            for (int i=0; i<fields.length; i++){
                if (i>0) str.append(",");
                String val = record.get(fields[i]).toString();
                if (val==null) val = "";
                if (val.contains(",")) val = "\"" + val + "\"";
                str.append(val);
            }
        }


        return new ServiceResponse(str.toString());
    }


  //**************************************************************************
  //** getNetwork
  //**************************************************************************
  /** Returns a csv linking manufacturers->ports->consignee
   */
    public ServiceResponse getNetwork(ServiceRequest request, Database database)
    throws ServletException {


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_Network");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Execute query
        String[] fields = new String[]{"manufacturer","lines","quantity","value","consignee","unladed_port"};
        ArrayList<HashMap<String, Value>> records = new ArrayList<>();
        HashMap<Long, Point> ports = new HashMap<>();
        Session session = null;
        try{
            session = graph.getSession();


          //Get records
            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();
                HashMap<String, Value> values = new HashMap<>();
                for (String field : fields){
                    Value val = new Value(r.get(field).asObject());
                    values.put(field, val);
                }
                records.add(values);

                Long port = new Value(r.get("unladed_port").asObject()).toLong();
                if (port!=null) ports.put(port, null);
            }



          //Get port names and coordinates
            StringBuilder str = new StringBuilder();
            str.append("MATCH (n:port_of_entry)\n");
            str.append("WHERE n.id IN[\n");
            Iterator<Long> it = ports.keySet().iterator();
            while (it.hasNext()){
                Long id = it.next();
                str.append(id);
                if (it.hasNext()) str.append(",");
            }
            str.append("]\n");
            str.append("OPTIONAL MATCH (n)-[r:has]->(a:address)\n");
            str.append("RETURN n.id as id, n.name as name, a.lat as lat, a.lon as lon");
            sql = str.toString();
            ports.clear();
            rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();
                Long id = new Value(r.get("id").asObject()).toLong();
                String name = new Value(r.get("name").asObject()).toString();
                Double lat = new Value(r.get("lat").asObject()).toDouble();
                Double lon = new Value(r.get("lon").asObject()).toDouble();
                try{
                    ports.put(id, JTS.createPoint(lat, lon));
                }
                catch(Exception e){
                    //console.log("No coordinate for port " + id);
                }
            }

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }



      //Generate response
        fields = new String[]{
        "manufacturer","manufacturer_lat","manufacturer_lon","manufacturer_cc",
        "unladed_port", "unladed_port_lat", "unladed_port_lon",
        "consignee","consignee_lat","consignee_lon","consignee_cc",
        "lines","quantity","value"};
        StringBuilder str = new StringBuilder(String.join(",", fields));
        synchronized (firmLocations){
            synchronized(firmCountries){
                for (HashMap<String, Value> record : records){
                    str.append("\r\n");

                    Long port = record.get("unladed_port").toLong();
                    Long manufacturer = record.get("manufacturer").toLong();
                    Long consignee = record.get("consignee").toLong();


                    Point pt = ports.get(port);
                    if (pt!=null) {
                        record.put("unladed_port_lat", new Value(pt.getY()));
                        record.put("unladed_port_lon", new Value(pt.getX()));
                    }


                    pt = firmLocations.get(manufacturer);
                    if (pt!=null) {
                        record.put("manufacturer_lat", new Value(pt.getY()));
                        record.put("manufacturer_lon", new Value(pt.getX()));
                    }
                    String cc = firmCountries.get(manufacturer);
                    if (cc!=null) record.put("manufacturer_cc", new Value(cc));


                    pt = firmLocations.get(consignee);
                    if (pt!=null) {
                        record.put("consignee_lat", new Value(pt.getY()));
                        record.put("consignee_lon", new Value(pt.getX()));
                    }
                    cc = firmCountries.get(manufacturer);
                    if (cc!=null) record.put("consignee_cc", new Value(cc));


                    for (int i=0; i<fields.length; i++){
                        if (i>0) str.append(",");
                        Value v = record.get(fields[i]);
                        String val = v==null ? null : v.toString();
                        if (val==null) val = "";
                        if (val.contains(",")) val = "\"" + val + "\"";
                        str.append(val);
                    }
                }
            }
        }
        return new ServiceResponse(str.toString());
    }


  //**************************************************************************
  //** getNetwork2
  //**************************************************************************
  /** Returns a csv linking manufacturers->consignee
   */
    public ServiceResponse getNetwork2(ServiceRequest request, Database database)
    throws ServletException {


      //Get query
        String query = bluewave.queries.Index.getQuery("Imports_Network");

      //Remove ports
        query = query.replace("n.unladed_port as unladed_port", "").trim();
        if (query.endsWith(",")) query = query.substring(0, query.length()-1);


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Execute query
        HashSet<Long> manufacturerIDs = new HashSet<>();
        HashSet<Long> consigneeIDs = new HashSet<>();
        ArrayList<HashMap<String, Value>> records = new ArrayList<>();
        Session session = null;
        try{
            session = graph.getSession();
            Result rs = session.run(query);
            while (rs.hasNext()){
                Record r = rs.next();

                Long manufacturer = new Value(r.get("manufacturer").asObject()).toLong();
                Long consignee = new Value(r.get("consignee").asObject()).toLong();

                HashMap<String, Value> values = new HashMap<>();
                for (String field : r.keys()){
                    Value val = new Value(r.get(field).asObject());
                    values.put(field, val);
                }
                records.add(values);
                if (manufacturer!=null) manufacturerIDs.add(manufacturer);
                if (consignee!=null) consigneeIDs.add(consignee);
            }
            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }


      //Get facility names
        HashMap<String, ArrayList<Long>> manufacturers = new HashMap<>();
        HashMap<String, ArrayList<Long>> consignees = new HashMap<>();
        synchronized(firmNames){
            for (Long fei : manufacturerIDs){
                String name = firmNames.get(fei);
                ArrayList<Long> arr = manufacturers.get(name);
                if (arr==null){
                    arr = new ArrayList<>();
                    manufacturers.put(name, arr);
                }
                arr.add(fei);
            }

            for (Long fei : consigneeIDs){
                String name = firmNames.get(fei);
                ArrayList<Long> arr = consignees.get(name);
                if (arr==null){
                    arr = new ArrayList<>();
                    consignees.put(name, arr);
                }
                arr.add(fei);
            }
        }



      //Merge records by facility
        ArrayList<HashMap<String, Value>> mergedRecords = new ArrayList<>();
        Iterator<String> it = manufacturers.keySet().iterator();
        while (it.hasNext()){
            String facilityName = it.next();
            ArrayList<Long> feis = manufacturers.get(facilityName);


            StringBuilder str = new StringBuilder();
            for (Long fei : feis){
                if (str.length()>0) str.append(",");
                str.append(fei);
            }
            String facilityFEIs = str.toString();


            HashMap<String, HashMap<String, Value>> group = new HashMap<>();
            for (HashMap<String, Value> record : records){
                Long manufacturer = record.get("manufacturer").toLong();
                if (manufacturer==null) continue;
                for (Long fei : feis){
                    if (manufacturer.equals(fei)){

                        String countryCode = null;
                        synchronized(firmCountries){
                            countryCode = firmCountries.get(fei);
                        }


                        Long consignee = record.get("consignee").toLong();
                        Float lines = record.get("lines").toFloat();
                        if (lines==null) lines = 0f;
                        Float quantity = record.get("quantity").toFloat();
                        if (quantity==null) quantity = 0f;
                        Float value = record.get("value").toFloat();
                        if (value==null) value = 0f;

                        String key = facilityFEIs+"->"+consignee;

                        HashMap<String, Value> g = group.get(key);
                        if (g==null){
                            g = new HashMap<>();
                            g.put("manufacturer_name", new Value(facilityName));
                            g.put("manufacturer_fei", new Value(facilityFEIs));
                            g.put("manufacturer_cc", new Value(countryCode));

                            g.put("consignee", new Value(consignee));
                            g.put("lines", new Value(lines));
                            g.put("quantity", new Value(quantity));
                            g.put("value", new Value(value));
                            group.put(key, g);
                        }
                        else{
                            g.put("lines", new Value(lines+g.get("lines").toLong()));
                            g.put("quantity", new Value(lines+g.get("quantity").toLong()));
                            g.put("value", new Value(lines+g.get("value").toLong()));
                        }


                        break;
                    }
                }
            }


            Iterator<String> i3 = group.keySet().iterator();
            while (i3.hasNext()){
                HashMap<String, Value> g = group.get(i3.next());
                mergedRecords.add(g);
            }
        }


        console.log("Reduced " + records.size() + " to " + mergedRecords.size() + " (merged " + (records.size()-mergedRecords.size()) + " records)");



      //Merge records by consignee
        ArrayList<HashMap<String, Value>> mergedRecords2 = new ArrayList<>();
        Iterator<String> i2 = consignees.keySet().iterator();
        while (i2.hasNext()){
            String facilityName = i2.next();
            ArrayList<Long> feis = consignees.get(facilityName);


            StringBuilder str = new StringBuilder();
            for (Long fei : feis){
                if (str.length()>0) str.append(",");
                str.append(fei);
            }
            String facilityFEIs = str.toString();

            HashMap<String, HashMap<String, Value>> group = new HashMap<>();
            for (HashMap<String, Value> record : mergedRecords){
                Long consignee = record.get("consignee").toLong();
                if (consignee==null) continue;
                for (Long fei : feis){
                    if (consignee.equals(fei)){


                        String countryCode = null;
                        synchronized(firmCountries){
                            countryCode = firmCountries.get(fei);
                        }

                        String manufacturerName = record.get("manufacturer_name").toString();
                        String manufacturerFEIs = record.get("manufacturer_fei").toString();
                        String manufacturerCC = record.get("manufacturer_cc").toString();

                        Float lines = record.get("lines").toFloat();
                        if (lines==null) lines = 0f;
                        Float quantity = record.get("quantity").toFloat();
                        if (quantity==null) quantity = 0f;
                        Float value = record.get("value").toFloat();
                        if (value==null) value = 0f;

                        String key = manufacturerFEIs+"->"+facilityFEIs;

                        HashMap<String, Value> g = group.get(key);
                        if (g==null){
                            g = new HashMap<>();
                            g.put("manufacturer_name", new Value(manufacturerName));
                            g.put("manufacturer_fei", new Value(manufacturerFEIs));
                            g.put("manufacturer_cc", new Value(manufacturerCC));

                            g.put("consignee_name", new Value(facilityName));
                            g.put("consignee_fei", new Value(facilityFEIs));
                            g.put("consignee_cc", new Value(countryCode));

                            g.put("lines", new Value(lines));
                            g.put("quantity", new Value(quantity));
                            g.put("value", new Value(value));
                            group.put(key, g);
                        }
                        else{
                            g.put("lines", new Value(lines+g.get("lines").toLong()));
                            g.put("quantity", new Value(lines+g.get("quantity").toLong()));
                            g.put("value", new Value(lines+g.get("value").toLong()));
                        }

                        break;
                    }
                }
            }

            Iterator<String> i3 = group.keySet().iterator();
            while (i3.hasNext()){
                HashMap<String, Value> g = group.get(i3.next());
                mergedRecords2.add(g);
            }
        }


        console.log("Further reduced " + records.size() + " to " + mergedRecords2.size() + " (merged " + (records.size()-mergedRecords2.size()) + " records)");



      //Generate response
        String[] fields = new String[]{
        "manufacturer_name","manufacturer_fei","manufacturer_cc",
        "consignee_name","consignee_fei","consignee_cc",
        "lines","quantity","value"};
        StringBuilder str = new StringBuilder(String.join(",", fields));
        for (HashMap<String, Value> record : mergedRecords2){
            str.append("\r\n");

            for (int i=0; i<fields.length; i++){
                if (i>0) str.append(",");
                String val = record.get(fields[i]).toString();
                if (val==null) val = "";
                if (val.contains(",")) val = "\"" + val + "\"";
                str.append(val);
            }
        }

        return new ServiceResponse(str.toString());
    }


  //**************************************************************************
  //** getShipments
  //**************************************************************************
  /** Returns imports by port of entry for a given establishment type and fei
   */
    public ServiceResponse getShipments(ServiceRequest request, Database database)
    throws ServletException {

      //Get parameters
        String establishment = request.getParameter("establishment").toString();
        if (establishment==null) establishment = "manufacturer";
        else establishment = establishment.toLowerCase();

        Long id = request.getParameter("id").toLong();
        if (id==null) id = request.getParameter("fei").toLong();
        if (id==null) return new ServiceResponse(400, "id or fei is required");


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_By_Port_Of_Entry");


      //Update sql with additional keywords
        sql = sql.replace("{establishment}", establishment);
        sql = sql.replace("{fei}", id+"");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Execute query and generate response
        String[] fields = new String[]{"port","method","lines","quantity","value"};
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
  //** getExams
  //**************************************************************************
  /** Returns exams for a given establishment type and fei
   */
    public ServiceResponse getExams(ServiceRequest request, Database database)
    throws ServletException {

      //Get parameters
        String establishment = request.getParameter("establishment").toString();
        if (establishment==null) establishment = "manufacturer";
        else establishment = establishment.toLowerCase();

        String id = request.getParameter("id").toString();
        if (id==null) id = request.getParameter("fei").toString();
        if (id==null) return new ServiceResponse(400, "id or fei is required");


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_Exams");


      //Update sql with additional keywords
        sql = sql.replace("{establishment}", establishment);
        sql = sql.replace("{fei}", id+"");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);



      //Execute query and generate response
        ArrayList<String> fields = new ArrayList<>();
        StringBuilder str = new StringBuilder();
        Session session = null;
        try{
            session = graph.getSession();

            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();

                if (fields.isEmpty()){
                    Iterator<String> it = r.keys().iterator();
                    while (it.hasNext()){
                        String key = it.next();
                        fields.add(key);


                        str.append(key.substring(2));
                        if (it.hasNext()) str.append(",");
                    }
                }

                str.append("\r\n");

                for (int i=0; i<fields.size(); i++){
                    if (i>0) str.append(",");
                    org.neo4j.driver.Value v = r.get(fields.get(i));
                    if (!v.isNull()){

                        String val = v.asString().replace("\n", " ");
                        if (val.contains(",")) str.append("\"");
                        str.append(val);
                        if (val.contains(",")) str.append("\"");
                    }
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
  //** getHistory
  //**************************************************************************
  /** Returns imports per day by country and product code
   */
    public ServiceResponse getHistory(ServiceRequest request, Database database)
    throws ServletException {

      //Get parameters
        String country = request.getParameter("country").toString();
        if (country==null) return new ServiceResponse(400, "country is required");

        String productCode = request.getParameter("productCode").toString();
        if (productCode==null) productCode="LZA,FMC,LYZ,IWP,LZC,KGO,LYY,OPA,OPJ,OPC,QDO";

        Integer threshold = request.getParameter("threshold").toInteger();
        if (threshold==null || threshold<0 || threshold>100) threshold = 0;

        String groupBy = request.getParameter("groupBy").toString();
        if (groupBy!=null) groupBy = groupBy.toLowerCase(); //e.g. manufacturer


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_Per_Day");
        sql = sql.replace("{country}", addQuotes(country));
        sql = sql.replace("{product_code}", addQuotes(productCode));
        sql = sql.replace("{threshold}", threshold+"");
        if (groupBy!=null) sql += ",n."+ groupBy + " as " + groupBy;


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);



      //Execute query
        HashSet<Long> establishmentIDs = new HashSet<>();
        ArrayList<HashMap<String, Value>> records = new ArrayList<>();
        LinkedHashSet<String> fields = new LinkedHashSet<>();
        Session session = null;
        try{
            session = graph.getSession();

            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();

                HashMap<String, Value> values = new HashMap<>();
                for (String field : r.keys()){
                    fields.add(field);
                    Value val = new Value(r.get(field).asObject());
                    values.put(field, val);
                }
                records.add(values);


                if (groupBy!=null){
                    Long establishmentID = new Value(r.get(groupBy).asObject()).toLong();
                    establishmentIDs.add(establishmentID);
                }
            }

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }



      //Group records as needed
        if (groupBy!=null){


            HashMap<String, ArrayList<Long>> establishments = new HashMap<>();
            synchronized(firmNames){
                for (Long fei : establishmentIDs){
                    String name = firmNames.get(fei);
                    ArrayList<Long> arr = establishments.get(name);
                    if (arr==null){
                        arr = new ArrayList<>();
                        establishments.put(name, arr);
                    }
                    arr.add(fei);
                }
            }


          //Merge records by establishment
            ArrayList<HashMap<String, Value>> mergedRecords = new ArrayList<>();
            Iterator<String> it = establishments.keySet().iterator();
            while (it.hasNext()){
                String facilityName = it.next();
                ArrayList<Long> feis = establishments.get(facilityName);

                /*
                StringBuilder str = new StringBuilder();
                for (Long fei : feis){
                    if (str.length()>0) str.append(",");
                    str.append(fei);
                }
                String facilityFEIs = str.toString();
                */


                HashMap<String, HashMap<String, Value>> group = new HashMap<>();
                for (HashMap<String, Value> record : records){
                    Long establishment = record.get(groupBy).toLong();
                    if (establishment==null) continue;
                    for (Long fei : feis){
                        if (establishment.equals(fei)){

                            String date = record.get("date").toString();
                            Float lines = record.get("lines").toFloat();
                            if (lines==null) lines = 0f;
                            Float quantity = record.get("quantity").toFloat();
                            if (quantity==null) quantity = 0f;
                            Float value = record.get("value").toFloat();
                            if (value==null) value = 0f;

                            String key = facilityName+"->"+date;

                            HashMap<String, Value> g = group.get(key);
                            if (g==null){
                                g = new HashMap<>();
                                g.put("date", new Value(date));
                                g.put("lines", new Value(lines));
                                g.put("quantity", new Value(quantity));
                                g.put("value", new Value(value));
                                g.put(groupBy, new Value(facilityName));
                                group.put(key, g);
                            }
                            else{
                                g.put("lines", new Value(lines+g.get("lines").toLong()));
                                g.put("quantity", new Value(lines+g.get("quantity").toLong()));
                                g.put("value", new Value(lines+g.get("value").toLong()));
                            }

                            break;
                        }
                    }
                }


                Iterator<String> i3 = group.keySet().iterator();
                while (i3.hasNext()){
                    HashMap<String, Value> g = group.get(i3.next());
                    mergedRecords.add(g);
                }
            }

            records = mergedRecords;
        }




      //Generate response
        StringBuilder str = new StringBuilder();
        Iterator<String> it = fields.iterator();
        while (it.hasNext()){
            str.append(it.next());
            if (it.hasNext()) str.append(",");
        }
        for (HashMap<String, Value> record : records){
            str.append("\r\n");
            it = fields.iterator();
            while (it.hasNext()){
                String val = record.get(it.next()).toString();
                if (val==null) val = "";
                if (val.contains(",")) val = "\"" + val + "\"";
                str.append(val);
                if (it.hasNext()) str.append(",");
            }
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


        HashMap<String, ArrayList<Long>> uniqueFacilities = new HashMap<>();
        synchronized(firmNames){
            for (String id : ids.split(",")){
                Long fei = Long.parseLong(id);
                String name = firmNames.get(fei);
                ArrayList<Long> arr = uniqueFacilities.get(name);
                if (arr==null){
                    arr = new ArrayList<>();
                    uniqueFacilities.put(name, arr);
                }
                arr.add(fei);
            }
        }



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


  //**************************************************************************
  //** getRoute
  //**************************************************************************
  /** Used to calculate the most probable route between a facility and a port
   *  of entry
   */
    public ServiceResponse getRoute(ServiceRequest request, Database database)
    throws ServletException {

      //Parse params
        Long fei = request.getParameter("facility").toLong();
        Long portOfEntry = request.getParameter("portOfEntry").toLong();
        String method = request.getParameter("method").toString();


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);

        Session session = null;
        try{
            JSONObject route = null;

          //Find route in the database
            String node = "import_route";
            session = graph.getSession();
            StringBuilder query = new StringBuilder();
            query.append("MATCH (n:" + node + ")\n");
            query.append("WHERE n.fei="+fei);
            query.append(" AND n.port="+portOfEntry);
            query.append(" AND n.method='"+method+"'\n");
            query.append("RETURN n.route as route");
            Result rs = session.run(query.toString());
            if (rs.hasNext()){
                Record r = rs.next();
                String s = new Value(r.get("route").asObject()).toString();
                if (s!=null) route = new JSONObject(s);
            }
            session.close();


          //Create new route as needed
            if (route==null){

              //Create route
                route = getRoute(fei, portOfEntry, method, graph);

              //Create key and indexes
                session = graph.getSession();
                try{ session.run("CREATE CONSTRAINT ON (n:" + node + ") ASSERT n.unique_key IS UNIQUE"); }
                catch(Exception e){}
                try{ session.run("CREATE INDEX idx_" + node + " IF NOT EXISTS FOR (n:" + node + ") ON (n.unique_key)"); }
                catch(Exception e){}

              //Set params
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("fei",fei);
                params.put("port",portOfEntry);
                params.put("method",method);
                params.put("route",route.toString());
                params.put("unique_key",fei+"_"+portOfEntry+"_"+method);

              //Compile query used to create nodes
                query = new StringBuilder("CREATE (a:" + node + " {");
                Iterator<String> it = params.keySet().iterator();
                while (it.hasNext()){
                    String param = it.next();
                    query.append(param);
                    query.append(": $");
                    query.append(param);
                    if (it.hasNext()) query.append(" ,");
                }
                query.append("})");

              //Create node
                session.run(query.toString(), params);
                session.close();
            }

          //Return route
            return new ServiceResponse(route);
        }
        catch(Exception e){
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getRoute
  //**************************************************************************
    private JSONObject getRoute(long fei, long portOfEntry, String method, Neo4J graph) throws Exception {

      //Get coordinates
        BigDecimal[] start = Address.getCoords("import_establishment", "fei", fei+"", graph);
        if (start==null) throw new Exception("Failed to find coordinates for fei " + fei);

        BigDecimal[] end = Address.getCoords("port_of_entry", "id", portOfEntry+"", graph);
        if (end==null) throw new Exception("Failed to find coordinates for portOfEntry " + portOfEntry);

        JSONObject geoJSON = Routing.getGreatCircleRoute(start, end, 50);
        //JSONObject geoJSON = Routing.getShippingRoute(start, end, method);


        return geoJSON;
    }


  //**************************************************************************
  //** mergeList
  //**************************************************************************
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
  //** addQuotes
  //**************************************************************************
    private String addQuotes(String country){
        if (country==null) return null;
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
        return str.toString();
    }
}