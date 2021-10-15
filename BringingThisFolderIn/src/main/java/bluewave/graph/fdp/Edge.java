package bluewave.graph.fdp;
import java.util.HashMap;

public class Edge {

    private final Vertex v;
    private final Vertex u;
    private HashMap<String, Object> props = new HashMap<>();

    public Edge(Vertex v, Vertex u) {
        this.v = v;
        this.u = u;
    }

    public Vertex getV() {
        return v;
    }

    public Vertex getU() {
        return u;
    }
    
    public void setProperty(String key, Object val){
        props.put(key, val);
    }

    public Object getProperty(String key){
        return props.get(key);
    }
}