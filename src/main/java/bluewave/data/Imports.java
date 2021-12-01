package bluewave.data;
import bluewave.utils.GeoCoder;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.math.BigDecimal;

import javaxt.utils.ThreadPool;
import javaxt.express.utils.CSV;
import static javaxt.utils.Console.console;

import com.monitorjbl.xlsx.StreamingReader;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Cell;

//******************************************************************************
//**  Imports Data
//******************************************************************************
/**
 *   Used to ingest imports data
 * 
 ******************************************************************************/

public class Imports {
    
    private javaxt.io.File file;
    private LinkedHashMap<String, Integer> header;
    private GeoCoder geocoder;
    private int sheetID;
    private String[] companyTypes = new String[]{"Manufacturer","Shipper","Importer","Consignee","DII"};
    
    
  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public Imports(javaxt.io.File file) throws Exception {
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
            if (rowID>0){  
                
                try{
                
                    if (rowID>1) writer.write("\r\n");

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
                    writer.write(row.getCell(header.get("Product Code")).getStringCellValue()); 
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
                    for (int i=0; i<companyTypes.length; i++){
                        if (i>0) writer.write(",");
                        Integer feiField = header.get(companyTypes[i] + " FEI Number");
                        String fei = row.getCell(feiField).getStringCellValue();
                        writer.write(fei);
                    }
                
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
                
                for (String type : companyTypes){                
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
        for (String type : companyTypes){ 
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
        name = name.replace("\r\n", " ");
        name = name.replace("\r", " ");
        name = name.replace("\n", " ");
        name = name.trim();
        while (name.contains("  ")){
            name = name.replace("  ", " ");
        }
        return name;
    }    
}