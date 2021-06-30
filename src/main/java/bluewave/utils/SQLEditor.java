package bluewave.utils;

import java.util.ArrayList;
import javaxt.express.utils.StringUtils;
import javaxt.sql.Model;

//******************************************************************************
//**  SQLEditor
//******************************************************************************
/**
 *   Used specifically by WebServices to apply filters when accessing Models
 *
 ******************************************************************************/

public class SQLEditor {
    private javaxt.sql.Parser parser;
    private Class c;
    private String sql;


  //**************************************************************************
  //** SQLEditor
  //**************************************************************************
    public SQLEditor(String sql, Class c){
        this.sql = sql;
        this.c = c;
    }


  //**************************************************************************
  //** addConstraint
  //**************************************************************************
  /** Used to update the where clause by adding a new where constraint
   */
    public void addConstraint(String whereClause){
        if (parser==null) parser = new javaxt.sql.Parser(sql);
        String where = parser.getWhereString();
        if (where==null) where = "";
        else where += " and ";
        where += whereClause;
        parser.setWhere(where);
        sql = parser.toString();
    }


  //**************************************************************************
  //** removeField
  //**************************************************************************
  /** Used to update the select clause by removing a field
   */
    public void removeField(String field){
        if (parser==null) parser = new javaxt.sql.Parser(sql);

      //Get select statements
        ArrayList<javaxt.sql.Parser.SelectStatement> selectStatements = new ArrayList<>();
        boolean appendAll = false;
        for (javaxt.sql.Parser.SelectStatement stmt : parser.getSelectStatements()){
            if (stmt.getField().contains("*")){
                appendAll = true;
            }
            else{
                selectStatements.add(stmt);
            }
        }


      //Replace "*" clause with actual field names
        if (appendAll){
            selectStatements.add(parser.new SelectStatement("id"));
            for (java.lang.reflect.Field f : c.getDeclaredFields()){
                String fieldName = f.getName();
                Class fieldType = f.getType();

                if (fieldType.equals(java.util.ArrayList.class)){
                    continue;
                }

                fieldName = StringUtils.camelCaseToUnderScore(fieldName);

                if (fieldType.getSuperclass().equals(Model.class)){
                    fieldName += "_id";
                }

                selectStatements.add(parser.new SelectStatement(fieldName));
            }
        }


      //Build new select statement without the user-specified field
        StringBuilder str = new StringBuilder();
        for (javaxt.sql.Parser.SelectStatement stmt : selectStatements){
            if (stmt.getColumnName().equalsIgnoreCase(field)){
                continue;
            }
            if (str.length()>0) str.append(", ");
            str.append(stmt.toString());
        }


      //Update sql
        parser.setSelect(str.toString());
        sql = parser.toString();
    }


  //**************************************************************************
  //** getSQL
  //**************************************************************************
  /** Returns the modified SQL statement
   */
    public String getSQL(){
        return sql;
    }
}