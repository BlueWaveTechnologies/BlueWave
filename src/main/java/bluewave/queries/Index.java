package bluewave.queries;
import bluewave.Config;
import bluewave.Plugin;
import java.util.concurrent.ConcurrentHashMap;

public class Index {
    private static ConcurrentHashMap<String, Query> queries = new ConcurrentHashMap<>();

  //**************************************************************************
  //** getQuery
  //**************************************************************************
  /** Returns a query found in this directory
   *  @param fileName Name of the sql script, excluding the file extension
   */
    public static Query getQuery(String fileName){

        Query query = null;
        synchronized(queries){
            if (queries.isEmpty()){
                for (javaxt.io.Jar.Entry entry : new javaxt.io.Jar(Index.class).getEntries()){
                    String relpath = entry.getName();
                    if (relpath.endsWith(".sql")){
                        String name = relpath.substring(relpath.lastIndexOf("/")+1);
                        name = name.substring(0, name.indexOf(".")).toLowerCase();
                        queries.put(name, new Query(entry.getText()));
                    }
                }

                for (Plugin plugin : Config.getPlugins()){
                    javaxt.io.Directory q = new javaxt.io.Directory(plugin.getDirectory() + "queries");
                    if (!q.exists()) continue;
                    for (javaxt.io.File file : q.getFiles(true)){
                        String name = file.getName(false).toLowerCase();
                        queries.put(name, new Query(file.getText()));
                    }
                }
            }

            return queries.get(fileName.toLowerCase());
        }
    }


  //**************************************************************************
  //** getQuery
  //**************************************************************************
  /** Returns a sql or cypher statement found in this directory
   *  @param fileName Name of the sql script, excluding the file extension
   *  @param dialect Query dialect (e.g. sql or cypher)
   */
    public static String getQuery(String fileName, String dialect){
        Query query = getQuery(fileName);
        if (query!=null) {
            if (dialect.equals("cypher")) return query.getCypher();
            if (dialect.equals("sql")) return query.getSQL();
        }
        return null;
    }
}