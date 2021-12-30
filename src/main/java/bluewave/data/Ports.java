package bluewave.data;
import bluewave.graph.Neo4J;
import bluewave.utils.GeoCoder;
import bluewave.utils.StatusLogger;
import static bluewave.utils.StatusLogger.*;
import static bluewave.graph.Utils.*;

import java.util.concurrent.atomic.AtomicLong;
import java.math.BigDecimal;
import java.util.*;


import javaxt.express.utils.CSV;
import static javaxt.utils.Console.console;
import javaxt.utils.ThreadPool;

import org.neo4j.driver.Session;


//******************************************************************************
//**  Ports
//******************************************************************************
/**
 *   Used to download and ingest port data (e.g. US Ports of Entry)
 *
 ******************************************************************************/
public class Ports {

    private GeoCoder geocoder;

    public Ports(){
        geocoder = new GeoCoder();
    }

  //**************************************************************************
  //** downloadUSPortsofEntry
  //**************************************************************************
  /** Used to generate a list of ports of entry into the United States by
   *  scraping the US Custom and Border Protection website and geocoding
   *  addresses
   */
    public void downloadUSPortsofEntry(String output) throws Exception {
        javaxt.io.Directory dir = new javaxt.io.Directory(output);
        javaxt.io.File file = new javaxt.io.File(dir, "us_ports_of_entry.csv");
        java.io.BufferedWriter br = file.getBufferedWriter("UTF-8");
        br.write("id,type,state,name,address,lat,lon");


        String[] states = new String[]{"AL","AK","AZ","AR","CA","CO","CT","DE",
        "DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA",
        "MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH",
        "OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"};
        for (String state : states){
            //if (!state.equals("CA")) continue;

            String url = "https://www.cbp.gov/contact/ports/" + state.toLowerCase();

            try{
                javaxt.http.Response response = new javaxt.http.Request(url).getResponse();
                if (response.getStatus()!=200) throw new Exception();

                String html = response.getText();
                javaxt.html.Parser parser = new javaxt.html.Parser(html);
                javaxt.html.Element[] tbody = parser.getElementByAttributes(
                "table", "summary", "All Ports of Entry").getElementsByTagName("tbody");
                for (javaxt.html.Element tr : tbody[0].getElementsByTagName("tr")){
                    javaxt.html.Element[] td = tr.getElementsByTagName("td");
                    String name = td[0].getInnerText().trim();
                    String address = td[1].getInnerText().trim();

                    String id = null;
                    int idx = name.lastIndexOf("-");
                    if (idx>0){
                        id = name.substring(idx+1).trim();
                        name = name.substring(0, idx).trim();
                    }
                    if (name.contains(",")) name = "\"" + name + "\"";

                    address = address.replace("\r", " ");
                    address = address.replace("\n", " ");
                    address = address.trim();
                    while (address.contains("  ")) address = address.replace("  ", " ");

                    String lat = "";
                    String lon = "";
                    try{
                        BigDecimal[] point = geocoder.getCoordinates(address);
                        if (point!=null){
                            lat = point[0].toString();
                            lon = point[1].toString();
                        }
                    }
                    catch(Exception e){}

                    String type = ""; //land, sea, or air
                    if (address.toLowerCase().contains("airport")) type = "air";


                    if (address.contains(",")) address = "\"" + address + "\"";

                    String row = id + "," + type + "," + state + "," + name + "," + address + "," + lat + "," + lon;
                    br.write("\r\n");
                    br.write(row);
                }
            }
            catch(Exception e){
                console.log("Failed to download " + state);
            }
        }
        br.close();

    }


  //**************************************************************************
  //** loadUSPortsofEntry
  //**************************************************************************
    public static void loadUSPortsofEntry(javaxt.io.File csvFile, Neo4J database)
    throws Exception {


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
            try{ session.run("CREATE CONSTRAINT ON (n:port_of_entry) ASSERT n.id IS UNIQUE"); }
            catch(Exception e){}


          //Create indexes
            try{ session.run("CREATE INDEX idx_address IF NOT EXISTS FOR (n:address) ON (n.address)"); }
            catch(Exception e){}
            try{ session.run("CREATE INDEX idx_port_of_entry IF NOT EXISTS FOR (n:port_of_entry) ON (n.id)"); }
            catch(Exception e){}

            session.close();
        }
        catch(Exception e){
            if (session!=null) session.close();
        }



      //Instantiate the ThreadPool
        ThreadPool pool = new ThreadPool(20, 1000){
            public void process(Object obj){
                String row = (String) obj;
                try{

                  //Parse row
                    CSV.Columns columns = CSV.getColumns(row, ",");
                    Integer id = columns.get(0).toInteger();
                    String type = columns.get(1).toString();
                    String state = columns.get(2).toString();
                    String name = columns.get(3).toString();
                    String address = columns.get(4).toString();
                    String lat = columns.get(5).toString();
                    String lon = columns.get(6).toString();


                  //Get session
                    Session session = getSession();


                  //Create address
                    Map<String, Object> params = new LinkedHashMap<>();
                    params.put("address", address);
                    params.put("country", "US");
                    params.put("state", state);
                    params.put("lat", lat);
                    params.put("lon", lon);

                    Long addressID;
                    try{
                        String createAddress = getQuery("address", params);
                        addressID = session.run(createAddress, params).single().get(0).asLong();
                    }
                    catch(Exception e){
                        addressID = getIdFromError(e);
                    }


                  //Create port of entry
                    params = new LinkedHashMap<>();
                    params.put("id", id);
                    params.put("type", type);
                    params.put("state", state);
                    params.put("name", name);

                    Long portID;
                    try{
                        String createPort = getQuery("port_of_entry", params);
                        portID = session.run(createPort, params).single().get(0).asLong();
                    }
                    catch(Exception e){
                        portID = getIdFromError(e);
                    }


                  //Link port to address
                    session.run("MATCH (r),(s) WHERE id(r) =" + portID + " AND id(s) = " + addressID +
                    " MERGE(r)-[:has]->(s)");

                }
                catch(Exception e){
                    console.log(e.getMessage(), row);
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


      //Insert records
        java.io.BufferedReader reader = csvFile.getBufferedReader();
        String row = reader.readLine();  //skip header
        while ((row = reader.readLine()) != null){
            pool.add(row);
        }
        reader.close();


      //Notify the pool that we have finished added records and Wait for threads to finish
        pool.done();
        pool.join();



      //Clean up
        statusLogger.shutdown();
    }


}