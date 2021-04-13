package bluewave.auth;

import java.util.*;
import javax.naming.*;
import javax.naming.ldap.InitialLdapContext;
import static javaxt.utils.Console.*;


public class LDAP {

    private int port = 389;
    private String host;
    private String dc;


  //**************************************************************************
  //** setHost
  //**************************************************************************
  /** Used to set the IP address or hostname of the LDAP server
   */
    public void setHost(String host){
        if (host.contains(":")){
            String[] arr = host.split(":");
            this.host = arr[0];
            this.port = Integer.parseInt(arr[1]);
        }
        else{
            this.host = host;
        }
    }


  //**************************************************************************
  //** setDomain
  //**************************************************************************
  /** Used to set the domain name associated with the LDAP server
   *  @param domain Example: "mydomain.com"
   */
    public void setDomain(String domainName){
        dc = toDC(domainName);
    }


  //**************************************************************************
  //** authenticate
  //**************************************************************************
  /** Used to authenticate a given user against an LDAP server. Throws an
   *  error if the username and/or password are invalid.
   */
    public void authenticate(String username, String password) throws Exception {

        String url = "ldap://" + host + ":" + port;

        String principal = "cn=" + username;
        if (!username.equals("admin")) principal += ",ou=users";
        principal += "," + dc;


        Properties props = new Properties();
        props.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
        props.put(Context.PROVIDER_URL, url);
        props.put(Context.SECURITY_PRINCIPAL, principal);
        props.put(Context.SECURITY_CREDENTIALS, password);
        if (url.toUpperCase().startsWith("LDAPS://")) {
            props.put(Context.SECURITY_PROTOCOL, "ssl");
            props.put(Context.SECURITY_AUTHENTICATION, "simple");
            String socketFactory = bluewave.auth.ZSocketFactory.class.getCanonicalName();
            props.put("java.naming.ldap.factory.socket", socketFactory);
        }


        InitialLdapContext context = new InitialLdapContext(props, null);
        console.log(context.toString());
        context.close();
    }


  //**************************************************************************
  //** toDC
  //**************************************************************************
  /** Returns a string "DC=sub,DC=mydomain,DC=com" string
   *  @param domainName Example sub.mydomain.com
   */
    private static String toDC(String domainName) {
        StringBuilder buf = new StringBuilder();
        for (String token : domainName.split("\\.")) {
            if(token.length()==0) continue;
            if(buf.length()>0)  buf.append(",");
            buf.append("dc=").append(token);
        }
        return buf.toString();
    }
}