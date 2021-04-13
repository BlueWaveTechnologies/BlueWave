package bluewave.utils;
import bluewave.web.Config;

//java includes
import java.util.*;

//javaxt includes
import javaxt.io.File;
import javaxt.json.*;
import static javaxt.utils.Console.console;
import javaxt.express.utils.CSV;

//fuzzywuzzy includes
import me.xdrop.fuzzywuzzy.FuzzySearch;


//******************************************************************************
//**  Geocoder
//******************************************************************************
/**
 *   Used to generate lat/lon coordinates for Hospitals found in the HHS report
 *   "COVID-19 Reported Patient Impact and Hospital Capacity by Facility"
 *   https://healthdata.gov/dataset/covid-19-reported-patient-impact-and-hospital-capacity-facility
 *
 *   The geocoder uses 3 different sources including DHS/HSIS, USGS, and Google.
 *   Google is a paid service and should be used as a last resort to avoid fees.
 *
 ******************************************************************************/

public class HospitalGeocoder {

    private HashMap<String, JSONObject> hospitals;
    private HashMap<String, ArrayList<JSONObject>> hospitalsByState;
    private HashMap<String, String> coords = new HashMap<>();


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public HospitalGeocoder(String csvFile) throws Exception {

      //Parse HHS file
        hospitals = new HashMap<>();
        java.io.BufferedReader br = new File(csvFile).getBufferedReader("UTF-8");
        br.readLine(); //Skip header
        String row;
        while ((row = br.readLine()) != null){
            CSV.Columns columns = CSV.getColumns(row, ",");
            JSONObject hospital = new JSONObject();
            String id = columns.get(0).toString();
            hospital.set("id", id);
            hospital.set("state", columns.get(2));
            hospital.set("name", columns.get(4).toString().replace(" & ", " and "));
            hospital.set("street", columns.get(5));
            hospital.set("city", columns.get(6));
            hospital.set("zip", columns.get(7));
            hospitals.put(id, hospital);
        }
        br.close();
        console.log("Found " + hospitals.size() + " hospitals");


      //Organize HHS data by state
        hospitalsByState = new HashMap<>();
        Iterator<String> it = hospitals.keySet().iterator();
        while (it.hasNext()){
            String id = it.next();
            JSONObject hospital = hospitals.get(id);
            String state = hospital.get("state").toString();
            ArrayList<JSONObject> arr = hospitalsByState.get(state);
            if (arr==null){
                arr = new ArrayList<>();
                hospitalsByState.put(state, arr);
            }
            arr.add(hospital);
        }
    }


  //**************************************************************************
  //** geocodeUSGS
  //**************************************************************************
    public void geocodeHSIN(String hsinFile) throws Exception {
        String geocoder = "HSIN";

        java.io.BufferedReader br = new File(hsinFile).getBufferedReader("UTF-8");
        br.readLine(); //Skip header
        String row;
        while ((row = br.readLine()) != null){
            CSV.Columns columns = CSV.getColumns(row, ",");
            String name = columns.get(4).toString().replace(" & ", " and ");
            String address = columns.get(5).toString();
            String city = columns.get(6).toString();
            String state = columns.get(7).toString();
            String zip = columns.get(8).toString();
            String county = columns.get(14).toString();
            String countyFIPS = columns.get(15).toString();
            String lat = columns.get(17).toString();
            String lon = columns.get(18).toString();


            int numMatches = 0;
            ArrayList<JSONObject> arr = hospitalsByState.get(state);
            if (arr==null) continue;
            for (JSONObject hospital : arr){
                String hospitalName = hospital.get("name").toString();
                String hospitalID = hospital.get("id").toString();
                if (coords.containsKey(hospitalID)) continue;

                if (hospitalName.equalsIgnoreCase(name)){
                    updateHospital(lat, lon, geocoder, hospital);
                    numMatches++;

                }
            }


            if (numMatches==0) {
                String a = name.toLowerCase(); //.replace("hospital", "");
                for (JSONObject hospital : arr){
                    String hospitalID = hospital.get("id").toString();
                    if (coords.containsKey(hospitalID)) continue;
                    try{
                        double cityScore = FuzzySearch.tokenSortPartialRatio(city, hospital.get("city").toString());
                        if (cityScore>90){
                            String hospitalName = hospital.get("name").toString();
                            String b = hospitalName.toLowerCase(); //.replace("hospital", "");
                            double wordScore = FuzzySearch.tokenSortPartialRatio(a, b);
                            if (wordScore>90){
                                updateHospital(lat, lon, geocoder, hospital);
                                break;
                            }
                        }
                    }
                    catch(Exception e){}
                }
            }


        }
        br.close();
        console.log("Matched " + coords.size() + " hospitals");

    }


  //**************************************************************************
  //** geocodeUSGS
  //**************************************************************************
    public void geocodeUSGS(String usgsFile) throws Exception {
        String geocoder = "USGS";

        java.io.BufferedReader br = new File(usgsFile).getBufferedReader("UTF-8");
        br.readLine(); //Skip header
        String row;
        while ((row = br.readLine()) != null){
            CSV.Columns columns = CSV.getColumns(row, "|");
            String name = columns.get(1).toString().replace(" & ", " and ");
            String feature = columns.get(2).toString();
            String state = columns.get(3).toString(); //2 char
            String county = columns.get(5).toString();
            String countyID = columns.get(6).toString();
            String lat = columns.get(9).toString();
            String lon = columns.get(10).toString();
            String city = columns.get(17).toString();

            int numMatches = 0;
            ArrayList<JSONObject> arr = hospitalsByState.get(state);
            if (arr==null) continue;
            for (JSONObject hospital : arr){
                String hospitalName = hospital.get("name").toString();
                String hospitalID = hospital.get("id").toString();
                if (coords.containsKey(hospitalID)) continue;

                if (hospitalName.equalsIgnoreCase(name)){
                    updateHospital(lat, lon, geocoder, hospital);
                    numMatches++;
                    if (!feature.equals("Hospital")) console.log(feature);
                }
            }

            if (numMatches==0 && (feature.equals("Hospital") || feature.equals("Building") || feature.equals("School"))) {
                String a = name.toLowerCase(); //.replace("hospital", "");
                for (JSONObject hospital : arr){
                    String hospitalID = hospital.get("id").toString();
                    if (coords.containsKey(hospitalID)) continue;
                    try{
                        double cityScore = FuzzySearch.tokenSortPartialRatio(city, hospital.get("city").toString());
                        if (cityScore>90){
                            String hospitalName = hospital.get("name").toString();
                            String b = hospitalName.toLowerCase(); //.replace("hospital", "");
                            double wordScore = FuzzySearch.tokenSortPartialRatio(a, b);
                            if (wordScore>90){
                                updateHospital(lat, lon, geocoder, hospital);
                                break;
                            }
                        }
                    }
                    catch(Exception e){}
                }
            }


        }
        br.close();
        console.log("Matched " + coords.size() + " hospitals");
    }


  //**************************************************************************
  //** geocodeGoogle
  //**************************************************************************
    public void geocodeGoogle(){
        String geocoder = "Google";
        String apiKey = Config.get("google").get("maps").get("key").toString();

        Iterator<String> it = hospitals.keySet().iterator();
        while (it.hasNext()){
            String id = it.next();

            if (!coords.containsKey(id)){
                JSONObject hospital = hospitals.get(id);

                String street = hospital.get("street").toString();
                String city = hospital.get("city").toString();
                String state = hospital.get("state").toString();
                String zip = hospital.get("zip").toString();

                String address = street + ", " + city + ", " + state + " " + zip;
                //console.log(address);


              //Construct url to hit the google maps geocoding service:
                StringBuffer url = new StringBuffer();
                url.append("https://maps.google.com/maps/api/geocode/json?");
                url.append("address=");
                url.append(address);
                url.append("&sensor=false");
                url.append("&key=");
                url.append(apiKey);


              //Send request to the geocoding service and parse response
                javaxt.http.Response response = new javaxt.http.Request(url.toString().replace(" ", "%20")).getResponse();
                JSONObject json = new JSONObject(response.getText());
                JSONArray results = json.get("results").toJSONArray();
                for (int i=0; i<results.length(); i++){
                    JSONObject result = results.get(i).toJSONObject();
                    JSONObject coords = result.get("geometry").get("location").toJSONObject();
                    coords.set("lon", coords.remove("lng"));
                    updateHospital(coords.get("lat").toString(), coords.get("lon").toString(), geocoder, hospital);
                    break;
                }


            }
        }

        console.log("Matched " + coords.size() + " hospitals");
    }

    public void geocodeGoogle(String csvFile) throws Exception{
        String geocoder = "Google";
        java.io.BufferedReader br = new File(csvFile).getBufferedReader("UTF-8");
        String row;
        while ((row = br.readLine()) != null){
            row = row.trim();
            if (row.length()==0) continue;

            CSV.Columns columns = CSV.getColumns(row, ",");
            String id = columns.get(0).toString();
            String lon = columns.get(1).toString();
            String lat = columns.get(2).toString();

            if (!coords.containsKey(id)){
                JSONObject hospital = hospitals.get(id);
                if (hospital==null){
                    hospital = hospitals.get("0" + id);
                }
                if (hospital==null){
                    console.log(id);
                    continue;
                }
                updateHospital(lat, lon, geocoder, hospital);
            }
        }
        br.close();
    }


  //**************************************************************************
  //** updateHospital
  //**************************************************************************
    private void updateHospital(String lat, String lon, String geocoder, JSONObject hospital){
        String hospitalID = hospital.get("id").toString();
        hospital.set("lat", lat);
        hospital.set("lon", lon);
        hospital.set("geocoder", geocoder);
        coords.put(hospitalID, lat + "," + lon);
    }


  //**************************************************************************
  //** toString
  //**************************************************************************
    public String toString(){
        StringBuilder str = new StringBuilder();

        Set<String> keys = hospitals.get(hospitals.keySet().iterator().next()).keySet(); //assumes first entry has all the keys!
        Iterator<String> i2 = keys.iterator();
        while (i2.hasNext()){
            str.append(i2.next());
            if (i2.hasNext()) str.append(",");
        }
        str.append("\r\n");


        Iterator<String> it = hospitals.keySet().iterator();
        while (it.hasNext()){
            String id = it.next();
            JSONObject hospital = hospitals.get(id);
            i2 = keys.iterator();
            while (i2.hasNext()){
                String key = i2.next();
                String val = hospital.get(key).toString();
                if (val==null){
                    str.append("null");
                }
                else{
                    if (val.contains(",")) val = "\"" + val + "\"";
                    str.append(val);
                }
                if (i2.hasNext()) str.append(",");
            }
            str.append("\r\n");
        }

        return str.toString();
    }



    public static void extractGoogleCoords(String csvFile) throws Exception {

        java.io.BufferedReader br = new File(csvFile).getBufferedReader("UTF-8");
        String row = br.readLine();
        while ((row = br.readLine()) != null){
            CSV.Columns columns = CSV.getColumns(row, ",");
            int numColumns = columns.length()-1;
            String geocoder = columns.get(numColumns).toString();
            if (geocoder.equalsIgnoreCase("Google")){
                String id = columns.get(0).toString();
                String lon = columns.get(numColumns-1).toString();
                String lat = columns.get(numColumns-2).toString();
                System.out.println(id + "," + lat + "," + lon);
            }
        }
        br.close();
    }
}