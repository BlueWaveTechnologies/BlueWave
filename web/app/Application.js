if(!bluewave) var bluewave={};

//******************************************************************************
//**  Application
//******************************************************************************
/**
 *   Primary user interface for the app.
 *
 ******************************************************************************/

bluewave.Application = function(parent, config) {

    var me = this;
    var appName;
    var waitmask;
    var auth = new javaxt.dhtml.Authentication("login", "logoff");
    var currUser;
    var ws; //web socket listener

  //Header components
    var profileButton, menuButton; //header buttons
    var mainMenu, profileMenu;
    var callout;


  //Title components
    var titleDiv;
    var backButton, nextButton;


  //Main body
    var body;


  //Dashboard components
    var carousel;
    var apps = [];
    var currApp, currDashboardItem;


  //Panels
  //# dashboardPanel appears to be the main panel, and admin/explorer are subpanels controlled within dashboardPanel
    var dashboardPanel, adminPanel, explorerPanel;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Set global configuration variables
        if (!config) config = {};
        //@ build html with javaxt
        if (!config.fx) config.fx = new javaxt.dhtml.Effects();
        if (!config.style) config.style = javaxt.dhtml.style.default;
        //@ generate global waitmask with javaxt
        //! what is a waitmask in this event?
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        //@ set current waitmask as global waitmask
        waitmask = config.waitmask;

        if (!waitmask.el.parentNode) document.body.appendChild(waitmask.el);
        //^ show waitmask
        //! how do you print this to see what it is?
        console.log(`show waitmask ${waitmask.el.parentNode} `);

        //^ show document body
        //! how do we show this specific portion of the rendered html?
        element_to_print = document.body;
        console.dir(`document body reads as ${element_to_print}`);

        //@ if datastores have not been initialized, initialize them
        if (!config.dataStores) config.dataStores = {};
        appName = config.appName;
        //^ log appName 
        //# when undefined, appName hasn't been declared
        console.log(`log registered appName ${appName}`);
        console.log(`log registered config.appName ${config.appName}`);
        if (!appName){
            appName = "";
            config.appName = appName;
            get("appinfo", {
                success: function(appInfo){
                    appName = appInfo.name;
                    config.appName = appName;
                }
            });
        }
        //^ log appName 
        console.log(`log registered appName ${appName}`);
        console.log(`log registered config.appName ${config.appName}`);
        console.log("when field empty above^^^^^^^^^^, appname is empty quotes");

      //Prevent native browser shortcuts (ctrl+a,h,o,p,s,...)
        document.addEventListener("keydown", function(e){
            if ((e.keyCode == 65 || e.keyCode == 72 || e.keyCode == 79 || e.keyCode == 80 || e.keyCode == 83) &&
            (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });


      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Create header nav
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        //# this is where createHeader is called. Within init
        createHeader(td);



      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);


      //Create footer
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createFooter(td);



        parent.appendChild(table);
        me.el = table;

        onRender(table, function(){
            //! what is the table?
            //^ print table
            //! cannot print table. it is an HTMLTableElement. How do we print those?
            //!A print these using the .innerHTML tag
            console.log(`print table line 136 is ${table.innerHTML}`);
            //carousel.resize();
            //# note that dashboard back and next are hidden elements of this page and are called in other ways.

        });

    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
  //! do we recreate the header anytime we change views? ++when is this function called?
  //!A called one time when app is initialized | called in init function
    var createHeader = function(parent){
        //v test when this function is called
        console.log(`create header was called for parent (line 154) ${parent.innerText} `);
        var div = document.createElement("div");
        div.className = "app-header";
        parent.appendChild(div);


        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;

        //! when is fn used?
        //!A fn function is called when using the "BlueWave" return home icon in top left of browser
        //!A additionally, this function is only used when using that icon. No other pages.
        var fn = function(){
            //^ log when this function is called
            //$ opportunity to test functionality with Selenium. Verify we return to homepage
            console.log("fn function was called");
            if (currUser){
                if (adminPanel) adminPanel.hide();
                //! what exactly does showing the dashboardPanel do? ++when raisePanel holds additional functionality
                //!a comments below
                //# dashboard panel is a carousel. by using dashboardPanel.show() the carousel it brings it onscreen.
                //# raisePanel renders a specific panel onscreen, on that carousel.
                //@ show the carousel onscreen
                dashboardPanel.show();
                raisePanel(bluewave.Homepage, true);
            }
            else{
                raisePanel(apps[0].app, true); //might not be the homepage if standalone
            }
        };

        td = document.createElement("td");
        tr.appendChild(td);
        var icon = document.createElement("div");
        icon.className = "app-header-icon noselect";
        td.appendChild(icon);
        td.style.cursor = "pointer";
        //# fn function used here
        td.onclick = fn;


        td = document.createElement("td");
        td.style.width = "100%";
        tr.appendChild(td);

      //Create profile button
        td = document.createElement("td");
        tr.appendChild(td);
        profileButton = document.createElement("div");
        profileButton.className = "app-header-profile noselect";
        profileButton.onclick = function(e){
            if (currUser) showMenu(getProfileMenu(), this);
        };
        addShowHide(profileButton);
        td.appendChild(profileButton);


      //Create menu button
        td = document.createElement("td");
        tr.appendChild(td);
        menuButton = document.createElement("div");
        menuButton.className = "app-header-menu noselect";
        var icon = document.createElement("i");
        icon.className = "fas fa-ellipsis-v";
        menuButton.appendChild(icon);
        menuButton.onclick = function(e){
            if (currUser) showMenu(getMainMenu(), this);
        };
        addShowHide(menuButton);
        td.appendChild(menuButton);


        div.appendChild(table);
    };


  //**************************************************************************
  //** createFooter
  //**************************************************************************
    var createFooter = function(parent){

    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){


        var table = createTable();
        parent.appendChild(table);
        var tbody = table.firstChild;
        var tr, td;


      //Create Dashboard Header
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        var div = document.createElement("div");
        div.style.position = "relative";
        td.appendChild(div);

        var createButton = function(className){
            var btn = document.createElement("div");
            btn.className = className;
            div.appendChild(btn);
            addShowHide(btn);
            return btn;
        };
        //# review dashboard-back function of createButton
        backButton = createButton("dashboard-back");
        //! where is the backbutton? I have not seen. What is the backbutton visualized as?
        //!a the backbutton is present only on the shared dashboard section
        //!a it appears as a sideways carrot
        backButton.onclick = function(){
            var dashboardItems = getDashboardItems();
            for (var i=0; i<dashboardItems.length; i++){
                var dashboardItem = dashboardItems[i];
                if (dashboardItem === currDashboardItem){
                    var idx;
                    if (i===0){
                        idx = dashboardItems.length-1;
                    }
                    else{
                        idx = i-1;
                    }
                    //! what is idx registering as?
                    //!a idx is the current page of a shared dashboard that we are on, minus 1
                    //!a idx represents the page we want to go to, when we use the backbutton
                    console.log("idx is registering as " + idx);
                    renderDashboard(dashboardItems[idx], true);
                    break;
                }
            }
        };
        backButton.hide();
        //# Set next-page functionality in Shared Dashboards
        nextButton = createButton("dashboard-next");
        nextButton.onclick = function(){
            var dashboardItems = getDashboardItems();
            for (var i=0; i<dashboardItems.length; i++){
                var dashboardItem = dashboardItems[i];
                if (dashboardItem === currDashboardItem){
                    var idx;
                    if (i+1===dashboardItems.length){
                        idx = 0;
                    }
                    else{
                        //# idx represents the page id# we want to go, when we use the forward button
                        //# 
                        idx = i+1;
                    }
                    renderDashboard(dashboardItems[idx], false);
                    break;
                }
            }
            //^ next button + which page we were on + which page we go to
            //! how do we log the current dashboard title to console?
            console.log(`next button used - current page:${i} ${dashboardItems[i]} - next page:${idx}`)
        };
        nextButton.hide();

        titleDiv = document.createElement("div");
        titleDiv.className = "dashboard-title noselect";
        div.appendChild(titleDiv);


      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        body = td;


      //Create carousel
      //# carousel is javaxt element
        carousel = new javaxt.dhtml.Carousel(body, {
            drag: false,
            loop: true,
            animate: true,
            animationSteps: 600,
            transitionEffect: "easeInOutCubic",
            fx: config.fx
        });


      //Create 2 panels for the carousel
        for (var i=0; i<2; i++){
            var panel = document.createElement("div");
            panel.style.height = "100%";
            carousel.add(panel);
        }


      //Add event handlers
        carousel.beforeChange = function(){
            me.setTitle("");
            backButton.hide();
            nextButton.hide();
        };


        carousel.onChange = function(currPanel){
            if (currApp){

              //Check if the currPanel is a clone created by the carousel.
              //If so, replace content with the currApp
                if (currApp.el.parentNode!==currPanel){
                    currPanel.innerHTML = "";
                    currApp.el.parentNode.removeChild(currApp.el);
                    currPanel.appendChild(currApp.el);
                }


              //Update title
                if (currApp.getTitle) me.setTitle(currApp.getTitle());


              //Update buttons
                if (apps.length>1){
                    backButton.show();
                    nextButton.show();
                }
                if (currApp instanceof bluewave.Homepage){
                    backButton.hide();
                }

            }
        };
        //# our dashboardPanel elements are prebuilt carousel objects
        //! where else is dashboardPanel used?
        dashboardPanel = carousel;
    };


  //**************************************************************************
  //** setTitle
  //**************************************************************************
    this.setTitle = function(str){
        titleDiv.innerHTML = str;
        if (appName.length>0){
            document.title = appName + (str.length>0 ? (" - " + str) : "");
        }
        else{
            document.title = str;
        }

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(user){
        //^
        console.log("update function called of user " + user.username);
        currUser = user;
        me.setTitle("");
        currDashboardItem = null;


      //If no user is supplied, then we are running in stand-alone mode
        if (!user){
            console.log("running without a user");
            menuButton.hide();
            console.log("hide menubutton");
            profileButton.hide();
            console.log("hide profile button");
            dashboardPanel.show();

          //Create dashboards
            var dashboards = [
            "SupplyChain", "ImportSummary", "EUAMap",
            "ProductPurchases", "GlobalSupplyChain"];

            console.log("create dashboards line 386");

            for (var i in dashboards){
                console.log("create dashboard " + i),
                dashboards[i] = {
                    id: i,
                    name: dashboards[i],
                    className: "bluewave.dashboards." + dashboards[i]
                }
            }




          //Convert the dashboards array into a datastore
            dashboards = new javaxt.dhtml.DataStore(dashboards);
            console.log("convert dashboard array");
            //@ storedashboards as locally stored array for dashboards
            //^
            console.log(`storing the current dashboards as a datastore: ${dashboards}`);
            config.dataStores["Dashboard"] = dashboards;


          //Add homepage
            // console.log("raising the homepage panel 407");
            //! bluewave.Homepage
            var homepage = raisePanel(bluewave.Homepage);
            //! onClick variable
            homepage.onClick = function(dashboardItem){
                renderDashboard(dashboardItem);
            };
            me.setTitle(homepage.getTitle());

            return;
        }

        dashboardPanel.show();
        menuButton.show();
        profileButton.innerHTML = user.username.substring(0,1);
        waitmask.show();


      //Add app to parent as needed (e.g. after logoff)
        if (!me.el.parentNode){
            me.el.style.opacity = 0;
            parent.appendChild(me.el);
            config.fx.fadeIn(me.el,"easeIn",1000);
        }


      //Create new panels
        get("dashboards?fields=id,name,className",{
            success: function(dashboards) {

              //Convert the dashboards array into a datastore
                dashboards = new javaxt.dhtml.DataStore(dashboards);
                config.dataStores["Dashboard"] = dashboards;


              //Add homepage
                var homepage = raisePanel(bluewave.Homepage);
                homepage.onClick = function(dashboardItem){
                    renderDashboard(dashboardItem);
                };
                me.setTitle(homepage.getTitle());


              //Hide waitmask
                waitmask.hide();
            },
            failure: function(request){
                alert(request);
                waitmask.hide();
            }
        });




      //Create web socket listener
        if (!ws) ws = new javaxt.dhtml.WebSocket({
            url: "/ws",
            onMessage: function(msg){
                var arr = msg.split(",");
                var op = arr[0];
                var model = arr[1];
                var id = parseInt(arr[2]);
                var userID = parseInt(arr[3]);
                onChange(op,model,id,userID);
            }
        });
    };


  //**************************************************************************
  //** onChange
  //**************************************************************************
  /** Used to manage updates by other users
   */
    var onChange = function(op, model, id, userID){


      //Update currUser as needed
        if (model=="User" && (op=="update" || op=="delete")){
            if (id===currUser){
                if (op=="delete"){
                    logoff();
                    return;
                }
                else{
                    get("user?id=" + id, {
                        success: function(user){
                            if (user.accessLevel!==currUser.accessLevel){
                                logoff();
                                return;
                            }
                            else{
                                for (var key in user) {
                                    if (user.hasOwnProperty(key)){
                                        currUser[key] = user[key];
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }



      //Update stores
        var store = config.dataStores[model];
        if (store){
            if (op=="delete"){
                for (var i=0; i<store.length; i++){
                    var item = store.get(i);
                    if (item.id===id){
                        store.removeAt(i);
                        break;
                    }
                }
            }
            else{
                get(model + "?id=" + id, {
                    success: function(obj){
                        if (op=="create"){
                            store.add(obj);
                        }
                        else{
                            for (var i=0; i<store.length; i++){
                                var item = store.get(i);
                                if (item.id===id){
                                    store.set(i, obj);
                                    break;
                                }
                            }
                        }
                    }
                });
            }
        }



      //Update Explorer as needed
        if (model==="Dashboard"){
            if (explorerPanel){

                if (id===explorerPanel.getDashboardID()){

                    if (op==="delete"){
                        explorerPanel.setReadOnly(true);
                        explorerPanel.clear();
                        explorerPanel.onDelete();
                    }

                    if (op==="update"){
                        if (currUser.id!==userID){
                            confirm("Dashboard has been modified by another user. Would you like to update?",{
                                leftButton: {label: "Yes", value: true},
                                rightButton: {label: "No", value: false},
                                callback: function(yes){
                                    if (yes){
                                        waitmask.show();
                                        var readOnly = explorerPanel.isReadOnly();
                                        get("dashboard?id="+id,{
                                            success: function(dashboard){
                                                waitmask.hide();
                                                explorerPanel.update(dashboard, readOnly, "Dashboard");
                                                me.setTitle(explorerPanel.getTitle());
                                            },
                                            failure: function(){
                                                waitmask.hide();
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }



      //Update Homepage and Explorer as DashboardUsers are created, edited, or removed from the database
        if (model==="DashboardUser"){
            var dashboards = config.dataStores["Dashboard"];


          //Update "dashboards" DataStore whenever DashboardUsers are created
          //Views like the Homepage will update automatically
            if (op==="create"){
                get("DashboardUsers?userID="+currUser.id,{
                    success: function(arr){
                        var newDashboards = [];
                        for (var i=0; i<arr.length; i++){
                            var dashboardID = arr[i].dashboardID;
                            var foundMatch = false;
                            for (var j=0; j<dashboards.length; j++){
                                var dashboard = dashboards.get(j);
                                if (dashboard.id===dashboardID){
                                    foundMatch = true;
                                    break;
                                }
                            }
                            if (!foundMatch){
                                newDashboards.push(dashboardID);
                                break;
                            }
                        }
                        if (newDashboards.length>0){
                            get("dashboards?fields=id,name,className&id="+newDashboards.join(","),{
                                success: function(arr) {
                                    for (var i=0; i<arr.length; i++){
                                        dashboards.add(arr[i]);
                                    }
                                }
                            });
                        }
                    }
                });
            }

            if (explorerPanel){
                var dashboardID = explorerPanel.getDashboardID();

                if (!isNaN(dashboardID)){
                    if (op==="update"){
                        get("DashboardUsers?id="+id,{
                            success: function(arr){
                                if (arr.length===0){

                                }
                                else{
                                    var dashboardUser = arr[0];
                                    if (dashboardUser.userID===currUser.id &&
                                        dashboardUser.dashboardID===dashboardID){
                                        explorerPanel.setReadOnly(dashboardUser.readOnly);
                                    }
                                }
                            }
                        });
                    }
                    else if (op==="delete"){
                        get("DashboardUsers?dashboardID="+id+"&userID="+currUser.id,{
                            success: function(arr){
                                if (arr.length===0){
                                    explorerPanel.setReadOnly(true);
                                    explorerPanel.clear();
                                    explorerPanel.onDelete();
                                }
                            }
                        });
                    }
                }
            }


          //Update "dashboards" DataStore whenever DashboardUsers are deleted
          //Views like the Homepage will update automatically
            if (op==="delete"){
                get("dashboards?fields=id",{
                    success: function(arr) {
                        var deletions = [];

                        for (var i=0; i<dashboards.length; i++){
                            var dashboard = dashboards.get(i);
                            var foundMatch = false;
                            for (var j=0; j<arr.length; j++){
                                if (arr[j].id===dashboard.id){
                                    foundMatch = true;
                                    break;
                                }
                            }
                            if (!foundMatch) deletions.push(dashboard.id);
                        }


                        for (var i=0; i<deletions.length; i++){
                            for (var j=0; j<dashboards.length; j++){
                                var dashboard = dashboards.get(j);
                                if (dashboard.id===deletions[i]){
                                    dashboards.removeAt(j);
                                    break;
                                }
                            }
                        }

                    }
                });
            }
        }
    };


  //**************************************************************************
  //** raisePanel
  //**************************************************************************
  /** Used to bring a panel into view
   *  @param obj Either a class or an instance of a class
   */
    var raisePanel = function(obj, slideBack){
        //! are we getting passed the dashboard panel object to pull up?
        //!a yes
        //! constructor function
        //^
        console.log("raise panel function called line 716");
        //# we are getting passed this object to the raisePanel function. This object is a complete panel that we'd like to show.
        //# pre-built object (obj)
        console.log(`the current object we'd like to pull up is ${obj}`);

      //Find panels in the carousel
        var currPage, nextPage;
        var panels = carousel.getPanels();
        for (var i=0; i<panels.length; i++){
            var panel = panels[i];
            var el = panel.div;
            if (panel.isVisible){
                currPage = el;
            }
            else{
                nextPage = el;
            }
        }
        if (!currPage) currPage = panels[0].div; //strange!


      //Select panel to use
        var div;
        if (currPage.childNodes.length===0){
            div = currPage;
        }
        else{
            div = nextPage;
            var el = nextPage.childNodes[0];
            if (el) nextPage.removeChild(el);
        }


        var app, isNew=false;
        if (typeof obj === 'function') { //obj is a class (vs instance of a class)

          //Check if the class has been instantiated
            for (var i=0; i<apps.length; i++){
                if (apps[i].cls===obj){
                    app = apps[i].app;
                    break;
                }
            }


          //Instantiate class as needed
            if (!app){
                app = new obj(div, config);
                app.onUpdate = function(){
                    console.log("setting the current app with onUpdate function "+ app.getTitle());
                    if (app===currApp) me.setTitle(app.getTitle());
                };
                app.onDelete = function(){
                    for (var i=0; i<apps.length; i++){
                        if (apps[i].app===app){
                            apps.splice(i, 1);
                            break;
                        }
                    }
                    raisePanel(bluewave.Homepage);
                };
                apps.push({
                    app: app,
                    cls: obj
                });
                app.update();
                isNew = true;
            }
        }
        else{
            app = obj;
        }



        if (app === currApp){
            //@ when the view we are looking to change to (app variable) is already in view we want to just return this view, without using slide
            //$ this can be tested by going to the homepage and clicking the home button in the top left - also can test each other page
            //% this only works while on the homepage.
            console.log("Already in view!");
            me.setTitle(app.getTitle());
            return app;
        }
        else{
            //! does the isNew function validate that the current page is a new page?
            //!a yes
            //@ render the current page. do not change views
            if (!isNew) div.appendChild(app.el);
            //@ render new view via the carousel functions
            if (div===nextPage){
                //! what does the carousel.back function do?
                if (slideBack===true) carousel.back();
                //! what does the carousel.next function do?
                else carousel.next();
                //! check the carousel.onchange function, may be a tool used in carousel.next
                //Note: title is updated in the carousel.onChange() function
            }
            else{
                me.setTitle(app.getTitle());
            }
            //@ currApp is app as an object that is instantiated, to later be used and editted.
            //% this does not show the current app title accurately when swapping off of the homepage view. (functions only on homepage)
            currApp = app;
            console.log("current app is " + currApp.getTitle());
            console.log("current app is (second attempt) " + app.getTitle());

            return app;
            //! where is this function used?
            //! where is currApp later used as an object?
        }
    };


  //**************************************************************************
  //** renderDashboard
  //**************************************************************************
  /** Used to render a dashboard in the carousel
   *  @param dashboardItem DashboardItem from the homepage
   *  @param slideBack If true, slides the carousel back. Otherwise, slides
   *  the carousel forward
   */
    //! when is this function called and where? How can we trigger it for testing. //$
    //@ dashboard item is the returned (current) dashboard view 
    //! which sub-functions/variables are linked to dashboardItem? i see .dashboard
    var renderDashboard = function(dashboardItem, slideBack){
        //^
        //! what can we add to console loggign that is more specific to identity? //$
        console.log(`using renderDashboard function to render ${dashboardItem.dashboardItem} |`);
        currDashboardItem = dashboardItem;
        var dashboard = dashboardItem.dashboard;


        if (dashboard.className && dashboard.className.indexOf("bluewave.dashboards.")===0){
            //@ if dashboard.app is not initialized
            if (!dashboard.app){
                //! is slideback a functionality of swapping frames? (review it's code)
                //!A | slideBack is a true/false variable for determining whether to slide back using the carousel.back function
                //! dashboard.className is the name of the panel class?
                //! eval function
                //! 
                //^
                console.log(`dashboard class name of renderDashboard ${dashboard.className}`);
                dashboard.app = raisePanel(eval(dashboard.className), slideBack);
            }
            else{
                raisePanel(dashboard.app, slideBack);
            }
        }
        else{
            waitmask.show();


            get("dashboardUsers?dashboardID="+dashboard.id + "&userID=" + currUser.id + "&fields=readOnly",{
                success: function(arr){
                    //^ show id url
                    console.log(`success ... dashboardUsers?dashboardID=${dashboard.id}&userID=${currUser.id}&fields=readOnly`);

                    if (arr.length===0){
                        waitmask.hide();
                    }
                    else{
                        var readOnly = arr[0].readOnly;
                        get("dashboard?id="+dashboard.id,{
                            success: function(d){
                                waitmask.hide();


                              //Raise explorer panel
                              //@ use slideback function
                                var app = raisePanel(bluewave.Explorer, slideBack);
                                dashboard.app = app;


                              //Update explorer panel
                                if (!explorerPanel) explorerPanel = app;
                                explorerPanel.update(d, readOnly, "Dashboard");
                                me.setTitle(explorerPanel.getTitle());

                            },
                            failure: function(){
                                waitmask.hide();
                            }
                        });
                    }
                },
                failure: function(){
                    //^ show id url
                    console.log(`failure ... dashboardUsers?dashboardID=${dashboard.id}&userID=${currUser.id}&fields=readOnly`);
                    //! what is the functionality of waitmask. ++what is shown/hidden when it is enabled/disabled?
                    waitmask.hide();
                }
            });
        }
    };


  //**************************************************************************
  //** getDashboardItems
  //**************************************************************************
  /** Returns dashboard items from the Homepage
   */
    //! is this function used?
    //!A this functionality is in the created dashboards section of the app
    var getDashboardItems = function(){
        for (var i=0; i<apps.length; i++){
            //! apps objects
            //^ log apps object
            var app = apps[i].app;
            if (app instanceof bluewave.Homepage){
                //^ print these items
                //# this logging shows which items are made available while active in "Shared Dashboards"
                // console.dir(`logging dashboard items func ${app.getDashboardItems()}`);
                console.dir(`logging dashboard items func ${JSON.stringify(app.getDashboardItems(),null, 2)}`); // spacing level = 2 (pretty print) 
                return app.getDashboardItems();
            }
        }
        return null;
    };


  //**************************************************************************
  //** showMenu
  //**************************************************************************
    var showMenu = function(menu, target){

        var numVisibleItems = 0;
        for (var i=0; i<menu.childNodes.length; i++){
            var menuItem = menu.childNodes[i];
            if (menuItem.isVisible()) numVisibleItems++;
        }
        if (numVisibleItems===0){
            return;
        }

        var callout = getCallout();
        var innerDiv = callout.getInnerDiv();
        while (innerDiv.firstChild) {
            innerDiv.removeChild(innerDiv.lastChild);
        }
        innerDiv.appendChild(menu);

        var rect = javaxt.dhtml.utils.getRect(target);
        var x = rect.x + (rect.width/2);
        var y = rect.y + rect.height + 3;
        callout.showAt(x, y, "below", "right");
    };


  //**************************************************************************
  //** createMainMenu
  //**************************************************************************
    var getMainMenu = function(){
        if (!mainMenu){

            var div = document.createElement("div");
            div.className = "app-menu";

            //@ create menu option for Dashboard Home view'
            //! what does createMenuOption do? ++Does it utilize java?
            div.appendChild(createMenuOption("Dashboard Home", "home", function(){
                //@ declare functionality of this menu option
                me.setTitle("");
                //@ hide the admin panel from view when it is visible (we want to open the dashboard home)
                if (adminPanel) adminPanel.hide();
                //@ hide the explorer panel from view when it is visible (we want to open the dashboard home)
                if (explorerPanel) explorerPanel.hide();
                raisePanel(bluewave.Homepage);
            }));

            //@ create menu option for Create dashboard view
            div.appendChild(createMenuOption("Create Dashboard", "plus-circle", function(label){
                backButton.hide();
                nextButton.hide();
                if (adminPanel) adminPanel.hide();
                dashboardPanel.show();
                me.setTitle(label);
                var app = raisePanel(bluewave.Explorer);
                if (!explorerPanel) explorerPanel = app;
                explorerPanel.update();
                setTimeout(function(){ //update title again in case slider move
                    me.setTitle(label);
                }, 800);
            }));

            //@ create menu option for editting dashboard (currently not used)
            div.appendChild(createMenuOption("Edit Dashboard", "edit", function(){
                if (explorerPanel) explorerPanel.setView("Edit");
            }));

            //@ create menu option for screenshot (currently not used)
            div.appendChild(createMenuOption("Screenshot", "image", function(){
                waitmask.show();
                var delay = 1000;



              //Find dashboard associated with the app
              //@ pull current users accessibile dashboards from database/datastorage  
                var dashboard;
                //! what are the config.dataStores parameters?
                //! what might be returned from showing these
                //! where does the config.dataStores variable link to?
                var dashboards = config.dataStores["Dashboard"];
                //^
                // console.log(`showing the current dashboards ${dashboards}`);
                for (var i=0; i<dashboards.length; i++){
                    //! what are the options of "dashboards"? get is one.
                    if (currApp === dashboards.get(i).app){
                        dashboard = dashboards.get(i);
                    }
                }

                //@ screenshot functionality
                if (currApp.beforeScreenshot){
                    currApp.beforeScreenshot();
                    delay = 2000;
                }
                setTimeout(function(){
                    const screenshotTarget = me.el; //document.body;
                    new bluewave.Screenshot(screenshotTarget, {
                        onReady: function(){
                            waitmask.hide();
                            this.showSaveOptions({
                                style: config.style,
                                dashboard: dashboard,
                                beforeSave: function(){
                                    waitmask.show();
                                },
                                onSave: function(){
                                    waitmask.hide();
                                    if (currApp.afterScreenshot) currApp.afterScreenshot();
                                },
                                onError: function(request){
                                    waitmask.hide();
                                    if (currApp.afterScreenshot) currApp.afterScreenshot();
                                    alert(request);
                                }
                            });
                        }
                    });
                }, delay);
            }));


            //@ add system admin to menu
            div.appendChild(createMenuOption("System Administration", "cog", function(label){
                dashboardPanel.hide();
                backButton.hide();
                nextButton.hide();
                me.setTitle(label);
                if (!adminPanel) adminPanel = new bluewave.AdminPanel(body, config);
                adminPanel.update();
                adminPanel.show();
            }));

            mainMenu = div;
        }


      //Update menu items
        for (var i=0; i<mainMenu.childNodes.length; i++) mainMenu.childNodes[i].show();


      //Show/hide menu items based on current app
        var isHomepageVisible = (currApp instanceof bluewave.Homepage);
        var isExplorerVisible = (currApp instanceof bluewave.Explorer);
        var isAdminVisible = (currApp instanceof bluewave.AdminPanel);
        console.log("current app is registering as " + currApp.getTitle());
        console.log(`logging each of the pages state one after another (homepage, explorer, admin) ${isHomepageVisible, isExplorerVisible, isAdminVisible}`);

        for (var i=0; i<mainMenu.childNodes.length; i++){
            var menuItem = mainMenu.childNodes[i];
            console.log("menu item label is " + menuItem.label);
            if (menuItem.label==="Screenshot"){
                if (isHomepageVisible || isExplorerVisible){
                    console.log("deciding to hide screenshot from menu")
                    menuItem.hide();
                }
            }
            console.log("homepage status " + isHomepageVisible);
            // Hide homepage icon when on homepage
            if (menuItem.label==="Dashboard Home" && isHomepageVisible){
                console.log("deciding to hide the dashboard home");
                menuItem.hide();
            }
            // Hide Create dashboard icon when on Create dashboard 
            console.log("create dashboard status " + isExplorerVisible);
            if (menuItem.label === "Create Dashboard" && isExplorerVisible) {
                console.log("deciding to hide the create dashboard icon");
                menuItem.hide();
            }
            // Hide sys admin icon when on sys admin
            console.log("system administration status " + isAdminVisible);
            if (menuItem.label === "System Administration" && isAdminVisible) {
                console.log("deciding to hide the systems administration");
                menuItem.hide();
            }
            // choose when to show edit dashboard menu icon

            if (menuItem.label==="Edit Dashboard"){
                if (isExplorerVisible && explorerPanel.getView()==="Dashboard"){
                    console.log("deciding to hide the create dashboard icon");
                    menuItem.show();
                }
                else{
                    menuItem.hide();
                }
            }

            if (isAdminVisible){
                if (menuItem.label==="Dashboard Home"){
                    console.log("deciding to show the dashboard home")
                    menuItem.show();
                }
                else{
                    console.log("deciding to hide the dashboard home")
                    menuItem.hide();
                }
            }
        }



      //Hide menu items based on user access
        for (var i=0; i<mainMenu.childNodes.length; i++){
            var menuItem = mainMenu.childNodes[i];
            if (menuItem.label==="Create Dashboard"){
                if (currUser.accessLevel<3) menuItem.hide();
            }
            if (menuItem.label==="Edit Dashboard"){
                if (currUser.accessLevel<3) menuItem.hide();
            }
            if (menuItem.label==="System Administration"){
                if (currUser.accessLevel<5) menuItem.hide();
            }
        }


        return mainMenu;
    };


  //**************************************************************************
  //** createProfileMenu
  //**************************************************************************
    var getProfileMenu = function(){
        if (!profileMenu){
            var div = document.createElement("div");
            div.className = "app-menu";
            div.appendChild(createMenuOption("Account Settings", "edit", function(){
                console.log("Show Accout");
            }));
            div.appendChild(createMenuOption("Sign Out", "times", function(){
                logoff();
            }));
            profileMenu = div;
        }
        return profileMenu;
    };


  //**************************************************************************
  //** createMenuOption
  //**************************************************************************
    var createMenuOption = function(label, icon, onClick){
        var div = document.createElement("div");
        div.className = "app-menu-item noselect";
        if (icon && icon.length>0){
            div.innerHTML = '<i class="fas fa-' + icon + '"></i>' + label;
        }
        else{
            div.innerHTML = label;
        }
        div.label = label;
        div.onclick = function(){
            callout.hide();
            onClick.apply(this, [label]);
        };
        addShowHide(div);
        return div;
    };


  //**************************************************************************
  //** logoff
  //**************************************************************************
    var logoff = function(){
        waitmask.show();
        currUser = null;

      //Stop websocket listener
        if (ws){
            ws.stop();
            ws = null;
        }


      //Delete dashboards
        for (var i in apps){
            destroy(apps[i].app);
        }
        apps = [];
        currApp = null;


      //Clear carousel
        carousel.hide();
        var panels = carousel.getPanels();
        for (var i=0; i<panels.length; i++){
            var panel = panels[i];
            panel.div.innerHTML = "";
        }


      //Delete admin panel
        if (adminPanel){
            adminPanel.clear();
            destroy(adminPanel);
            adminPanel = null;
        }


      //Clear datastores
      //# config.datastores info
        for (var key in config.dataStores) {
            if (config.dataStores.hasOwnProperty(key)){
                var store = config.dataStores[key];
                store.destroy();
                store = null;
                delete config.dataStores[key];
            }
        }


      //Remove menus
        if (mainMenu){
            var parent = mainMenu.parentNode;
            if (parent) parent.removeChild(mainMenu);
            mainMenu = null;
        }
        if (profileMenu){
            var parent = profileMenu.parentNode;
            if (parent) parent.removeChild(profileMenu);
            profileMenu = null;
        }


      //Logoff
        auth.logoff(function(){
            document.user = null;
            var pageLoader = new javaxt.dhtml.PageLoader();
            pageLoader.loadPage("index.html", function(){
                waitmask.hide();
            });
        });
    };


  //**************************************************************************
  //** getCallout
  //**************************************************************************
    var getCallout = function(){
        if (callout){
            var parent = callout.el.parentNode;
            if (!parent){
                callout.el.innerHTML = "";
                callout = null;
            }
        }
        if (!callout) callout = new javaxt.dhtml.Callout(document.body,{
            style: config.style.callout
        });
        return callout;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var onRender = javaxt.dhtml.utils.onRender;
    var destroy = javaxt.dhtml.utils.destroy;
    var get = bluewave.utils.get;


    init();

};