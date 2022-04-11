package bluewave.data;
import bluewave.utils.GeoCoder;
import bluewave.graph.Neo4J;
import bluewave.utils.StatusLogger;
import bluewave.utils.StringUtils;
import static bluewave.graph.Utils.*;
import static bluewave.utils.StatusLogger.*;

import java.io.InputStream;
import java.io.FileInputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.math.BigDecimal;

import javaxt.json.*;
import javaxt.utils.ThreadPool;
import javaxt.express.utils.CSV;
import static javaxt.utils.Console.console;

import com.monitorjbl.xlsx.StreamingReader;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;

import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;


//******************************************************************************
//**  ImportsV2 Data
//******************************************************************************
/**
 *   Used to ingest imports data
 *
 ******************************************************************************/

public class ImportsV2 {

    private static GeoCoder geocoder = new GeoCoder();
    private static String[] establishmentTypes = new String[]{
    "Manufacturer","Shipper","Importer","Consignee","DII"};
    private static Map<String, String> usTerritories = java.util.Map.ofEntries(
        java.util.Map.entry("AS", "American Samoa"),
        java.util.Map.entry("FM", "Federated States of Micronesia"),
        java.util.Map.entry("GU", "Guam"),
        java.util.Map.entry("MH", "Marshall Islands"),
        java.util.Map.entry("MP", "Northern Mariana Islands"),
        java.util.Map.entry("PR", "Puerto Rico"),
        java.util.Map.entry("PW", "Palau"),
        java.util.Map.entry("VI", "U.S. Virgin Islands"),
        java.util.Map.entry("UM", "U.S. Minor Outlying Islands")
    );


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    private ImportsV2(){}


  //**************************************************************************
  //** loadLines
  //**************************************************************************
  /** Used to create "import_line" nodes using select fields from the input
   *  xlsx file. Creates relationships to the "import_establishment" and
   *  "port_of_entry" nodes. Obviously these nodes need to be created BEFORE
   *  calling this function.
   */
    public static void loadLines(javaxt.io.File xlsx, Neo4J database) throws Exception {

        System.out.println("\n\nLoading lines\n");

      //Start console logger
        AtomicLong recordCounter = new AtomicLong(0);
        StatusLogger statusLogger = new StatusLogger(recordCounter, null);


      //Generate list of fields
        ArrayList<String> fields = new ArrayList<>(Arrays.asList(
        "Entry","DOC","Line","Date","Port of Entry","Port of Entry District Code","Unladed Port","Country of Origin",
        "Shipment Method Code","Shipment Method","Product Code","Product Name","Quantity","Value"));
        for (String establishment : establishmentTypes){
            fields.add(establishment);
        }
        // fields.add("Affirmations");
        fields.add("Final Disposition");
        fields.add("Predict Risk");
        fields.add("Predict Score");
        fields.add("unique_key");



      //Compile prepared statements used to create nodes
        StringBuilder stmt = new StringBuilder("CREATE (a:import_line {");
        Iterator<String> it = fields.iterator();
        while (it.hasNext()){
            String param = it.next().replace(" ","_").toLowerCase();
            stmt.append(param);
            stmt.append(": $");
            stmt.append(param);
            if (it.hasNext()) stmt.append(" ,");
        }
        stmt.append("}) RETURN id(a)");
        String createImportLine = stmt.toString();

        stmt = new StringBuilder("CREATE (a:import_affirmation {");
        for (String param : new String[]{"key","value","unique_key"}){
            stmt.append(param);
            stmt.append(": $");
            stmt.append(param);
            if (!param.equals("unique_key")) stmt.append(" ,");
        }
        stmt.append("}) RETURN id(a)");
        String createImportAffirmation = stmt.toString();




      //Create unique key constraints and indexes
        Session session = null;
        try{
            session = database.getSession();
            try{ session.run("CREATE CONSTRAINT ON (n:import_line) ASSERT n.unique_key IS UNIQUE"); }
            catch(Exception e){}
            try{ session.run("CREATE INDEX idx_import_line IF NOT EXISTS FOR (n:import_line) ON (n.unique_key)"); }
            catch(Exception e){}

            try{ session.run("CREATE CONSTRAINT ON (n:import_affirmation) ASSERT n.unique_key IS UNIQUE"); }
            catch(Exception e){}
            try{ session.run("CREATE INDEX idx_import_affirmation IF NOT EXISTS FOR (n:import_affirmation) ON (n.unique_key)"); }
            catch(Exception e){}

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
        }



      //Instantiate the ThreadPool
        ThreadPool pool = new ThreadPool(20, 1000){
            public void process(Object obj){
                JSONObject json = (JSONObject) obj;


              //Create params for the import_node
                Map<String, Object> params = new LinkedHashMap<>();
                for (String field : fields){
                    String param = field.replace(" ","_").toLowerCase();
                    params.put(param, null);
                }

                String uniqueKey = json.get("entry").toString() + "_" + json.get("doc").toString() + "_" + json.get("line").toString();
                params.put("unique_key", uniqueKey);

                Iterator<String> it = json.keys();
                while (it.hasNext()){
                    String key = it.next();
                    JSONValue val = json.get(key);
                    if (val.isNull()){
                        params.put(key, null);
                    }
                    else{

                        boolean fei = false;
                        for (String establishment : establishmentTypes){
                            if (key.equalsIgnoreCase(establishment)){
                                fei = true;
                                break;
                            }
                        }

                        if (fei){
                            params.put(key, val.toLong());
                        }
                        else{
                            switch(key) {
//                                case "date":
//                                    javaxt.utils.Date d = val.toDate();
//                                    if (d!=null) d.setTimeZone("America/New York");
//                                    params.put(key, d==null ? null : d.getDate());
//                                    break;
                                case "quantity":
                                case "value":
                                case "predict_risk":
                                    params.put(key, val.toDouble());
                                    break;
                                default:
                                    String str = val.toString();
                                    if (str!=null){
                                        str = str.trim();
                                        if (str.isEmpty()) str = null;
                                    }
                                    params.put(key, str);
                                    break;
                            }
                        }

                    }
                }


              //Create import_line node
                Long nodeID;
                try{
                    nodeID = getSession().run(createImportLine, params).single().get(0).asLong();
                }
                catch(Exception e){
                    nodeID = getIdFromError(e);
                    if (nodeID==null) e.printStackTrace();
                }
                if (nodeID==null) return;



              //Link import_line to import_establishment
                for (String establishmentType : establishmentTypes){
                    establishmentType = establishmentType.toLowerCase();
                    String fei = json.get(establishmentType).toString();
                    if (fei==null) continue;

                    String link = "MATCH (r), (n:import_establishment) WHERE id(r)=" + nodeID +
                    " and n.fei="+fei+" MERGE(r)-[:" + establishmentType + "]->(n)";

                    try{
                        getSession().run(link);
                    }
                    catch(Exception e){
                        console.log(e.getMessage());
                    }
                }


              //Link import_line to port_of_entry
                for (String port : new String[]{"port_of_entry","unladed_port"}){
                    Integer portID = json.get(port).toInteger();
                    if (portID!=null){
                        String link = "MATCH (r), (n:port_of_entry) WHERE id(r)=" + nodeID +
                        " and n.id="+portID+" MERGE(r)-[:" + port + "]->(n)";

                        try{
                            getSession().run(link);
                        }
                        catch(Exception e){
                            //console.log(e.getMessage());
                        }
                    }
                }


              //Create import_affirmation nodes
                String affirmations = json.get("affirmations").toString();
                if (affirmations!=null){
                    for (String str : affirmations.split(";")){
                        str = str.trim();
                        if (str.isEmpty()) continue;
                        while (str.contains("  ")) str = str.replace("  ", " ");
                        String[] arr = str.split(" ");
                        String key = arr[0].replace("#", "");
                        String val = arr.length>1 ? arr[1] : null;
                        uniqueKey = key;
                        if (val!=null) uniqueKey+="_"+val;
                        params = new LinkedHashMap<>();
                        params.put("key", key);
                        params.put("value", val);
                        params.put("unique_key", uniqueKey);


                      //Create import_affirmation node
                        Long affirmationId;
                        try{
                            affirmationId = getSession().run(createImportAffirmation, params).single().get(0).asLong();
                        }
                        catch(Exception e){
                            affirmationId = getIdFromError(e);
                        }

                      //Link import_line to import_affirmation
                        try {
                            getSession().run("MATCH (r),(s:import_affirmation) WHERE id(r) =" + nodeID + " AND id(s) = " + affirmationId +
                            " CREATE(r)-[:has]->(s)");
                        }
                        catch(Exception e) {
                            e.printStackTrace();
                        }
                    }
                }


                recordCounter.incrementAndGet();
            }


            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();



      //Parse records and add them to the pool
        java.io.InputStream is = xlsx.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        LinkedHashMap<String, Integer> header = new LinkedHashMap<>();
        int rowID = 0;
        for (Row row : workbook.getSheetAt(0)){
            if(row == null) break;
            if (rowID==0){

              //Parse header
                int idx = 0;
                for (Cell cell : row) {
                    header.put(cell.getStringCellValue(), idx);
                    idx++;
                }

            }
            else{
                try{

                    JSONObject json = new JSONObject();


                  //Get entry
                    String entry = "";
                    String doc = "";
                    String line = "";
                    Cell cell = row.getCell(header.get("Entry/DOC/Line"));
                    if(cell == null) continue;
                    String id = cell.getStringCellValue();
                    if (id!=null){
                        id = id.trim();
                        if (!id.isEmpty()){
                            String[] arr = id.split("/");
                            if (arr.length>0) entry = arr[0];
                            if (arr.length>1) doc = arr[1];
                            if (arr.length>2) line = arr[2];
                        }
                    }
                    json.set("entry",entry);
                    json.set("doc",doc);
                    json.set("line",line);


                  //Get date
                    String date = row.getCell(header.get("Arrival Date")).getStringCellValue();
                    if (date!=null) date = date.trim();
                    if (date==null || date.isEmpty()){
                        date = row.getCell(header.get("Submission Date")).getStringCellValue();
                        if (date!=null) date = date.trim();
                    }
                    date = getShortDate(date);
                    json.set("date",date);


                  //Get port of entry code
                    String port = row.getCell(header.get("Port of Entry Code")).getStringCellValue();
                    json.set("port_of_entry",port);


                  // Port of entry district
                    json.set("port_entry_district_code", row.getCell(header.get("Port of Entry Distrct Abrvtn")).getStringCellValue());


                  //Unladed Thru Port Code
                    String thruPort = row.getCell(header.get("Unladed Thru Port Code")).getStringCellValue();
                    json.set("unladed_port",thruPort);



                  //Country of Origin
                    json.set("country_of_origin", row.getCell(header.get("Country Of Origin")).getStringCellValue());


                  //Carrier type code
                    json.set("shipment_method_code", row.getCell(header.get("Carrier Type Code")).getStringCellValue());


                  //Carrier Type
                    String carrierType = row.getCell(header.get("Carrier Type")).getStringCellValue();
                    if (carrierType==null) carrierType = "";
                    carrierType = carrierType.trim().toLowerCase();
                    if (carrierType.contains("rail") || carrierType.contains("road") || carrierType.contains("truck")){
                        carrierType = "land";
                    }
                    else if (carrierType.contains("air")){
                        carrierType = "air";
                    }
                    else if (carrierType.contains("sea")){
                        carrierType = "sea";
                    }
                    else{
                        if (!carrierType.isEmpty()) carrierType = "other";
                    }
                    json.set("shipment_method",carrierType);



                  //Product code
                    String productCode = row.getCell(header.get("Product Code (Abbr.)")).getStringCellValue();
                    json.set("product_code",productCode);



                  //Product name
                    String productName = row.getCell(header.get("Brand Name")).getStringCellValue();
                    if (productName!=null){
                        //if (productName.contains(",")) productName = "\"" + productName + "\"";
                        json.set("product_name",productName);
                    }



                  //Total reported quantity
                    json.set("quantity",row.getCell(header.get("Reported Total Quantity")).getStringCellValue());



                  //Declared value in USD
                    String value = row.getCell(header.get("Value of Goods")).getStringCellValue();
                    if (value!=null) value = value.replace("$", "").replace(",", "");
                    json.set("value",value);



                  //FEI
                    for (int i=0; i<establishmentTypes.length; i++){
                        Integer feiField = header.get(establishmentTypes[i] + " FEI Number");
                        String fei = row.getCell(feiField).getStringCellValue();
                        json.set(establishmentTypes[i].toLowerCase(),fei);
                    }



                  //Affirmations
                    json.set("affirmations",row.getCell(header.get("All Affirmations")).getStringCellValue());


                  //Final Disposition
                    json.set("final_disposition",row.getCell(header.get("Final Disposition Activity Description")).getStringCellValue());


                  //PREDICT Risk
                    json.set("predict_risk",row.getCell(header.get("PREDICT Risk Percentile")).getStringCellValue());


                  //PREDICT Score
                    json.set("predict_score",row.getCell(header.get("PREDICT Total Risk Score")).getStringCellValue());


                  //PREDICT Score
                    json.set("predict_recommendation",row.getCell(header.get("PREDICT Recommendation")).getStringCellValue());

                    pool.add(json);

                }
                catch(Exception e){
                    e.printStackTrace();
                    console.log("Failed to parse row " + rowID);
                }

            }
            rowID++;

        }


        workbook.close();
        is.close();


      //Notify the pool that we have finished added records and Wait for threads to finish
        pool.done();
        pool.join();


      //Clean up
        statusLogger.shutdown();

    }


  //**************************************************************************
  //** geocodeEstablishments
  //**************************************************************************
  /** Used to add lat/lon coordinates to the Establishments.csv using results
   *  from a previous geocoding attempt using the geocodeCompanies() method.
   */
    public void geocodeEstablishments(javaxt.io.Directory dir) throws Exception {


        HashMap<String, String[]> addresses = new HashMap<>();
        for (String establishment : establishmentTypes){
            javaxt.io.File file = new javaxt.io.File(dir, establishment + ".csv");
            java.io.BufferedReader br = file.getBufferedReader();
            String row;
            while ((row = br.readLine()) != null){
                CSV.Columns columns = CSV.getColumns(row, ",");
                String address = columns.get(2).toString();
                String lat = columns.get(3).toString();
                String lon = columns.get(4).toString();
                addresses.put(address, new String[]{lat,lon});
            }
            br.close();
        }

        console.log("Found " + addresses.size() + " addresses");


        javaxt.io.File input = new javaxt.io.File(dir, "Establishments.csv");
        java.io.BufferedReader br = input.getBufferedReader();

        javaxt.io.File output = new javaxt.io.File(dir, "Establishments2.csv");
        java.io.BufferedWriter writer = output.getBufferedWriter("UTF-8");

        writer.write("fei,name,address,lat,lon");

        HashSet<String> unmatched = new HashSet<>();
        String row = br.readLine(); //skip header
        while ((row = br.readLine()) != null){
            CSV.Columns columns = CSV.getColumns(row, ",");
            String fei = columns.get(0).toString();
            String name = columns.get(1).toString();
            String address = columns.get(2).toString();
            String lat = "";
            String lon = "";
            String[] coord = addresses.get(address);
            if (coord!=null){
                lat = coord[0];
                lon = coord[1];
            }
            else{
                int min = Integer.MAX_VALUE;
                for (int i=0; i<10; i++){
                    int x = address.indexOf(i+"");
                    if (x>-1) min = Math.min(min, x);
                }

                //console.log(address);


                try{

                    String addr = address;
                    if (min>0 && min<Integer.MAX_VALUE){
                        addr = address.substring(min);
                        String prefix = "";
                        for (int i=0; i<min; i++) prefix+="-";
                        console.log(prefix+addr);
                    }


                    BigDecimal[] point = geocoder.getCoordinates(addr);
                    if (point!=null){
                        lat = point[0].toString();
                        lon = point[1].toString();
                    }
                }
                catch(Exception e){
                }

                if (lat.isEmpty() || lon.isEmpty()) unmatched.add(fei);
            }

            writer.write("\r\n");

            name = replaceLineBreaks(name);
            if (name.contains(",")) name = "\""+name+"\"";
            address = replaceLineBreaks(address);
            if (address.contains(",")) address = "\""+address+"\"";
            writer.write(fei+","+name+","+address+","+lat+","+lon);
        }
        br.close();
        writer.close();

        console.log("Geocoded " + (addresses.size()-unmatched.size()) + " addresses");

        Iterator<String> it = unmatched.iterator();
        while (it.hasNext()){
            console.log(it.next());
        }
    }


  //**************************************************************************
  //** loadEstablishments
  //**************************************************************************
    private static void _loadEstablishments(javaxt.io.File csvFile, Neo4J database, java.io.BufferedWriter errorWriter, HashSet uniqueFEIs, JSONArray totalRows, JSONArray badRows) throws Exception {
        System.out.println("\n\n"+csvFile.getName()+"\n");
        System.out.println("\n\nLoading Establishments\n");
        //Count total records in the file
        // AtomicLong totalRecords = new AtomicLong(0);
        // if (true){
        //     System.out.print("Analyzing File...");
        //     long t = System.currentTimeMillis();
        //     java.io.BufferedReader br = csvFile.getBufferedReader();
        //     String row = br.readLine(); //skip header
        //     while ((row = br.readLine()) != null){
        //         totalRecords.incrementAndGet();
        //     }
        //     br.close();
        //     System.out.print(" Done!");
        //     System.out.println(
        //     "\nFound " + format(totalRecords.get()) + " records in " + getElapsedTime(t));
        // }


      //Start console logger
        // AtomicLong recordCounter = new AtomicLong(0);
        // StatusLogger statusLogger = new StatusLogger(recordCounter, totalRecords);



        Session session = null;
        try{
            session = database.getSession();

          //Create unique key constraint
            try{ session.run("CREATE CONSTRAINT ON (n:address) ASSERT n.address IS UNIQUE"); }
            catch(Exception e){}
            try{ session.run("CREATE CONSTRAINT ON (n:import_establishment) ASSERT n.fei IS UNIQUE"); }
            catch(Exception e){}


          //Create indexes
            try{ session.run("CREATE INDEX idx_address IF NOT EXISTS FOR (n:address) ON (n.address)"); }
            catch(Exception e){}
            try{ session.run("CREATE INDEX idx_import_establishment IF NOT EXISTS FOR (n:import_establishment) ON (n.fei)"); }
            catch(Exception e){}


            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
        }
        HashSet sheetsProcessed = new HashSet();


      //Instantiate the ThreadPool
        ThreadPool pool = new ThreadPool(20, 1000){
            public void process(Object obj){
                JSONObject jsonRowObject = (JSONObject) obj;
                JSONArray row = jsonRowObject.get("row").toJSONArray();
                String currentSheet = jsonRowObject.get("sheet").toString();

                sheetsProcessed.add(currentSheet);
                Long fei = null;
                try{
                    int index = 0;
                    fei = row.get(index++).toLong();

                  //Discard invalid rows with 0 value for fei
                    if(fei == null || fei == 0) {
                        return;
                    }

                    uniqueFEIs.add(fei);

                    String name = row.get(index++).toString();
                    String address = row.get(index++).toString();
                    String countryCode = null;
                    String state = null;
                    if(address!=null) {
                        try {
                            String[]parts = address.split("\\R");
                            address = parts[2]+" "+parts[3];
                            countryCode = parts[4];
                            if(countryCode.equals("US")) {
                                String[]cityStateZip = parts[3].split(",");
                                state = cityStateZip[1].trim().split(" ")[0];
                            }
                        }catch(Exception e){
                            errorWriter.write("FEI: " + fei + " " + e.toString());
                            errorWriter.newLine();errorWriter.newLine();
                        }
                    }
                    String duns = null;
                    if(currentSheet.equals("MFR Report") || currentSheet.equals("DII Report")) {
                        duns = row.get(index++).toString();
                    }

                    String op_status_code = null;
                    String lat = null;
                    String lon = null;
                    if(!currentSheet.equals("DII Report")) {
                        op_status_code = row.get(index++).toString();
                        try {
                            lat = row.get(index++).toString();
                            lon = row.get(index++).toString();
                        } catch (Exception e) {
                            errorWriter.write("FEI: " + fei + " " + e.toString());
                            errorWriter.newLine();errorWriter.newLine();
                        }

                    }

                    Session session = getSession();
                    Map<String, Object> params = new LinkedHashMap<>();

                    params.put("address", address);
                    params.put("state", (state==null?"":state));
                    if(countryCode != null && !countryCode.isEmpty()) params.put("country", countryCode);
                    if(lat != null && !lat.isEmpty()) params.put("lat", lat);
                    if(lon != null && !lon.isEmpty()) params.put("lon", lon);


                    // String createAddress = getQuery("address", params);
                    String createAddress = getUpsertQuery("address", params);

                    Long addressID;
                    try{
                        addressID = session.run(createAddress, params).single().get(0).asLong();
                    }
                    catch(Exception e){
                        addressID = getIdFromError(e);
                        if(addressID == null) {
                            errorWriter.write("FEI: " + fei + " " + e.toString());
                            errorWriter.newLine();errorWriter.newLine();
                        }
                    }


                    params = new LinkedHashMap<>();
                    params.put("fei", fei);
                    params.put("name", name);
                    if(duns != null && !duns.isEmpty()) params.put("duns", duns);
                    if(op_status_code != null && !op_status_code.isEmpty()) params.put("op_status_code", op_status_code);

                    String createEstablishment = getEstablishmentByFEIQueryUsingSet("import_establishment", params);

                    Long establishmentID;
                    try{
                        establishmentID = session.run(createEstablishment, params).single().get(0).asLong();
                    }
                    catch(Exception e){
                        establishmentID = getIdFromError(e);
                        if(establishmentID == null){
                            errorWriter.write("FEI: " + fei + " " + e.toString());
                            errorWriter.newLine();errorWriter.newLine();
                        }
                    }

                    session.run("MATCH (r),(s) WHERE id(r) =" + establishmentID + " AND id(s) = " + addressID +
                    " MERGE(r)-[:has]->(s)");

                }
                catch(Exception e){
                    try {
                        errorWriter.write("FEI: " + fei + " " + e.toString());
                        errorWriter.newLine();errorWriter.newLine();
                    }catch(java.io.IOException ioe) {}
                }

                // recordCounter.incrementAndGet();
            }

            private String getUpsertQuery(String node, Map<String, Object> params){

                StringBuilder query = new StringBuilder("MERGE (a:" + node + " {");
                Iterator<String> it = params.keySet().iterator();
                while (it.hasNext()){
                    String param = it.next();
                    query.append(param);
                    query.append(": $");
                    query.append(param);
                    if (it.hasNext()) query.append(" ,");
                }
                query.append("}) RETURN id(a)");

                return query.toString();
            }

            private String getQuery(String node, Map<String, Object> params){
                String key = "create_"+node;
                String q = (String) get(key);
                if (q==null){
                    StringBuilder query = new StringBuilder("CREATE (a:" + node + " {");
                    Iterator<String> it = params.keySet().iterator();
                    while (it.hasNext()){
                        String param = it.next();
                        query.append(param);
                        query.append(": $");
                        query.append(param);
                        if (it.hasNext()) query.append(" ,");
                    }
                    query.append("}) RETURN id(a)");
                    q = query.toString();
                    set(key, q);
                }
                return q;
            }

            private String getEstablishmentByFEIQueryUsingSet(String node, Map<String, Object> params){

                StringBuilder query = new StringBuilder("MERGE (a:" + node + " { fei: $fei}) SET a += {");
                Iterator<String> it = params.keySet().iterator();
                while (it.hasNext()){
                    String param = it.next();
                    query.append(param);
                    query.append(": $");
                    query.append(param);
                    if (it.hasNext()) query.append(" ,");
                }
                query.append("} RETURN id(a)");
                return query.toString();
            }

            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        };
        // }.start();

        List<String> sheets = Arrays.asList("Entry Report", "Listing Report", "MFR Report", "Shipper Report", "Importer Report", "Consignee Report", "DII Report", "Exam Report", "Sample Report", "Joint Firm Report", "Query Summary");
        HashSet<String>establishmentSheetNames = new HashSet<>(Arrays.asList("MFR Report", "Shipper Report", "Importer Report", "Consignee Report", "DII Report"));
        // HashSet<String>establishmentSheetNames = new HashSet<>(Arrays.asList("MFR Report"));
        List<String>estSheets = Arrays.asList("MFR Report", "Shipper Report", "Importer Report", "Consignee Report", "DII Report");

        List<String>mfrHeaders = Arrays.asList("Manufacturer FEI Number", "Manufacturer Legal Name","Manufacturer Name & Address", "Manufacturer DUNS Num", "Manufacture Operational Status Code", "Manufacturer Latitude", "Manufacturer Longitude");
        List<String>shipperHeaders = Arrays.asList("Shipper FEI Number", "Shipper Legal Name","Shipper Name & Address", "Shipper DUNS Num", "Shipper Operational Status Code", "Shipper Latitude", "Shipper Longitude");
        List<String>importerHeaders = Arrays.asList("Importer FEI Number",	"Importer Legal Name","Importer Name & Address", "Importer DUNS Num", "Importer Operational Status Code", "Importer Latitude", "Importer Longitude");
        List<String>consigneeHeaders = Arrays.asList("Consignee FEI Number", "Consignee Legal Name","Consignee Name & Address", "Consignee DUNS Num", "Consignee Operational Status Code", "Consignee Latitude", "Consignee Longitude");
        List<String>diiHeaders = Arrays.asList("DII FEI Number", "DII Legal Name","DII Name & Address", "DII DUNS Num", "DII Operational Status Code");

        List<List<String>> hdrs = new ArrayList();
        hdrs.add(mfrHeaders);
        hdrs.add(shipperHeaders);
        hdrs.add(importerHeaders);
        hdrs.add(consigneeHeaders);
        hdrs.add(diiHeaders);

        int sheetIndex = 0;
          //Parse file
          InputStream is = new FileInputStream(csvFile.toFile());
          Workbook workbook = StreamingReader.builder()
              .rowCacheSize(10)    // number of rows to keep in memory (defaults to 10)
              .bufferSize(4096)     // buffer size to use when reading InputStream to file (defaults to 1024)
              .open(is);            // InputStream or File for XLSX file (required)

          String sheetName = null;
          long rowNum = 0;

          try{
                // Iterator<String>iter = establishmentSheetNames.iterator();
                // while(iter.hasNext()) {
                for(int i=0;i < estSheets.size();i++) {
                    sheetName = String.valueOf(estSheets.get(i));
                   // sheetName = iter.next();
                    Sheet sheet = workbook.getSheet(sheetName);
                    if(sheet == null) continue;

                    JSONObject jsonRowObject = null;
                    JSONArray rowBuffer = null;
                    DataFormatter formatter = new DataFormatter();
                    boolean skippedHeaderRow = false;
                    int badRowPerSheet = 0;
                    rowNum = 0;
                    // int headerIndex = estSheets.indexOf(sheetName);
                    // if(headerIndex == -1) {
                    //     errorWriter.write("Headers for '"+ sheetName + "' not found: " );errorWriter.newLine();errorWriter.newLine();
                    //     continue;
                    // }
                    // List<String>headerList = hdrs.get(i);
                    // Iterator headerIterator = headerSet.iterator();
                    // String feiHeader = headerList.get(0);

                    List<String>headerList = null;
                    String feiHeader = null;
                    String currentCellHeader = null;
                    for (Row row : sheet){

                        if(!skippedHeaderRow) {
                            headerList = new ArrayList();
                            Iterator<Cell> cellIterator = row.cellIterator();
                            int cellNum = 0;
                            while(cellIterator.hasNext()) {
                                if(cellNum == 0) {
                                    feiHeader = cellIterator.next().getStringCellValue();
                                    headerList.add(feiHeader);
                                }
                                else {
                                    headerList.add(cellIterator.next().getStringCellValue());
                                }
                                cellNum++;
                            }
                            skippedHeaderRow = true;
                            continue;
                        }
                        rowNum++;
                        jsonRowObject = new JSONObject();
                        jsonRowObject.set("rowNum", rowNum);
                        // rowBuffer = new JSONArray();

                        for(int h=0;h < headerList.size();h++) {
                        // while(headerIterator.hasNext()) {
                            // currentCellHeader = (String)headerIterator.next();
                            // currentCellHeader = (String)headerSet.next();
                            currentCellHeader = headerList.get(h);
                            Cell cell = row.getCell(h);
                            if(cell != null) {
                                if(cell.getCellType() == CellType.BLANK || cell.getCellType() == CellType._NONE || cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR) {
                                    jsonRowObject.set(currentCellHeader, " ");
                                }
                                else if(cell.getCellType() == CellType.BOOLEAN) {
                                    jsonRowObject.set(currentCellHeader, cell.getBooleanCellValue());
                                }
                                else if(cell.getCellType() == CellType.NUMERIC) {
                                    jsonRowObject.set(currentCellHeader, cell.getNumericCellValue());
                                }
                                else if(cell.getCellType() == CellType.STRING) {
                                    jsonRowObject.set(currentCellHeader, cell.getStringCellValue());
                                }
                            }
                        }

                        // Iterator<Cell> cellIter = row.cellIterator();
                        // while(cellIter.hasNext()) {

                        //     Cell cell = cellIter.next();
                        //     if(cell.getCellType() == CellType.BLANK || cell.getCellType() == CellType._NONE) {
                        //         rowBuffer.add(" ");
                        //     }
                        //     else if(cell.getCellType() == CellType.BOOLEAN) {
                        //         rowBuffer.add(cell.getBooleanCellValue());
                        //     }
                        //     else if(cell.getCellType() == CellType.ERROR) {
                        //         rowBuffer.add(" ");
                        //     }
                        //     else if(cell.getCellType() == CellType.FORMULA) {
                        //         rowBuffer.add(" ");
                        //     }
                        //     else if(cell.getCellType() == CellType.NUMERIC) {
                        //         rowBuffer.add(cell.getNumericCellValue());
                        //     }
                        //     else if(cell.getCellType() == CellType.STRING) {
                        //        rowBuffer.add(cell.getStringCellValue());
                        //     }
                        // }

                        jsonRowObject.set("sheet", sheetName);

                        boolean legitFeiValue = true;

                        try {
                            Long feiValue = jsonRowObject.get(feiHeader).toLong();
                            if(feiValue == null) {
                                 legitFeiValue = false;
                            } else {
                                if(!(feiValue > 0)) {
                                    legitFeiValue = false;
                                }
                            }
                        }catch(Exception e) {
                            e.printStackTrace();
                            legitFeiValue = false;
                        }

                        if(jsonRowObject.length() > 2 && legitFeiValue)
                            totalRows.add(jsonRowObject);
                        else {
                            badRows.add(jsonRowObject);
                            badRowPerSheet++;
                        }

                    }
                    System.out.println("\n\nTotal Bad Rows -"+sheetName+" - " + badRowPerSheet +"\n\n");
                }
            }
          catch(Exception e){
            errorWriter.write("ERROR Sheet: " + sheetName + " row: "+rowNum+" " + e.toString());
            errorWriter.newLine();errorWriter.newLine();
            e.printStackTrace();
          }

          workbook.close();
          is.close();

      //Notify the pool that we have finished added records and Wait for threads to finish
        // pool.done();
        // pool.join();

        System.out.println("\n\nTotal Rows: " + totalRows.length() +"\n\n");
        System.out.println("\n\nTotal Bad Rows: " + badRows.length() +"\n\n");
        // System.out.println("\nSheets Processed: " + sheetsProcessed.toString());
      //Clean up
        // statusLogger.shutdown();


    }

    public static void loadEstablishments(javaxt.io.File[] files, Neo4J database) {
        HashSet uniques = new HashSet();
        javaxt.io.File errorLog = new javaxt.io.File("loadEstablishmentsErrors.log");
        if(!errorLog.exists()) {
            errorLog.create();
        }

        try(java.io.BufferedWriter errorWriter = errorLog.getBufferedWriter("UTF-8")) {
            javaxt.utils.Date date = new javaxt.utils.Date();
            errorWriter.write("Begin: " + date);
            errorWriter.newLine();errorWriter.newLine();
            JSONArray totalRows = new JSONArray();
            JSONArray badRows = new JSONArray();
            for(javaxt.io.File file : files) {
                _loadEstablishments(file, database, errorWriter, uniques, totalRows, badRows);
                errorWriter.write(file.getName() +": Total Rows: "+totalRows.length()); errorWriter.newLine();errorWriter.newLine();
            }
            Iterator iter = totalRows.iterator();
            while(iter.hasNext()) {
                JSONObject jsonObj = (JSONObject)iter.next();
                errorWriter.newLine();
                errorWriter.write(jsonObj.toString());
            }

            iter = badRows.iterator();
            errorWriter.newLine();errorWriter.newLine();
            errorWriter.write("BAD ROWS");errorWriter.newLine();
            while(iter.hasNext()) {
                JSONObject jsonObj = (JSONObject)iter.next();
                errorWriter.newLine();
                errorWriter.write(jsonObj.toString());
            }

            date = new javaxt.utils.Date();
            errorWriter.newLine();
            errorWriter.write("End: " + date);
            errorWriter.newLine();errorWriter.newLine();

            errorWriter.write("Unique FEIs/Rows processed: " + uniques.size());

            // HashSet fromServer = new HashSet();
            // try (Session session = database.getSession()) {
            //     List<org.neo4j.driver.Record> uniqueFEIsFromServer = session.run("MATCH (n:import_establishment) return n.fei").list();
            //     errorWriter.newLine();errorWriter.newLine();

            //     errorWriter.write("Unique FEIs/Rows in server: " + uniqueFEIsFromServer.size());
            //     JSONArray jsonArray = new JSONArray();
            //     for(org.neo4j.driver.Record keyObj : uniqueFEIsFromServer) {
            //         Long key = keyObj.get(0).asLong();
            //         fromServer.add(key);
            //         if(!uniques.contains(key)) {
            //             jsonArray.add(key);
            //         }
            //     }

            //     for(Object kLong : jsonArray) {
            //         errorWriter.newLine();errorWriter.newLine();
            //         errorWriter.write("Missing Unique FEI: " + kLong.toString());
            //     }
            // }catch(Exception e) {
            //     errorWriter.newLine();errorWriter.newLine();
            //     errorWriter.write("ERROR: " + e.toString());
            // }


            errorWriter.flush();
            errorWriter.close();
        }catch(Exception e) {
            e.printStackTrace();
        }
    }


  //**************************************************************************
  //** linkEstablishments
  //**************************************************************************
  /** Used to link "import_line" nodes to "import_establishment" nodes
   */
    public static void linkEstablishments(Neo4J database)
    throws Exception {


      //Count unlinked establishments
        AtomicLong totalRecords = new AtomicLong();
        Session session = null;
        try {
            session = database.getSession();

            String query = "MATCH (n:import_line)\n" +
            "WHERE NOT (n)-[]->(:import_establishment)\n" +
            "RETURN count(n)";

            Result rs = session.run(query);
            if (rs.hasNext()){
                Record record = rs.next();
                totalRecords.set(record.get(0).asLong());
            }
            session.close();
        }
        catch (Exception e) {
            if (session != null) session.close();
        }




      //Start console logger
        AtomicLong recordCounter = new AtomicLong(0);
        StatusLogger statusLogger = new StatusLogger(recordCounter, totalRecords);


      //Instantiate the ThreadPool
        ThreadPool pool = new ThreadPool(10, 1000){
            public void process(Object obj){
                JSONObject json = (JSONObject) obj;
                Long nodeID = json.get("nodeID").toLong();


                for (String establishmentType : establishmentTypes){
                    establishmentType = establishmentType.toLowerCase();
                    String fei = json.get(establishmentType).toString();

                    String query = "MATCH (r), (n:import_establishment) WHERE id(r)=" + nodeID +
                    " and n.fei="+fei+" MERGE(r)-[:" + establishmentType + "]->(n)";

                    try{
                        getSession().run(query);
                    }
                    catch(Exception e){
                        console.log(e.getMessage());
                    }
                }

                recordCounter.incrementAndGet();
            }


            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();




      //Add records to the pool
        try {
            session = database.getSession();


            String query = "MATCH (n:import_line)\n" +
            "WHERE NOT (n)-[]->(:import_establishment)\n" +
            "RETURN id(n) as id";

            for (String establishmentType : establishmentTypes){
                establishmentType = establishmentType.toLowerCase();
                query+=", n."+establishmentType+" as " + establishmentType;
            }


            Result rs = session.run(query);
            while (rs.hasNext()){
                Record record = rs.next();
                Long nodeID = record.get(0).asLong();
                JSONObject json = new JSONObject();
                json.set("nodeID", nodeID);
                boolean hasErrors = false;
                for (String establishmentType : establishmentTypes){
                    establishmentType = establishmentType.toLowerCase();
                    Long fei = new javaxt.utils.Value(record.get(establishmentType).asObject()).toLong();
                    if (fei==null){
                        hasErrors = true;
                    }
                    else{
                        json.set(establishmentType, fei);
                    }
                }
                if (hasErrors){
                    console.log(nodeID);
                }
                else{
                    pool.add(json);
                }
            }
            session.close();
        }
        catch (Exception e) {

            if (session != null) session.close();
        }


      //Notify the pool that we have finished added records and Wait for threads to finish
        pool.done();
        pool.join();


      //Clean up
        statusLogger.shutdown();
    }


  //**************************************************************************
  //** loadExams
  //**************************************************************************
  /** Used to load records from the "Exam Report" worksheet
   */
    public static void loadExams(javaxt.io.File xlsx, Neo4J database) throws Exception {
        System.out.println("\n\nLoading Exams\n");
        loadActivity("Exam Report", xlsx, database);
    }


  //**************************************************************************
  //** loadSamples
  //**************************************************************************
  /** Used to load records from the "Sample Report" worksheet
   */
    public static void loadSamples(javaxt.io.File xlsx, Neo4J database) throws Exception {
        System.out.println("\n\nLoading Samples\n");
        loadActivity("Sample Report", xlsx, database);
    }


  //**************************************************************************
  //** loadActivity
  //**************************************************************************
  /** Used to create import_activity nodes and link them to import_line nodes
   */
    private static void loadActivity(String sheetName, javaxt.io.File xlsx, Neo4J database) throws Exception {

      //Start console logger
        AtomicLong recordCounter = new AtomicLong(0);
        StatusLogger statusLogger = new StatusLogger(recordCounter, null);


        Session session = null;
        try{
            session = database.getSession();

          //Create unique key constraint
            try{ session.run("CREATE CONSTRAINT ON (n:import_activity) ASSERT n.unique_key IS UNIQUE"); }
            catch(Exception e){}


          //Create indexes
            try{ session.run("CREATE INDEX idx_import_activity IF NOT EXISTS FOR (n:import_activity) ON (n.unique_key)"); }
            catch(Exception e){}


            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
        }


      //Instantiate the ThreadPool
        ThreadPool pool = new ThreadPool(20, 1000){
            public void process(Object obj){
                Object[] arr = (Object[]) obj;
                String entry = (String) arr[0];
                String doc = (String) arr[1];
                String line = (String) arr[2];
                Map<String, Object> params = (Map<String, Object>) arr[3];


              //Parse/update activity date
                javaxt.utils.Date activityDate = null;
                try{
                    String key = getKey("Activity Date Time");
                    activityDate = new javaxt.utils.Date(params.get(key).toString());
                    params.put(key, activityDate.toISOString());
                }
                catch(Exception e){}
                if (activityDate==null){
                    console.log("Missing Activity Date Time for row " + entry+"/"+doc+"/"+line);
                    return;
                }


              //Parse/update other dates
                for (String key : new String[]{"Expected Availability Date","Sample Availability Date"}){
                    try{
                        key = getKey(key);
                        String date = getShortDate(params.get(key).toString());
                        params.put(key, date);
                    }
                    catch(Exception e){}
                }



              //Add additional params
                params.put("activity",sheetName);
                params.put("entry",entry);
                params.put("doc",doc);
                params.put("line",line);
                String foreignKey = entry+"_"+doc+"_"+line;
                String uniqueKey = sheetName.toLowerCase().replace(" ", "_")+"_"+foreignKey+"_"+activityDate.toISOString();
                params.put("unique_key", uniqueKey);


              //Create import_activity node and link to import_line
                Session session = database.getSession();
                try{
                    String createNode = getQuery("import_activity", params);
                    Long nodeID;
                    try{
                        nodeID = session.run(createNode, params).single().get(0).asLong();
                    }
                    catch(Exception e){
                        nodeID = getIdFromError(e);
                    }

                    session.run("MATCH (r),(s:import_line{unique_key:'" + foreignKey +"'}) WHERE id(r) =" + nodeID +
                    " MERGE(s)-[:has]->(r)");
                }
                catch(Exception e){
                    console.log(e.getMessage(), uniqueKey);
                }
                recordCounter.incrementAndGet();
            }


            private String getQuery(String node, Map<String, Object> params){
                String key = "create_"+node;
                String q = (String) get(key);
                if (q==null){
                    StringBuilder query = new StringBuilder("CREATE (a:" + node + " {");
                    Iterator<String> it = params.keySet().iterator();
                    while (it.hasNext()){
                        String param = it.next();
                        query.append(param);
                        query.append(": $");
                        query.append(param);
                        if (it.hasNext()) query.append(" ,");
                    }
                    query.append("}) RETURN id(a)");
                    q = query.toString();
                    set(key, q);
                }
                return q;
            }

            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();




        java.io.InputStream is = xlsx.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        LinkedHashMap<String, Integer> header = new LinkedHashMap<>();

        int rowID = 0;
        int totalRecords = 0;
        Sheet sheet = workbook.getSheet(sheetName);
        if(sheet == null) return;
        for (Row row : sheet){

            if (rowID==0){

              //Parse header
                int idx = 0;
                for (Cell cell : row) {
                    header.put(cell.getStringCellValue(), idx);
                    idx++;
                }

            }
            else{
                try{

                  //Get entry
                    String entry = "";
                    String doc = "";
                    String line = "";
                    Cell cell = row.getCell(header.get("Entry/DOC/Line"));
                    if(cell == null) continue;
                    String id = cell.getStringCellValue();
                    if (id!=null){
                        id = id.trim();
                        if (!id.isEmpty()){
                            String[] arr = id.split("/");
                            if (arr.length>0) entry = arr[0];
                            if (arr.length>1) doc = arr[1];
                            if (arr.length>2) line = arr[2];
                        }
                    }

                    Map<String, Object> params = new LinkedHashMap<>();
                    String[] fields = new String[]{

                      //Common fields
                        "Activity Number","Activity Description","Activity Date Time",
                        "Expected Availability Date","Sample Availability Date",
                        "Problem Area Flag","Problem Area Description","PAC","PAC Description",
                        "Remarks",

                      //Exam specific fields
                        "Suspected Counterfeit Reason","Lab Classification Code","Lab Classification","Summary",

                      //Sample specific fields
                        "Sample Tracking Number","LAB CLASSIFICATION","LAB CLASSIFICATION DESCRIPTION","LAB CONCLUSION"

                    };


                    for (String field : fields){
                        try{
                            String key = getKey(field);
                            String val = row.getCell(header.get(field)).getStringCellValue();


                            if (val==null){

                              //Starting on 4/4/2022 some of the fields have changed names
                                if (field.equals("Problem Area Flag")){
                                    val = row.getCell(header.get("Exam Problem Area Flag")).getStringCellValue();
                                    if (val==null){
                                        val = row.getCell(header.get("Collection Problem Area Flag")).getStringCellValue();
                                    }
                                }
                                if (field.equals("Problem Area Description")){
                                    val = row.getCell(header.get("Exam Problem Area Desc")).getStringCellValue();
                                    if (val==null){
                                        val = row.getCell(header.get("Collection Problem Area Desc")).getStringCellValue();
                                    }
                                }
                                if (field.equals("Remarks")){
                                    val = row.getCell(header.get("Activity Remarks")).getStringCellValue();
                                }
                            }


                            params.put(key, val);
                        }
                        catch(Exception e){
                        }
                    }


                    pool.add(new Object[]{entry,doc,line,params});
                    totalRecords++;
                }
                catch(Exception e){
                    console.log("Failed to parse row " + rowID);
                }

            }
            rowID++;
        }


      //Update statusLogger
        statusLogger.setTotalRecords(totalRecords);


      //Close workbook
        workbook.close();
        is.close();


      //Notify the pool that we have finished added records and Wait for threads to finish
        pool.done();
        pool.join();


      //Clean up
        statusLogger.shutdown();
    }



    public static void loadEstablishments2(javaxt.io.File xlsx, Neo4J database) throws Exception {
        int numThreads = 12;

        System.out.println("\n\nLoading Establishments\n");


      //Generate a unique list of establishments and addresses
        System.out.print("Parsing xlsx...");
        HashMap<Long, Map<String, Object>> establishments = new HashMap<>();
        HashMap<String, Map<String, Object>> addresses = new HashMap<>();
        HashMap<Long, String> establishmentsWithoutAddresses = new HashMap<>();
        java.io.InputStream is = xlsx.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        for (String establishmentType : establishmentTypes){

            String sheetName = establishmentType;
            if (establishmentType.equals("Manufacturer")) sheetName = "MFR";
            Sheet sheet = workbook.getSheet(sheetName + " Report");
            if(sheet == null) continue;


            int rowID = 0;
            LinkedHashMap<String, Integer> header = new LinkedHashMap<>();

            for (Row row : sheet){

                if (rowID==0){

                  //Parse header
                    int idx = 0;
                    for (Cell cell : row) {
                        header.put(cell.getStringCellValue(), idx);
                        idx++;
                    }

                }
                else{
                    try{

                        HashMap<String, String> values = new HashMap<>();
                        String[] fields = new String[]{

                            "FEI Number", "Legal Name",
                            "Name & Address", "Name and Address",
                            "DUNS Num", "Operational Status Code",
                            "Latitude", "Longitude"

                        };

                        for (String field : fields){
                            try{

                                String colName = establishmentType + " " + field;
                                colName = colName.replace(
                                "Manufacturer Operational Status Code",
                                "Manufacture Operational Status Code");

                                String val = row.getCell(header.get(colName)).getStringCellValue();
                                if (val!=null){
                                    val = val.trim();
                                    if (!val.isEmpty()){
                                        values.put(field, val);
                                    }
                                }
                            }
                            catch(Exception e){
                                //e.printStackTrace();
                            }
                        }

                        String feiNumber = (String) values.get("FEI Number");


                        if (feiNumber!=null){
                            Long fei = Long.parseLong(feiNumber);
                            if (fei>0){

                              //Get establishment-specific parameters
                                String name = (String) values.get("Legal Name");
                                String duns = (String) values.get("DUNS Num");
                                String status = (String) values.get("Operational Status Code");


                              //Create establishment
                                Map<String, Object> params = new LinkedHashMap<>();
                                params.put("fei", fei);
                                if (name!=null) params.put("name", name);
                                if (duns!=null) params.put("duns", duns);
                                if (status!=null) params.put("status", status);
                                establishments.put(fei, params);



                              //Get address-specific parameters
                                String address = (String) values.get("Name and Address");
                                if (address==null) address = (String) values.get("Name & Address");
                                String latitude = (String) values.get("Latitude");
                                String longitude = (String) values.get("Longitude");
                                String country = null;


                              //Parse address
                                if (address!=null){

                                  //Trim address string and remove extra whitespaces
                                    while (address.contains("  ")){
                                        address = address.replace("  ", " ");
                                    }
                                    address = address.trim();


                                  //Split address lines
                                    ArrayList<String> arr = new ArrayList<>();
                                    address = address.replace("\r", "\n");
                                    for (String str : address.split("\n")){
                                        str = str.trim();
                                        if (!str.isEmpty()) arr.add(str);
                                    }


                                  //Remove FEI number from the first row as needed
                                    if (arr.get(0).equals(feiNumber)){
                                        arr.remove(0);
                                    }

                                  //Remove company name as needed
                                    if (arr.get(0).equals(name)){
                                        arr.remove(0);
                                    }


                                  //Remove country code from the last line
                                    String countryCode = arr.get(arr.size()-1);
                                    if (countryCode.length()==2){
                                        country = countryCode;
                                        arr.remove(arr.size()-1);
                                    }


                                  //Flatten address into a single line
                                    String addr = "";
                                    for (String str : arr){
                                        addr += " ";
                                        addr += str;
                                    }
                                    address = replaceLineBreaks(addr).trim();


                                  //Ensure commas have a whitespace after them
                                    address = address.replace(",", ", ");
                                    while (address.contains("  ")){
                                        address = address.replace("  ", " ");
                                    }
                                    address = address.trim();
                                    if (address.endsWith(",")) address = address.substring(0, address.length()-1).trim();


                                  //Perform additional address parsing if there's a country code
                                    if (country!=null && !address.isEmpty()){
                                        if (country.equals("US")){


                                          //Check if address is a US territory
                                            String territory = null;
                                            Iterator<String> it = usTerritories.keySet().iterator();
                                            while (it.hasNext()){
                                                String t = it.next();
                                                if (address.contains(" " + t + " ") || address.endsWith(" " + t)){
                                                    territory = t;
                                                    break;
                                                }
                                            }


                                            if (territory!=null){
                                                country = territory;
                                            }
                                            else{
                                                address = StringUtils.trimUSAddress(address);
                                            }
                                        }
                                        else{

                                          //If the address in not in the US, append country code
                                            if (!address.isEmpty() && !address.endsWith(" " + country)){
                                                address+= ", " + country;
                                            }
                                        }
                                    }

                                    if (address.isEmpty()) address = null;
                                }


                                if (address==null){
                                    if (latitude!=null && longitude!=null){
                                        address = "[" + longitude + "," + latitude + "]";
                                        //console.log(address);
                                    }
                                }




                                if (address!=null){

                                    params = new LinkedHashMap<>();
                                    params.put("address", address);
                                    if (latitude!=null && longitude!=null){
                                        params.put("lat", latitude);
                                        params.put("lon", longitude);
                                        params.put("geocoder", "ORADSS");
                                    }
                                    if (country!=null) params.put("country", country);
                                    addresses.put(address, params);



                                  //Update establishment so we can link later
                                    String addr = (String) establishments.get(fei).get("address");
                                    if (!address.equals(addr)){
                                        //if (addr!=null) console.log(addr, address);
                                        establishments.get(fei).put("address", address);
                                    }
                                }
                                else{
                                    establishmentsWithoutAddresses.put(fei, values.get("Name & Address"));
                                }


                            }
                        }




                    }
                    catch(Exception e){
                        console.log("Failed to parse row " + rowID + " in " + sheetName);
                    }

                }
                rowID++;
            }
        }

        workbook.close();
        is.close();

        System.out.println("Done!");


        console.log("Found " + establishments.size() + " establishments");
        console.log("Found " + addresses.size() + " addresses");
        int numEstablishmentsWithAddresses = 0;
        Iterator<Long> i2 = establishments.keySet().iterator();
        while (i2.hasNext()){
            Long fei = i2.next();
            Map<String, Object> params = establishments.get(fei);
            String address = (String) params.get("address");
            if (address!=null){
                numEstablishmentsWithAddresses++;
            }
        }
        console.log("Found " + numEstablishmentsWithAddresses + " establishments with addresses");
        console.log("Found " + establishmentsWithoutAddresses.size() + " establishments without addresses");


        /*
        i2 = establishmentsWithoutAddresses.keySet().iterator();
        while (i2.hasNext()){
            Long fei = i2.next();
            String address = establishmentsWithoutAddresses.get(fei);
            console.log(fei, address);
        }
        */

//if (true){
//    int numAddressesWithoutCoords = 0;
//    Iterator<String> it = addresses.keySet().iterator();
//    while (it.hasNext()){
//        String address = it.next();
//        Map<String, Object> params = addresses.get(address);
//        Object lat = params.get("lat");
//        Object lon = params.get("lon");
//        if (lat==null || lon==null){
//            System.out.println(address);
//            //System.out.println("-----------------");
//            numAddressesWithoutCoords++;
//        }
//    }
//    console.log(numAddressesWithoutCoords);
//    return;
//}


      //Start console logger
        AtomicLong recordCounter = new AtomicLong(0);
        long totalRecords = addresses.size()+establishments.size()+numEstablishmentsWithAddresses;
        StatusLogger statusLogger = new StatusLogger(recordCounter, new AtomicLong(totalRecords));



        Session session = null;

        try{
            session = database.getSession();

          //Create unique key constraint
            try{ session.run("CREATE CONSTRAINT ON (n:address) ASSERT n.address IS UNIQUE"); }
            catch(Exception e){}
            try{ session.run("CREATE CONSTRAINT ON (n:import_establishment) ASSERT n.fei IS UNIQUE"); }
            catch(Exception e){}


          //Create indexes
            try{ session.run("CREATE INDEX idx_address IF NOT EXISTS FOR (n:address) ON (n.address)"); }
            catch(Exception e){}
            try{ session.run("CREATE INDEX idx_import_establishment IF NOT EXISTS FOR (n:import_establishment) ON (n.fei)"); }
            catch(Exception e){}

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
        }



      //Create address nodes
        ConcurrentHashMap<String, Long> addressNodes = new ConcurrentHashMap<>();
        ThreadPool pool = new ThreadPool(numThreads){
            public void process(Object obj){
                Map<String, Object> params = (Map<String, Object>) obj;
                String nodeName = "address";

                StringBuilder stmt = new StringBuilder("CREATE (a:" + nodeName + " {");
                Iterator<String> it = params.keySet().iterator();
                while (it.hasNext()){
                    String param = it.next();
                    stmt.append(param);
                    stmt.append(": $");
                    stmt.append(param);
                    if (it.hasNext()) stmt.append(" ,");
                }
                stmt.append("}) RETURN id(a)");


              //Create node
                try{
                    Long nodeID;
                    try{
                        nodeID = getSession().run(stmt.toString(), params).single().get(0).asLong();
                    }
                    catch(Exception e){
                        nodeID = getIdFromError(e);
                    }

                    synchronized(addressNodes){
                        addressNodes.put(params.get("address").toString(), nodeID);
                        addressNodes.notify();
                    }
                }
                catch(Exception e){
                    console.log(e.getMessage());
                }

                recordCounter.incrementAndGet();
            }

            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();

        Iterator<String> it = addresses.keySet().iterator();
        while (it.hasNext()){
            String address = it.next();
            Map<String, Object> params = addresses.get(address);
            pool.add(params);
        }

        pool.done();
        pool.join();

        //console.log("Created " + addressNodes.size() + " addressNodes");


      //Create establishment nodes
        ConcurrentHashMap<Long, Long> links = new ConcurrentHashMap<>();
        pool = new ThreadPool(numThreads){
            public void process(Object obj){
                Map<String, Object> params = (Map<String, Object>) obj;
                String nodeName = "import_establishment";
                String address = (String) params.remove("address");
                Long addressID = null;
                if (address!=null){
                    addressID = addressNodes.get(address);
                }


                StringBuilder stmt = new StringBuilder("CREATE (a:" + nodeName + " {");
                Iterator<String> it = params.keySet().iterator();
                while (it.hasNext()){
                    String param = it.next();
                    stmt.append(param);
                    stmt.append(": $");
                    stmt.append(param);
                    if (it.hasNext()) stmt.append(" ,");
                }
                stmt.append("}) RETURN id(a)");


              //Create node
                try{
                    Long establishmentID;
                    try{
                        establishmentID = getSession().run(stmt.toString(), params).single().get(0).asLong();
                    }
                    catch(Exception e){
                        establishmentID = getIdFromError(e);
                    }

                    if (addressID!=null){
                        synchronized(links){
                            links.put(establishmentID, addressID);
                            links.notify();
                        }
                    }
                }
                catch(Exception e){
                    console.log(e.getMessage());
                }

                recordCounter.incrementAndGet();
            }

            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();

        i2 = establishments.keySet().iterator();
        while (i2.hasNext()){
            Long fei = i2.next();
            Map<String, Object> params = establishments.get(fei);
            pool.add(params);
        }

        pool.done();
        pool.join();


        //console.log("Found " + links.size() + " relationships");

      //Create relationships
        pool = new ThreadPool(numThreads){
            public void process(Object obj){
                Object[] arr = (Object[]) obj;
                Long establishmentID = (Long) arr[0];
                Long addressID = (Long) arr[1];


              //Create relationship
                try{

                    getSession().run("MATCH (r),(s) WHERE id(r) =" + establishmentID + " AND id(s) = " + addressID +
                    " MERGE(r)-[:has]->(s)");

                }
                catch(Exception e){
                    console.log(e.getMessage());
                }

                recordCounter.incrementAndGet();
            }

            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();

        i2 = links.keySet().iterator();
        while (i2.hasNext()){
            Long establishmentID = i2.next();
            Long addressID = links.get(establishmentID);
            pool.add(new Object[]{establishmentID, addressID});
        }

        pool.done();
        pool.join();


      //Clean up
        statusLogger.shutdown();
    }


  //**************************************************************************
  //** getShipmentsByPortOfUnlading
  //**************************************************************************
    public void getShipmentsByPortOfUnlading(Integer portOfEntryID, javaxt.io.File importsSummary) throws Exception {
        HashMap<Integer, HashMap<String, LinkedHashMap<String, Double>>> shipmentsByPortOfUnlading = new HashMap<>();
        java.io.BufferedReader br = importsSummary.getBufferedReader();
        String row;
        while ((row = br.readLine()) != null){
            CSV.Columns columns = CSV.getColumns(row, ",");
            Integer portOfEntry = columns.get(1).toInteger();
            Integer portOfUnlading = columns.get(2).toInteger();
            String countryOfOrigin = columns.get(3).toString();
            String carrierType = columns.get(4).toString();

            if (portOfEntry!=portOfEntryID) continue;
            if (portOfUnlading==null) portOfUnlading = -1;

            HashMap<String, LinkedHashMap<String, Double>> shipmentsByCountry = shipmentsByPortOfUnlading.get(portOfUnlading);
            if (shipmentsByCountry==null){
                shipmentsByCountry = new HashMap<>();
                shipmentsByPortOfUnlading.put(portOfUnlading, shipmentsByCountry);
            }


            LinkedHashMap<String, Double> shipmentMethods = shipmentsByCountry.get(countryOfOrigin);
            if (shipmentMethods==null){
                shipmentMethods = new LinkedHashMap<>();
                shipmentMethods.put("air", 0.0);
                shipmentMethods.put("sea", 0.0);
                shipmentMethods.put("land", 0.0);
                shipmentMethods.put("other", 0.0);
                shipmentMethods.put("n/a", 0.0);
                shipmentsByCountry.put(countryOfOrigin, shipmentMethods);
            }
            if (carrierType==null || carrierType.isEmpty()) carrierType = "n/a";
            Double sum = shipmentMethods.get(carrierType);
            sum++;
            shipmentMethods.put(carrierType,sum);
        }
        br.close();


        Iterator<Integer> i2 = shipmentsByPortOfUnlading.keySet().iterator();
        while (i2.hasNext()){
            Integer portOfUnlading = i2.next();

            HashMap<String, LinkedHashMap<String, Double>> shipmentsByCountry = shipmentsByPortOfUnlading.get(portOfUnlading);
            Iterator<String> it = shipmentsByCountry.keySet().iterator();
            while (it.hasNext()){
                String countryOfOrigin = it.next();
                LinkedHashMap<String, Double> shipmentMethods = shipmentsByCountry.get(countryOfOrigin);
                Double air = shipmentMethods.get("air");
                Double sea = shipmentMethods.get("sea");
                Double land = shipmentMethods.get("land");
                Double other = shipmentMethods.get("other");
                Double na = shipmentMethods.get("n/a");
                row = portOfUnlading + "," + countryOfOrigin + "," + air + "," + sea + "," + land + "," + other + "," + na;
                System.out.println(row);
            }


        }
    }


  //**************************************************************************
  //** geocodeAddresses
  //**************************************************************************
  /** Used to add lat/lon coordinates to address nodes
   *  @param csvFile Optional CSV file with addresses and coordinates from a
   *  previous geocoding run.
   */
    public static void geocodeAddresses(Neo4J database, javaxt.io.File csvFile) throws Exception {


      //Count address that don't have coordinates
        String query = "MATCH (n:address)\n" +
        "WHERE n.lat is null or n.lon is null\n";
        AtomicLong totalRecords = new AtomicLong();
        Session session = null;
        try {
            session = database.getSession();
            Result rs = session.run(query + "RETURN count(n)");
            if (rs.hasNext()){
                Record record = rs.next();
                totalRecords.set(record.get(0).asLong());
            }
            session.close();
        }
        catch (Exception e) {
            if (session != null) session.close();
        }
        if (totalRecords.get()==0) return;
        console.log(totalRecords + " addresses missing coordinates");


      //Start console logger
        AtomicLong recordCounter = new AtomicLong(0);
        StatusLogger statusLogger = new StatusLogger(recordCounter, totalRecords);



      //Parse CSV file as needed
        ConcurrentHashMap<String, BigDecimal[]> coords = new ConcurrentHashMap<>();
        if (csvFile!=null){
            java.io.BufferedReader br = csvFile.getBufferedReader();

          //Parse header and find address, lat, and lon fields
            Integer addressField = null;
            Integer latField = null;
            Integer lonField = null;
            String row = br.readLine();
            CSV.Columns columns = CSV.getColumns(row, ",");
            for (int i=0; i<columns.length(); i++){
                String fieldName = columns.get(i).toString();
                if (fieldName.equals("lat")) latField = i;
                if (fieldName.equals("lon")) lonField = i;
                if (fieldName.equals("address")) addressField = i;
            }

          //Extract addresses and coords
            if (addressField!=null && latField!=null && lonField!=null){
                while ((row = br.readLine()) != null){
                    try{
                        columns = CSV.getColumns(row, ",");
                        String address = columns.get(addressField).toString();
                        BigDecimal lat = columns.get(latField).toBigDecimal();
                        BigDecimal lon = columns.get(lonField).toBigDecimal();
                        if (lat==null || lon==null) continue;

                        if (address.endsWith(" US")){
                            address = address.substring(0, address.length()-2).trim();

                          //Ensure commas have a whitespace after them
                            address = address.replace(",", ", ");
                            while (address.contains("  ")){
                                address = address.replace("  ", " ");
                            }
                            address = address.trim();
                            if (address.endsWith(",")) address = address.substring(0, address.length()-1).trim();



                          //Check if address is a US territory
                            String territory = null;
                            Iterator<String> it = usTerritories.keySet().iterator();
                            while (it.hasNext()){
                                String t = it.next();
                                if (address.contains(" " + t + " ") || address.endsWith(" " + t)){
                                    territory = t;
                                    break;
                                }
                            }

                            if (territory==null){
                                address = StringUtils.trimUSAddress(address);
                            }
                        }
                        coords.put(address, new BigDecimal[]{lat,lon});
                    }
                    catch(Exception e){
                        //e.printStackTrace();
                    }
                }
            }
            br.close();
            console.log("Found " + coords.size() + " addresses with coords");
        }



      //Instantiate the ThreadPool
        AtomicLong geocodingRequests = new AtomicLong(0);
        ThreadPool pool = new ThreadPool(12){
            public void process(Object obj){
                Object[] arr = (Object[]) obj;
                Long id = (Long) arr[0];
                String address = (String) arr[1];

                BigDecimal[] point;
                synchronized(coords){
                    point = coords.get(address);
                }

                if (point==null){
                    try{
                        point = geocoder.getCoordinates(address);
                        if (point==null) throw new Exception("Failed to geocode address: " +address);
                        geocodingRequests.incrementAndGet();
                    }
                    catch(Exception e){
                        console.log(e.getMessage());
                    }
                }

                if (point!=null){

                    synchronized(coords){
                        coords.put(address, point);
                        coords.notify();
                    }

                    try{

                        StringBuilder stmt = new StringBuilder();
                        stmt.append("MATCH (a:address) WHERE id(a)=" + id + "\n");
                        stmt.append("SET a+= {");
                        stmt.append("lat: $lat,");
                        stmt.append("lon: $lon,");
                        stmt.append("geocoder: $geocoder");
                        stmt.append("}");

                        Map<String, Object> params = new LinkedHashMap<>();
                        params.put("lat", point[0].toString());
                        params.put("lon", point[1].toString());
                        params.put("geocoder", "Google");

                        getSession().run(stmt.toString(), params);
                    }
                    catch(Exception e){
                        //console.log(e.getMessage());
                    }
                }



                recordCounter.incrementAndGet();
            }

            private Session getSession() throws Exception {
                Session session = (Session) get("session");
                if (session==null){
                    session = database.getSession(false);
                    set("session", session);
                }
                return session;
            }

            public void exit(){
                Session session = (Session) get("session");
                if (session!=null){
                    session.close();
                }
            }
        }.start();



      //Add records to the ThreadPool
        try{
            session = database.getSession();
            Result rs = session.run(query + "RETURN id(n) as id, n.address as address");
            while (rs.hasNext()){
                Record r = rs.next();
                try{
                    Long id = r.get("id").asLong();
                    String address = r.get("address").asString();
                    pool.add(new Object[]{id, address});
                }
                catch(Exception e){
                    e.printStackTrace();
                }
            }
            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
        }



      //Notify the pool that we have finished added records and Wait for threads to finish
        pool.done();
        pool.join();


      //Clean up
        statusLogger.shutdown();

        console.log("Executed " + geocodingRequests.get() + " geocoding requests");


      //Output addresses and coordinates to a file
        if (csvFile!=null){
            javaxt.io.File output = new javaxt.io.File(csvFile.getDirectory(), csvFile.getName(false) + "-updates.csv");
            java.io.BufferedWriter writer = output.getBufferedWriter("UTF-8");
            writer.write("address,lat,lon");
            Iterator<String> it = coords.keySet().iterator();
            while (it.hasNext()){
                String address = it.next();
                BigDecimal[] point = coords.get(address);
                String lat = "";
                String lon = "";
                if (point!=null){
                    lat = point[0].toString();
                    lon = point[1].toString();
                }
                writer.write("\r\n");
                if (address.contains(",")) address = "\""+address+"\"";
                writer.write(address+","+lat+","+lon);
            }
            writer.close();
        }
    }


  //**************************************************************************
  //** geocodeCompanies
  //**************************************************************************
    public void geocodeCompanies(javaxt.io.File file) throws Exception {

        HashSet<String> addresses = new HashSet<>();
        ConcurrentHashMap<String, BigDecimal[]> coords = new ConcurrentHashMap<>();
        HashMap<String, HashMap<String, String[]>> companies = new HashMap<>();


      //Parse file and generate unique list of addresses by company type
        java.io.InputStream is = file.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        int rowID = 0;
        /*
        for (Row row : workbook.getSheetAt(sheetID)){
            if (rowID>0){

                for (String type : establishmentTypes){
                    try{
                        Integer nameField = header.get(type + " Legal Name");
                        Integer addressField = header.get(type + " Name & Address");
                        Integer feiField = header.get(type + " FEI Number");

                      //Special case for DII
                        if (addressField==null) addressField = header.get(type + " Name and Address");

                        if (nameField==null||addressField==null||feiField==null) continue;

                        String name = row.getCell(nameField).getStringCellValue();
                        String address = row.getCell(addressField).getStringCellValue();
                        String fei = row.getCell(feiField).getStringCellValue();

                        if (address!=null){
                            address = address.trim();
                            if (!address.isEmpty()){
                                String addr = "";
                                for (String str : address.split("\n")){
                                    str = str.trim();
                                    if (str.isEmpty() || str.equals(fei) || str.equals(name)) continue;
                                    if (!addr.isEmpty()) addr += " ";
                                    addr += str;
                                }
                                if (!addr.isEmpty()){
                                    addresses.add(addr);

                                    HashMap<String, String[]> info = companies.get(type);
                                    if (info==null){
                                        info = new HashMap<>();
                                        companies.put(type, info);
                                    }
                                    info.put(addr, new String[]{name, fei});
                                }
                            }
                        }
                    }
                    catch(Exception e){
                        console.log("Failed to parse " + type + " at line " + rowID);
                    }
                }
            }
            rowID++;
        }
        */
        console.log("Found " + addresses.size() + " addresses");
        workbook.close();
        is.close();




      //Create ThreadPool to geocode addresses
        ThreadPool pool = new ThreadPool(12){
            public void process(Object obj){
                String address = obj.toString();
                try{
                    BigDecimal[] point = geocoder.getCoordinates(address);
                    if (point!=null){
                        synchronized(coords){
                            coords.put(address, point);
                            coords.notify();
                        }
                    }
                }
                catch(Exception e){
                    console.log(address);
                }
            }
        }.start();


      //Add manufacturers to the pool
        Iterator<String> it = addresses.iterator();
        while (it.hasNext()){
            String address = it.next();
            pool.add(address);
        }


      //Notify the pool that we have finished added records and wait for threads to complete
        pool.done();
        pool.join();


      //Dump results to a file
        for (String type : establishmentTypes){
            rowID = 0;
            javaxt.io.File output = new javaxt.io.File(file.getDirectory(), type + ".csv");
            java.io.BufferedWriter writer = output.getBufferedWriter("UTF-8");
            HashMap<String, String[]> info = companies.get(type);
            it = info.keySet().iterator();
            while (it.hasNext()){
                String address = it.next();
                String[] arr = info.get(address);
                String name = arr[0];
                String fei = arr[1];
                BigDecimal[] point = coords.get(address);
                String lat = "";
                String lon = "";
                if (point!=null){
                    lat = point[0].toString();
                    lon = point[1].toString();
                }

                if (rowID>0) writer.write("\r\n");
                name = replaceLineBreaks(name);
                if (name.contains(",")) name = "\""+name+"\"";
                address = replaceLineBreaks(address);
                if (address.contains(",")) address = "\""+address+"\"";
                writer.write(name+","+fei+","+address+","+lat+","+lon);
                rowID++;
            }
            writer.close();
        }
    }


  //**************************************************************************
  //** geocodePortsOfEntry
  //**************************************************************************
    public void geocodePortsOfEntry(javaxt.io.File file) throws Exception {

        HashMap<String, String> addresses = new HashMap<>();
        ConcurrentHashMap<String, BigDecimal[]> coords = new ConcurrentHashMap<>();


      //Parse file and generate unique list of addresses by company type
        java.io.InputStream is = file.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        int rowID = 0;
        /*
        for (Row row : workbook.getSheetAt(sheetID)){
            if (rowID>0){

                try{
                    Integer portField = header.get("Port of Entry Code & Name");
                    Integer stateField = header.get("Port of Entry State Code");


                    if (portField==null || stateField==null) continue;

                    String port = row.getCell(portField).getStringCellValue();
                    String state = row.getCell(stateField).getStringCellValue();

                    if (port!=null){
                        port = port.trim();
                        if (!port.isEmpty()){
                            int idx = port.indexOf(" - ");
                            if (idx>-1){
                                String entryCode = port.substring(0, idx).trim();
                                String entryName = port.substring(idx+3).trim();
                                addresses.put(entryName + ", " + state, entryCode);
                            }
                        }
                    }
                }
                catch(Exception e){
                    console.log("Failed to parse line " + rowID);
                }

            }
            rowID++;
        }
        */
        console.log("Found " + addresses.size() + " addresses");
        workbook.close();
        is.close();




      //Create ThreadPool to geocode addresses
        ThreadPool pool = new ThreadPool(12){
            public void process(Object obj){
                String address = obj.toString();
                try{
                    BigDecimal[] point = geocoder.getCoordinates(address);
                    if (point!=null){
                        synchronized(coords){
                            coords.put(address, point);
                            coords.notify();
                        }
                    }
                }
                catch(Exception e){
                    console.log(address);
                }
            }
        }.start();


      //Add manufacturers to the pool
        Iterator<String> it = addresses.keySet().iterator();
        while (it.hasNext()){
            String address = it.next();
            pool.add(address);
        }


      //Notify the pool that we have finished added records and wait for threads to complete
        pool.done();
        pool.join();


      //Dump results to a file
        rowID = 0;
        javaxt.io.File output = new javaxt.io.File(file.getDirectory(), "PortsOfEntry.csv");
        java.io.BufferedWriter writer = output.getBufferedWriter("UTF-8");
        it = addresses.keySet().iterator();
        while (it.hasNext()){
            String address = it.next();
            String id = addresses.get(address);
            BigDecimal[] point = coords.get(address);
            String lat = "";
            String lon = "";
            if (point!=null){
                lat = point[0].toString();
                lon = point[1].toString();
            }

            if (rowID>0) writer.write("\r\n");
            address = replaceLineBreaks(address);
            if (address.contains(",")) address = "\""+address+"\"";
            writer.write(id+","+address+","+lat+","+lon);
            rowID++;
        }
        writer.close();


    }


  //**************************************************************************
  //** replaceLineBreaks
  //**************************************************************************
    private static String replaceLineBreaks(String name){
        if (name==null) return "";
        name = name.replace("\r\n", " ");
        name = name.replace("\r", " ");
        name = name.replace("\n", " ");
        name = name.trim();
        while (name.contains("  ")){
            name = name.replace("  ", " ");
        }
        return name.trim();
    }


    /**
     * Checks for duplicate rows and creates a csv containing them.
     * @param files
     */
    public static void entries(javaxt.io.File[] files) {
        javaxt.io.File duplicatesLog = new javaxt.io.File("dups.csv");
        if(!duplicatesLog.exists()) {
            duplicatesLog.create();
        }

        LinkedHashMap<Integer, String> hashish = new LinkedHashMap<>();
        int totalRows = 0;
        try(java.io.BufferedWriter bWriter = duplicatesLog.getBufferedWriter("UTF-8")) {

            System.out.println("\n\nCounting unique entries... \n");

            for(javaxt.io.File file: files) {
                bWriter.write("\nProcessing file: "+file.getName()+",\n");bWriter.flush();
                try(java.io.InputStream is = file.getInputStream()) {

                    Workbook workbook = StreamingReader.builder()
                        .rowCacheSize(10)
                        .bufferSize(4096)
                        .open(is);

                    LinkedHashMap<String, Integer> header = new LinkedHashMap<>();
                    int rowID = 0;
                    int totalRecords = 0;
                    Sheet sheet = workbook.getSheet("Entry Report");
                    if(sheet == null) continue;

                    for (Row row : sheet) {

                        if (rowID==0){
                        //Parse header
                            int idx = 0;
                            for (Cell cell : row) {
                                header.put(cell.getStringCellValue(), idx);
                                idx++;
                            }

                        } else {
                            totalRows++;
                            Cell cell = row.getCell(header.get("Entry/DOC/Line"));
                            if(cell == null) continue;
                            String id = cell.getStringCellValue();
                            if (id!=null){
                                id = id.trim();
                                if (!id.isEmpty()){
                                    if(hashish.containsKey(id.hashCode())) {
                                        bWriter.write(id+",\n");bWriter.flush();
                                    } else {
                                        hashish.put(id.hashCode(), id);
                                    }
                                }
                            }
                        }
                        rowID++;
                    }
                } catch(Exception e) {
                    e.printStackTrace();
                }
            }
        }catch(Exception e) {
            e.printStackTrace();
        }
        System.out.println("\n\nFound "+ hashish.keySet().size()+" unique entries from "+  totalRows +" total entry rows. \n");

    }


    public static void findMissingRows(javaxt.io.File[] files, Neo4J database) {
        Integer missingKeys = 0;
        HashSet fromServer = new HashSet();

        javaxt.io.File missingLog = new javaxt.io.File("missing.csv");
        if(!missingLog.exists()) {
            missingLog.create();
        }

        try(java.io.BufferedWriter mWriter = missingLog.getBufferedWriter("UTF-8")) {

            try (Session session = database.getSession()) {
                List<org.neo4j.driver.Record> uniqueKeys = session.run("MATCH (n:import_line) return n.unique_key").list();
                System.out.println("unique keys: " + uniqueKeys.size());
                for(org.neo4j.driver.Record keyObj : uniqueKeys) {
                    String key = keyObj.get(0).asString().replaceAll("_","/");
                    fromServer.add(key);
                    //System.out.println("key: " + key);
                }
            }

            for(javaxt.io.File file: files) {
                System.out.println("\n\n Comparing file: "+ file.getName()+" \n");
                mWriter.write("\n\n Comparing file: "+ file.getName()+", \n");
                try(java.io.InputStream is = file.getInputStream()) {

                    Workbook workbook = StreamingReader.builder()
                        .rowCacheSize(10)
                        .bufferSize(4096)
                        .open(is);

                    LinkedHashMap<String, Integer> header = new LinkedHashMap<>();
                    int rowID = 0;
                    Sheet sheet = workbook.getSheet("Entry Report");
                    if(sheet == null) continue;
                    JSONArray jsonArray = new JSONArray();
                    for (Row row : sheet) {

                        if (rowID==0){
                        //Parse header
                            int idx = 0;
                            for (Cell cell : row) {
                                header.put(cell.getStringCellValue(), idx);
                                idx++;
                            }

                        } else {
                            Cell cell = row.getCell(header.get("Entry/DOC/Line"));
                            if(cell == null) continue;
                            String id = cell.getStringCellValue();
                            if (id!=null){
                                id = id.trim();
                                if (!id.isEmpty()){
                                    if(!fromServer.contains(id)) {
                                        mWriter.write(id + " ,\n");
                                        System.out.println(id+ " is missing from the server.");
                                    }
                                }
                            }
                        }
                        rowID++;
                    }


                } catch(Exception e) {
                    e.printStackTrace();
                }
            }
            mWriter.flush();
        }catch(Exception e) {
            e.printStackTrace();
        }
    }



    private static String getShortDate(String date){
        date = date.trim();
        String[] d = date.split("/");
        String year = d[2];
        String month = d[0];
        String day = d[1];
        if (month.length()==1) month = "0"+month;
        if (day.length()==1) day = "0"+day;
        return year + "-" + month + "-" + day;
    }


    private static String getKey(String field){
        String colName = field;
        while (colName.contains("  ")) colName = colName.replace("  ", " ");
        colName = colName.toLowerCase().replace(" ", "_");
        colName = colName.trim().toLowerCase();
        return colName;
    }
}