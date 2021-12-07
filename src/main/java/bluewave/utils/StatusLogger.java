package bluewave.utils;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;


//******************************************************************************
//**  StatusLogger
//******************************************************************************
/**
 *  Used to print status messages
 *
 ******************************************************************************/

public class StatusLogger implements Runnable {
    
    private long startTime;
    private AtomicLong recordCounter;
    private AtomicLong totalRecords;
    private String statusText = "0 records processed (0 records per second)";
    private ScheduledExecutorService executor;
    
    
  //**************************************************************************
  //** Constructor
  //**************************************************************************
    public StatusLogger(AtomicLong recordCounter, AtomicLong totalRecords){
        startTime = System.currentTimeMillis();
        this.recordCounter = recordCounter;
        this.totalRecords = totalRecords;
        executor = getExecutor(this); 
    }
    
    
  //**************************************************************************
  //** run
  //**************************************************************************
    public void run() {
        long currTime = System.currentTimeMillis();
        double elapsedTime = (currTime-startTime)/1000; //seconds
        long x = recordCounter.get();

        String rate = "0";
        try{
            rate = format(Math.round(x/elapsedTime));
        }
        catch(Exception e){}

        int len = statusText.length();
        for (int i=0; i<len; i++){
            System.out.print("\b");
        }

        statusText = format(x) + " records processed (" + rate + " records per second)";


        if (totalRecords!=null && totalRecords.get()>0){
            double p = ((double) x / (double) totalRecords.get());
            int currPercent = (int) Math.round(p*100);
            statusText += " " + x + "/" + totalRecords.get() + " " + currPercent + "%";
        }

        while (statusText.length()<len) statusText += " ";


        System.out.print(statusText);
    }
    
    
  //**************************************************************************
  //** shutdown
  //**************************************************************************
    public void shutdown(){
        
      //Send one last status update
        run();

      //Clean up
        executor.shutdown();      
    }
    
    
  //**************************************************************************
  //** getExecutor
  //**************************************************************************
    private static ScheduledExecutorService getExecutor(Runnable statusLogger){
        ScheduledExecutorService executor = Executors.newScheduledThreadPool(1);
        executor.scheduleAtFixedRate(statusLogger, 0, 1, TimeUnit.SECONDS);
        return executor;
    }

    
  //**************************************************************************
  //** format
  //**************************************************************************
  /** Used to format a number with commas.
   */
    public static String format(long l){
        return java.text.NumberFormat.getNumberInstance(java.util.Locale.US).format(l);
    }

    
  //**************************************************************************
  //** getElapsedTime
  //**************************************************************************
  /** Computes elapsed time between a given startTime and now. Returns a
   *  human-readable string representing the elapsed time.
   */
    public static String getElapsedTime(long startTime){
        long t = System.currentTimeMillis()-startTime;
        if (t<1000) return t + "ms";
        long s = Math.round(t/1000);
        if (s<60) return s + "s";
        long m = Math.round(s/60);
        return m + "m";
    }    
    
}
