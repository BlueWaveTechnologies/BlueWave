package bluewave.utils;

public class StringUtils {
    
    
  //Common suffixes found in company name. Order is important
    private static String[] companySuffixes = new String[]{
    "LTD","LIMITED","LLC","INC","SDN BHD","AB","GMBH",
    "CO","CORP","CORPORATION",
    "PUBLIC COMPANY","GLOBAL COMPANY","COMPANY","PUBLIC"};
        
    
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