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

//******************************************************************************
//**  SupplyChainService
//******************************************************************************
/**
 *   Used to find, create, edit, and delete supply chain data (company,
 *   facility, product, etc). Leverages registrationlisting data from OpenFDA
 *
 ******************************************************************************/

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
            List<String> sourceIDs = new ArrayList<>();

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

                    Long sourceID = json.get("sourceID").toLong();
                    if (sourceID!=null) sourceIDs.add("'" + sourceID + "'");

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
                (sourceIDs.isEmpty() ? "" : "AND NOT(n.owner_operator_number IN[" + String.join(", ", sourceIDs) + "])\n") +
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

                JSONArray facilities = new JSONArray();
                HashSet<Long> facilityIDs = new HashSet<>();


                String query =
                "MATCH (company)-[:has]-(facility)\n" +
                "WHERE facility.companyID = " + companyID + "\n" +
                "RETURN id(facility) as id, properties(facility) as facility, company.sourceID as owner_operator_number";

                Session session = null;
                try{
                    session = graph.getSession();
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();
                        long nodeID = record.get("id").asLong();
                        JSONObject facility = new JSONObject();


                        Value val = record.get("facility");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            facility = new JSONObject(gson.toJson(val.asMap()));
                        }

                        Long fei = facility.get("sourceID").toLong();
                        if (fei!=null) facilityIDs.add(fei);


                        val = record.get("owner_operator_number");
                        if (!val.isNull()) ownerOperatorID = new javaxt.utils.Value(val.asObject()).toLong();


                        facility.set("id", nodeID);
                        facilities.add(facility);
                    }


                    JSONArray otherFacilities = getFacilities(ownerOperatorID, session);
                    for (int i=0; i<otherFacilities.length(); i++){
                        JSONObject facility = otherFacilities.get(i).toJSONObject();
                        Long fei = facility.get("fei_number").toLong();
                        if (!facilityIDs.contains(fei)){
                            facilities.add(facility);
                        }
                    }


                    session.close();

                    return new ServiceResponse(facilities);
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }
        }
        else{

            if (ownerOperatorID!=null){

                Session session = null;
                try{
                    session = graph.getSession();
                    JSONArray arr = getFacilities(ownerOperatorID, session);
                    session.close();
                    return new ServiceResponse(arr);
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }
            }
            else{
                return new ServiceResponse(400, "companyID or owner_operator_number is required");
            }
        }
    }


  //**************************************************************************
  //** getFacilities
  //**************************************************************************
  /** Returns facilities associated with a company in registrationlisting
   *  @param ownerOperatorID FDA-assigned unique id for a company
   */
    private JSONArray getFacilities(Long ownerOperatorID, Session session) throws Exception {
        JSONArray arr = new JSONArray();
        if (ownerOperatorID!=null){
            String query =
            "MATCH (n:registrationlisting_registration_owner_operator)-[:has]-(registrationlisting_registration_owner_operator_contact_address)\n" +
            "WHERE n.owner_operator_number='" + ownerOperatorID + "' " +
            "or registrationlisting_registration_owner_operator_contact_address.owner_operator_number='" + ownerOperatorID + "'\n" +
            "RETURN id(registrationlisting_registration_owner_operator_contact_address) as id, " +
            "properties(registrationlisting_registration_owner_operator_contact_address) as facility";

            Result rs = session.run(query);
            while (rs.hasNext()){
                Record record = rs.next();
                JSONObject json = new JSONObject();


                Value val = record.get("facility");
                if (!val.isNull()){
                    Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                    json = new JSONObject(gson.toJson(val.asMap()));
                }

                arr.add(json);
            }
        }
        return arr;
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



      //Create or update facility
        Session session = null;
        try{
            session = graph.getSession();


            if (facilityID==null){

                List<String> properties = new ArrayList<>();
                properties.add("name: '" + facilityName + "'");
                properties.add("companyID: '" + companyID + "'");
                if (sourceID!=null) properties.add("sourceID: '" + sourceID + "'");


              //Create facility
                String query = "CREATE (a:facility {" + String.join(", ", properties) + "}) RETURN id(a)";
                Result result = session.run(query);
                if (result.hasNext()) {
                    facilityID = result.single().get(0).asLong();
                }


              //Link facility to company
                query = "MATCH (r), (s) WHERE id(r) =" + companyID + " AND id(s) = " + facilityID + " MERGE(r)-[:has]->(s)";
                session.run(query);


                if (sourceID!=null){
                    //link facility node to registrationlisting?
                }

            }
            else{
                if (sourceID==null){
                    //update facility

                    HashMap<String, Object> updates = new HashMap<>();

                    String query = "MATCH (n:facility)\n" +
                    "WHERE id(n) = " + facilityID + "\n" +
                    "RETURN properties(n) as facility";

                    Result rs = session.run(query);
                    if (rs.hasNext()){
                        Record record = rs.next();
                        Value val = record.get("facility");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            JSONObject company = new JSONObject(gson.toJson(val.asMap()));
                            String name = company.get("name").toString();
                            if (facilityName!=null){
                                facilityName = facilityName.trim();
                                if (!facilityName.equals(name)){
                                    updates.put("name", facilityName);
                                }
                            }
                        }
                    }

                    if (!updates.isEmpty()){
                        StringBuilder stmt = new StringBuilder();
                        stmt.append("MATCH (n:facility) WHERE id(n) = " + facilityID + "\n");
                        Iterator<String> it = updates.keySet().iterator();
                        while (it.hasNext()){
                            String key = it.next();
                            Object val = updates.get(key);
                            stmt.append("SET n." + key + " = '" + val + "'\n");
                        }
                        Result result = session.run(query);
                        if (result.hasNext()) {
                            facilityID = result.single().get(0).asLong();
                        }
                    }

                }
                else{
                    //update registrationlisting and facility?
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

            JSONArray products = new JSONArray();
            HashSet<String> productCodes = new HashSet<>();

            String query =
            "MATCH (n:facility)-[:has]-(product)\n" +
            "WHERE n.facilityID = " + facilityID + "\n" +
            "RETURN id(product) as id, n.sourceID as fei, properties(n) as product";

            Session session = null;
            try{
                session = graph.getSession();
                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();
                    long nodeID = record.get("id").asLong();
                    JSONObject product = new JSONObject();


                    Value val = record.get("product");
                    if (!val.isNull()){
                        Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                        product = new JSONObject(gson.toJson(val.asMap()));
                    }

                    String productCode = product.get("code").toString();
                    if (productCode!=null) productCodes.add(productCode);


                    val = record.get("fei");
                    if (!val.isNull()) fei = new javaxt.utils.Value(val.asObject()).toLong();


                    product.set("id", nodeID);

                    products.add(product);
                }



                JSONArray otherProducts = getProducts(fei, session);
                for (int i=0; i<otherProducts.length(); i++){
                    JSONObject product = otherProducts.get(i).toJSONObject();
                    String productCode = product.get("product_code").toString();
                    if (!productCodes.contains(productCode)){
                        products.add(product);
                    }
                }


                session.close();

                return new ServiceResponse(products);
            }
            catch (Exception e) {
                if (session != null) session.close();
                return new ServiceResponse(e);
            }
        }
        else{
            if (fei!=null){

                Session session = null;
                try{
                    session = graph.getSession();
                    JSONArray arr = getProducts(fei, session);
                    session.close();
                    return new ServiceResponse(arr);
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }

            }
            else{ //Search openFDA

                String name = request.getParameter("name").toString();
                if (name==null) return new ServiceResponse(400, "Product name, facilityID, or fei is required");

                Long limit = request.getParameter("limit").toLong();
                if (limit==null || limit<1 || limit>50) limit = 10L;

                JSONArray products = new JSONArray();

                Session session = null;
                try{
                    String query = "MATCH (n:registrationlisting_product_openfda)\n" +
                    "WHERE n.device_name CONTAINS '" + name + "'\n" +
                    "RETURN ID(n) as id, properties(n) as product " +
                    //"ORDER BY n.name\n" +
                    "LIMIT " + limit;
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();

                        Value val = record.get("product");
                        if (!val.isNull()){
                            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                            JSONObject json = new JSONObject(gson.toJson(val.asMap()));
                            products.add(json);
                        }
                    }

                    session.close();
                    return new ServiceResponse(products);
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }
            }
        }
    }


  //**************************************************************************
  //** getProducts
  //**************************************************************************
  /** Returns products associated with a facility in registrationlisting
   *  @param fei Facility Establishment Number. FDA-assigned unique id for a
   *  facility
   */
    private JSONArray getProducts(Long fei, Session session) throws Exception {
        JSONArray arr = new JSONArray();
        if (fei!=null){
            String query =
            //"MATCH (registrationlisting_registration)<-[:has]-(registrationlisting)-[:has]->(registrationlisting_product)-[:has]->(registrationlisting_product_openfda)\n" +
            //"WHERE registrationlisting_registration.fei_number = '" + fei + "'\n" +
            "MATCH (n:registrationlisting_registration {fei_number:\"" + fei + "\"})<-[:has]-(registrationlisting)-[:has]->(registrationlisting_product)-[:has]->(registrationlisting_product_openfda)\n" +
            "RETURN id(registrationlisting_product) as id," +
            "properties(registrationlisting) as registration, " +
            "properties(registrationlisting_product) as product, " +
            "properties(registrationlisting_product_openfda) as product_description";


            Result rs = session.run(query);
            while (rs.hasNext()){
                Record record = rs.next();
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

                arr.add(json);
            }
        }
        return arr;
    }


  //**************************************************************************
  //** saveProduct
  //**************************************************************************
    public ServiceResponse saveProduct(ServiceRequest request, Database database)
        throws ServletException, IOException {

      //Get user associated with the request
        bluewave.app.User user = (bluewave.app.User) request.getUser();


      //Prevent read-only users from saving
        if (user.getAccessLevel()<3) throw new ServletException(403, "Not Authorized");


      //Parse payload
        JSONObject json = request.getJson();
        Long productID = json.get("productID").toLong();
        String productName = json.get("name").toString();
        String productCode = json.get("code").toString();
        Long facilityID = json.get("facilityID").toLong();



      //Create or update product
        Session session = null;
        try{
            session = graph.getSession();

            if (productID==null){
                List<String> properties = new ArrayList<>();
                properties.add("name: '" + productName + "'");
                properties.add("code: '" + productCode + "'");
                properties.add("facilityID: '" + facilityID + "'");


              //Create facility
                String query = "CREATE (a:product {" + String.join(", ", properties) + "}) RETURN id(a)";
                Result result = session.run(query);
                if (result.hasNext()) {
                    productID = result.single().get(0).asLong();
                }


              //Link facility to company
                query = "MATCH (r), (s) WHERE id(r) =" + facilityID + " AND id(s) = " + productID + " MERGE(r)-[:has]->(s)";
                session.run(query);


              //Link to OpenFDA

            }

            session.close();

            return new ServiceResponse(productID+"");
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
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