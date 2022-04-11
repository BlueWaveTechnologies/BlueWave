package bluewave.utils;

import java.util.*;
import me.xdrop.fuzzywuzzy.FuzzySearch;
import static javaxt.utils.Console.console;


public class StringUtils {


  //Common suffixes found in company name. Order is important
    private static String[] companySuffixes = new String[]{
    "LTD","LIMITED","LLC","INC","SDN BHD","AB","GMBH",
    "CO","CORP","CORPORATION",
    "PUBLIC COMPANY","GLOBAL COMPANY","COMPANY","PUBLIC"};


  //**************************************************************************
  //** trimUSAddress
  //**************************************************************************
  /** Generally speaking, street addresses in the US should start with a
   *  number. This function will attempt to trim a given string by removing
   *  any text before the street address.
   */
    public static String trimUSAddress(String address){

      //Get first character that's a number
        int firstNumber = Integer.MAX_VALUE;
        for (int i=0; i<10; i++){
            int idx = address.indexOf(i+"");
            if (idx>-1){
                firstNumber = Math.min(idx, firstNumber);
            }
        }


      //If the address doesn't start with a number, trim it as best we can
        if (firstNumber!=0 && firstNumber<address.length()){
            String str = address.substring(firstNumber);

            boolean trim = true;
            try{
                Long.parseLong(str.replace("-", ""));
                trim = false;
            }
            catch(Exception e){}


            if (trim){
                String s = address.substring(0,firstNumber);
                if (s.contains(" ")){

                    if (s.toUpperCase().equals("PO BOX ")){
                        trim = false;
                    }

                    if (s.toUpperCase().equals("ROUTE ") ||
                        s.toUpperCase().equals("RTE ")){
                        trim = false;
                    }

                    if (s.toUpperCase().equals("ROOM ")){
                        //TODO: Trim off room number
                        trim = false;
                    }

                    if (trim){
                        if (s.trim().endsWith("#")){
                            trim = false;
                        }
                    }

                    //System.out.println(s + "|" + str);
                }
                else{
                    trim = false;
                }


                if (trim){
                    address = str;
                }
            }

        }
        return address;
    }


  //**************************************************************************
  //** mergeCompanies
  //**************************************************************************
  /** Used to fuzzy match company names
   *  @return map with a company name and all associated IDs
   */
    public static HashMap<String, ArrayList<Long>> mergeCompanies(HashMap<Long, String> companies){
        HashMap<String, ArrayList<Long>> results = new HashMap<>();

      //Return early if there's only one entry in companies
        if (companies.size()==1){
            Long id = companies.keySet().iterator().next();
            String name = companies.get(id);
            ArrayList<Long> arr = new ArrayList<>();
            arr.add(id);
            results.put(name, arr);
            return results;
        }


        HashSet<Integer> matches = new HashSet<>();

        int x = 0;
        Iterator<Long> it = companies.keySet().iterator();
        while (it.hasNext()){
            Long id = it.next();
            String name = companies.get(id);
            name = getCompanyName(name);
            String uname = name.toUpperCase();
            if (!matches.contains(x)){


                matches.add(x);

                ArrayList<Long> ids = results.get(name);
                if (ids==null){
                    ids = new ArrayList<>();
                    results.put(name, ids);
                    ids.add(id);
                }



                int y = 0;
                Iterator<Long> i2 = companies.keySet().iterator();
                while (i2.hasNext()){
                    Long i = i2.next();
                    String n = companies.get(i);


                    if (!matches.contains(y)){


                        n = getCompanyName(n);
                        String un = n.toUpperCase();


                        boolean foundMatch = false;
                        if (un.equals(uname)){
                            foundMatch = true;
                            //console.log("-",n);
                        }
                        else{
                            double wordScore = FuzzySearch.tokenSortPartialRatio(uname, un);
                            if (wordScore>90){
                                foundMatch = true;
                                //console.log("~",n);
                            }
                        }

                        if (foundMatch){
                            ids.add(i);
                            matches.add(y);
                        }

                    }

                    y++;
                }

            }

            x++;
        }


      //Update key in the results with the simpliest company name
        HashMap<String, ArrayList<Long>> output = new HashMap<>();
        //console.log("Reduced " + companies.size() + " companies to " + results.size());
        int numIDs = 0;
        Iterator<String> i2 = results.keySet().iterator();
        while (i2.hasNext()){
            String name = i2.next();
            ArrayList<Long> ids = results.get(name);
            numIDs+=ids.size();


          //If there are multiple companies, find simplest name
            if (ids.size()>1){

                TreeMap<Integer, String> names = new TreeMap<>();
                for (Long id : ids){
                    String n = companies.get(id);
                    n = getCompanyName(n);
                    int numWords = n.split(" ").length;
                    names.put(numWords, n);
                }

                int numWords = names.firstKey();
                if (numWords==1){
                    Iterator<Integer> i3 = names.keySet().iterator();
                    while (i3.hasNext()){
                        numWords = i3.next();
                        if (numWords>1){
                            name = names.get(numWords);
                        }
                    }
                }
                else{
                    name = names.get(numWords);
                }
            }


            output.put(name, ids);
            //console.log(name, ids);

        }
        //console.log("Results contain " + numIDs + "/" + companies.size() + " IDs");
        return output;
    }


  //**************************************************************************
  //** getCompanyName
  //**************************************************************************
  /** Used to clean up a company name by removing company suffixes, unwanted
   *  punctuation, and words in parenthesis
   */
    public static String getCompanyName(String name){
        name = name.replaceAll("[^a-zA-Z0-9() ]", " ");
        name = name.replace("(", " (").replace(")", ") ");

        while (name.contains("  ")) name = name.replace("  ", " ");
        name = name.trim();


        name = removeParenthesis(name);
        name = removeCompanySuffix(name);
        return name;
    }


  //**************************************************************************
  //** removeCompanySuffix
  //**************************************************************************
  /** Removes common suffixes found in company names (e.g. Ltd.)
   */
    private static String removeCompanySuffix(String name){
        String uname = name.toUpperCase();
        for (String s : companySuffixes){
            if (uname.endsWith(" " + s)){
                int len = uname.length() - (s.length()+1);
                uname = uname.substring(0,len).trim();
                name = name.substring(0,len).trim();
            }
        }
        return name;
    }


  //**************************************************************************
  //** removeParenthesis
  //**************************************************************************
    private static String removeParenthesis(String name){
        while (true){
            int idx = name.indexOf("(");
            if (idx==-1) break;
            String a = name.substring(0,idx).trim();
            String b = name.substring(idx);
            idx = b.indexOf(")");
            if (idx==-1) b = "";
            else b = b.substring(idx+1).trim();
            name = a+" "+b;
        }
        while (name.contains("  ")) name = name.replace("  ", " ");
        return name.trim();
    }

}