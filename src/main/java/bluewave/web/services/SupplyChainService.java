package bluewave.web.services;
import bluewave.graph.Neo4J;

import javaxt.express.ServiceRequest;
import javaxt.express.ServiceResponse;
import javaxt.express.WebService;
import javaxt.http.servlet.ServletException;
import javaxt.sql.Database;

import java.io.IOException;


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
        return new ServiceResponse(501, "Not Implemented");
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