package bluewave.data;
import bluewave.utils.GeoCoder;
import bluewave.graph.Neo4J;
import bluewave.utils.StatusLogger;
import static bluewave.graph.Utils.*;
import static bluewave.utils.StatusLogger.*;

import java.io.InputStream;
import java.io.FileInputStream;
import java.io.BufferedReader;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.math.BigDecimal;

import javaxt.json.*;
import javaxt.utils.ThreadPool;
import javaxt.express.utils.CSV;
import static javaxt.utils.Console.console;

import com.monitorjbl.xlsx.StreamingReader;
import com.monitorjbl.xlsx.impl.StreamingRow;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
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

    private javaxt.io.File file;
    private static LinkedHashMap<String, Integer> header;
    private GeoCoder geocoder;
    private int sheetID;
    private static String[] establishmentTypes = new String[]{
    "Manufacturer","Shipper","Importer","Consignee","DII"};


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ImportsV2(javaxt.io.File file) throws Exception {
        this.file = file;



      //Parse file
        java.io.InputStream is = file.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)    // number of rows to keep in memory (defaults to 10)
            .bufferSize(4096)     // buffer size to use when reading InputStream to file (defaults to 1024)
            .open(is);            // InputStream or File for XLSX file (required)

        try{
            int numSheets = workbook.getNumberOfSheets();
            for (int i=0; i<numSheets; i++){
                Sheet sheet = workbook.getSheetAt(i);
                String name = sheet.getSheetName();
                if (!name.equals("Query Summary")){
                    sheetID = i;
                    header = new LinkedHashMap<>();


                  //Parse header
                    for (Row row : sheet){
                        int idx = 0;
                        for (Cell cell : row) {
                            header.put(cell.getStringCellValue(), idx);
                            idx++;

                        }
                        break;
                    }


                    break;
                }
            }
        }
        catch(Exception e){
        }

        workbook.close();
        is.close();


        geocoder = new GeoCoder();
    }


  //**************************************************************************
  //** loadLines
  //**************************************************************************
  /** Used to create "import_line" nodes using select fields from the input
   *  xlsx file. Creates relationships to the "import_establishment" and
   *  "port_of_entry" nodes. Obviously these nodes need to be created BEFORE
   *  calling this function.
   */
    public static void loadLines(javaxt.io.File csvFile, Neo4J database) throws Exception {

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


      //Set node name
        String node = "import_line";


      //Compile query used to create nodes
        StringBuilder query = new StringBuilder("CREATE (a:" + node + " {");
        Iterator<String> it = fields.iterator();
        while (it.hasNext()){
            String param = it.next().replace(" ","_").toLowerCase();
            query.append(param);
            query.append(": $");
            query.append(param);
            if (it.hasNext()) query.append(" ,");
        }
        query.append("}) RETURN id(a)");



      //Create unique key constraint and index
        Session session = null;
        try{
            session = database.getSession();
            try{ session.run("CREATE CONSTRAINT ON (n:" + node + ") ASSERT n.unique_key IS UNIQUE"); }
            catch(Exception e){}
            try{ session.run("CREATE INDEX idx_" + node + " IF NOT EXISTS FOR (n:" + node + ") ON (n.unique_key)"); }
            catch(Exception e){}

            try{ session.run("CREATE CONSTRAINT ON (n:import_affirmation) ASSERT n.pm IS UNIQUE"); }
            catch(Exception e){}
            try{ session.run("CREATE INDEX idx_affirmation IF NOT EXISTS FOR (n:import_affirmation) ON (n.pm)"); }
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


                Long nodeID;
                try{
                    nodeID = getSession().run(query.toString(), params).single().get(0).asLong();
                }
                catch(Exception e){
                    nodeID = getIdFromError(e);
                    if (nodeID==null) e.printStackTrace();
                }
                if (nodeID==null) return;




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

                for (String port : new String[]{"port_of_entry","unladed_port"}){


                    Integer portID = json.get(port).toInteger();
                    if (portID!=null){
                        String link = "MATCH (r), (n:port_of_entry) WHERE id(r)=" + nodeID +
                        " and n.id="+portID+" MERGE(r)-[:" + port + "]->(n)";

                        try{
                            getSession().run(link);
                        }
                        catch(Exception e){
                            console.log(e.getMessage());
                        }
                    }
                }


              //Affirmation params
                params = new LinkedHashMap<>();
                String affirmation = json.get("affirmations").toString();
                if(affirmation != null && !affirmation.trim().isEmpty()) {
                    String[]pairs = null;
                    if(affirmation.contains(";")) {
                        pairs = affirmation.trim().split(";");
                        for(int i=0;i<pairs.length;i++) {
                            String[]parts = pairs[i].trim().split(" ");
                            if(parts.length == 2) params.put(parts[0].contains("#") ? parts[0].replaceAll("#","").trim().toLowerCase() : parts[0].trim().toLowerCase(), parts[1].trim());
                        }
                    } else if(affirmation.trim().contains(" ")) {
                        pairs = affirmation.trim().split(" ");
                        if(pairs != null) {
                            if(pairs.length == 2)  params.put(pairs[0].contains("#") ? pairs[0].replaceAll("#","").trim().toLowerCase() : pairs[0].trim().toLowerCase(), pairs[1].trim());
                        }
                    }



                    if(params.size() > 0) {
                        Long affirmationId;
                        String createAffirmations = getAffirmationsQuery("import_affirmation", params);

                        try{
                            affirmationId = getSession().run(createAffirmations, params).single().get(0).asLong();
                        }
                        catch(Exception e){
                            affirmationId = getIdFromError(e);
                        }


                        try {
                            getSession().run("MATCH (r),(s:import_affirmation) WHERE id(r) =" + nodeID + " AND id(s) = " + affirmationId +
                            " CREATE(r)-[:has]->(s)");
                        }catch(Exception e) {
                            e.printStackTrace();
                        }
                    }
                }


                recordCounter.incrementAndGet();
            }


            private String getAffirmationsQuery(String node, Map<String, Object> params){
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
        java.io.InputStream is = csvFile.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        int rowID = 0;
        for (Row row : workbook.getSheetAt(0)){
            if(row == null) break;

            if (rowID>0){
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
  //** exportSummary
  //**************************************************************************
  /** Used to export a csv file with select fields from the input xlsx file
   */
    public void exportSummary() throws Exception {
        javaxt.io.File output = new javaxt.io.File(this.file.getDirectory(), "ImportSummary.csv");
        java.io.BufferedWriter writer = output.getBufferedWriter("UTF-8");

        java.io.InputStream is = file.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        int rowID = 0;
        for (Row row : workbook.getSheetAt(sheetID)){
            if (rowID==0){
                    ArrayList<String> fields = new ArrayList<>(Arrays.asList(
                    "Entry","DOC","Line","Date","Port of Entry","Unladed Port","Country of Origin",
                    "Shipment Method","Product Code","Product Name","Quantity","Value"));
                    for (String establishment : establishmentTypes){
                        fields.add(establishment);
                    }
                    fields.add("Affirmations");
                    fields.add("Final Disposition");
                    fields.add("Predict Risk");
                    fields.add("Predict Score");

                    for (int i=0; i<fields.size(); i++){
                        if (i>0) writer.write(",");
                        writer.write(fields.get(i));
                    }
            }
            else {

                try{

                    writer.write("\r\n");


                  //Get entry
                    String entry = "";
                    String doc = "";
                    String line = "";
                    String id = row.getCell(header.get("Entry/DOC/Line")).getStringCellValue();
                    if (id!=null){
                        id = id.trim();
                        if (!id.isEmpty()){
                            String[] arr = id.split("/");
                            if (arr.length>0) entry = arr[0];
                            if (arr.length>1) doc = arr[1];
                            if (arr.length>2) line = arr[2];
                        }
                    }
                    writer.write(entry);
                    writer.write(",");
                    writer.write(doc);
                    writer.write(",");
                    writer.write(line);
                    writer.write(",");


                  //Get date
                    String date = row.getCell(header.get("Arrival Date")).getStringCellValue();
                    if (date!=null) date = date.trim();
                    if (date.isEmpty()) date = row.getCell(header.get("Submission Date")).getStringCellValue();
                    writer.write(date);
                    writer.write(",");


                  //Get port of entry code
                    String port = row.getCell(header.get("Port of Entry Code & Name")).getStringCellValue();
                    if (port!=null){
                        port = port.trim();
                        if (!port.isEmpty()){
                            int idx = port.indexOf(" - ");
                            if (idx>-1){
                                port = port.substring(0, idx).trim();
                            }
                        }
                    }
                    writer.write(port);
                    writer.write(",");


                  //Unladed Thru Port Code
                    String thruPort = row.getCell(header.get("Unladed Thru Port Code")).getStringCellValue();
                    writer.write(thruPort);
                    writer.write(",");


                  //Country of Origin
                    writer.write(row.getCell(header.get("Country Of Origin")).getStringCellValue());
                    writer.write(",");


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
                    writer.write(carrierType);
                    writer.write(",");


                  //Product code
                    String productCode = row.getCell(header.get("Product Code")).getStringCellValue();
                    String industryCode = row.getCell(header.get("Industry Code")).getStringCellValue();
                    if (productCode!=null){
                        if (productCode.startsWith(industryCode)){
                            productCode = productCode.substring(industryCode.length());
                        }
                    }
                    writer.write(productCode);
                    writer.write(",");


                  //Product name
                    String productName = row.getCell(header.get("Brand Name")).getStringCellValue();
                    if (productName!=null){
                        if (productName.contains(",")) productName = "\"" + productName + "\"";
                        writer.write(productName);
                    }
                    writer.write(",");


                  //Total reported quantity
                    writer.write(row.getCell(header.get("Reported Total Quantity")).getStringCellValue());
                    writer.write(",");


                  //Declared value in USD
                    String value = row.getCell(header.get("Value of Goods")).getStringCellValue();
                    if (value!=null) value = value.replace("$", "").replace(",", "");
                    writer.write(value);
                    writer.write(",");


                  //FEI
                    for (int i=0; i<establishmentTypes.length; i++){
                        if (i>0) writer.write(",");
                        Integer feiField = header.get(establishmentTypes[i] + " FEI Number");
                        String fei = row.getCell(feiField).getStringCellValue();
                        writer.write(fei);
                    }
                    writer.write(",");



                  //Affirmations
                    writer.write(row.getCell(header.get("All Affirmations")).getStringCellValue());
                    writer.write(",");

                  //Final Disposition
                    writer.write(row.getCell(header.get("Final Disposition Activity Description")).getStringCellValue());
                    writer.write(",");


                  //PREDICT Risk
                    writer.write(row.getCell(header.get("PREDICT Risk Percentile")).getStringCellValue());
                    writer.write(",");

                  //PREDICT Score
                    writer.write(row.getCell(header.get("PREDICT Total Risk Score")).getStringCellValue());


                }
                catch(Exception e){
                    console.log("Failed to parse row " + rowID);
                }

            }
            rowID++;
        }

        writer.close();
        workbook.close();
        is.close();
    }


  //**************************************************************************
  //** exportEstablishments
  //**************************************************************************
  /** Used to export a csv file with a unique list of establishments found
   *  in the input xlsx file
   */
    public void exportEstablishments() throws Exception {
        HashMap<String, HashSet<String>> companies = new HashMap<>();

      //Parse file and generate unique list of addresses by company type
        java.io.InputStream is = file.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        int rowID = 0;
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

                        if (name==null) name = "";
                        else name = name.trim();

                        if (address==null) address = "";
                        else address = address.trim();

                        if (fei==null) fei = "";
                        else fei = fei.trim();



                        String addr = "";
                        while (address.contains("  ")){
                            address = address.replace("  ", " ");
                        }
                        address = address.trim();
                        for (String str : address.split("\n")){
                            str = str.trim();
                            if (str.isEmpty() || str.equals(fei) || str.equals(name)) continue;
                            if (!addr.isEmpty()) addr += " ";
                            addr += str;
                        }

                        address = replaceLineBreaks(addr).trim();


                        if (address.startsWith(fei + " ")){
                            address = address.substring((fei + " ").length());
                        }
                        if (address.startsWith(name + " ")){
                            address = address.substring((name + " ").length());
                        }


                        HashSet<String> info = companies.get(fei);
                        if (info==null){
                            info = new HashSet<>();
                            companies.put(fei, info);
                        }
                        info.add(name + "\n" + address);

                    }
                    catch(Exception e){
                        console.log("Failed to parse " + type + " at line " + rowID);
                    }
                }
            }
            rowID++;
        }

        workbook.close();
        is.close();

        console.log("Found " + companies.size() + " establishments");




        javaxt.io.File output = new javaxt.io.File(this.file.getDirectory(), "Establishments.csv");
        java.io.BufferedWriter writer = output.getBufferedWriter("UTF-8");

        writer.write("fei,name,address");

        Iterator<String> it = companies.keySet().iterator();
        while (it.hasNext()){

            String fei = it.next();
            HashSet<String> info = companies.get(fei);
            if (info.size()>1) console.log(fei, info.size());

            Iterator<String> i2 = info.iterator();
            while (i2.hasNext()){
                String[] entry = i2.next().split("\n");
                String name = entry[0];
                String address = entry[1];

                writer.write("\r\n");

                name = replaceLineBreaks(name);
                if (name.contains(",")) name = "\""+name+"\"";
                address = replaceLineBreaks(address);
                if (address.contains(",")) address = "\""+address+"\"";
                writer.write(fei+","+name+","+address);
            }
        }
        writer.close();


    }


  //**************************************************************************
  //** geocodeEstablishments
  //**************************************************************************
  /** Used to add lat/lon coordinates to the Establishments.csv using results
   *  from a previous geocoding attempt using the geocodeCompanies() method.
   */
    public void geocodeEstablishments() throws Exception {

        javaxt.io.Directory dir = this.file.getDirectory();


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
    private static void _loadEstablishments(javaxt.io.File csvFile, Neo4J database, java.io.BufferedWriter errorWriter) throws Exception {

        System.out.println("\n\nLoading Establishments\n");
      //Count total records in the file
        AtomicLong totalRecords = new AtomicLong(0);
        if (true){
            System.out.print("Analyzing File...");
            long t = System.currentTimeMillis();
            java.io.BufferedReader br = csvFile.getBufferedReader();
            String row = br.readLine(); //skip header
            while ((row = br.readLine()) != null){
                totalRecords.incrementAndGet();
            }
            br.close();
            System.out.print(" Done!");
            System.out.println(
            "\nFound " + format(totalRecords.get()) + " records in " + getElapsedTime(t));
        }


      //Start console logger
        AtomicLong recordCounter = new AtomicLong(0);
        StatusLogger statusLogger = new StatusLogger(recordCounter, totalRecords);



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
                    if(fei == null || fei == 0) return;

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

                recordCounter.incrementAndGet();
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
        }.start();

        List<String> sheets = Arrays.asList("Entry Report", "Listing Report", "MFR Report", "Shipper Report", "Importer Report", "Consignee Report", "DII Report", "Exam Report", "Sample Report", "Joint Firm Report", "Query Summary");
        HashSet<String>establishmentSheetNames = new HashSet<>(Arrays.asList("MFR Report", "Shipper Report", "Importer Report", "Consignee Report", "DII Report"));
        // HashSet<String>establishmentSheetNames = new HashSet<>(Arrays.asList("MFR Report"));

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
                Iterator<String>iter = establishmentSheetNames.iterator();
                while(iter.hasNext()) {

                  sheetName = iter.next();
                  Sheet sheet = workbook.getSheet(sheetName);
                  if(sheet == null) continue;

                    JSONObject jsonRowObject = null;
                    JSONArray rowBuffer = null;
                    DataFormatter formatter = new DataFormatter();
                    boolean skippedHeaderRow = false;
                    rowNum = 0;
                    for (Row row : sheet){
                        rowNum++;
                        if(!skippedHeaderRow) {
                            skippedHeaderRow = true;
                            continue;
                        }
                        jsonRowObject = new JSONObject();
                        rowBuffer = new JSONArray();
                        Iterator<Cell> cellIter = row.cellIterator();
                        while(cellIter.hasNext()) {

                            Cell cell = cellIter.next();
                            if(cell.getCellType() == CellType.BLANK || cell.getCellType() == CellType._NONE) {
                                rowBuffer.add(" ");
                            }
                            else if(cell.getCellType() == CellType.BOOLEAN) {
                                rowBuffer.add(cell.getBooleanCellValue());
                            }
                            else if(cell.getCellType() == CellType.ERROR) {
                                rowBuffer.add(" ");
                            }
                            else if(cell.getCellType() == CellType.FORMULA) {
                                rowBuffer.add(" ");
                            }
                            else if(cell.getCellType() == CellType.NUMERIC) {
                                rowBuffer.add(cell.getNumericCellValue());
                            }
                            else if(cell.getCellType() == CellType.STRING) {
                               rowBuffer.add(cell.getStringCellValue());
                            }
                        }

                        jsonRowObject.set("sheet", sheetName);
                        jsonRowObject.set("row", rowBuffer);
                        pool.add(jsonRowObject);
                    }
                }
            }
          catch(Exception e){
            errorWriter.write("Sheet: " + sheetName + " row: "+rowNum+" " + e.toString());
            errorWriter.newLine();errorWriter.newLine();
          }

          workbook.close();
          is.close();

      //Notify the pool that we have finished added records and Wait for threads to finish
        pool.done();
        pool.join();

        System.out.println("\nSheets Processed: " + sheetsProcessed.toString());
      //Clean up
        statusLogger.shutdown();


    }

    public static void loadEstablishments(javaxt.io.File[] files, Neo4J database) {
        javaxt.io.File errorLog = new javaxt.io.File("loadEstablishmentsErrors.log");
        if(!errorLog.exists()) {
            errorLog.create();
        }

        try(java.io.BufferedWriter errorWriter = errorLog.getBufferedWriter("UTF-8")) {
            javaxt.utils.Date date = new javaxt.utils.Date();
            errorWriter.write("Begin: " + date);
            errorWriter.newLine();errorWriter.newLine();
            for(javaxt.io.File file : files) {
                _loadEstablishments(file, database, errorWriter);
            }
            date = new javaxt.utils.Date();
            errorWriter.newLine();
            errorWriter.write("End: " + date);
            errorWriter.flush();
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
        StatusLogger statusLogger = new StatusLogger(recordCounter, null);


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
                        "Sample Tracking Number	LAB CLASSIFICATION","LAB CLASSIFICATION DESCRIPTION","LAB CONCLUSION"

                    };

                    for (String field : fields){
                        try{
                            String val = row.getCell(header.get(field)).getStringCellValue();

                            String colName = field;
                            while (colName.contains("  ")) colName = colName.replace("  ", " ");
                            colName = colName.toLowerCase().replace(" ", "_");
                            colName = colName.trim().toLowerCase();

                            params.put(colName, val);
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
  //** geocodeCompanies
  //**************************************************************************
    public void geocodeCompanies() throws Exception {

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
            javaxt.io.File output = new javaxt.io.File(this.file.getDirectory(), type + ".csv");
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
    public void geocodePortsOfEntry() throws Exception {

        HashMap<String, String> addresses = new HashMap<>();
        ConcurrentHashMap<String, BigDecimal[]> coords = new ConcurrentHashMap<>();


      //Parse file and generate unique list of addresses by company type
        java.io.InputStream is = file.getInputStream();
        Workbook workbook = StreamingReader.builder()
            .rowCacheSize(10)
            .bufferSize(4096)
            .open(is);

        int rowID = 0;
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
        javaxt.io.File output = new javaxt.io.File(this.file.getDirectory(), "PortsOfEntry.csv");
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
    private String replaceLineBreaks(String name){
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