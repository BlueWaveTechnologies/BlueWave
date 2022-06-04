package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;


//******************************************************************************
//**  UserActivity Class
//******************************************************************************
/**
 *   Used to represent a UserActivity
 *
 ******************************************************************************/

public class UserActivity extends javaxt.sql.Model {

    private User user;
    private Integer hour;
    private Integer minute;
    private Integer count;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public UserActivity(){
        super("user_activity", java.util.Map.ofEntries(

            java.util.Map.entry("user", "user_id"),
            java.util.Map.entry("hour", "hour"),
            java.util.Map.entry("minute", "minute"),
            java.util.Map.entry("count", "count")

        ));

    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public UserActivity(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  UserActivity.
   */
    public UserActivity(JSONObject json){
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
            this.hour = getValue(rs, "hour").toInteger();
            this.minute = getValue(rs, "minute").toInteger();
            this.count = getValue(rs, "count").toInteger();



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
  /** Used to update attributes with attributes from another UserActivity.
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
        this.hour = json.get("hour").toInteger();
        this.minute = json.get("minute").toInteger();
        this.count = json.get("count").toInteger();
    }


    public User getUser(){
        return user;
    }

    public void setUser(User user){
        this.user = user;
    }

    public Integer getHour(){
        return hour;
    }

    public void setHour(Integer hour){
        this.hour = hour;
    }

    public Integer getMinute(){
        return minute;
    }

    public void setMinute(Integer minute){
        this.minute = minute;
    }

    public Integer getCount(){
        return count;
    }

    public void setCount(Integer count){
        this.count = count;
    }




  //**************************************************************************
  //** get
  //**************************************************************************
  /** Used to find a UserActivity using a given set of constraints. Example:
   *  UserActivity obj = UserActivity.get("user_id=", user_id);
   */
    public static UserActivity get(Object...args) throws SQLException {
        Object obj = _get(UserActivity.class, args);
        return obj==null ? null : (UserActivity) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find UserActivitys using a given set of constraints.
   */
    public static UserActivity[] find(Object...args) throws SQLException {
        Object[] obj = _find(UserActivity.class, args);
        UserActivity[] arr = new UserActivity[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (UserActivity) obj[i];
        }
        return arr;
    }
}