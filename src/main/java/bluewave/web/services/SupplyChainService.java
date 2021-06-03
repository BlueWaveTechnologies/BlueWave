package bluewave.web.services;
import bluewave.graph.Neo4J;

import java.util.*;
import java.io.IOException;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;
import javaxt.sql.Database;
import javaxt.json.*;

import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.Value;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class SupplyChainService extends WebService {

    private Neo4J graph;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public SupplyChainService(Neo4J graph){
        this.graph = graph;
    }


  //**************************************************************************
  //** getCompanies
  //**************************************************************************
  /** Returns a list of companies that start with a given name. Searches both
   *  "company" nodes and "registrationlisting" nodes
   */
    public ServiceResponse getCompanies(ServiceRequest request, Database database)
        throws ServletException, IOException {

      //Parse parameters
        String name = request.getParameter("name").toString();
        if (name==null) return new ServiceResponse(400, "Name is required");

        Long limit = request.getParameter("limit").toLong();
        if (limit==null || limit<1 || limit>50) limit = 10L;


      //Execute queries and return response
        Session session = null;
        try {
            session = graph.getSession();


            HashMap<Long, JSONObject> companies = new HashMap<>();

          //Find companies in the company data
            try{
                String query = "MATCH (n:company)\n" +
                "WHERE n.name STARTS WITH '" + name + "'\n" +
                "RETURN ID(n) as id, properties(n) as company " +
                //"ORDER BY n.name\n" +
                "LIMIT " + limit;
                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();
                    long nodeID = record.get("id").asLong();
                    JSONObject json = new JSONObject();


                    Value val = record.get("company");
                    if (!val.isNull()){
                        Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                        json = new JSONObject(gson.toJson(val.asMap()));
                    }

                    json.set("id", nodeID);
                    companies.put(nodeID, json);
                }
            }
            catch (Exception e) {
                if (session != null) session.close();
                return new ServiceResponse(e);
            }


          //Find companies in the Registration & Listing data
            try {
                String query =
                "MATCH (n:registrationlisting_registration)-[:has]-(registrationlisting_registration_owner_operator)-[:has]-(registrationlisting_registration_owner_operator_contact_address)\n" +
                "WHERE n.name STARTS WITH '" + name + "'\n" +
                "RETURN distinct(id(n)) as id, \n" + //distinct() only reduces the number of duplicates
                "properties(n) as registrationlisting_registration,\n" +
                "registrationlisting_registration_owner_operator.owner_operator_number as owner_operator_number, \n" +
                "registrationlisting_registration_owner_operator.firm_name as firm_name, \n" +
                "registrationlisting_registration_owner_operator_contact_address.owner_operator_number as owner_operator_number2,\n" +
                "registrationlisting_registration_owner_operator_contact_address.firm_name as firm_name2\n" +
                "LIMIT " + (limit-companies.size());

                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();
                    long nodeID = record.get("id").asLong();
                    JSONObject json = new JSONObject();


                    Value val = record.get("registrationlisting_registration");
                    if (!val.isNull()){
                        Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                        json = new JSONObject(gson.toJson(val.asMap()));
                    }

                    Long ownerOperatorID = null;
                    val = record.get("owner_operator_number");
                    if (!val.isNull()) ownerOperatorID = new javaxt.utils.Value(val.asObject()).toLong();

                    if (ownerOperatorID==null){
                        val = record.get("owner_operator_number2");
                        if (!val.isNull()) ownerOperatorID = new javaxt.utils.Value(val.asObject()).toLong();
                    }


                    String firmName = null;
                    val = record.get("firm_name");
                    if (!val.isNull()) firmName = val.asString();

                    if (firmName==null){
                        val = record.get("firm_name2");
                        if (!val.isNull()) firmName = val.asString();
                    }

                    json.set("id", nodeID);
                    if (firmName!=null) json.set("name", firmName);
                    if (ownerOperatorID!=null) json.set("owner_operator_number", ownerOperatorID);
                    if (!companies.containsKey(nodeID)) companies.put(nodeID, json);
                }
            }
            catch (Exception e) {
                if (session != null) session.close();
                return new ServiceResponse(e);
            }




          //Close session
            session.close();



          //Sort companies by company name
            TreeMap<String, JSONObject> sortedCompanies = new TreeMap<>();
            Iterator<Long> it = companies.keySet().iterator();
            while (it.hasNext()){
                long nodeID = it.next();
                JSONObject json = companies.get(nodeID);
                String key = json.get("name").toString();
                if (key==null) key = "";
                key += "_" + nodeID;
                sortedCompanies.put(key, json);
            }



          //Create json output
            StringBuilder str = new StringBuilder("[");
            Iterator<String> i2 = sortedCompanies.keySet().iterator();
            while (i2.hasNext()){
                String key = i2.next();
                JSONObject json = sortedCompanies.get(key);
                str.append(json.toString());
                if (i2.hasNext()) str.append(",");
            }
            str.append("]");


          //Return response
            ServiceResponse response = new ServiceResponse(str.toString());
            response.setContentType("application/json");
            return response;
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** saveCompany
  //**************************************************************************
    public ServiceResponse saveCompany(ServiceRequest request, Database database)
        throws ServletException, IOException {

      //Get user associated with the request
        bluewave.app.User user = (bluewave.app.User) request.getUser();


      //Prevent read-only users from saving
        if (user.getAccessLevel()<3) throw new ServletException(403, "Not Authorized");


      //Parse payload
        JSONObject json = request.getJson();
        Long companyID = json.get("id").toLong();
        String companyName = json.get("name").toString();
        Long sourceID = json.get("sourceID").toLong(); //owner_operator_number



      //Create or update company
        Session session = null;
        try{
            session = graph.getSession();


            if (companyID==null){

                List<String> properties = new ArrayList<>();
                properties.add("name: '" + companyName + "'");
                if (sourceID!=null) properties.add("sourceID: '" + sourceID + "'");


                String query = "CREATE (a:company {" + String.join(", ", properties) + "}) RETURN id(a)";
                Result result = session.run(query);
                if (result.hasNext()) {
                    companyID = result.single().get(0).asLong();
                }

                if (sourceID!=null){
                    //link company node to registrationlisting_registration_owner_operator?
                }

            }
            else{
                if (sourceID==null){
                    //update company

                    HashMap<String, Object> updates = new HashMap<>();

                    String query = "MATCH (n:company)\n" +
                    "WHERE id(n) = " + companyID + "\n" +
                    "RETURN properties(n) as company";
                    Result rs = session.run(query);
                    if (rs.hasNext()){
                        Record record = rs.next();
                        Value val = record.get("company");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            JSONObject company = new JSONObject(gson.toJson(val.asMap()));
                            String name = company.get("name").toString();
                            if (companyName!=null){
                                companyName = companyName.trim();
                                if (!companyName.equals(name)){
                                    updates.put("name", companyName);
                                }
                            }
                        }
                    }

                    if (!updates.isEmpty()){
                        StringBuilder stmt = new StringBuilder();
                        stmt.append("MATCH (n:company) WHERE id(n) = " + companyID + "\n");
                        Iterator<String> it = updates.keySet().iterator();
                        while (it.hasNext()){
                            String key = it.next();
                            Object val = updates.get(key);
                            stmt.append("SET n." + key + " = '" + val + "'\n");
                        }
                        Result result = session.run(query);
                        if (result.hasNext()) {
                            companyID = result.single().get(0).asLong();
                        }
                    }

                }
                else{
                    //update registrationlisting and company?
                    throw new Exception("Not Implemented");
                }
            }

            session.close();

            return new ServiceResponse(200, companyID+"");
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getFacilities
  //**************************************************************************
  /** Returns a list of facilities associated with a given company. Searches
   *  both "facility" nodes and "registrationlisting" nodes
   */
    public ServiceResponse getFacilities(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long companyID = request.getParameter("companyID").toLong();
        Long ownerOperatorID = request.getParameter("owner_operator_number").toLong();

        if (companyID!=null){
                JSONArray arr = new JSONArray();

                String query = "MATCH (n:facility)\n" +
                "WHERE n.companyID = " + companyID + "\n" +
                "RETURN id(n) as id, properties(n) as facility";

                Session session = null;
                try{
                    session = graph.getSession();
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();
                        long nodeID = record.get("id").asLong();
                        JSONObject json = new JSONObject();


                        Value val = record.get("facility");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            json = new JSONObject(gson.toJson(val.asMap()));
                        }


                        json.set("id", nodeID);
                        arr.add(json);
                    }
                    session.close();
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }

                return new ServiceResponse(arr);
        }
        else{
            if (ownerOperatorID!=null){
                JSONArray arr = new JSONArray();

                String query =
                "MATCH (n:registrationlisting_registration_owner_operator)-[:has]-(registrationlisting_registration_owner_operator_contact_address)\n" +
                "WHERE n.owner_operator_number='" + ownerOperatorID + "' " +
                "or registrationlisting_registration_owner_operator_contact_address.owner_operator_number='" + ownerOperatorID + "'\n" +
                "RETURN id(registrationlisting_registration_owner_operator_contact_address) as id, " +
                "properties(registrationlisting_registration_owner_operator_contact_address) as facility";

                Session session = null;
                try{
                    session = graph.getSession();

                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();
                        long nodeID = record.get("id").asLong();
                        JSONObject json = new JSONObject();


                        Value val = record.get("facility");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            json = new JSONObject(gson.toJson(val.asMap()));
                        }


                        json.set("id", nodeID);
                        arr.add(json);
                    }

                    session.close();
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }

                return new ServiceResponse(arr);

            }
            else{
                return new ServiceResponse(400, "companyID or owner_operator_number is required");
            }
        }
    }


  //**************************************************************************
  //** saveFacility
  //**************************************************************************
    public ServiceResponse saveFacility(ServiceRequest request, Database database)
        throws ServletException, IOException {

      //Get user associated with the request
        bluewave.app.User user = (bluewave.app.User) request.getUser();


      //Prevent read-only users from saving
        if (user.getAccessLevel()<3) throw new ServletException(403, "Not Authorized");


      //Parse payload
        JSONObject json = request.getJson();
        Long facilityID = json.get("id").toLong();
        Long companyID = json.get("companyID").toLong(); //company node id
        String facilityName = json.get("name").toString();
        Long sourceID = json.get("sourceID").toLong(); //fei_number



      //Create or update company
        Session session = null;
        try{
            session = graph.getSession();


            if (facilityID==null){

                List<String> properties = new ArrayList<>();
                properties.add("name: '" + facilityName + "'");
                properties.add("companyID: '" + companyID + "'");
                if (sourceID!=null) properties.add("sourceID: '" + sourceID + "'");



                String query = "CREATE (a:facility {" + String.join(", ", properties) + "}) RETURN id(a)";
                Result result = session.run(query);
                if (result.hasNext()) {
                    facilityID = result.single().get(0).asLong();
                }

                if (sourceID!=null){
                    //link company node to registrationlisting_registration_owner_operator?
                }

            }
            else{
                if (sourceID==null){
                    //update company

                    String query = "MATCH (n:facility)\n" +
                    "WHERE id(n) = " + companyID + "\n" +
                    "RETURN properties(n)";


                }
                else{
                    //update registrationlisting and company?
                    throw new Exception("Not Implemented");
                }
            }

            session.close();

            return new ServiceResponse(200, facilityID+"");

        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** getProducts
  //**************************************************************************
  /** Returns a list of products associated with a given facility. Searches
   *  both "product" nodes and "registrationlisting" nodes
   */
    public ServiceResponse getProducts(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long facilityID = request.getParameter("facilityID").toLong();
        Long fei = request.getParameter("fei").toLong();

        if (facilityID!=null){

        }
        else{
            if (fei!=null){
                JSONArray arr = new JSONArray();

                String query =
                "MATCH (registrationlisting_registration)<-[:has]-(registrationlisting)-[:has]->(registrationlisting_product)-[:has]->(registrationlisting_product_openfda)\n" +
                "WHERE registrationlisting_registration.fei_number = '" + fei + "'\n" +
                "RETURN id(registrationlisting_product) as id," +
                "properties(registrationlisting) as registration, " +
                "properties(registrationlisting_product) as product, " +
                "properties(registrationlisting_product_openfda) as product_description";

                Session session = null;
                try{
                    session = graph.getSession();

                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();
                        long nodeID = record.get("id").asLong();
                        JSONObject json = new JSONObject();


                        Value val = record.get("product");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            json = new JSONObject(gson.toJson(val.asMap()));
                        }

                        val = record.get("product_description");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            JSONObject productInfo = new JSONObject(gson.toJson(val.asMap()));
                            Iterator<String> it = productInfo.keySet().iterator();
                            while (it.hasNext()){
                                String key = it.next();
                                json.set(key, productInfo.get(key));
                            }
                        }

                        val = record.get("registration");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            JSONObject productInfo = new JSONObject(gson.toJson(val.asMap()));
                            Iterator<String> it = productInfo.keySet().iterator();
                            while (it.hasNext()){
                                String key = it.next();
                                json.set(key, productInfo.get(key));
                            }
                        }


                        json.set("id", nodeID);
                        arr.add(json);
                    }

                    session.close();
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }

                return new ServiceResponse(arr);

            }
            else{
                return new ServiceResponse(400, "facilityID or fei is required");
            }
        }

        return new ServiceResponse(501, "Not Implemented");
    }


  //**************************************************************************
  //** getNetwork
  //**************************************************************************
    public ServiceResponse getNetwork(ServiceRequest request, Database database)
        throws ServletException, IOException {
        return new ServiceResponse(501, "Not Implemented");
    }


  //**************************************************************************
  //** saveNetwork
  //**************************************************************************
    public ServiceResponse saveNetwork(ServiceRequest request, Database database)
        throws ServletException, IOException {
        return new ServiceResponse(501, "Not Implemented");
    }
}