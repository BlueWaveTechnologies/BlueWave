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


import org.locationtech.jts.geom.*;

public class ImportService extends WebService {

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
  //** getNetwork
  //**************************************************************************
  /** Returns a csv linking manufacturers->ports->consignee
   */
    public ServiceResponse getNetwork(ServiceRequest request, Database database)
    throws ServletException {

        Boolean mergeFacilities = request.getParameter("merge").toBoolean();
        if (mergeFacilities==null) mergeFacilities = false;


      //Get sql
        String sql = bluewave.queries.Index.getQuery("Imports_Network");


      //Get graph
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        Neo4J graph = bluewave.Config.getGraph(user);


      //Execute query
        String[] fields = new String[]{"manufacturer","lines","quantity","value","consignee","unladed_port"};
        ArrayList<HashMap<String, Value>> records = new ArrayList<>();
        HashMap<Long, String> facilities = new HashMap<>();
        HashMap<Long, Point> coordinates = new HashMap<>();
        HashMap<Long, Point> ports = new HashMap<>();
        Session session = null;
        try{
            session = graph.getSession();
            HashSet<Long> feis = new HashSet<>();

          //Get records
            Result rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();

                Long manufacturer = new Value(r.get("manufacturer").asObject()).toLong();
                Long consignee = new Value(r.get("consignee").asObject()).toLong();
                Long port = new Value(r.get("unladed_port").asObject()).toLong();

                HashMap<String, Value> values = new HashMap<>();
                for (String field : fields){
                    Value val = new Value(r.get(field).asObject());
                    values.put(field, val);
                }
                records.add(values);
                if (manufacturer!=null) feis.add(manufacturer);
                if (consignee!=null) feis.add(consignee);
                if (ports!=null) ports.put(port, null);
            }


          //Get establishment names and coordinates
            StringBuilder str = new StringBuilder();
            str.append("MATCH (n:import_establishment)\n");
            str.append("WHERE n.fei IN[\n");
            Iterator<Long> it = feis.iterator();
            while (it.hasNext()){
                Long fei = it.next();
                str.append(fei);
                if (it.hasNext()) str.append(",");
            }
            str.append("]\n");
            str.append("OPTIONAL MATCH (n)-[r:has]->(a:address)\n");
            str.append("RETURN n.fei as fei, n.name as name, a.lat as lat, a.lon as lon");
            sql = str.toString();
            rs = session.run(sql);
            while (rs.hasNext()){
                Record r = rs.next();
                Long fei = new Value(r.get("fei").asObject()).toLong();
                String name = new Value(r.get("name").asObject()).toString();
                Double lat = new Value(r.get("lat").asObject()).toDouble();
                Double lon = new Value(r.get("lon").asObject()).toDouble();
                facilities.put(fei, name);
                try{
                    coordinates.put(fei, JTS.createPoint(lat, lon));
                }
                catch(Exception e){
                    console.log("No coordinate for " + fei);
                }
            }


          //Get port names and coordinates
            str = new StringBuilder();
            str.append("MATCH (n:port_of_entry)\n");
            str.append("WHERE n.id IN[\n");
            it = ports.keySet().iterator();
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
                    console.log("No coordinate for port " + id);
                }
            }

            session.close();
        }
        catch(Exception e){
            e.printStackTrace();
            if (session!=null) session.close();
            return new ServiceResponse(e);
        }

        console.log("Found " + records.size() + " records and " + facilities.size() + " facilities");
        console.log("Found " + coordinates.size() + " points for " + facilities.size() + " facilities");
        console.log("Found " + ports.size() + " ports with coordinates");


      //Return early as requested
        if (!mergeFacilities){
            fields = new String[]{
            "manufacturer","manufacturer_lat","manufacturer_lon",
            "unladed_port", "unladed_port_lat", "unladed_port_lon",
            "consignee","consignee_lat","consignee_lon",
            "lines","quantity","value"};
            StringBuilder str = new StringBuilder(String.join(",", fields));
            for (HashMap<String, Value> record : records){
                str.append("\r\n");


                Point pt = ports.get(record.get("unladed_port").toLong());
                if (pt!=null) {
                    record.put("unladed_port_lat", new Value(pt.getY()));
                    record.put("unladed_port_lon", new Value(pt.getX()));
                }

                pt = coordinates.get(record.get("manufacturer").toLong());
                if (pt!=null) {
                    record.put("manufacturer_lat", new Value(pt.getY()));
                    record.put("manufacturer_lon", new Value(pt.getX()));
                }

                pt = coordinates.get(record.get("consignee").toLong());
                if (pt!=null) {
                    record.put("consignee_lat", new Value(pt.getY()));
                    record.put("consignee_lon", new Value(pt.getX()));
                }


                for (int i=0; i<fields.length; i++){
                    if (i>0) str.append(",");
                    Value v = record.get(fields[i]);
                    String val = v==null ? null : v.toString();
                    if (val==null) val = "";
                    if (val.contains(",")) val = "\"" + val + "\"";
                    str.append(val);
                }
            }

            return new ServiceResponse(str.toString());
        }



      //Get country codes associated with each facility
        HashMap<Long, String> countryCodes = new HashMap<>();
        HashMap<String, HashSet<Long>> facilitiesByCountry = new HashMap<>();
        try {
            Iterator<Long> it = coordinates.keySet().iterator();
            while (it.hasNext()){
                Long fei = it.next();
                Point point = coordinates.get(fei);
                if (point==null) continue;

                JSONObject country = Countries.getCountry(point);
                if (country==null) console.log(point);
                if (country==null) continue;


                String countryCode = country.get("code").toString();
                countryCodes.put(fei, countryCode);

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


        console.log("Found facilities in " +  facilitiesByCountry.keySet().size() + " countries");


      //Fuzzy match facility names and combine entries
        HashMap<String, HashMap<String, ArrayList<Long>>> uniqueFacilities = new HashMap<>();
        Iterator<String> it = facilitiesByCountry.keySet().iterator();
        while (it.hasNext()){
            String countryCode = it.next();
            HashSet<Long> feis = facilitiesByCountry.get(countryCode);
            HashMap<Long, String> f = new HashMap<>();
            Iterator<Long> i2 = feis.iterator();
            while (i2.hasNext()){
                Long fei = i2.next();
                f.put(fei, facilities.get(fei));
            }
            HashMap<String, ArrayList<Long>> uf = mergeCompanies(f);
            console.log("Found " + uf.size() + " unique facilities in " + countryCode);
            uniqueFacilities.put(countryCode, uf);
        }



      //Merge records by facility
        ArrayList<HashMap<String, Value>> mergedRecords = new ArrayList<>();
        it = uniqueFacilities.keySet().iterator();
        while (it.hasNext()){
            String countryCode = it.next();
            HashMap<String, ArrayList<Long>> uf = uniqueFacilities.get(countryCode);

            Iterator<String> i2 = uf.keySet().iterator();
            while (i2.hasNext()){
                String facilityName = i2.next();
                ArrayList<Long> feis = uf.get(facilityName);

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

                            Long port = record.get("unladed_port").toLong();
                            Long consignee = record.get("consignee").toLong();
                            Float lines = record.get("lines").toFloat();
                            if (lines==null) lines = 0f;
                            Float quantity = record.get("quantity").toFloat();
                            if (quantity==null) quantity = 0f;
                            Float value = record.get("value").toFloat();
                            if (value==null) value = 0f;

                            String key = port+"_"+consignee;

                            HashMap<String, Value> g = group.get(key);
                            if (g==null){
                                g = new HashMap<>();
                                g.put("manufacturer_name", new Value(facilityName));
                                g.put("manufacturer_fei", new Value(facilityFEIs));
                                g.put("manufacturer_cc", new Value(countryCode));
                                g.put("unladed_port", new Value(port));
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
        }

        console.log("Reduced " + records.size() + " to " + mergedRecords.size() + " (merged " + (records.size()-mergedRecords.size()) + " records)");



      //Merge records by consignee
        ArrayList<HashMap<String, Value>> mergedRecords2 = new ArrayList<>();
        it = uniqueFacilities.keySet().iterator();
        while (it.hasNext()){
            String countryCode = it.next();
            HashMap<String, ArrayList<Long>> uf = uniqueFacilities.get(countryCode);

            Iterator<String> i2 = uf.keySet().iterator();
            while (i2.hasNext()){
                String facilityName = i2.next();
                ArrayList<Long> feis = uf.get(facilityName);



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

                            String manufacturerName = record.get("manufacturer_name").toString();
                            String manufacturerFEIs = record.get("manufacturer_fei").toString();
                            String manufacturerCC = record.get("manufacturer_cc").toString();
                            Long port = record.get("unladed_port").toLong();
                            Float lines = record.get("lines").toFloat();
                            if (lines==null) lines = 0f;
                            Float quantity = record.get("quantity").toFloat();
                            if (quantity==null) quantity = 0f;
                            Float value = record.get("value").toFloat();
                            if (value==null) value = 0f;

                            String key = port+"_"+manufacturerFEIs;

                            HashMap<String, Value> g = group.get(key);
                            if (g==null){
                                g = new HashMap<>();
                                g.put("manufacturer_name", new Value(manufacturerName));
                                g.put("manufacturer_fei", new Value(manufacturerFEIs));
                                g.put("manufacturer_cc", new Value(manufacturerCC));
                                g.put("unladed_port", new Value(port));

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
        }

        console.log("Further reduced " + records.size() + " to " + mergedRecords2.size() + " (merged " + (records.size()-mergedRecords2.size()) + " records)");



      //Generate response
        fields = new String[]{"manufacturer_name","manufacturer_fei","manufacturer_cc",
            "lines","quantity","value","consignee_name","consignee_fei","consignee_cc","unladed_port"};
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
        String[] fields = new String[]{"date","lines","quantity","value"};
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
}