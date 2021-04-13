package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;


//******************************************************************************
//**  Dashboard Class
//******************************************************************************
/**
 *   Used to represent a Dashboard
 *
 ******************************************************************************/

public class Dashboard extends javaxt.sql.Model {

    private String name;
    private String className;
    private byte[] thumbnail;
    private JSONObject info;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public Dashboard(){
        super("application.dashboard", new java.util.HashMap<String, String>() {{
            
            put("name", "name");
            put("className", "class_name");
            put("thumbnail", "thumbnail");
            put("info", "info");

        }});
        
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public Dashboard(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  Dashboard.
   */
    public Dashboard(JSONObject json){
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
            this.className = getValue(rs, "class_name").toString();
            this.thumbnail = getValue(rs, "thumbnail").toByteArray();
            this.info = new JSONObject(getValue(rs, "info").toString());


        }
        catch(Exception e){
            if (e instanceof SQLException) throw (SQLException) e;
            else throw new SQLException(e.getMessage());
        }
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes with attributes from another Dashboard.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        this.name = json.get("name").toString();
        this.className = json.get("className").toString();
        this.thumbnail = json.get("thumbnail").toByteArray();
        this.info = json.get("info").toJSONObject();
    }


    public String getName(){
        return name;
    }

    public void setName(String name){
        this.name = name;
    }

    public String getClassName(){
        return className;
    }

    public void setClassName(String className){
        this.className = className;
    }

    public byte[] getThumbnail(){
        return thumbnail;
    }

    public void setThumbnail(byte[] thumbnail){
        this.thumbnail = thumbnail;
    }

    public JSONObject getInfo(){
        return info;
    }

    public void setInfo(JSONObject info){
        this.info = info;
    }
    
    


  //**************************************************************************
  //** get
  //**************************************************************************
  /** Used to find a Dashboard using a given set of constraints. Example:
   *  Dashboard obj = Dashboard.get("name=", name);
   */
    public static Dashboard get(Object...args) throws SQLException {
        Object obj = _get(Dashboard.class, args);
        return obj==null ? null : (Dashboard) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find Dashboards using a given set of constraints.
   */
    public static Dashboard[] find(Object...args) throws SQLException {
        Object[] obj = _find(Dashboard.class, args);
        Dashboard[] arr = new Dashboard[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (Dashboard) obj[i];
        }
        return arr;
    }
}