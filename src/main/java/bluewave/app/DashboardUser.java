package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;


//******************************************************************************
//**  DashboardUser Class
//******************************************************************************
/**
 *   Used to represent a DashboardUser
 *
 ******************************************************************************/

public class DashboardUser extends javaxt.sql.Model {

    private User user;
    private Dashboard dashboard;
    private Boolean readOnly;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public DashboardUser(){
        super("application.dashboard_user", java.util.Map.ofEntries(
            
            java.util.Map.entry("user", "user_id"),
            java.util.Map.entry("dashboard", "dashboard_id"),
            java.util.Map.entry("readOnly", "read_only")

        ));
        
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public DashboardUser(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  DashboardUser.
   */
    public DashboardUser(JSONObject json){
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
            Long userID = getValue(rs, "user_id").toLong();
            Long dashboardID = getValue(rs, "dashboard_id").toLong();
            this.readOnly = getValue(rs, "read_only").toBoolean();



          //Set user
            if (userID!=null) user = new User(userID);


          //Set dashboard
            if (dashboardID!=null) dashboard = new Dashboard(dashboardID);

        }
        catch(Exception e){
            if (e instanceof SQLException) throw (SQLException) e;
            else throw new SQLException(e.getMessage());
        }
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes with attributes from another DashboardUser.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        if (json.has("user")){
            user = new User(json.get("user").toJSONObject());
        }
        else if (json.has("userID")){
            try{
                user = new User(json.get("userID").toLong());
            }
            catch(Exception e){}
        }
        if (json.has("dashboard")){
            dashboard = new Dashboard(json.get("dashboard").toJSONObject());
        }
        else if (json.has("dashboardID")){
            try{
                dashboard = new Dashboard(json.get("dashboardID").toLong());
            }
            catch(Exception e){}
        }
        this.readOnly = json.get("readOnly").toBoolean();
    }


    public User getUser(){
        return user;
    }

    public void setUser(User user){
        this.user = user;
    }

    public Dashboard getDashboard(){
        return dashboard;
    }

    public void setDashboard(Dashboard dashboard){
        this.dashboard = dashboard;
    }

    public Boolean getReadOnly(){
        return readOnly;
    }

    public void setReadOnly(Boolean readOnly){
        this.readOnly = readOnly;
    }
    
    


  //**************************************************************************
  //** get
  //**************************************************************************
  /** Used to find a DashboardUser using a given set of constraints. Example:
   *  DashboardUser obj = DashboardUser.get("user_id=", user_id);
   */
    public static DashboardUser get(Object...args) throws SQLException {
        Object obj = _get(DashboardUser.class, args);
        return obj==null ? null : (DashboardUser) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find DashboardUsers using a given set of constraints.
   */
    public static DashboardUser[] find(Object...args) throws SQLException {
        Object[] obj = _find(DashboardUser.class, args);
        DashboardUser[] arr = new DashboardUser[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (DashboardUser) obj[i];
        }
        return arr;
    }
}