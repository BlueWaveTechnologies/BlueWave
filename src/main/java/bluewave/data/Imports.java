package bluewave.data;
import bluewave.utils.GeoCoder;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.math.BigDecimal;

import static javaxt.utils.Console.console;
import javaxt.utils.ThreadPool;

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
  //** geocodeCompanies
  //**************************************************************************
    public void geocodeCompanies() throws Exception {
        
        HashSet<String> addresses = new HashSet<>();
        ConcurrentHashMap<String, BigDecimal[]> coords = new ConcurrentHashMap<>();
        HashMap<String, HashMap<String, String[]>> companies = new HashMap<>();        
        String[] companyTypes = new String[]{"Manufacturer","Shipper","Importer","Consignee","DII"};
        
        
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
            if (address.contains(",")) address = "\""+address+"\"";                  
            writer.write(id+","+address+","+lat+","+lon);            
            rowID++;
        }
        writer.close();

        
    }      
}