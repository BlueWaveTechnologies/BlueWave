package bluewave;

//Java imports
import java.util.*;
import java.lang.reflect.Method;

//JavaXT imports
import javaxt.json.*;
import static javaxt.xml.DOM.*;
import static javaxt.utils.Console.console;

//XML imports
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
  //** getJarFile
  //**************************************************************************
    public javaxt.io.File getJarFile(){
        for (javaxt.io.File jarFile : dir.getFiles("*.jar")){
            return jarFile;
        }
        return null;
    }


  //**************************************************************************
  //** loadLibraries
  //**************************************************************************
  /** Used to load all the jar files found in the "lib" folder
   */
    public void loadLibraries() {

        ClassLoader classLoader = ClassLoader.getSystemClassLoader();
        javaxt.io.Directory libDir = new javaxt.io.Directory(dir + "lib");
        for (javaxt.io.File k : libDir.getFiles("*.jar")){
            try {
                java.net.URL url = k.toFile().toURI().toURL();
                Method method = classLoader.getClass().getDeclaredMethod("addURL", java.net.URL.class);
                method.setAccessible(true);
                method.invoke(classLoader, url);
            }
            catch (Exception e) {
                try{
                    Method method = classLoader.getClass().getDeclaredMethod("appendToClassPathForInstrumentation", String.class);
                    method.setAccessible(true);
                    method.invoke(classLoader, k.toString());
                }
                catch(Exception ex){
                    ex.toString();
                }
            }
        }
    }


  //**************************************************************************
  //** getMainMethods
  //**************************************************************************
  /** Returns a json array representing all the dashboards defined in the
   *  plugin file
   */
    public JSONArray getMainMethods(){
        JSONArray arr = new JSONArray();
        for (Node ext : getElementsByTagName("main", xml)){
            for (Node node : getNodes(ext.getChildNodes())){
                JSONObject json = getJson(node);
                json.set("switch", node.getNodeName());
                arr.add(json);
            }
        }
        return arr;
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
  //** getDashboards
  //**************************************************************************
  /** Returns a json array representing all the dashboards defined in the
   *  plugin file
   */
    public JSONArray getDashboards(){
        JSONArray arr = new JSONArray();
        for (Node ext : getElementsByTagName("dashboards", xml)){
            for (Node node : getNodes(ext.getChildNodes())){
                arr.add(getJson(node));
            }
        }
        return arr;
    }


  //**************************************************************************
  //** getExtensions
  //**************************************************************************
  /** Returns a json object representing all the web extensions defined in the
   *  plugin file
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
            JSONObject j = getJson(n);
            if (j.isEmpty()){
                json.set(nodeName, getNodeValue(n));
            }
            else{
                json.set(nodeName, j);
            }
        }
        return json;
    }
}