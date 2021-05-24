package bluewave.web.services;
import bluewave.graph.Neo4J;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;
import javaxt.sql.Database;

import java.io.IOException;
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
    public ServiceResponse getCompanies(ServiceRequest request, Database database)
        throws ServletException, IOException {

        String name = request.getParameter("name").toString();
        if (name==null) return new ServiceResponse(400, "Name is required");

        Long limit = request.getParameter("limit").toLong();
        if (limit==null || limit<1 || limit>50) limit = 10L;

        String query = "MATCH (n:registrationlisting_registration)\n" +
        "WHERE n.name STARTS WITH '" + name + "'\n" +
        "RETURN ID(n) as id, properties(n) as registrationlisting_registration " +
        "ORDER BY n.name\n" +
        "LIMIT " + limit;


        Session session = null;
        try {
            session = graph.getSession();

            StringBuilder str = new StringBuilder("[");

            Result rs = session.run(query);
            while (rs.hasNext()){
                str.append("{");
                Record record = rs.next();
                str.append("\"id\":");
                str.append(record.get("id"));
                str.append(",");

                Value val = record.get("registrationlisting_registration");
                if (!val.isNull()){
                    Gson gson = new GsonBuilder().disableHtmlEscaping().create();
                    String json = gson.toJson(val.asMap());
                    str.append("\"company\":");
                    str.append(json);
                }
                str.append("}");
                if (rs.hasNext()) str.append(",");
            }
            session.close();

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