package bluewave.data;
import java.util.*;

import com.jcraft.jsch.*;
import com.jcraft.jsch.ChannelSftp.LsEntrySelector;
import com.jcraft.jsch.ChannelSftp.LsEntry;


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
