package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;
import javaxt.encryption.BCrypt;

//Graph stuff
import bluewave.graph.Neo4J;

//******************************************************************************
//**  User Class
//******************************************************************************
/**
 *   Used to represent a User
 *
 ******************************************************************************/

public class User extends javaxt.sql.Model
    implements java.security.Principal, javaxt.express.User {

    private String username;
    private String password; //bcrypt hash
    private Integer accessLevel;
    private Boolean active;
    private Contact contact;
    private JSONObject auth;
    private JSONObject info;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public User(){
        super("application.user", new java.util.HashMap<String, String>() {{

            put("username", "username");
            put("password", "password");
            put("accessLevel", "access_level");
            put("active", "active");
            put("contact", "contact_id");
            put("auth", "auth");
            put("info", "info");

        }});

    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public User(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  User.
   */
    public User(JSONObject json){
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
            this.username = getValue(rs, "username").toString();
            this.password = getValue(rs, "password").toString();
            this.accessLevel = getValue(rs, "access_level").toInteger();
            this.active = getValue(rs, "active").toBoolean();
            Long contactID = getValue(rs, "contact_id").toLong();
            this.auth = new JSONObject(getValue(rs, "auth").toString());
            this.info = new JSONObject(getValue(rs, "info").toString());



          //Set contact
            if (contactID!=null) contact = new Contact(contactID);

        }
        catch(Exception e){
            if (e instanceof SQLException) throw (SQLException) e;
            else throw new SQLException(e.getMessage());
        }
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes with attributes from another User.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        this.username = json.get("username").toString();
        this.setPassword(json.get("password").toString());
        this.accessLevel = json.get("accessLevel").toInteger();
        this.active = json.get("active").toBoolean();
        if (json.has("contact")){
            contact = new Contact(json.get("contact").toJSONObject());
        }
        else if (json.has("contactID")){
            try{
                contact = new Contact(json.get("contactID").toLong());
            }
            catch(Exception e){}
        }
        this.auth = json.get("auth").toJSONObject();
        this.info = json.get("info").toJSONObject();
    }

    
    public String getName(){
        return username;
    }

    public String getUsername(){
        return username;
    }

    public void setUsername(String username){
        this.username = username;
    }

    public boolean authenticate(String password){
        return BCrypt.checkpw(password, this.password);
    }

    public void setPassword(String password){
        this.password = BCrypt.hashpw(password, BCrypt.gensalt());
    }

    public Integer getAccessLevel(){
        return accessLevel;
    }

    public void setAccessLevel(Integer accessLevel){
        this.accessLevel = accessLevel;
    }

    public Boolean getActive(){
        return active;
    }

    public void setActive(Boolean active){
        this.active = active;
    }

    public Contact getContact(){
        return contact;
    }

    public void setContact(Contact contact){
        this.contact = contact;
    }

    public JSONObject getAuth(){
        return auth;
    }

    public void setAuth(JSONObject auth){
        this.auth = auth;
    }

    public JSONObject getInfo(){
        return info;
    }

    public void setInfo(JSONObject info){
        this.info = info;
    }
    
    
  //**************************************************************************
  //** save
  //**************************************************************************
  /** Custom save method
   */
    public void save() throws SQLException {
        
      //Check whether we need to update the graph
        boolean updateGraph = false;
        User user = null;
        Long id = getID();
        if (id==null) updateGraph = true;
        else{
            user = new User(id);
            if (accessLevel != user.getAccessLevel()){
                updateGraph = true;
            }
            if (!this.password.equals(user.password)){
                updateGraph = true;
            }
        }
        
        
      //Save user in the app database
        super.save();
        
        
      //Update the graph as needed
        if (updateGraph){
            String[] credentials = getGraphCredentials();
            String username = credentials[0];
            String password = credentials[1];

            Neo4J graph = null;
            try{
                graph = bluewave.Config.getGraph(null);
                if (user==null){
                    bluewave.graph.Maintenance.createUser(username, password, graph);
                    bluewave.graph.Maintenance.setRole(username, getGraphRole(accessLevel), graph);
                }
                else{
                    if (accessLevel != user.getAccessLevel()){
                        bluewave.graph.Maintenance.setRole(username, getGraphRole(accessLevel), graph);
                    }
                    if (!this.password.equals(user.password)){
                        bluewave.graph.Maintenance.setPassword(username, password, graph);
                    }
                }
                
                graph.close();
            }
            catch(Exception e){
                if (graph!=null) try{graph.close();}catch(Exception ex){}
            }
        }
    }
    
    
  //**************************************************************************
  //** delete
  //**************************************************************************
  /** Custom delete method
   */
    public void delete() throws SQLException {
        Long id = getID();
        super.delete();
        if (id!=null){
            
            String[] credentials = getGraphCredentials();
            String username = credentials[0];

            Neo4J graph = null;
            try{
                graph = bluewave.Config.getGraph(null);
                bluewave.graph.Maintenance.deleteUser(username, graph);
                graph.close();
            }
            catch(Exception e){
                if (graph!=null) try{graph.close();}catch(Exception ex){}
            }
        }
    }
    
    
  //**************************************************************************
  //** getGraphRole
  //**************************************************************************
  /** Used to map an accessLevel to a role in the graph
   */
    private String getGraphRole(int accessLevel){
        String role;
        switch (accessLevel) {
            case 3:  role = "editor";
                     break;
            case 4:  role = "architect";
                     break;
            case 5:  role = "admin";
                     break;
            default: role = "reader";
                     break;
        }
        return role;
    }
    
    
  //**************************************************************************
  //** getGraphCredentials
  //**************************************************************************
  /** Returns graph username/password associated with this user
   */
    public String[] getGraphCredentials() {
        String hostname = ""; 
        try{ hostname = java.net.InetAddress.getLocalHost().getHostName() + "-";}
        catch(Exception e){};
        String username = "bu-" + hostname + getID();
        String password = this.password;
        if (password.length()>8) password = password.substring(0, 8);
        return new String[]{username, password};
    }


  //**************************************************************************
  //** toJson
  //**************************************************************************
  /** Returns a string representation of the User in JSON notation.
   */
    public JSONObject toJson(){
        JSONObject json = super.toJson();

        json.set("password", null);

        return json;
    }



  //**************************************************************************
  //** get
  //**************************************************************************
  /** Used to find a User using a given set of constraints. Example:
   *  User obj = User.get("username=", username);
   */
    public static User get(Object...args) throws SQLException {
        Object obj = _get(User.class, args);
        return obj==null ? null : (User) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find Users using a given set of constraints.
   */
    public static User[] find(Object...args) throws SQLException {
        Object[] obj = _find(User.class, args);
        User[] arr = new User[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (User) obj[i];
        }
        return arr;
    }
}