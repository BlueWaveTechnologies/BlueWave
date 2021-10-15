package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;
import java.util.ArrayList;

//******************************************************************************
//**  DashboardGroup Class
//******************************************************************************
/**
 *   Used to represent a DashboardGroup
 *
 ******************************************************************************/

public class DashboardGroup extends javaxt.sql.Model {

    private String name;
    private String description;
    private User user;
    private JSONObject info;
    private ArrayList<Dashboard> dashboards;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public DashboardGroup(){
        super("application.dashboard_group", new java.util.HashMap<String, String>() {{
            
            put("name", "name");
            put("description", "description");
            put("user", "user_id");
            put("info", "info");
            put("dashboards", "dashboards");

        }});
        dashboards = new ArrayList<Dashboard>();
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public DashboardGroup(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  DashboardGroup.
   */
    public DashboardGroup(JSONObject json){
        this();
        update(json);
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes using a record in the database.
   */
    protected void update(Object rs) throws SQLException {

        try{
            this.id = getValue(rs, "id").toLong();
            this.name = getValue(rs, "name").toString();
            this.description = getValue(rs, "description").toString();
            Long userID = getValue(rs, "user_id").toLong();
            this.info = new JSONObject(getValue(rs, "info").toString());


            javaxt.sql.Connection conn = null;
            try{
                conn = getConnection(this.getClass());


              //Set dashboards
                ArrayList<Long> dashboardIDs = new ArrayList<Long>();
                for (javaxt.sql.Recordset row : conn.getRecordset(
                    "select dashboard_id from application.dashboard_group_dashboard where dashboard_group_id="+id)){
                    dashboardIDs.add(row.getValue(0).toLong());
                }
                for (long dashboardID : dashboardIDs){
                    dashboards.add(new Dashboard(dashboardID));
                }

                conn.close();
            }
            catch(SQLException e){
                if (conn!=null) conn.close();
                throw e;
            }



          //Set user
            if (userID!=null) user = new User(userID);

        }
        catch(Exception e){
            if (e instanceof SQLException) throw (SQLException) e;
            else throw new SQLException(e.getMessage());
        }
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes with attributes from another DashboardGroup.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        this.name = json.get("name").toString();
        this.description = json.get("description").toString();
        if (json.has("user")){
            user = new User(json.get("user").toJSONObject());
        }
        else if (json.has("userID")){
            try{
                user = new User(json.get("userID").toLong());
            }
            catch(Exception e){}
        }
        this.info = json.get("info").toJSONObject();

      //Set dashboards
        if (json.has("dashboards")){
            JSONArray _dashboards = json.get("dashboards").toJSONArray();
            for (int i=0; i<_dashboards.length(); i++){
                dashboards.add(new Dashboard(_dashboards.get(i).toJSONObject()));
            }
        }
    }


    public String getName(){
        return name;
    }

    public void setName(String name){
        this.name = name;
    }

    public String getDescription(){
        return description;
    }

    public void setDescription(String description){
        this.description = description;
    }

    public User getUser(){
        return user;
    }

    public void setUser(User user){
        this.user = user;
    }

    public JSONObject getInfo(){
        return info;
    }

    public void setInfo(JSONObject info){
        this.info = info;
    }

    public Dashboard[] getDashboards(){
        return dashboards.toArray(new Dashboard[dashboards.size()]);
    }

    public void setDashboards(Dashboard[] arr){
        dashboards = new ArrayList<Dashboard>();
        for (int i=0; i<arr.length; i++){
            dashboards.add(arr[i]);
        }
    }

    public void addDashboard(Dashboard dashboard){
        this.dashboards.add(dashboard);
    }
    
  //**************************************************************************
  //** save
  //**************************************************************************
  /** Used to save a DashboardGroup in the database.
   */
    public void save() throws SQLException {
        super.save();
        javaxt.sql.Connection conn = null;
        try{
            conn = getConnection(this.getClass());
            javaxt.sql.Recordset rs = new javaxt.sql.Recordset();
            
          //Save dashboards
            ArrayList<Long> dashboardIDs = new ArrayList<Long>();
            for (Dashboard obj : dashboards){
                obj.save();
                dashboardIDs.add(obj.getID());
            }
            for (long dashboardID : dashboardIDs){
                rs.open("select * from application.dashboard_group_dashboard where dashboard_group_id=" + id + 
                " and dashboard_id=" + dashboardID, conn, false);
                if (rs.EOF){
                    rs.addNew();
                    rs.setValue("dashboard_group_id", id);
                    rs.setValue("dashboard_id", dashboardID);
                    rs.update();
                }
                rs.close();
            }


            conn.close();
        }
        catch(SQLException e){
            if (conn!=null) conn.close();
            throw e;
        }
    }

    


  //**************************************************************************
  //** get
  //**************************************************************************
  /** Used to find a DashboardGroup using a given set of constraints. Example:
   *  DashboardGroup obj = DashboardGroup.get("name=", name);
   */
    public static DashboardGroup get(Object...args) throws SQLException {
        Object obj = _get(DashboardGroup.class, args);
        return obj==null ? null : (DashboardGroup) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find DashboardGroups using a given set of constraints.
   */
    public static DashboardGroup[] find(Object...args) throws SQLException {
        Object[] obj = _find(DashboardGroup.class, args);
        DashboardGroup[] arr = new DashboardGroup[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (DashboardGroup) obj[i];
        }
        return arr;
    }
}