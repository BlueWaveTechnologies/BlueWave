package bluewave.queries;

//******************************************************************************
//**  Query
//******************************************************************************
/**
 *   Used to encapsulate a query found in the queries package. Queries in this
 *   package may contain both sql and cypher statements in a single file. This
 *   class is used to parse the file and return a statement for each dialect.
 *
 ******************************************************************************/

public class Query {
    
    private String query;
    public Query(String query){
        this.query = query;
    }
    public String getCypher(){
        return getQuery("cypher");
    }
    public String getSQL(){
        return getQuery("sql");
    }
    
  //**************************************************************************
  //** getQuery
  //**************************************************************************
    private String getQuery(String dialect){
        if (dialect.equals("cypher") || dialect.equals("sql")){
            for (String str : query.split(";")){
                str = removeComments(str);
                String u = str.toUpperCase();
                if (u.startsWith("MATCH") && dialect.equals("cypher")){
                    return str;
                }
                if (u.startsWith("SELECT") && dialect.equals("sql")){
                    return str;
                }
            }
        }

        return null;
    }

  //**************************************************************************
  //** removeComments
  //**************************************************************************
    private static String removeComments(String sql){
        StringBuilder str = new StringBuilder();
        for (String s : sql.split("\n")){
            String t = s.trim();
            if (t.length()==0 || t.startsWith("--")) continue;
            str.append(s);
            str.append("\n");
        }
        return str.toString().trim();
    }
}