package bluewave.utils;
import java.util.*;


public class NotificationService {

    private static List events;
    private static List<Listener> listeners;


  //**************************************************************************
  //** notify
  //**************************************************************************
    public static void notify(String event, String data){
        if (events==null) return;

        long timestamp = DateUtils.getCurrentTime();
        synchronized(events){
            events.add(new Object[]{event, data, timestamp});
            events.notify();
        }
    }


  //**************************************************************************
  //** start
  //**************************************************************************
    public static void start(){
        listeners = new LinkedList();

        events = new LinkedList();
        int numThreads = 4;
        for (int i=0; i<numThreads; i++){
            Thread thread = new Thread(new NotificationProcessor());
            thread.start();
        }
    }


  //**************************************************************************
  //** stop
  //**************************************************************************
    public static void stop(){

        synchronized(listeners){
            listeners.clear();
            listeners.notify();
        }

        synchronized(events){
            events.clear();
            events.add(0, null);
            events.notify();
        }
    }


  //**************************************************************************
  //** addListener
  //**************************************************************************
    public static void addListener(Listener listener){
        synchronized(listeners){
            listeners.add(listener);
            listeners.notify();
        }
    }


  //**************************************************************************
  //** Listener Class
  //**************************************************************************
    public static class Listener {
        public void processEvent(String event, String data, long timestamp){}
    }


  //**************************************************************************
  //** NotificationProcessor
  //**************************************************************************
  /** Thread used to pass events to listeners
   */
    private static class NotificationProcessor implements Runnable {

        public void run() {

            while (true) {

                Object obj = null;
                synchronized (events) {
                    while (events.isEmpty()) {
                        try {
                            events.wait();
                        }
                        catch (InterruptedException e) {
                            return;
                        }
                    }
                    obj = events.get(0);
                    if (obj!=null) events.remove(0);
                    events.notifyAll();
                }

                if (obj!=null){
                    Object[] arr = (Object[]) obj;
                    String event = (String) arr[0];
                    String data = (String) arr[1];
                    Long timestamp = (Long) arr[2];


                    for (Listener listener : listeners){
                        try{
                            listener.processEvent(event, data, timestamp);
                        }
                        catch(Exception e){
                        }
                    }

                }
                else{
                    return;
                }
            }
        }
    }

}