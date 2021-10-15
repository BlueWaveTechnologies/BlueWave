package bluewave.graph.fdp;

import javax.vecmath.Vector2d;
import java.util.HashMap;

public class Vertex {

    private Object id;
    private HashMap<String, Object> props = new HashMap<>();

    private Vector2d pos = new Vector2d();
    private Vector2d disp = new Vector2d();

    public void randomPos(int width, int height) {
        this.pos.x = Math.random() * width;
        this.pos.y = Math.random() * height;
    }

    public void setProperty(String key, Object val){
        if (key.equals("id")) id = val;
        props.put(key, val);
    }

    public Object getProperty(String key){
        return props.get(key);
    }

    public Vector2d getPos() {
        return pos;
    }

    public Vector2d getDisp() {
        return disp;
    }

    public boolean equals(Object obj){
        if (obj instanceof Vertex){
            try{
                Vertex v = (Vertex) obj;
                return id.equals(v.id);
            }
            catch(Exception e){}
        }
        return false;
    }
}