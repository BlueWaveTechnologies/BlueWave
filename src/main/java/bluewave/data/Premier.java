package bluewave.data;
import bluewave.graph.Import;
import static bluewave.graph.Import.UTF8_BOM;
import bluewave.graph.Neo4J;

import com.jcraft.jsch.*;
import com.jcraft.jsch.ChannelSftp.LsEntrySelector;
import com.jcraft.jsch.ChannelSftp.LsEntry;

import java.util.*;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.zip.GZIPInputStream;

import javaxt.json.JSONObject;
import static javaxt.utils.Console.console;
import javaxt.utils.ThreadPool;
import javaxt.express.utils.CSV;


//******************************************************************************
//**  Premier Data
//******************************************************************************
/**
 *   Used to download and ingest purchasing info from Premier. As of this
 *   writing, Premier publishes data in shards and posts it on a SFTP server.  
 *
 ******************************************************************************/

public class Premier {
    
    private static String host = "sdt.premierinc.com";
    private String username;
    private String password;
    private String remotePath;
    private TreeMap<String, LinkedHashMap<String, Long>> index = new TreeMap<>();
    
    
  //**************************************************************************
  //** Premier
  //**************************************************************************
    public Premier(String username, String password) throws Exception {
        this.username = username;
        this.password = password;
        this.remotePath = "/Cost/ABI/ABI_OUT/" + username.substring(3, username.length()-4);
        createIndex();
    }
    
    
  //**************************************************************************
  //** createIndex
  //**************************************************************************
  /** Used to generate a list of files available on the server, grouped by 
   *  date
   */
    private void createIndex() throws Exception {
        Session session = null;
        try{
            
          //Connect to the server
            session = getSession(username, password);
            ChannelSftp sftpChannel = getChannel(session);

          //Change directory
            sftpChannel.cd(remotePath);
            
          //Generate list of files
            LinkedHashMap<String, Long> files = new LinkedHashMap<>();
            sftpChannel.ls(remotePath, new LsEntrySelector() {
                public int select(LsEntry entry)  {
                    String filename = entry.getFilename();
                    if (filename.equals(".") || filename.equals("..")) {
                        return CONTINUE;
                    }
                    
                    SftpATTRS obj = entry.getAttrs();
                    Long size = obj.getSize();
                    if (obj.isLink()) {
                        //filelist.add(filename);
                    }
                    else if (obj.isDir()) {
                        //filelist.add(filename);
                    }
                    else {
                        files.put(filename, size);
                    }
                    return CONTINUE;
                }
            });
            
          //Close connection to the server
            sftpChannel.exit();
            session.disconnect();
            
            
            
            Iterator<String> it = files.keySet().iterator();
            while (it.hasNext()){
                String fileName = it.next();
                Long fileSize = files.get(fileName);
                String[] arr = fileName.split("_");
                if (arr.length>2){
                    String date = arr[2];
                    int idx = date.indexOf(".");
                    if (idx>0) date = date.substring(0, idx);
                    //System.out.println(date + "\t" + fileName);
                    LinkedHashMap<String, Long> entries = index.get(date);
                    if (entries==null){
                        entries = new LinkedHashMap<>();
                        index.put(date, entries);
                    }
                    entries.put(fileName, fileSize);
                }
            }
            
        }
        catch(Exception e){
            if (session!=null){
                try{
                    session.disconnect();
                }
                catch(Exception ex){}
            }
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** downloadShards
  //**************************************************************************
  /** Used to download latest shards to a local directory
   */
    public void downloadShards(String localPath) throws Exception {
        javaxt.io.Directory dir = new javaxt.io.Directory(localPath);
        if (!dir.exists()) dir.create();
        if (!dir.exists()) throw new Exception("Invalid path: " + localPath);
        
        Session session = null;
        try{
            
          //Connect to the server
            session = getSession(username, password);
            ChannelSftp sftpChannel = getChannel(session);

          //Change directory
            sftpChannel.cd(remotePath);
            
          //Download files
            LinkedHashMap<String, Long> entries = index.get(index.lastKey());
            Iterator<String> it = entries.keySet().iterator();
            while (it.hasNext()){
                String fileName = it.next();
                Long fileSize = entries.get(fileName);
                if (fileName.startsWith("txn_extract_")){
                    javaxt.io.File localFile = new javaxt.io.File(dir, fileName);
                    boolean downloadFile = !localFile.exists() || localFile.getSize()<fileSize;
                    if (downloadFile){
                        System.out.print("Downloading " + fileName + "...");
                        sftpChannel.get(fileName, localFile.toString());
                        System.out.println("Done!");
                    }
                }
            }
            
          //Close connection to the server
            sftpChannel.exit();
            session.disconnect();
            
        }
        catch(Exception e){
            if (session!=null){
                try{
                    session.disconnect();
                }
                catch(Exception ex){}
            }
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** importShards
  //**************************************************************************   
    public static void importShards(javaxt.io.Directory dir, Neo4J graph) throws Exception {
        
      //Find files and group by date
        TreeMap<String, LinkedHashMap<String, javaxt.io.File>> index = new TreeMap<>();
        for (javaxt.io.File file : dir.getFiles("txn_extract_*")){
            String fileName = file.getName(false);
            int idx = fileName.indexOf(".");
            if (idx>0) fileName = fileName.substring(0, idx);
            
            String[] arr = fileName.split("_");
            if (arr.length>2){
                String date = arr[2];
                LinkedHashMap<String, javaxt.io.File> entries = index.get(date);
                if (entries==null){
                    entries = new LinkedHashMap<>();
                    index.put(date, entries);
                }
                entries.put(fileName, file);
            }
        }
        
        
      //Load latest shards
        for (javaxt.io.File file : index.get(index.lastKey()).values()){
            importShard(file, graph);
        }
    }
    
    
  //**************************************************************************
  //** importShard
  //**************************************************************************       
    public static void importShard(javaxt.io.File file, Neo4J graph) throws Exception {
        java.io.BufferedReader br = getBufferedReader(file);

      //Parse header
        LinkedHashMap<String, Integer> header = new LinkedHashMap<>();
        String row = br.readLine();
        if (row.startsWith(UTF8_BOM)) {
            row = row.substring(1);
        }
        CSV.Columns columns = CSV.getColumns(row, ",");
        for (int i=0; i<columns.length(); i++){
            String colName = columns.get(i).toString();
            header.put(colName, i);
        }
        
        
      //Create thread used to transfer records to an input stream
        PipedInputStream in = new PipedInputStream();
        PipedOutputStream out = new PipedOutputStream(in);
        List queue = new LinkedList();
        Thread t = new Thread(
            new Runnable(){
                long numRecords = 0;
                public void run(){
                    while (true) {

                        Object obj = null;
                        synchronized (queue) {

                            while (queue.isEmpty()){
                                try{
                                    queue.wait();
                                }
                                catch(java.lang.InterruptedException e){
                                    break;
                                }
                            }
                            obj = queue.get(0);
                            if (obj!=null) queue.remove(0);
                            queue.notifyAll();
                        }
                        
                        try{
                            if (obj!=null){
                                if (numRecords==0) out.write("{\"transactions\":[".getBytes("UTF-8"));
                                else out.write(',');
                                out.write((byte[]) obj);
                                numRecords++;
                            }
                            else{
                                out.write(']');
                                out.write('}');
                                out.close();
                                return;
                            }
                        }
                        catch(Exception e){
                            e.printStackTrace();
                            return;
                        }
                    }
                }
            }
        );
        t.start();
        
        
      //Start seperate thread to import the json
        Thread t2 = new Thread(
            new Runnable(){
                public void run(){
                    try{
                        Import.importJSON(in, "premier", "transactions", graph);
                    }
                    catch(Exception e){
                        e.printStackTrace();
                    }
                }
            }
        );
        t2.start();
        
        
      //Create ThreadPool to parse entries in the file
        ThreadPool pool = new ThreadPool(12, 12){
            public void process(Object obj){
                String row = (String) obj;
                try{
                    CSV.Columns columns = CSV.getColumns(row, ",");
                    for (int i=0; i<columns.length(); i++){


                        String facilityLocationType = getVal("Location_Type", columns).toString();
                        
                        JSONObject json = new JSONObject();
                        json.set("key", getVal("Record_Key", columns));
                        String spendPeriod = getVal("Spend_Period", columns).toString();//4 digit year, 1 digit quarter and then two digit month
                        spendPeriod = spendPeriod.substring(0, 4) + "-" + spendPeriod.substring(5);
                        json.set("spend_period", spendPeriod);
                        json.set("landed_spend", getVal("Landed_Spend", columns));
                        json.set("product", getVal("Contract_Category", columns));
                        
                        
                        JSONObject facility = new JSONObject();
                        facility.set("code", getVal("Facility_Code", columns));
                        facility.set("type", getVal("Facility_Type", columns));
                        facility.set("size", getVal("Size", columns));
                        facility.set("service", getVal("Facility_Primary_Service_Type", columns));
                        
                        JSONObject location = new JSONObject();
                        location.set("census_region", getVal("Census_Region", columns));
                        location.set("census_division", getVal("Census_Division", columns));
                        facility.set("location", location);
                        
                        json.set("facility", facility);
                        
                        JSONObject vendor = new JSONObject();
                        json.set("vendor", vendor);
                        
                        console.log(json.toString(4));
                        
                        byte[] b = json.toString().getBytes("UTF-8");
                        synchronized (queue) {
                            queue.add(b);
                            queue.notify();
                        }
                    }
                }
                catch(Exception e){
                    e.printStackTrace();
                }
                
            }
            private javaxt.utils.Value getVal(String colName, CSV.Columns columns){
                return columns.get(header.get(colName));
            }
        }.start();
        
        
      //Insert records
        while ((row = br.readLine()) != null){
            pool.add(row);
        }
        
        
      //Notify the pool that we have finished added records and wait for threads to complete
        pool.done();
        pool.join();
        
        
      //Notify the writer that we're done 
        synchronized (queue) {
            queue.add(null);
            queue.notify();
        }
        
        
      //Wait for writer to finish
        t.join();
        t2.join();
    }
    
    
  //**************************************************************************
  //** getBufferedReader
  //**************************************************************************    
    private static java.io.BufferedReader getBufferedReader(javaxt.io.File file) throws Exception {
        String ext = file.getExtension();
        if (ext.equals("gz")){
            InputStream fileStream = file.getInputStream();
            InputStream gzipStream = new GZIPInputStream(fileStream);
            return new BufferedReader(new InputStreamReader(gzipStream, "UTF-8"));
        }
        else{
            return file.getBufferedReader("UTF-8");
        }
    }
    
    
  //**************************************************************************
  //** testConnect
  //**************************************************************************
  /** Used to connect to the SFTP server using the given credentials
   */
    public static void testConnect(String username, String password) throws Exception {
        Session session = null;
        try{
            session = getSession(username, password);
            ChannelSftp sftpChannel = getChannel(session);
            session.disconnect();
        }
        catch(Exception e){
            if (session!=null){
                try{
                    session.disconnect();
                }
                catch(Exception ex){}
            }
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** getSession
  //**************************************************************************
  /** Used to create a secure socket connection to a server
   */
    private static Session getSession(String username, String password) throws Exception {
        JSch jsch = new JSch();
        Session session = null;
        try {
            session = jsch.getSession(username, host, 22);
            session.setConfig("StrictHostKeyChecking", "no");
            session.setConfig("compression.s2c", "none"); 
            session.setPassword(password);
            session.connect();

            return session;
        } 
        catch (Exception e) {
            if (session!=null){
                try{
                    session.disconnect();
                }
                catch(Exception ex){}
            }
            throw e;
        }
    }
    
    
  //**************************************************************************
  //** getChannel
  //**************************************************************************
  /** Used to connect a SFTP server using a secure socket connection
   */
    private static ChannelSftp getChannel(Session session) throws Exception {
        try {
            Channel channel = session.openChannel("sftp");
            channel.connect();
            ChannelSftp sftpChannel = (ChannelSftp) channel;
            return sftpChannel;
        } 
        catch (Exception e) {
            throw e;
        }
    }
}
