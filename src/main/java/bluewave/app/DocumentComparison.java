package bluewave.app;
import javaxt.json.*;
import java.sql.SQLException;


//******************************************************************************
//**  DocumentComparison Class
//******************************************************************************
/**
 *   Used to represent a DocumentComparison
 *
 ******************************************************************************/

public class DocumentComparison extends javaxt.sql.Model {

    private Document a;
    private Document b;
    private JSONObject info;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public DocumentComparison(){
        super("application.document_comparison", java.util.Map.ofEntries(
            
            java.util.Map.entry("a", "a_id"),
            java.util.Map.entry("b", "b_id"),
            java.util.Map.entry("info", "info")

        ));
        
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a record ID in the database.
   */
    public DocumentComparison(long id) throws SQLException {
        this();
        init(id);
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class using a JSON representation of a
   *  DocumentComparison.
   */
    public DocumentComparison(JSONObject json){
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
            Long aID = getValue(rs, "a_id").toLong();
            Long bID = getValue(rs, "b_id").toLong();
            this.info = new JSONObject(getValue(rs, "info").toString());



          //Set a
            if (aID!=null) a = new Document(aID);


          //Set b
            if (bID!=null) b = new Document(bID);

        }
        catch(Exception e){
            if (e instanceof SQLException) throw (SQLException) e;
            else throw new SQLException(e.getMessage());
        }
    }


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update attributes with attributes from another DocumentComparison.
   */
    public void update(JSONObject json){

        Long id = json.get("id").toLong();
        if (id!=null && id>0) this.id = id;
        if (json.has("a")){
            a = new Document(json.get("a").toJSONObject());
        }
        else if (json.has("aID")){
            try{
                a = new Document(json.get("aID").toLong());
            }
            catch(Exception e){}
        }
        if (json.has("b")){
            b = new Document(json.get("b").toJSONObject());
        }
        else if (json.has("bID")){
            try{
                b = new Document(json.get("bID").toLong());
            }
            catch(Exception e){}
        }
        this.info = json.get("info").toJSONObject();
    }


    public Document getA(){
        return a;
    }

    public void setA(Document a){
        this.a = a;
    }

    public Document getB(){
        return b;
    }

    public void setB(Document b){
        this.b = b;
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
  /** Used to find a DocumentComparison using a given set of constraints. Example:
   *  DocumentComparison obj = DocumentComparison.get("a_id=", a_id);
   */
    public static DocumentComparison get(Object...args) throws SQLException {
        Object obj = _get(DocumentComparison.class, args);
        return obj==null ? null : (DocumentComparison) obj;
    }


  //**************************************************************************
  //** find
  //**************************************************************************
  /** Used to find DocumentComparisons using a given set of constraints.
   */
    public static DocumentComparison[] find(Object...args) throws SQLException {
        Object[] obj = _find(DocumentComparison.class, args);
        DocumentComparison[] arr = new DocumentComparison[obj.length];
        for (int i=0; i<arr.length; i++){
            arr[i] = (DocumentComparison) obj[i];
        }
        return arr;
    }
}