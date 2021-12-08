package bluewave.data;
import bluewave.utils.GeoCoder;
import java.math.BigDecimal;
import java.util.*;
import static javaxt.utils.Console.console;

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
    
    
}