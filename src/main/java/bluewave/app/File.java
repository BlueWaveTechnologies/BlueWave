package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;
import javaxt.utils.Date;

//******************************************************************************
//**  File Class
//******************************************************************************
/**
 *   Used to represent a File
 *
 ******************************************************************************/

public class File extends javaxt.sql.Model {

    private String name;
    private Path path;
    private String type;
    private Date date;
    private Long size;
    private String hash;
    private JSONObject metadata;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public File(){
        super("application.file", java.util.Map.ofEntries(
            
            java.util.Map.entry("name", "name"),
            java.util.Map.entry("path", "path_id"),
            java.util.Map.entry("type", "type"),
            java.util.Map.entry("date", "date"),
            java.util.Map.entry("size", "size"),
            java.util.Map.entry("hash", "hash"),
            java.util.Map.entry("metadata", "metadata")

        ));
        
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public File(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  File.
   */
    public File(JSONObject json){
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
            Long pathID = getValue(rs, "path_id").toLong();
            this.type = getValue(rs, "type").toString();
            this.date = getValue(rs, "date").toDate();
            this.size = getValue(rs, "size").toLong();
            this.hash = getValue(rs, "hash").toString();
            this.metadata = new JSONObject(getValue(rs, "metadata").toString());



          //Set path
            if (pathID!=null) path = new Path(pathID);

        }
        catch(Exception e){
            if (e instanceof SQLException) throw (SQLException) e;
            else throw new SQLException(e.getMessage());
        }
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes with attributes from another File.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        this.name = json.get("name").toString();
        if (json.has("path")){
            path = new Path(json.get("path").toJSONObject());
        }
        else if (json.has("pathID")){
            try{
                path = new Path(json.get("pathID").toLong());
            }
            catch(Exception e){}
        }
        this.type = json.get("type").toString();
        this.date = json.get("date").toDate();
        this.size = json.get("size").toLong();
        this.hash = json.get("hash").toString();
        this.metadata = json.get("metadata").toJSONObject();
    }


    public String getName(){
        return name;
    }

    public void setName(String name){
        this.name = name;
    }

    public Path getPath(){
        return path;
    }

    public void setPath(Path path){
        this.path = path;
    }

    public String getType(){
        return type;
    }

    public void setType(String type){
        this.type = type;
    }

    public Date getDate(){
        return date;
    }

    public void setDate(Date date){
        this.date = date;
    }

    public Long getSize(){
        return size;
    }

    public void setSize(Long size){
        this.size = size;
    }

    public String getHash(){
        return hash;
    }

    public void setHash(String hash){
        this.hash = hash;
    }

    public JSONObject getMetadata(){
        return metadata;
    }

    public void setMetadata(JSONObject metadata){
        this.metadata = metadata;
    }
    
    


  //**************************************************************************
  //** get
  //**************************************************************************
  /** Used to find a File using a given set of constraints. Example:
   *  File obj = File.get("name=", name);
   */
    public static File get(Object...args) throws SQLException {
        Object obj = _get(File.class, args);
        return obj==null ? null : (File) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find Files using a given set of constraints.
   */
    public static File[] find(Object...args) throws SQLException {
        Object[] obj = _find(File.class, args);
        File[] arr = new File[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (File) obj[i];
        }
        return arr;
    }
}