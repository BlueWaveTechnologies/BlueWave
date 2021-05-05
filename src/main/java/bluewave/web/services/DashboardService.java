package bluewave.web.services;
import bluewave.app.Dashboard;

import javaxt.express.*;
import javaxt.http.servlet.*;
import javaxt.sql.*;

import java.util.*;
import java.io.IOException;

//******************************************************************************
//**  DashboardService
//******************************************************************************
/**
 *   Used to get and save thumbnails associated with dashboards. Note that
 *   all other CRUD requests are managed by the WebServices class.
 *
 ******************************************************************************/

public class DashboardService extends WebService {

    private bluewave.web.WebServices ws;
    private String format = "png";


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public DashboardService(bluewave.web.WebServices ws, javaxt.io.Directory web, Database database) throws Exception {
        this.ws = ws;


        Connection conn = null;
        try{

          //Find dashboards in the database
            HashSet<String> dashboards = new HashSet<>();
            conn = database.getConnection();
            Recordset rs = new Recordset();
            String tableName = Model.getTableName(new Dashboard());
            rs.open("select class_name from " + tableName, conn);
            while (rs.hasNext()){
                String className = rs.getValue(0).toString();
                int idx = className.lastIndexOf(".");
                if (idx>0) className = className.substring(idx+1);
                dashboards.add(className);
                rs.moveNext();
            }
            rs.close();
            conn.close();


          //Add dashboards as needed
            javaxt.io.Directory dir = new javaxt.io.Directory(web + "app/dashboards/");
            for (javaxt.io.File file : dir.getFiles("*.js")){
                String className = file.getName(false);
                if (!dashboards.contains(className)){
                    Dashboard dashboard = new Dashboard();
                    dashboard.setName(className);
                    dashboard.setClassName(className);
                    dashboard.save();
                }
            }
        }
        catch(Exception e){
            if (conn!=null) conn.close();
            throw e;
        }
    }


  //**************************************************************************
  //** getThumbnail
  //**************************************************************************
    public ServiceResponse getThumbnail(ServiceRequest request, Database database)
        throws ServletException, IOException {

        String name = request.getParameter("name").toString();
        if (name==null) return new ServiceResponse(400, "Name is required");

        try{
            Dashboard dashboard = getDashboard(name, database);
            if (dashboard==null) return new ServiceResponse(400, "Dashboard does not exist");

            byte[] thumbnail = dashboard.getThumbnail();
            if (thumbnail==null) return new ServiceResponse(404, "Thumbnail does not exist");

            javaxt.io.Image img = new javaxt.io.Image(thumbnail);
            img.setWidth(360);
            byte[] bytes = img.getByteArray(format);
            ServiceResponse response = new ServiceResponse(bytes);
            response.setContentType("image/"+format);
            response.setContentLength(bytes.length);
            return response;
        }
        catch(Exception e){
            return new ServiceResponse(e);
        }
    }


  //**************************************************************************
  //** saveThumbnail
  //**************************************************************************
    public ServiceResponse saveThumbnail(ServiceRequest request, Database database)
        throws ServletException, IOException {

        Long id = null;
        javaxt.io.Image img = null;
        String name = null;
        String className = null;

        Iterator<FormInput> it = request.getRequest().getFormInputs();
        while (it.hasNext()){
            FormInput input = it.next();
            String key = input.getName();
            FormValue value = input.getValue();
            if (input.isFile()){
                img = new javaxt.io.Image(value.getInputStream());
            }
            else{
                if (key.equals("id")) id = value.toLong();
                if (key.equals("name")) name = value.toString();
                if (key.equals("className")) className = value.toString();
            }
        }


        if (id==null){

            if (img==null) return new ServiceResponse(400, "Image is required");
            if (name==null) return new ServiceResponse(400, "Name is required");
            if (className==null) return new ServiceResponse(400, "ClassName is required");


            try{
                Dashboard dashboard = getDashboard(className, database);
                if (dashboard==null) return new ServiceResponse(400, "Dashboard does not exist");


                byte[] b = img.getByteArray(format);
                dashboard.setName(name);
                dashboard.setThumbnail(b);
                dashboard.setClassName(className);
                dashboard.save();
                ws.notify("update",dashboard);
                return new ServiceResponse(200);
            }
            catch(Exception e){
                return new ServiceResponse(e);
            }

        }
        else{
            try{
                Dashboard dashboard = Dashboard.get("id=", id);
                if (img!=null) dashboard.setThumbnail(img.getByteArray(format));
                dashboard.save();
                return new ServiceResponse(200);
            }
            catch(Exception e){
                return new ServiceResponse(e);
            }
        }
    }


  //**************************************************************************
  //** getDashboard
  //**************************************************************************
    private Dashboard getDashboard(String className, Database database) throws Exception {
        Dashboard dashboard = null;
        Connection conn = null;
        try{
            conn = database.getConnection();
            Recordset rs = new Recordset();
            String tableName = Model.getTableName(new Dashboard());
            int idx = className.lastIndexOf(".");
            if (idx>0) className = className.substring(idx+1);
            rs.open("select id from " + tableName + " where class_name like '%" + className + "'", conn);
            if (!rs.EOF) dashboard = Dashboard.get("id=", rs.getValue(0).toLong());
            rs.close();
            conn.close();
        }
        catch(Exception e){
            if (conn!=null) conn.close();
            throw e;
        }
        return dashboard;
    }

}