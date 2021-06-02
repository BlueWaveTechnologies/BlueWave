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
        return new ServiceResponse(501, "Not Implemented");
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