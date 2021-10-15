package bluewave.graph.fdp;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;

import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import javax.vecmath.Vector2d;
import javaxt.utils.ThreadPool;

import org.jgrapht.Graph;
import org.jgrapht.graph.SimpleGraph;


//******************************************************************************
//**  ForceDirectedGraph
//******************************************************************************
/**
 *   Java implementation of Fruchterman and Reingold's graph layout algorithm
 *   using force-directed placement. Credit:
 *   https://github.com/Benjoyo/ForceDirectedPlacement
 *
 ******************************************************************************/

public class ForceDirectedGraph {

    private Graph<Vertex, Edge> graph = null;


    //private Color VERTEX_FILL_COLOR = Color.WHITESMOKE;
    //private Color VERTEX_CIRCLE_COLOR = Color.BLACK;
    private Color EDGE_COLOR = Color.GRAY;
    private int VERTEX_WIDTH = 6;

    private int width;
    private int height;

    private String stopCriterion = "MechanicalEquilibrium"; //vs Iterations
    private int criterionValue = 15;

    private double coolingRate = 0.01;

    private static final double C = 0.4;


    private boolean equilibriumReached = false;
    private int iteration = 0;
    private double k;
    private double t;


    private String statusText = "Status: 0  %  ETC: ---------- --:-- --";


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ForceDirectedGraph(){
        graph = new SimpleGraph<>(new EdgeFactory());
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ForceDirectedGraph(Graph<Vertex, Edge> graph){
        this.graph = graph;
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public ForceDirectedGraph(javaxt.io.File f) throws Exception {
        this();

        String row;
        HashMap<String, Vertex> map = new HashMap<>();
        java.io.BufferedReader br = f.getBufferedReader();
        while ((row = br.readLine()) != null){
            row = row.trim();
            if (row.isEmpty()) continue;
            String[] arr = row.split(",");
            String type = arr[0];
            if (type.equals("v")){
                String id = arr[1];
                double x = Double.parseDouble(arr[2]);
                double y = Double.parseDouble(arr[3]);
                String label = "";
                for (int i=4; i<arr.length; i++){
                    if (arr[i].isEmpty()) continue;
                    if (label.length()>0) label += ",";
                    label += arr[i];
                }
                Vertex v = new Vertex();
                v.setProperty("id", id);
                v.setProperty("label", label);
                v.getPos().x = x;
                v.getPos().y = y;
                graph.addVertex(v);
                map.put(id, v);
            }
        }
        br.close();

        br = f.getBufferedReader();
        while ((row = br.readLine()) != null){
            row = row.trim();
            if (row.isEmpty()) continue;
            String[] arr = row.split(",");
            String type = arr[0];
            if (type.equals("e")){
                String id = arr[1];
                double x = Double.parseDouble(arr[2]);
                double y = Double.parseDouble(arr[3]);
                Vertex u = map.get(id);
                u.setProperty("id", id);
                u.getPos().x = x;
                u.getPos().y = y;

                id = arr[4];
                x = Double.parseDouble(arr[5]);
                y = Double.parseDouble(arr[6]);
                Vertex v = map.get(id);
                v.setProperty("id", id);
                v.getPos().x = x;
                v.getPos().y = y;
                graph.addEdge(v, u);
            }
        }
        br.close();
    }


  //**************************************************************************
  //** saveAs
  //**************************************************************************
    public void saveAs(javaxt.io.File f) throws Exception {
        String ext = f.getExtension();
        if (ext.equals("png") || ext.equals("jpg")){

            javaxt.io.Image img = new javaxt.io.Image(width, height);
            Graphics2D g2d = img.getBufferedImage().createGraphics();

          //Enable anti-alias
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                                 RenderingHints.VALUE_ANTIALIAS_ON);


          //Draw edges first
            for (Edge e : getEdges()) {
                Vector2d uPos = e.getU().getPos();
                Vector2d vPos = e.getV().getPos();

                double x1 = uPos.x;
                double y1 = uPos.y;
                double x2 = vPos.x;
                double y2 = vPos.y;

                g2d.setColor(EDGE_COLOR);
                g2d.drawLine((int)Math.round(x1), (int)Math.round(y1), (int)Math.round(x2), (int)Math.round(y2));
            }


          //Draw vertices
            for (Vertex v : getVertices()) {
//            gc.setFill(VERTEX_FILL_COLOR);
//            gc.fillOval(v.getPos().x, v.getPos().y, VERTEX_WIDTH, VERTEX_WIDTH);
//            gc.setFill(VERTEX_CIRCLE_COLOR);
//            gc.strokeOval(v.getPos().x, v.getPos().y, VERTEX_WIDTH, VERTEX_WIDTH);
            }


            img.saveAs(f.toFile());
        }
        else{

            java.io.BufferedWriter br = f.getBufferedWriter("UTF-8");
            for (Vertex v : getVertices()) {
                br.write("v," + v.getProperty("id") + "," + v.getPos().x + "," + v.getPos().y + "," + v.getProperty("label") + "\r\n");
            }
            br.flush();

            for (Edge e : getEdges()) {
                Vertex v = e.getV();
                Vertex u = e.getU();
                Vector2d uPos = u.getPos();
                Vector2d vPos = v.getPos();

                double x1 = uPos.x;
                double y1 = uPos.y;
                double x2 = vPos.x;
                double y2 = vPos.y;

                br.write("e," +
                    u.getProperty("id")+","+ x1+","+y1+","+
                    v.getProperty("id")+","+ x2+","+y2+"\r\n");
            }

            br.flush();
            br.close();
        }
    }


  //**************************************************************************
  //** getGraph
  //**************************************************************************
    public Graph<Vertex, Edge> getGraph(){
        return graph;
    }


  //**************************************************************************
  //** addVertex
  //**************************************************************************
    public void addVertex(Vertex v){
        graph.addVertex(v);
    }


  //**************************************************************************
  //** addEdge
  //**************************************************************************
    public void addEdge(Vertex v, Vertex u){
        graph.addEdge(v, u);
    }


  //**************************************************************************
  //** getEdges
  //**************************************************************************
    public ArrayList<Edge> getEdges(){
        ArrayList<Edge> arr = new ArrayList<>();
        arr.addAll(graph.edgeSet());
        return arr;
    }


  //**************************************************************************
  //** getVertices
  //**************************************************************************
    public ArrayList<Vertex> getVertices(){
        ArrayList<Vertex> arr = new ArrayList<>();
        arr.addAll(graph.vertexSet());
        return arr;
    }


    public String getStopCriterion() {
        return stopCriterion;
    }

    public void setStopCriterion(String stopCriterion) {
        this.stopCriterion = stopCriterion;
    }

    public double getCriterion() {
        return criterionValue;
    }

    public void setCriterion(int criterionValue) {
        this.criterionValue = criterionValue;
    }

    public double getCoolingRate() {
        return coolingRate;
    }

    public void setCoolingRate(double coolingRateValue) {
        this.coolingRate = coolingRateValue;
    }

    public int getVertexWidth(){
        return VERTEX_WIDTH;
    }


  //**************************************************************************
  //** build
  //**************************************************************************
    public int build() throws Exception {


      //Get vertices and edges as ArrayLists. Iterating through arrays is 5x
      //faster than looping through graph.vertexSet()
        ArrayList<Vertex> vertices = getVertices();
        ArrayList<Edge> edges = getEdges();
        int numVertices = vertices.size();
        System.out.println("Vertices: " + numVertices);
        System.out.println("Edges: " + edges.size());


      //Set width and height using vertex count
        width = Math.max(1000, (numVertices*VERTEX_WIDTH)*2);
        height = width;
        System.out.println(width+"x"+height);


        int frameWidth = (width - VERTEX_WIDTH);
        int frameHeight = (height - VERTEX_WIDTH);



        iteration = 0;
        equilibriumReached = false;

        int area = Math.min(frameWidth * frameWidth, frameHeight * frameHeight);
        k = C * Math.sqrt(area / numVertices);
        t = frameWidth / 10;




      //assign random initial positions to all vertices
        for (Vertex v : vertices) {
            v.randomPos(frameWidth, frameHeight);
        }



        long startTime = System.currentTimeMillis();
        javaxt.utils.Date startDate = new javaxt.utils.Date(startTime);
        startDate.setTimeZone("America/New York");
        System.out.println(startDate.toString("yyyy-MM-dd HH:mm a"));
        int numThreads = numVertices>1000 ? 12 : 1;



        if (stopCriterion.equals("MechanicalEquilibrium")) {
            while (!equilibriumReached && iteration < 1000) {
                if (numThreads>1){
                    System.out.print(statusText);
                    simulateStep(frameWidth, frameHeight, vertices, edges, numThreads);
                    System.out.println();
                    System.out.println(iteration + " (" + equilibriumReached + ")");
                    if (iteration==20) break;
                }
                else{
                    simulateStep(frameWidth, frameHeight, vertices, edges, numThreads);
                }
            }
        }
        else {
            for (int i=0; i<criterionValue; i++) {
                simulateStep(frameWidth, frameHeight, vertices, edges, numThreads);
            }
        }

        System.out.println("Iterations: " + iteration);
        return iteration;
    };


    private void simulateStep(int frameWidth, int frameHeight,
        ArrayList<Vertex> vertices, ArrayList<Edge> edges, int numThreads) throws Exception {

      //Set variables for status messages
        long ttl = vertices.size();
        long startTime = System.currentTimeMillis();
        AtomicInteger percentComplete = new AtomicInteger(0);
        AtomicInteger x = new AtomicInteger(0);



      //Calculate repulsive forces (from every vertex to every other)
        ThreadPool pool = new ThreadPool(numThreads){
            public void process(Object obj){
                Vertex v = (Vertex) obj;
                v.getDisp().set(0, 0);
                for (Vertex u : vertices) {
                    if (!v.equals(u)) {
                        // normalized difference position vector of v and u
                        Vector2d deltaPos = new Vector2d();
                        deltaPos.sub(v.getPos(), u.getPos());
                        double d = deltaPos.length();
                        deltaPos.normalize();


                        // displacement depending on repulsive force
                        double repulsiveForce = getRepulsiveForce(d, k);
                        deltaPos.scale(repulsiveForce);

                        v.getDisp().add(deltaPos);
                    }
                }


              //Print status
                if (numThreads>1){
                    double p = ((double) x.incrementAndGet()/ (double) ttl);
                    int currPercent = (int) Math.round(p*100);
                    synchronized(percentComplete){
                        if (currPercent > percentComplete.get()){
                            percentComplete.set(currPercent);
                            long currTime = System.currentTimeMillis();
                            int elapsedTime = (int) Math.round(((currTime-startTime)/1000)/60); //minutes
                            int totalTime = (int) Math.round((double)elapsedTime/p); //minutes
                            int timeRemaining = totalTime - elapsedTime;

                            javaxt.utils.Date etc = new javaxt.utils.Date();
                            etc.add(timeRemaining, "minutes");

                            if (percentComplete.get()==100) etc = new javaxt.utils.Date();
                            etc.setTimeZone("America/New York");

                            String _etc = etc.toString("yyyy-MM-dd HH:mm a");
                            if (elapsedTime==0) _etc = "---------- --:-- --";


                            for (int i=0; i<statusText.length(); i++){
                                System.out.print("\b");
                            }
                            String str = statusText.replace("0  %", pad(percentComplete.get())+"%");
                            str = str.replace("---------- --:-- --", _etc);

                            System.out.print(str);

                        }
                    }
                }
            }
        }.start();
        for (Vertex v : vertices) {
            pool.add(v);
        }
        pool.done();
        pool.join();



      //Calculate attractive forces (only between neighbors)
        pool = new ThreadPool(numThreads){
            public void process(Object obj){
                Edge e = (Edge) obj;

                // normalized difference position vector of v and u
                Vector2d deltaPos = new Vector2d();
                deltaPos.sub(e.getV().getPos(), e.getU().getPos());
                double d = deltaPos.length();
                deltaPos.normalize();

                // displacements depending on attractive force
                double attractiveForce = getAttractiveForce(d, k);
                deltaPos.scale(attractiveForce);

                e.getV().getDisp().sub(deltaPos);
                e.getU().getDisp().add(deltaPos);
            }
        }.start();
        for (Edge e : edges) {
            pool.add(e);
        }
        pool.done();
        pool.join();



        // assume equilibrium
        equilibriumReached = true;


        pool = new ThreadPool(numThreads){
            public void process(Object obj){
                Vertex v = (Vertex) obj;
                Vector2d disp = new Vector2d(v.getDisp());
                double length = disp.length();

                // no equilibrium if one vertex has too high net force
                if (length > criterionValue) {
                    equilibriumReached = false;
                }
                // System.out.print((int)length + "; ");
                // limit maximum displacement by temperature t
                disp.normalize();
                disp.scale(Math.min(length, t));
                v.getPos().add(disp);

                // prevent being displaced outside the frame
                v.getPos().x = Math.min(frameWidth, Math.max(0.0, v.getPos().x));
                v.getPos().y = Math.min(frameHeight, Math.max(0.0, v.getPos().y));
            }
        }.start();
        for (Vertex v : graph.vertexSet()) {
            pool.add(v);
        }
        pool.done();
        pool.join();



        // System.out.println();
        // reduce the temperature as the layout approaches a better
        // configuration but always let vertices move at least 1px
        t = Math.max(t * (1 - coolingRate), 1);

        if (numThreads>1){
        System.out.println("t: " + (float) t);
        }

        iteration++;
    }


  //**************************************************************************
  //** getAttractiveForce
  //**************************************************************************
  /** Calculates the amount of the attractive force between vertices using the
   *  following expression: "(d * d) / k". Users can override this method to
   *  use a different expression.
   *
   *  @param d the distance between the two vertices
   *  @param k
   *  @return amount of force
   */
    public double getAttractiveForce(double d, double k) {
        return (d * d) / k;
    }


  //**************************************************************************
  //** getRepulsiveForce
  //**************************************************************************
  /** Calculates the amount of the repulsive force between vertices using the
   *  following expression: "(k * k) / d". Users can override this method to
   *  use a different expression.
   *
   * @param d the distance between the two vertices
   * @param k
   * @return amount of force
   */
    public double getRepulsiveForce(double d, double k) {
        return (k * k) / d;
    }


  //**************************************************************************
  //** EdgeFactory
  //**************************************************************************
    private class EdgeFactory implements org.jgrapht.EdgeFactory<Vertex, Edge> {

	@Override
	public Edge createEdge(Vertex v, Vertex u) {
            return new Edge(v, u);
	}
    }


  //**************************************************************************
  //** pad
  //**************************************************************************
  /** Used to pad a number with white spaces. Used when printing percent
   *  complete to the standard output stream.
   */
    private static String pad(int i){
        String s = ""+i;
        if(s.length()==1){
          s += "  ";
        }
        else if(s.length()==2){
          s += " ";
        }
        return s;
    }

}