package bluewave.web.services;
import static bluewave.graph.Utils.*;

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


//******************************************************************************
//**  SupplyChainService
//******************************************************************************
/**
 *   Used to find, create, edit, and delete supply chain data (company,
 *   facility, product, etc). Leverages registrationlisting data from OpenFDA
 *
 ******************************************************************************/

public class SupplyChainService extends WebService {


  //**************************************************************************
  //** getCompany
  //**************************************************************************
    public ServiceResponse getCompany(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long companyID = request.getParameter("id").toLong();
        if (companyID==null) return new ServiceResponse(400, "ID is required");

        Session session = null;
        try {
            session = getSession(request);

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
            session = getSession(request);


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
                "OPTIONAL MATCH (c:company)-[:source]->(o)\n" +
                "RETURN properties(o) as owner_operator, properties(a) as address, id(c) as companyID\n" +
                "LIMIT " + (limit-companies.size());

                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();
                    JSONObject company = getCompany(record);

                    Long companyID = null;
                    Value val = record.get("companyID");
                    if (!val.isNull()) companyID = new javaxt.utils.Value(val.asObject()).toLong();
                    company.set("id", companyID);

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
        String companyName = getString(json.get("name"));
        Long sourceID = json.get("sourceID").toLong(); //owner_operator_number


      //Validate inputs
        if (companyName==null){
            if (sourceID==null){
                throw new ServletException(400, "Company name is required");
            }
        }


      //Create or update company
        Session session = null;
        try{
            session = getSession(request);


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
                        String name = getString(company.get("name"));
                        if (companyName!=null){
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
                            stmt.append("SET n." + key + " = ");
                            if (val==null) stmt.append("null\n");
                            else stmt.append("'" + val + "'\n");
                        }
                        session.run(stmt.toString());
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
  //** getFacility
  //**************************************************************************
    public ServiceResponse getFacility(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long facilityID = request.getParameter("id").toLong();
        if (facilityID==null) return new ServiceResponse(400, "ID is required");

        Session session = null;
        try {
            session = getSession(request);

            JSONObject facility = new JSONObject();

            String query = "MATCH (f:facility)\n" +
            "WHERE id(f)=" + facilityID + "\n" +
            "OPTIONAL MATCH (f)-[:source]->(n)\n" +
            "RETURN id(f) as id, " +
            "properties(f) as facility, " +
            "properties(n) as registration";


            Result rs = session.run(query);
            if (rs.hasNext()){
                Record record = rs.next();
                facility = getFacility(record);
            }
            session.close();

            if (facility.isEmpty()) return new ServiceResponse(404);
            facility.set("id", facilityID);
            return new ServiceResponse(facility);
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
    }

    private JSONObject getFacility(Record record){
        long facilityID = record.get("id").asLong();
        JSONObject facility = getJson(record.get("registration"));
        if (facility.isEmpty()){
            facility = getJson(record.get("facility"));
        }
        return facility;
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

                    session = getSession(request);
                    Result rs = session.run(query);
                    while (rs.hasNext()){
                        Record record = rs.next();
                        long facilityID = record.get("id").asLong();
                        JSONObject facility = getFacility(record);


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
                    session = getSession(request);
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
        String facilityName = getString(json.get("name"));
        String city = getString(json.get("city"));
        String state = getString(json.get("state"));
        String country = getString(json.get("country"));
        Long sourceID = json.get("sourceID").toLong(); //fei_number


      //Validate inputs
        if (facilityName==null){
            if (sourceID==null) throw new ServletException(400, "Facility name is required");
        }
        if (companyID==null) throw new ServletException(400, "CompanyID is required");

        if (state!=null){
            if (state.length()!=2) throw new ServletException(400, "Invalid state. 2 char state code is required");
        }

        if (country!=null){
            if (country.length()!=2) throw new ServletException(400, "Invalid country. 2 char country code is required");
        }


      //Create or update facility
        Session session = null;
        try{
            session = getSession(request);


            if (facilityID==null){

              //Create new facility node
                String query;
                if (sourceID==null){
                    List<String> properties = new ArrayList<>();
                    properties.add("name: '" + facilityName + "'");
                    if (city!=null) properties.add("city: '" + city + "'");
                    if (state!=null) properties.add("state: '" + state + "'");
                    if (country!=null) properties.add("country: '" + country + "'");
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
                        String name = getString(facility.get("name"));
                        if (facilityName!=null){
                            if (!facilityName.equals(name)){
                                updates.put("name", facilityName);
                            }
                        }
                        String cty = getString(facility.get("city"));
                        if (city!=null){
                            if (!city.equals(cty)){
                                updates.put("city", cty);
                            }
                        }
                        String st = getString(facility.get("state"));
                        if (state!=null){
                            if (!state.equals(st)){
                                updates.put("state", st);
                            }
                        }
                        String cntry = getString(facility.get("country"));
                        if (country!=null){
                            if (!country.equals(cntry)){
                                updates.put("country", cntry);
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
                            stmt.append("SET n." + key + " = ");
                            if (val==null) stmt.append("null\n");
                            else stmt.append("'" + val + "'\n");
                        }
                        session.run(stmt.toString());
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
  //** getProduct
  //**************************************************************************
    public ServiceResponse getProduct(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long productID = request.getParameter("id").toLong();
        if (productID==null) return new ServiceResponse(400, "ID is required");

        Session session = null;
        try {
            session = getSession(request);

            JSONObject product = new JSONObject();

            String query = "MATCH (p:product)\n" +
            "WHERE id(p)=" + productID + "\n" +
            "OPTIONAL MATCH (f)-[:source]->(n)\n" + //link to registration
            "RETURN id(p) as id, " +
            "properties(p) as product, " +
            "n.fei_number as fei";


            Result rs = session.run(query);
            if (rs.hasNext()){
                Record record = rs.next();
                product = getProduct(record);
            }
            session.close();

            if (product.isEmpty()) return new ServiceResponse(404);
            product.set("id", productID);
            return new ServiceResponse(product);
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
    }


    private JSONObject getProduct(Record record){
        JSONObject product = getJson(record.get("product"));
        return product;
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


            TreeMap<String, JSONObject> uniqueProducts = new TreeMap<>();
            Long fei = null;

            String query =
            "MATCH (f:facility)-[:has]->(p:product)\n" +
            "WHERE id(f) = " + facilityID + "\n" +
            "OPTIONAL MATCH (f)-[:source]->(n)\n" + //link to registration
            "RETURN id(p) as id, " +
            "properties(p) as product, " +
            "n.fei_number as fei";

            Session session = null;
            try{
                session = getSession(request);

              //Get products associated with the facility
                Result rs = session.run(query);
                while (rs.hasNext()){
                    Record record = rs.next();

                    long productID = record.get("id").asLong();
                    JSONObject product = getJson(record.get("product"));
                    product.set("id", productID);

                    String key = getProductKey(product);
                    uniqueProducts.put(key, product);

                    Value val = record.get("fei");
                    if (!val.isNull()) fei = new javaxt.utils.Value(val.asObject()).toLong();
                }



              //If the facility has no products, check in the facility has an fei number
                if (uniqueProducts.isEmpty()){
                    query =
                    "MATCH (f:facility)-[:source]->(n)\n" +
                    "WHERE id(f) = " + facilityID + "\n" +
                    "RETURN n.fei_number as fei";
                    rs = session.run(query);
                    if (rs.hasNext()){
                        Record record = rs.next();
                        Value val = record.get("fei");
                        if (!val.isNull()) fei = new javaxt.utils.Value(val.asObject()).toLong();
                    }
                }


              //Get products from registrationlisting using the fei number
                JSONArray otherProducts = getProducts(fei, session);
                for (int i=0; i<otherProducts.length(); i++){
                    JSONObject product = otherProducts.get(i).toJSONObject();
                    String key = getProductKey(product);
                    if (!uniqueProducts.containsKey(key)){
                        uniqueProducts.put(key, product);
                    }
                }


                session.close();


                JSONArray products = new JSONArray();
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
        else{

            Long fei = request.getParameter("fei").toLong();
            if (fei!=null){

                Session session = null;
                try{
                    session = getSession(request);
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
                    session = getSession(request);

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


                        String key = getProductKey(product);
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
                String key = getProductKey(product);
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
  //** getProductKey
  //**************************************************************************
    private String getProductKey(JSONObject product){

        String productName = product.get("name").toString();
        String productCode = product.get("code").toString();
        String productType = product.get("type").toString();

        if (productCode==null) productCode = product.get("product_code").toString();
        if (productType==null) productType = product.get("device_name").toString();


        if (productName==null) productName = "ZZZ";
        if (productCode==null) productCode = "ZZZ";
        if (productType==null) productType = "ZZZ";

        return productName + "-" + productType + "-" + productCode;
    }


  //**************************************************************************
  //** getProductCodes
  //**************************************************************************
    public ServiceResponse getProductCodes(ServiceRequest request, Database database)
        throws ServletException, IOException {

        String productCodes = request.getParameter("code").toString();
        if (productCodes==null) productCodes = "";
        else productCodes = productCodes.trim();


        Session session = null;
        try {
            session = getSession(request);

            JSONArray arr = new JSONArray();

            String query =
            "match (p:registrationlisting_product)-[]-(n:registrationlisting_product_openfda)\n" +
            (productCodes.isEmpty() ? "" : "where p.product_code in ['" + productCodes.replace(",", "','") + "']\n") +
            "return distinct(p.product_code) as product_code,\n" +
            "n.device_name, n.medical_specialty_description,\n" +
            "n.device_class, n.regulation_number";


            Result rs = session.run(query);
            while (rs.hasNext()){
                Record record = rs.next();
                JSONObject json = new JSONObject();

                for (String key : record.keys()){
                    Object val = record.get(key).asObject();
                    int idx = key.indexOf(".");
                    if (idx>-1) key = key.substring(idx+1);
                    json.set(key, val);
                }

                arr.add(json);
            }
            session.close();


            return new ServiceResponse(arr);
        }
        catch (Exception e) {
            if (session != null) session.close();
            return new ServiceResponse(e);
        }
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
        Long productID = json.get("id").toLong();
        String productName = getString(json.get("name"));
        String productType = getString(json.get("type"));
        String productCode = getString(json.get("code"));
        String productInventory = getString(json.get("inventory"));
        String productCapacity = getString(json.get("capacity"));
        String productLeadTime = getString(json.get("leadTime"));
        Long facilityID = json.get("facilityID").toLong();



      //Validate inputs
        if (productName==null) throw new ServletException(400, "Product name is required");
        if (facilityID==null) throw new ServletException(400, "Facility is required");


      //Create or update product
        Session session = null;
        try{
            session = getSession(request);

            if (productID==null){
                List<String> properties = new ArrayList<>();
                properties.add("name: '" + productName + "'");
                if (productType!=null) properties.add("type: '" + productType + "'");
                if (productCode!=null) properties.add("code: '" + productCode + "'");
                if (productInventory!=null) properties.add("inventory: '" + productInventory + "'");
                if (productCapacity!=null) properties.add("capacity: '" + productCapacity + "'");
                if (productLeadTime!=null) properties.add("leadTime: '" + productLeadTime + "'");


              //Create product
                String query = "CREATE (a:product {" + String.join(", ", properties) + "}) RETURN id(a)";
                Result result = session.run(query);
                if (result.hasNext()) {
                    productID = result.single().get(0).asLong();
                }


              //Link facility to product
                query = "MATCH (f),(p) WHERE id(f) =" + facilityID + " AND id(p) = " + productID + " MERGE(f)-[:has]->(p)";
                session.run(query);

            }
            else{
                HashMap<String, Object> updates = new HashMap<>();

                String query = "MATCH (n:product)\n" +
                "WHERE id(n) = " + productID + "\n" +
                "RETURN properties(n) as product";

                Result rs = session.run(query);
                if (rs.hasNext()){
                    Record record = rs.next();
                    JSONObject product = getJson(record.get("product"));

                    String name = product.get("name").toString();
                    if (!productName.equals(name)) updates.put("name", productName);

                    String type = product.get("type").toString();
                    if (type==null || !type.equals(productType)) updates.put("type", productType);

                    String inventory = product.get("inventory").toString();
                    if (inventory==null || !inventory.equals(productInventory)) updates.put("inventory", productInventory);

                    String capacity = product.get("capacity").toString();
                    if (capacity==null || !capacity.equals(productCapacity)) updates.put("capacity", productCapacity);

                    String leadTime = product.get("leadTime").toString();
                    if (leadTime==null || !leadTime.equals(productLeadTime)) updates.put("leadTime", productLeadTime);
                }

                if (!updates.isEmpty()){
                    StringBuilder stmt = new StringBuilder();
                    stmt.append("MATCH (n:product) WHERE id(n) = " + productID + "\n");
                    Iterator<String> it = updates.keySet().iterator();
                    while (it.hasNext()){
                        String key = it.next();
                        Object val = updates.get(key);
                        stmt.append("SET n." + key + " = ");
                        if (val==null) stmt.append("null\n");
                        else stmt.append("'" + val + "'\n");
                    }
                    session.run(stmt.toString());
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
  //** getString
  //**************************************************************************
  /** Returns a string for the given value. Returns null if the string is
   *  empty or equals "NULL" (case insensitive)
   */
    private String getString(JSONValue val){
        String str = val.toString();
        if (str!=null){
            str = str.trim();
            if (str.length()==0) str = null;
            else{
                if (str.equalsIgnoreCase("null")) str = null;
            }
        }
        return str;
    }


  //**************************************************************************
  //** getSession
  //**************************************************************************
    private Session getSession(ServiceRequest request){
        bluewave.app.User user = (bluewave.app.User) request.getUser();
        bluewave.graph.Neo4J graph = bluewave.Config.getGraph(user);
        return graph.getSession();
    }
}