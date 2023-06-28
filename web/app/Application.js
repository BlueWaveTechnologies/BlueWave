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
    var dashboardPanel, adminPanel, explorerPanel;

    var extensions = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Set global configuration variables
        if (!config) config = {};
        if (!config.fx) config.fx = new javaxt.dhtml.Effects();
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;
        if (!waitmask.el.parentNode) document.body.appendChild(waitmask.el);
        if (!config.dataStores) config.dataStores = {};
        appName = config.appName;
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


      //Prevent native browser shortcuts (ctrl+a,h,o,p,s,...)
        document.addEventListener("keydown", function(e){
            if ((e.keyCode == 65 || e.keyCode == 72 || e.keyCode == 79 || e.keyCode == 80 || e.keyCode == 83) &&
            (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });


      //Create main table
        var table = createTable(parent);


      //Create header nav
        createHeader(table.addRow().addColumn());


      //Create body
        var td = table.addRow().addColumn({
            height: "100%"
        });
        createBody(td);


      //Create footer
        createFooter(table.addRow().addColumn());


        me.el = table;

        onRender(table, function(){
            //carousel.resize();
        });

    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){

        var div = createElement("div", parent, "app-header");


        var tr = createTable(div).addRow();


      //Add logo
        var td = tr.addColumn();
        createElement("div", td, "app-header-icon noselect");
        td.style.cursor = "pointer";
        td.onclick = function(){
            if (currUser){
                if (adminPanel) adminPanel.hide();
                dashboardPanel.show();
                raisePanel(bluewave.Homepage, true);
            }
            else{
                raisePanel(apps[0].app, true); //might not be the homepage if standalone
            }
        };


      //Add spacer
        tr.addColumn({
            width: "100%"
        });


      //Create profile button
        profileButton = createElement("div", tr.addColumn(), "app-header-profile noselect");
        profileButton.onclick = function(e){
            if (currUser) showMenu(getProfileMenu(), this);
        };
        addShowHide(profileButton);


      //Create menu button
        menuButton = createElement("div", tr.addColumn(), "app-header-menu noselect");
        createElement("i", menuButton, "fas fa-ellipsis-v");
        menuButton.onclick = function(e){
            if (currUser) showMenu(getMainMenu(), this);
        };
        addShowHide(menuButton);

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


        var table = createTable(parent);


      //Create Dashboard Header
        var td = table.addRow().addColumn();
        var div = createElement("div", td, {
            position: "relative"
        });


        var createButton = function(className){
            var btn = createElement("div", div);
            btn.className = className;
            addShowHide(btn);
            return btn;
        };

        backButton = createButton("dashboard-back");
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
                    renderDashboard(dashboardItems[idx], true);
                    break;
                }
            }
        };
        backButton.hide();

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
                        idx = i+1;
                    }
                    renderDashboard(dashboardItems[idx], false);
                    break;
                }
            }
        };
        nextButton.hide();

        titleDiv = createElement("div", div, "dashboard-title noselect");
        addShowHide(titleDiv);


      //Create body
        body = table.addRow().addColumn({
            height: "100%"
        });


      //Create carousel
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
            var panel = createElement("div", {
                height: "100%"
            });
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


              //Trigger resize event for the app to ensure components render properly
                if (currApp.resize) currApp.resize();

            }
        };

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
        currUser = user;
        me.setTitle("");
        currDashboardItem = null;
        extensions = [];


      //If no user is supplied, then we are running in stand-alone mode
        if (!user){
            menuButton.hide();
            profileButton.hide();
            dashboardPanel.show();

//          //Create dashboards
//            var dashboards = [
//            "SupplyChain", "ImportSummary", "EUAMap",
//            "ProductPurchases", "GlobalSupplyChain"];
//            for (var i in dashboards){
//                dashboards[i] = {
//                    id: i,
//                    name: dashboards[i],
//                    className: "bluewave.dashboards." + dashboards[i]
//                };
//            }
//
//          //Convert the dashboards array into a datastore
//            dashboards = new javaxt.dhtml.DataStore(dashboards);
//            config.dataStores["Dashboard"] = dashboards;


          //Add homepage
            var homepage = raisePanel(bluewave.Homepage);
            homepage.onClick = function(dashboardItem){
                renderDashboard(dashboardItem);
            };
            me.setTitle(homepage.getTitle());

            return;
        }


      //Get extensions
        get("extensions", {
            success: function(arr){
                extensions = arr;
            }
        });



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



      //Check if we have a URL shortcut to a bluewave dashboard
        var showHomepage = true;
        var fileName = window.location.pathname.replaceAll(/[^a-zA-Z0-9]/g, "");
        if (fileName.length>0){
            try{
                var app = eval("bluewave.dashboards." + fileName);
                if (!app) app = eval("bluewave.analytics." + fileName);
                if (app){
                    raisePanel(app);
                    if (currApp.getTitle) me.setTitle(currApp.getTitle());
                    else me.setTitle(fileName);
                    showHomepage = false;
                }
            }
            catch(e){
                console.log(e);
            }
        }



      //Create new panels
        if (showHomepage){
            get("dashboards?fields=id,name,className",{
                success: function(dashboards) {

                  //Convert the dashboards array into a datastore
                    dashboards = new javaxt.dhtml.DataStore(dashboards);
                    config.dataStores["Dashboard"] = dashboards;


                  //Render homepage (or explorer panel if there are no dashboards)
                    if (dashboards.length<2){

                        if (dashboards.length===1){
                            titleDiv.show();
                            renderDashboard({
                                dashboard: dashboards.get(0)
                            });
                            currDashboardItem = null;
                        }
                        else{
                            titleDiv.hide();
                            var app = raisePanel(bluewave.dashboard.Composer);
                            if (!explorerPanel) explorerPanel = app;
                        }
                    }
                    else{
                        titleDiv.show();
                        var homepage = raisePanel(bluewave.Homepage);
                        homepage.onClick = function(dashboardItem){
                            renderDashboard(dashboardItem);
                        };
                        me.setTitle(homepage.getTitle());
                    }


                  //Hide waitmask
                    waitmask.hide();
                },
                failure: function(request){
                    alert(request);
                    waitmask.hide();
                }
            });
        }



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


      //Find "current" and "next" panels in the carousel
        var panels = {};
        var maxArea = 0;
        carousel.getPanels().forEach((panel)=>{
            maxArea = Math.max(panel.visibleArea, maxArea);
            panels[panel.visibleArea+""] = panel;
        });
        var currPage = panels[maxArea+""].div;
        delete panels[maxArea+""];
        var nextPage = panels[Object.keys(panels)[0]].div;


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


      //Load extensions
        if (obj===bluewave.dashboard.Composer){
            if (!explorerPanel){
                explorerPanel = app;
                extensions.forEach(function(extension){
                    var explorerExtensions = [];
                    if (extension.explorer){
                        if (isArray(extension.explorer)){
                            extension.explorer.forEach(function(e){
                                explorerExtensions.push(e);
                            });
                        }
                        else{
                            explorerExtensions.push(extension.explorer);
                        }
                    }
                    explorerPanel.addExtensions(explorerExtensions);
                });
            }
        }



        if (app === currApp){
            //console.log("Already in view!");
            me.setTitle(app.getTitle());
            return app;
        }
        else{

            if (!isNew) div.appendChild(app.el);
            if (div===nextPage){
                if (slideBack===true) carousel.back();
                else carousel.next();
                //Note: title is updated in the carousel.onChange() function
            }
            else{
                if (app.getTitle) me.setTitle(app.getTitle());
            }

            currApp = app;
            return app;
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
    var renderDashboard = function(dashboardItem, slideBack){
        currDashboardItem = dashboardItem;
        var dashboard = dashboardItem.dashboard;


        if (dashboard.className && dashboard.className.indexOf("bluewave.Explorer")===-1){
            if (!dashboard.app){
                dashboard.app = raisePanel(eval(dashboard.className), slideBack);
            }
            else{
                raisePanel(dashboard.app, slideBack);
            }
        }
        else{
            waitmask.show(500);


            get("dashboardUsers?dashboardID="+dashboard.id + "&userID=" + currUser.id + "&fields=readOnly",{
                success: function(arr){
                    if (arr.length===0){
                        waitmask.hide();
                    }
                    else{
                        var readOnly = arr[0].readOnly;
                        get("dashboard?id="+dashboard.id,{
                            success: function(d){

                              //Raise explorer panel
                                var app = raisePanel(bluewave.dashboard.Composer, slideBack);
                                if (!explorerPanel) explorerPanel = app;
                                explorerPanel.hide();
                                dashboard.app = app;


                              //Update explorer panel after a slight delay giving
                              //the carousel time to finish it's animation
                                setTimeout(function(){
                                    waitmask.hide();
                                    explorerPanel.update(d, readOnly);
                                    explorerPanel.show();
                                    me.setTitle(explorerPanel.getTitle());

                                }, 800);

                            },
                            failure: function(){
                                waitmask.hide();
                            }
                        });
                    }
                },
                failure: function(){
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
    var getDashboardItems = function(){
        for (var i=0; i<apps.length; i++){
            var app = apps[i].app;
            if (app instanceof bluewave.Homepage){
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

            var div = createElement("div");
            div.className = "app-menu";


            div.appendChild(createMenuOption("Dashboard Home", "home", function(){
                me.setTitle("");
                if (adminPanel) adminPanel.hide();
                if (explorerPanel) explorerPanel.hide();
                dashboardPanel.show();
                raisePanel(bluewave.Homepage);
            }));


            div.appendChild(createMenuOption("Create Dashboard", "plus-circle", function(label){
                backButton.hide();
                nextButton.hide();
                if (adminPanel) adminPanel.hide();
                dashboardPanel.show();
                me.setTitle(label);
                var app = raisePanel(bluewave.dashboard.Composer);
                if (!explorerPanel) explorerPanel = app;


                explorerPanel.show();
                explorerPanel.update();
                setTimeout(function(){ //update title again in case slider move
                    me.setTitle(label);
                }, 800);
            }));


            div.appendChild(createMenuOption("Create Group", "folder-plus", function(){
                if (currApp instanceof bluewave.Homepage){
                    currApp.createGroup();
                }
            }));


            div.appendChild(createMenuOption("Edit Dashboard", "edit", function(){
                if (explorerPanel) explorerPanel.setView("Edit");
            }));


            div.appendChild(createMenuOption("Screenshot", "image", function(){
                waitmask.show();
                var delay = 1000;



              //Find dashboard associated with the app
                var dashboard;
                var dashboards = config.dataStores["Dashboard"];
                for (var i=0; i<dashboards.length; i++){
                    if (currApp === dashboards.get(i).app){
                        dashboard = dashboards.get(i);
                    }
                }


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



            div.appendChild(createMenuOption("System Administration", "cog", function(label){
                dashboardPanel.hide();
                backButton.hide();
                nextButton.hide();
                me.setTitle(label);
                if (!adminPanel) adminPanel = new bluewave.admin.AdminPanel(body, config);
                adminPanel.update();
                adminPanel.show();
            }));

            mainMenu = div;
        }


      //Update menu items
        for (var i=0; i<mainMenu.childNodes.length; i++) mainMenu.childNodes[i].show();


      //Show/hide menu items based on current app
        var isHomepageVisible = (currApp instanceof bluewave.Homepage);
        var isExplorerVisible = (currApp instanceof bluewave.dashboard.Composer);
        var isAdminVisible = (currApp instanceof bluewave.admin.AdminPanel);
        for (var i=0; i<mainMenu.childNodes.length; i++){
            var menuItem = mainMenu.childNodes[i];

            if (menuItem.label==="Screenshot"){
                if (isHomepageVisible || isExplorerVisible){
                    menuItem.hide();
                }
            }

            if (menuItem.label==="Dashboard Home" && isHomepageVisible){
                menuItem.hide();
            }


            if (menuItem.label==="Create Group" && !isHomepageVisible){
                menuItem.hide();
            }


            if (menuItem.label==="Edit Dashboard"){
                if (isExplorerVisible && explorerPanel.getView()==="Dashboard"){
                    menuItem.show();
                }
                else{
                    menuItem.hide();
                }
            }

            if (isAdminVisible){
                if (menuItem.label==="Dashboard Home"){
                    menuItem.show();
                }
                else{
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
            var div = createElement("div");
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
        var div = createElement("div");
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
    var createElement = javaxt.dhtml.utils.createElement;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var isArray = javaxt.dhtml.utils.isArray;
    var onRender = javaxt.dhtml.utils.onRender;
    var destroy = javaxt.dhtml.utils.destroy;
    var get = bluewave.utils.get;


    init();

};