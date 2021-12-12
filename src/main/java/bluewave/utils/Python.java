package bluewave.utils;

import java.util.*;
import javaxt.json.JSONObject;

public class Python {


  //**************************************************************************
  //** executeScript
  //**************************************************************************
    public static JSONObject executeScript(javaxt.io.File script, ArrayList<String> params) 
    throws Exception {

        String[] cmdarray = new String[params.size()+2];
        cmdarray[0] = "python3";
        cmdarray[1] = script.toString();
        int i = 2;
        for (String param : params){
            cmdarray[i] = param;
            i++;
        }

        javaxt.io.Shell cmd = new javaxt.io.Shell(cmdarray);
        cmd.run();
        List<String> output = cmd.getOutput();
        List<String> errors = cmd.getErrors();

        if (errors.size()>0){
            StringBuilder err = new StringBuilder();
            Iterator<String> i2 = errors.iterator();
            while (i2.hasNext()){
                String error = i2.next();
                if (error!=null) err.append(error + "\r\n");
            }
            if (err.length()>0){
                throw new Exception(err.toString());
            }
        }


        try{
            return new JSONObject(output.get(0));
        }
        catch(Exception e){
            StringBuilder err = new StringBuilder();
            err.append("Error parsing script output");
            StringBuffer result = new StringBuffer();
            Iterator<String> i2 = output.iterator();
            while (i2.hasNext()){
                String out = i2.next();
                if (out!=null) result.append(out + "\r\n");
            }
            err.append(":\r\n" + result);
            throw new Exception(err.toString());
        }
    }
}