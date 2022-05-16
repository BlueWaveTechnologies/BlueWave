package bluewave;
import java.util.*;
import javaxt.json.*;

//XML parser for plugins
import static javaxt.xml.DOM.*;
import org.w3c.dom.*;
import org.w3c.dom.Node;

public class Plugin {

    private org.w3c.dom.Document xml;
    private javaxt.io.Directory dir;
    private String name;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public Plugin(javaxt.io.File xmlFile){
        xml = xmlFile.getXML();
        dir = xmlFile.getDirectory();

        for (Node node : getElementsByTagName("plugin", xml)){
            NamedNodeMap attr = node.getAttributes();
            name = getAttributeValue(attr, "name");
        }
    }


  //**************************************************************************
  //** getName
  //**************************************************************************
    public String getName(){
        return name;
    }


  //**************************************************************************
  //** getDirectory
  //**************************************************************************
    public javaxt.io.Directory getDirectory(){
        return dir;
    }


  //**************************************************************************
  //** getWebServices
  //**************************************************************************
    public HashMap<String, String> getWebServices(){
        HashMap<String, String> webservices = new HashMap<>();
        for (Node node : getElementsByTagName("webservices", xml)){
            for (Node webservice : getElementsByTagName("service", node)){
                NamedNodeMap attr = webservice.getAttributes();
                String endpoint = getAttributeValue(attr, "endpoint");
                String className = getAttributeValue(attr, "class");
                webservices.put(endpoint.toLowerCase(), className);
            }
        }
        return webservices;
    }


  //**************************************************************************
  //** getIncludes
  //**************************************************************************
    public ArrayList<Node> getIncludes(){
        ArrayList<Node> includes = new ArrayList<>();
        for (Node n : getElementsByTagName("includes", xml)){
            for (Node node : getNodes(n.getChildNodes())){
                String nodeName = node.getNodeName();
                if (nodeName.equals("script") || nodeName.equals("link")){
                    includes.add(node);
                }
            }
        }
        return includes;
    }


  //**************************************************************************
  //** getExtensions
  //**************************************************************************
  /** Returns a json object representing all the web extension
   */
    public JSONObject getExtensions(){

        JSONObject extensions = new JSONObject();

        for (Node ext : getElementsByTagName("extensions", xml)){
            for (Node node : getNodes(ext.getChildNodes())){

              //Get component
                String component = node.getNodeName();
                JSONArray extension = extensions.get(component).toJSONArray();
                if (extension==null){
                    extension = new JSONArray();
                    extensions.set(component, extension);
                }


              //Get config
                JSONObject json = new JSONObject();
                String type = getAttributeValue(node, "type");
                json.set("type", type);
                for (Node n : getNodes(node.getChildNodes())){
                    json.set(n.getNodeName(), getJson(n));
                }

                extension.add(json);
            }
        }

        return extensions;
    }


    private JSONObject getJson(Node node){
        JSONObject json = new JSONObject();

        NamedNodeMap attributes = node.getAttributes();
        for (int i=0; i<attributes.getLength(); i++){
            Node attr = attributes.item(i);
            json.set(attr.getNodeName(), attr.getNodeValue());
        }

        for (Node n : getNodes(node.getChildNodes())){
            //if (n.getNodeType()!=1) continue;
            String nodeName = n.getNodeName();
            json.set(nodeName, getJson(n));
        }
        return json;
    }
}