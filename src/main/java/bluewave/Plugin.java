package bluewave;
import java.util.*;

//XML parser for plugins
import static javaxt.xml.DOM.*;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;

public class Plugin {

    private org.w3c.dom.Document xml;
    private javaxt.io.Directory dir;
    private String name;

    public Plugin(javaxt.io.File xmlFile){
        xml = xmlFile.getXML();
        dir = xmlFile.getDirectory();

        for (Node node : getElementsByTagName("plugin", xml)){
            NamedNodeMap attr = node.getAttributes();
            name = getAttributeValue(attr, "name");
        }
    }

    public String getName(){
        return name;
    }

    public javaxt.io.Directory getDirectory(){
        return dir;
    }

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

    
}