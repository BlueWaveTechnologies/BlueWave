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
  //** getCompany
  //**************************************************************************
    public ServiceResponse getCompany(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long companyID = request.getParameter("id").toLong();
        if (companyID==null) return new ServiceResponse(400, "ID is required");

        Session session = null;
        try {
            session = graph.getSession();

            JSONObject company = new JSONObject();

            String query = "MATCH (c:company)\n" +
            "WHERE id(c)=" + companyID + "\n" +
            "OPTIONAL MATCH (c)-[:source]->(o)-[:has]->(a:registrationlisting_registration_owner_operator_contact_address) \n" +
            "RETURN properties(c) as company, properties(o) as owner_operator, properties(a) as address";

            Result rs = session.run(query);
            if (rs.hasNext()){
                Record record = rs.next();
                company = getCompany(record);
                if (company.isEmpty()){
                    company = getJson(record.get("company"));
                }
            }
            session.close();

            if (company.isEmpty()) return new ServiceResponse(404);
            company.set("id", companyID);
            return new ServiceResponse(company);
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
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


            TreeMap<String, JSONObject> companies = new TreeMap<>();


          //Find companies in the company nodes
            try{
                String query = "MATCH (c:company)\n" +
                "WHERE toLower(c.name) STARTS WITH toLower(\"" + name + "\")\n" +
                "RETURN ID(c) as id, properties(c) as company " +
                "LIMIT " + limit;
                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();
                    long companyID = record.get("id").asLong();
                    JSONObject company = getJson(record.get("company"));
                    company.set("id", companyID);
                    companies.put(company.get("name").toString(), company);
                }
            }
            catch (Exception e) {
                if (session != null) session.close();
                return new ServiceResponse(e);
            }


          //Find companies in the Registration & Listing data
            try {
                String query =
                "MATCH (o:registrationlisting_registration_owner_operator)-[:has]->(a:registrationlisting_registration_owner_operator_contact_address)\n" +
                "WHERE toLower(o.firm_name) STARTS WITH toLower(\"" + name + "\")\n" +
                "RETURN properties(o) as owner_operator, properties(a) as address\n" +
                "LIMIT " + (limit-companies.size());

                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();
                    JSONObject company = getCompany(record);
                    companies.put(company.get("name").toString(), company);
                }
            }
            catch (Exception e) {
                if (session != null) session.close();
                return new ServiceResponse(e);
            }


          //Close session
            session.close();



          //Create json output
            StringBuilder str = new StringBuilder("[");
            Iterator<String> it = companies.keySet().iterator();
            while (it.hasNext()){
                String key = it.next();
                JSONObject json = companies.get(key);
                str.append(json.toString());
                if (it.hasNext()) str.append(",");
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
  //** getCompany
  //**************************************************************************
  /** Returns company info from the owner_operator and address nodes in the
   *  registrationlisting
   */
    private JSONObject getCompany(Record record){

        JSONObject company = getJson(record.get("owner_operator"));

        String companyName = company.get("firm_name").toString();
        if (companyName!=null){
            company.set("name", companyName);
            company.remove("firm_name");
        }

        JSONObject address = getJson(record.get("address"));
        Iterator<String> it = address.keySet().iterator();
        while (it.hasNext()){
            String key = it.next();
            company.set(key, address.get(key));
        }

        return company;
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


      //Validate inputs
        if (companyName!=null) companyName = companyName.trim();
        if (companyName==null || companyName.isEmpty()){
            if (sourceID==null){
                throw new ServletException(400, "Company name is required");
            }
        }


      //Create or update company
        Session session = null;
        try{
            session = graph.getSession();


            if (companyID==null){

              //Create new company node
                String query;
                if (sourceID==null){
                    List<String> properties = new ArrayList<>();
                    properties.add("name: '" + companyName + "'");
                    query = "CREATE (a:company {" + String.join(", ", properties) + "}) RETURN id(a)";
                }
                else{
                    query = "CREATE (a:company) RETURN id(a)";
                }

                Result result = session.run(query);
                if (result.hasNext()) companyID = result.single().get(0).asLong();


              //Link company node to registrationlisting_registration_owner_operator
                if (sourceID!=null){
                    session.run(
                    "MATCH (c),(o:registrationlisting_registration_owner_operator {owner_operator_number:\"" + sourceID + "\"}) " +
                    "WHERE id(c)=" + companyID + " MERGE(c)-[:source]->(o)"
                    );
                    //To confirm link, run something like this:
                    //MATCH (n:company) WHERE id(n)=12438225 MATCH (n)-[r]-(p) RETURN id(n), labels(n), type(r), labels(p)
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
                        JSONObject company = getJson(record.get("company"));
                        String name = company.get("name").toString();
                        if (companyName!=null){
                            companyName = companyName.trim();
                            if (!companyName.equals(name)){
                                updates.put("name", companyName);
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
                        session.run(query);
                    }

                }
                else{
                    //Do nothing. Ignore any updates. We don't want to modify the source data in the R&L
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
        if (companyID!=null){


                HashSet<Long> facilityIDs = new HashSet<>();


                String query =
                "MATCH (c:company)-[r:has]->(f:facility)\n" +
                "WHERE id(c) = " + companyID + "\n" +
                "OPTIONAL MATCH (f)-[:source]->(n)\n" +
                "OPTIONAL MATCH (c)-[:source]->(o)\n" +
                "RETURN id(f) as id, " +
                "properties(f) as facility, " +
                "properties(n) as registration, " +
                "o.owner_operator_number as owner_operator_number";


                Session session = null;
                try{

                    LinkedHashMap<Long, JSONObject> facilities = new LinkedHashMap<>();
                    Long ownerOperatorID = null;

                    session = graph.getSession();
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();
                        long facilityID = record.get("id").asLong();
                        JSONObject facility = getJson(record.get("registration"));
                        if (facility.isEmpty()){
                            facility = getJson(record.get("facility"));
                        }


                        Long fei = facility.get("fei_number").toLong();
                        if (fei!=null) facilityIDs.add(fei);


                        Value val = record.get("owner_operator_number");
                        if (!val.isNull()) ownerOperatorID = new javaxt.utils.Value(val.asObject()).toLong();


                        facility.set("id", facilityID);
                        facilities.put(facilityID, facility);
                    }


                    JSONArray arr = new JSONArray();
                    Iterator<Long> it = facilities.keySet().iterator();
                    while (it.hasNext()){
                        long nodeID = it.next();
                        JSONObject facility = facilities.get(nodeID);
                        arr.add(facility);
                    }


                    JSONArray otherFacilities = getFacilities(ownerOperatorID, session);
                    for (int i=0; i<otherFacilities.length(); i++){
                        JSONObject facility = otherFacilities.get(i).toJSONObject();
                        Long fei = facility.get("fei_number").toLong();
                        if (!facilityIDs.contains(fei)){
                            arr.add(facility);
                        }
                    }


                    session.close();

                    return new ServiceResponse(arr);
                }
                catch (Exception e) {
                    if (session != null) session.close();
                    return new ServiceResponse(e);
                }
        }
        else{

            Long ownerOperatorID = request.getParameter("owner_operator_number").toLong();
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
            LinkedHashMap<Long, JSONObject> facilities = new LinkedHashMap<>();

            String query = "MATCH (registration:registrationlisting_registration)-[:has]->"+
            "(n:registrationlisting_registration_owner_operator {owner_operator_number: '" + ownerOperatorID + "'})\n" +
            "RETURN id(registration) as id, properties(registration) as facility";


            Result rs = session.run(query);
            while (rs.hasNext()){
                Record record = rs.next();
                long nodeID = record.get("id").asLong();
                JSONObject facility = getJson(record.get("facility"));
                facilities.put(nodeID, facility);
            }


            Iterator<Long> it = facilities.keySet().iterator();
            while (it.hasNext()){
                long nodeID = it.next();
                JSONObject facility = facilities.get(nodeID);
                arr.add(facility);
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


      //Validate inputs
        if (facilityName!=null) facilityName = facilityName.trim();
        if (facilityName==null || facilityName.isEmpty()){
            if (sourceID==null) throw new ServletException(400, "Facility name is required");
        }
        if (companyID==null) throw new ServletException(400, "CompanyID is required");


      //Create or update facility
        Session session = null;
        try{
            session = graph.getSession();


            if (facilityID==null){

              //Create new facility node
                String query;
                if (sourceID==null){
                    List<String> properties = new ArrayList<>();
                    properties.add("name: '" + facilityName + "'");
                    query = "CREATE (a:facility {" + String.join(", ", properties) + "}) RETURN id(a)";
                }
                else{
                    query = "CREATE (a:facility) RETURN id(a)";
                }

                Result result = session.run(query);
                if (result.hasNext()) {
                    facilityID = result.single().get(0).asLong();
                }


              //Link facility to company
                query = "MATCH (c),(f) WHERE id(c)=" + companyID + " AND id(f) = " + facilityID + " MERGE(c)-[:has]->(f)";
                session.run(query);


              //Link facility node to the registrationlisting_registration node
                if (sourceID!=null){
                    session.run(
                    "MATCH (f),(n:registrationlisting_registration {fei_number:\"" + sourceID + "\"}) " +
                    "WHERE id(f)=" + facilityID + " MERGE(f)-[:source]->(n)"
                    );
                    //To confirm link, run something like this:
                    //MATCH (n:facility) WHERE id(n)=12438225 MATCH (n)-[r]-(p) RETURN id(n), labels(n), type(r), labels(p)
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
                        JSONObject facility = getJson(record.get("facility"));
                        String name = facility.get("name").toString();
                        if (facilityName!=null){
                            facilityName = facilityName.trim();
                            if (!facilityName.equals(name)){
                                updates.put("name", facilityName);
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
  /** Returns a unique list of product codes associated with a given facility.
   *  Searches both "product" nodes and "registrationlisting" nodes.
   */
    public ServiceResponse getProducts(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long facilityID = request.getParameter("facilityID").toLong();
        if (facilityID!=null){

            JSONArray products = new JSONArray();
            HashSet<String> productCodes = new HashSet<>();
            Long fei = null;

            String query =
            "MATCH (f:facility)-[:has]->(p:product)\n" +
            "WHERE id(f) = " + facilityID + "\n" +
            "OPTIONAL MATCH (f)-[:source]->(n)\n" + //link to registration
            "OPTIONAL MATCH (p)-[:has]->(o)\n" + //link to openFDA
            "RETURN id(p) as id, " +
            "properties(p) as product, " +
            "properties(o) as product_description, " +
            "n.fei_number as fei";

            Session session = null;
            try{
                session = graph.getSession();
                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();


                    long productID = record.get("id").asLong();
                    JSONObject product = getJson(record.get("product"));
                    product.set("id", productID);


                    String productCode = product.get("code").toString();
                    if (productCode!=null) productCodes.add(productCode);


                    Value val = record.get("fei");
                    if (!val.isNull()) fei = new javaxt.utils.Value(val.asObject()).toLong();


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

            Long fei = request.getParameter("fei").toLong();
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
                    session = graph.getSession();

                    TreeMap<String, JSONObject> uniqueProducts = new TreeMap<>();

                    String query = "MATCH (p:registrationlisting_product)-[:has]->(n:registrationlisting_product_openfda)\n" +
                    "WHERE toLower(n.device_name) CONTAINS toLower('" + name + "')\n" +
                    "RETURN distinct(n.regulation_number) as id, properties(n) as product, p.product_code as product_code \n" +
                    "LIMIT " + limit;
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();
                        JSONObject product = getJson(record.get("product"));
                        String productCode = null;
                        Value val = record.get("product_code");
                        if (!val.isNull()) productCode = val.asString();
                        product.set("product_code", productCode);
                        product.remove("k_number");



                        name = product.get("device_name").toString();
                        if (productCode==null) productCode = "ZZZ";
                        if (name==null) name = "ZZZ";
                        String key = name + "-" + productCode;
                        uniqueProducts.put(key, product);
                    }

                    session.close();



                    Iterator<String> it = uniqueProducts.keySet().iterator();
                    while (it.hasNext()){
                        JSONObject product = uniqueProducts.get(it.next());
                        products.add(product);
                    }


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
  /** Returns a list of products associated with a facility in registrationlisting
   *  @param fei Facility Establishment Number. FDA-assigned unique id for a
   *  facility
   */
    private JSONArray getProducts(Long fei, Session session) throws Exception {
        JSONArray arr = new JSONArray();
        if (fei!=null){

            String query =
            "MATCH (:registrationlisting_registration {fei_number:\"" + fei + "\"})<-[:has]-(r:registrationlisting)-[:has]->(p:registrationlisting_product)-[:has]->(o:registrationlisting_product_openfda)\n" +
            "RETURN " +
            "r.proprietary_name as proprietary_name, " +
            "p.product_code as product_code, " +
            "properties(o) as product";


            ArrayList<JSONObject> products = new ArrayList<>();
            HashSet<String> productCodes = new HashSet<>();

            Result rs = session.run(query);
            while (rs.hasNext()){
                Record record = rs.next();


                JSONObject product = getJson(record.get("product"));
                String productCode = null;
                Value val = record.get("product_code");
                if (!val.isNull()) productCode = val.asString();
                product.set("product_code", productCode);



                val = record.get("proprietary_name");
                if (val==null){
                    if (!productCodes.contains(productCode)) products.add(product);
                }
                else{
                    JSONArray names = new JSONArray();
                    String str = val.asString();
                    if (str.startsWith("[") && str.endsWith("]")){
                        try{
                            names = new JSONArray(val.asString());
                        }
                        catch(Exception e){
                            names = new JSONArray();
                            for (String s : str.substring(1, str.length()-1).split(",")){
                                names.add(s);
                            }
                        }
                    }


                    if (names.isEmpty()){
                        if (!productCodes.contains(productCode)) products.add(product);
                    }
                    else{
                        for (int i=0; i<names.length(); i++){
                            JSONObject p = new JSONObject(product.toString());
                            p.set("name", names.get(i));
                            products.add(p);
                        }
                    }
                }

                productCodes.add(productCode);
            }



            TreeMap<String, JSONObject> uniqueProducts = new TreeMap<>();
            for (int i=0; i<products.size(); i++){
                JSONObject product = products.get(i);
                String code = product.get("product_code").toString();
                String name = product.get("name").toString();
                if (code==null) code = "ZZZ";
                if (name==null) name = "ZZZ";
                String key = name + "-" + code;
                uniqueProducts.put(key, product);
            }

            Iterator<String> it = uniqueProducts.keySet().iterator();
            while (it.hasNext()){
                JSONObject product = uniqueProducts.get(it.next());
                arr.add(product);
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
        Long sourceID = json.get("sourceID").toLong(); //regulation_number


      //Validate inputs
        if (productName!=null) productName = productName.trim();
        if (productName==null || productName.isEmpty()) throw new ServletException(400, "Product name is required");
        if (facilityID==null) throw new ServletException(400, "Facility is required");


      //Create or update product
        Session session = null;
        try{
            session = graph.getSession();

            if (productID==null){
                List<String> properties = new ArrayList<>();
                properties.add("name: '" + productName + "'");
                if (productCode!=null) properties.add("code: '" + productCode + "'");



              //Create facility
                String query = "CREATE (a:product {" + String.join(", ", properties) + "}) RETURN id(a)";
                Result result = session.run(query);
                if (result.hasNext()) {
                    productID = result.single().get(0).asLong();
                }


              //Link facility to product
                query = "MATCH (f),(p) WHERE id(f) =" + facilityID + " AND id(p) = " + productID + " MERGE(f)-[:has]->(p)";
                session.run(query);


              //Link product to OpenFDA node
                if (sourceID!=null){
                    query = "MATCH (r), (s) WHERE id(r) =" + productID + " AND s.regulation_number ='" + sourceID + "' MERGE(r)-[:has]->(s)";
                    session.run(query);
                }
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


  //**************************************************************************
  //** getJson
  //**************************************************************************
    private static JSONObject getJson(Value val){
        JSONObject json = new JSONObject();
        if (!val.isNull()){
            Gson gson = new GsonBuilder().disableHtmlEscaping().create();
            json = new JSONObject(gson.toJson(val.asMap()));
        }
        return json;
    }
}