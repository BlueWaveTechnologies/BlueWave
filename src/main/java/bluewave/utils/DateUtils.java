package bluewave.utils;

public class DateUtils {

    private final static long  jvm_diff;
    static {
        jvm_diff = System.currentTimeMillis()*1000_000-System.nanoTime();
    }

  //**************************************************************************
  //** getCurrentTime
  //**************************************************************************
  /** Returns current time in milliseconds
   */
    public static long getCurrentTime(){
        return System.nanoTime()+jvm_diff;
    }


  //**************************************************************************
  //** getMilliseconds
  //**************************************************************************
  /** Converts a timestamp in nanoseconds to milliseconds
   */
    public static long getMilliseconds(long nanoseconds){
        return nanoseconds / 1000000;
    }

}