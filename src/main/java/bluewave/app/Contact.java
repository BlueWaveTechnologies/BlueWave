package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;


//******************************************************************************
//**  Contact Class
//******************************************************************************
/**
 *   Used to represent a Contact
 *
 ******************************************************************************/

public class Contact extends javaxt.sql.Model {

    private String firstName;
    private String lastName;
    private String fullName;
    private String gender;
    private String dob;
    private JSONObject info;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public Contact(){
        super("application.contact", java.util.Map.ofEntries(
            
            java.util.Map.entry("firstName", "first_name"),
            java.util.Map.entry("lastName", "last_name"),
            java.util.Map.entry("fullName", "full_name"),
            java.util.Map.entry("gender", "gender"),
            java.util.Map.entry("dob", "dob"),
            java.util.Map.entry("info", "info")

        ));
        
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public Contact(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  Contact.
   */
    public Contact(JSONObject json){
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
            this.firstName = getValue(rs, "first_name").toString();
            this.lastName = getValue(rs, "last_name").toString();
            this.fullName = getValue(rs, "full_name").toString();
            this.gender = getValue(rs, "gender").toString();
            this.dob = getValue(rs, "dob").toString();
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
  /** Used to update attributes with attributes from another Contact.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        this.firstName = json.get("firstName").toString();
        this.lastName = json.get("lastName").toString();
        this.fullName = json.get("fullName").toString();
        this.gender = json.get("gender").toString();
        this.dob = json.get("dob").toString();
        this.info = json.get("info").toJSONObject();
    }


    public String getFirstName(){
        return firstName;
    }

    public void setFirstName(String firstName){
        this.firstName = firstName;
    }

    public String getLastName(){
        return lastName;
    }

    public void setLastName(String lastName){
        this.lastName = lastName;
    }

    public String getFullName(){
        return fullName;
    }

    public void setFullName(String fullName){
        this.fullName = fullName;
    }

    public String getGender(){
        return gender;
    }

    public void setGender(String gender){
        this.gender = gender;
    }

    public String getDob(){
        return dob;
    }

    public void setDob(String dob){
        this.dob = dob;
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
  /** Used to find a Contact using a given set of constraints. Example:
   *  Contact obj = Contact.get("first_name=", first_name);
   */
    public static Contact get(Object...args) throws SQLException {
        Object obj = _get(Contact.class, args);
        return obj==null ? null : (Contact) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find Contacts using a given set of constraints.
   */
    public static Contact[] find(Object...args) throws SQLException {
        Object[] obj = _find(Contact.class, args);
        Contact[] arr = new Contact[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (Contact) obj[i];
        }
        return arr;
    }
}