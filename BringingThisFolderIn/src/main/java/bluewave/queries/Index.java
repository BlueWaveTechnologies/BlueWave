package bluewave.queries;
import java.util.concurrent.ConcurrentHashMap;

public class Index {
    private static ConcurrentHashMap<String, String> queries = new ConcurrentHashMap<>();

  //**************************************************************************
  //** getQuery
  //**************************************************************************
    public static String getQuery(String file){
        return getQuery(file, null);
    }

  //**************************************************************************
  //** getQuery
  //**************************************************************************
  /** Returns a sql statement/script found in this directory
   *  @param file Name of the sql script, excluding the file extension
   *  @param dialect Query dialect (e.g. sql or cypher)
   */
    public static String getQuery(String file, String dialect){
        synchronized(queries){
            if (queries.isEmpty()){
                for (javaxt.io.Jar.Entry entry : new javaxt.io.Jar(Index.class).getEntries()){
                    String relpath = entry.getName();
                    if (relpath.endsWith(".sql")){
                        String name = relpath.substring(relpath.lastIndexOf("/")+1);
                        name = name.substring(0, name.indexOf("."));
                        String sql = entry.getText();
                        queries.put(name, sql);
                    }
                }
            }


            String sql = queries.get(file);
            if (dialect==null) return sql;
            else dialect = dialect.toLowerCase();

            if (dialect.equals("cypher") || dialect.equals("sql")){
                for (String str : sql.split(";")){
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

            return sql;
        }
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