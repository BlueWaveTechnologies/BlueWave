package bluewave.utils;

//Java Includes
import java.util.*;

//JTS Includes
import org.locationtech.jts.geom.*;
import org.locationtech.jts.index.strtree.STRtree;
import org.locationtech.jts.geom.prep.PreparedGeometry;
import org.locationtech.jts.geom.prep.PreparedGeometryFactory;

//******************************************************************************
//**  SpatialIndex
//******************************************************************************
/**
 *   Used to generate a spatial index of geometry objects for local analytics
 *
 ******************************************************************************/

public class SpatialIndex {


    private STRtree strTree;
    private Envelope extents;
    private HashMap<Long, Object> map;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public SpatialIndex(){
        strTree = new STRtree();
    }


  //**************************************************************************
  //** add
  //**************************************************************************
  /** Used to add a geometry to the r-tree spatial index
   */
    public void add(Geometry geom, long id){
        if (geom instanceof Polygon) {
            updateIndex(id, geom);
        }
        else if (geom instanceof MultiPolygon) {
            MultiPolygon mp = (MultiPolygon)geom;
            for (int i=0; i<mp.getNumGeometries(); i++) {
                updateIndex(id, mp.getGeometryN(i));
            }
        }
        else if (geom.getGeometryType().equals("GeometryCollection")) {
            GeometryCollection gc = (GeometryCollection)geom;
            for (int i=0; i<gc.getNumGeometries(); i++) {
                updateIndex(id, gc.getGeometryN(i));
            }
        }
        else{
            updateIndex(id, geom);
        }
    }


  //**************************************************************************
  //** addMap
  //**************************************************************************
    public void addMap(HashMap<Long, Object> map){
        this.map = map;
    }


  //**************************************************************************
  //** getMap
  //**************************************************************************
    public HashMap<Long, Object> getMap(){
        return map;
    }


  //**************************************************************************
  //** getExtents
  //**************************************************************************
  /** Returns the spatial extents of all the items in the index
   */
    public Envelope getExtents(){
        return extents;
    }


  //**************************************************************************
  //** build
  //**************************************************************************
  /** Generates the index. Call once after you have added all the geometry
   *  objects you wish to index.
   */
    public void build(){
        strTree.build();
    }


  //**************************************************************************
  //** getIDs
  //**************************************************************************
  /** Returns IDs of items in the index that intersect the given geometry
   */
    public Long[] getIDs(Geometry geom){
        if (geom==null) return new Long[0];


        Envelope env = geom.getEnvelopeInternal();
        ArrayList<Long> ids = new ArrayList<>();
        if (env!=null){
            for (Object o : strTree.query(env)) {
                IndexedRegion region = (IndexedRegion) o;
                try{
                    if (region.poly.intersects(geom)){
                        ids.add(region.getID());
                    }
                }
                catch(Exception e){
                }
            }
        }

        return ids.toArray(new Long[ids.size()]);
    }


  //**************************************************************************
  //** getIDs
  //**************************************************************************
    public Long[] getIDs(Envelope env){
        ArrayList<Long> ids = new ArrayList<>();
        if (env!=null){
            for (Object o : strTree.query(env)) {
                IndexedRegion region = (IndexedRegion) o;
                ids.add(region.getID());
            }
        }
        return ids.toArray(new Long[ids.size()]);
    }


  //**************************************************************************
  //** updateIndex
  //**************************************************************************
    private void updateIndex(long id, Geometry geom){
        Envelope env = geom.getEnvelopeInternal();
        if (extents==null) extents = env;
        else extents.expandToInclude(env);
        strTree.insert(env, new IndexedRegion(id, geom));
    }


  //**************************************************************************
  //** IndexedRegion
  //**************************************************************************
  /** Used represent a record in the r-tree spatial index
   */
    private class IndexedRegion {
        private final long id;
        private final PreparedGeometry poly;

        public IndexedRegion(long id, Geometry poly) {
            this.id = id;
            this.poly = PreparedGeometryFactory.prepare(poly);
        }

        public long getID() {
            return id;
        }

        public boolean intersects(Point pt) {
            return poly.intersects(pt);
        }
    }
}