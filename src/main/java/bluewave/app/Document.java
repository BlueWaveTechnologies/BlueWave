package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;


//******************************************************************************
//**  Document Class
//******************************************************************************
/**
 *   Used to represent a Document
 *
 ******************************************************************************/

public class Document extends javaxt.sql.Model {

    private String title;
    private String description;
    private File file;
    private Integer pageCount;
    private String indexStatus;
    private JSONObject info;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public Document(){
        super("application.document", java.util.Map.ofEntries(
            
            java.util.Map.entry("title", "title"),
            java.util.Map.entry("description", "description"),
            java.util.Map.entry("file", "file_id"),
            java.util.Map.entry("pageCount", "page_count"),
            java.util.Map.entry("indexStatus", "index_status"),
            java.util.Map.entry("info", "info")

        ));
        
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public Document(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  Document.
   */
    public Document(JSONObject json){
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
            this.title = getValue(rs, "title").toString();
            this.description = getValue(rs, "description").toString();
            Long fileID = getValue(rs, "file_id").toLong();
            this.pageCount = getValue(rs, "page_count").toInteger();
            this.indexStatus = getValue(rs, "index_status").toString();
            this.info = new JSONObject(getValue(rs, "info").toString());



          //Set file
            if (fileID!=null) file = new File(fileID);

        }
        catch(Exception e){
            if (e instanceof SQLException) throw (SQLException) e;
            else throw new SQLException(e.getMessage());
        }
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes with attributes from another Document.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        this.title = json.get("title").toString();
        this.description = json.get("description").toString();
        if (json.has("file")){
            file = new File(json.get("file").toJSONObject());
        }
        else if (json.has("fileID")){
            try{
                file = new File(json.get("fileID").toLong());
            }
            catch(Exception e){}
        }
        this.pageCount = json.get("pageCount").toInteger();
        this.indexStatus = json.get("indexStatus").toString();
        this.info = json.get("info").toJSONObject();
    }


    public String getTitle(){
        return title;
    }

    public void setTitle(String title){
        this.title = title;
    }

    public String getDescription(){
        return description;
    }

    public void setDescription(String description){
        this.description = description;
    }

    public File getFile(){
        return file;
    }

    public void setFile(File file){
        this.file = file;
    }

    public Integer getPageCount(){
        return pageCount;
    }

    public void setPageCount(Integer pageCount){
        this.pageCount = pageCount;
    }

    public String getIndexStatus(){
        return indexStatus;
    }

    public void setIndexStatus(String indexStatus){
        this.indexStatus = indexStatus;
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
  /** Used to find a Document using a given set of constraints. Example:
   *  Document obj = Document.get("title=", title);
   */
    public static Document get(Object...args) throws SQLException {
        Object obj = _get(Document.class, args);
        return obj==null ? null : (Document) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find Documents using a given set of constraints.
   */
    public static Document[] find(Object...args) throws SQLException {
        Object[] obj = _find(Document.class, args);
        Document[] arr = new Document[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (Document) obj[i];
        }
        return arr;
    }
}