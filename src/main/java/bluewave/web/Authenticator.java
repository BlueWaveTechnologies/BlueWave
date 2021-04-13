package bluewave.web;
import bluewave.app.User;
import javaxt.http.servlet.*;
import javaxt.json.JSONObject;
import java.util.concurrent.ConcurrentHashMap;

//******************************************************************************
//**  ServiceAuthentication
//******************************************************************************
/**
 *   Used to authenticate HTTP requests using "BASIC" authentication. This
 *   class is typically instantiated within a servlet constructor and assigned
 *   to the servlet via the setAuthenticator() method. Once an Authenticator
 *   is defined, several security-related methods will be available via the
 *   HttpServletRequest object (e.g. getCredentials(), getUserPrincipal(),
 *   authenticate(), etc).
 *
 ******************************************************************************/

public class Authenticator implements javaxt.http.servlet.Authenticator {

  //Global variables
    private static final ConcurrentHashMap<String, JSONObject> cache =
        new ConcurrentHashMap<String, JSONObject>();
    private long cacheExpiration = 30000; //30 seconds

  //Local variables
    private String[] credentials;
    private User user;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Constructor that can be used to set up global variables.
   */
    public Authenticator(){
    }


  //**************************************************************************
  //** Constructor
  //**************************************************************************
  /** Creates a new instance of this class and parse user credentials. Called
   *  with each HTTP request via the newInstance() method.
   */
    public Authenticator(HttpServletRequest request){
        String authorization = request.getHeader("Authorization");
        if (authorization!=null){
            String authenticationScheme = authorization.substring(0, authorization.indexOf(" "));
            if (authenticationScheme.equalsIgnoreCase(this.getAuthType())){

              //Parse credentials
                String credentials = decode(authorization.substring(authorization.indexOf(" ")+1));
                String username = credentials.substring(0, credentials.indexOf(":")).toLowerCase();
                String password = credentials.substring(credentials.indexOf(":")+1);
                this.credentials = new String[]{username, password};

                if (username.equals("logout") && password.equals("logout")) return;



              //Web applications can be very chatty. To load a single page, a browser
              //often has to make multiple web requests (e.g. get images, stylesheets,
              //javascript, etc.). Instead of authenticating users with each request,
              //we cache the last valid login time. If the last valid login was less
              //than 3000 ms ago, we skip the authentication process.


                User user = null;
                Long lastUpdate = null;
                synchronized(cache){
                    JSONObject json = cache.get(username);
                    if (json!=null){
                        user = (User) json.get("user").toObject();
                        lastUpdate = json.get("lastUpdate").toLong();
                    }
                }

                boolean authenticate = true;
                if (lastUpdate!=null){
                    if (System.currentTimeMillis()-lastUpdate<cacheExpiration){
                        authenticate = false;
                    }
                }

                if (authenticate){
                    boolean authenticated = false;
                    try{
                        user = getUser(username);
                        if (user!=null){
                            authenticated = user.authenticate(password);
                            this.user = user;
                        }
                    }
                    catch(Exception e){
                        //e.printStackTrace();
                    }


                    if (authenticated){
                        JSONObject json = new JSONObject();
                        json.set("user", user);
                        json.set("lastUpdate", System.currentTimeMillis());
                        synchronized(cache){
                            cache.put(username, json);
                            cache.notifyAll();
                        }
                    }
                    else{
                        synchronized(cache){
                            cache.remove(username);
                            cache.notifyAll();
                        }
                    }
                }
                else{
                    this.user = user;
                }

            }
        }
    }


    private User getUser(String username){
        User user;
        try{
            user = User.get("username=", username);
            boolean isActive = user.getActive();
            if (!isActive) user = null;
        }
        catch(Exception e){
            user = null;
        }
        return user;
    }


  //**************************************************************************
  //** newInstance
  //**************************************************************************
  /** Creates a new instance of this class. Called with each HTTP request.
   */
    public Authenticator newInstance(HttpServletRequest request){
        return new Authenticator(request);
    }


  //**************************************************************************
  //** getCredentials
  //**************************************************************************
  /** Returns username/password associated with an HTTP request.
   */
    public String[] getCredentials() {
        return credentials;
    }


  //**************************************************************************
  //** authenticate
  //**************************************************************************
  /** Used to authenticate a client request. If the Authenticator fails to
   *  authenticate the client, this method throws a ServletException.
   */
    public void authenticate() throws ServletException {
        if (user==null) throw new ServletException();
    }


  //**************************************************************************
  //** getPrinciple
  //**************************************************************************
  /** Returns an implementation of a java.security.Principal.
   */
    public User getPrinciple(){
        return user;
    }


  //**************************************************************************
  //** isUserInRole
  //**************************************************************************
  /** Not implemented. Returns a null.
   */
    public boolean isUserInRole(String role){
        return false;
    }


  //**************************************************************************
  //** getAuthType
  //**************************************************************************
  /** Returns the authentication scheme used to authenticate clients. In this
   *  case, we use "BASIC" authentication.
   */
    public String getAuthType(){
        return BASIC_AUTH;
    }


    private String decode(String credentials){
        try{
            return new String(javaxt.utils.Base64.decode(credentials));
        }
        catch(Exception e){
            return null;
        }
    }
}