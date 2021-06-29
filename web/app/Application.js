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
    var dashboardPanel;
    var carousel;
    var views = []; //panels in the carousel
    var raisingPanel = false;


  //Plugins
    var adminPanel, explorerPanel;



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
            get("appinfo", {
                success: function(appInfo){
                    appName = appInfo.name;
                    config.appName = appName;
                    me.setTitle("");
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
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Create header nav
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
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
            //carousel.resize();
        });

    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){

        var div = document.createElement("div");
        div.className = "app-header";
        parent.appendChild(div);


        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;


        var fn = function(){
            if (currUser && views.length>0){
                if (adminPanel) adminPanel.hide();
                if (explorerPanel) explorerPanel.hide();
                dashboardPanel.show();
                raisePanel(views[0].app); //might not be the homepage if standalone
            }
        };

        td = document.createElement("td");
        tr.appendChild(td);
        var icon = document.createElement("div");
        icon.className = "app-header-icon noselect";
        td.appendChild(icon);
        td.style.cursor = "pointer";
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

        backButton = createButton("dashboard-back");
        backButton.onclick = function(){
            carousel.back();
        };

        nextButton = createButton("dashboard-next");
        nextButton.onclick = function(){
            carousel.next();
        };

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
    };


  //**************************************************************************
  //** createDashboardPanel
  //**************************************************************************
    var createDashboardPanel = function(){

      //Create dashboardPanel
        dashboardPanel = document.createElement("div");
        dashboardPanel.style.height = "100%";
        body.appendChild(dashboardPanel);
        addShowHide(dashboardPanel);


      //Create carousel
        carousel = new javaxt.dhtml.Carousel(dashboardPanel, {
            drag: false,
            loop: false,
            animate: true,
            animationSteps: 600,
            transitionEffect: "easeInOutCubic",
            fx: config.fx
        });


      //Add event handlers
        carousel.beforeChange = function(){
            if (raisingPanel) return;
            me.setTitle("");
            backButton.hide();
            nextButton.hide();
        };
        carousel.onChange = function(){
            if (raisingPanel) return;
            var app = getVisibleApp();
            if (!app.isRendered){
                app.update();
                app.isRendered = true;
            }
            me.setTitle(app.getTitle());

            var panels = carousel.getPanels();
            if (panels.length>1){
                for (var i=0; i<panels.length; i++){
                    var panel = panels[i];
                    if (panel.isVisible){
                        if (i==0){
                            backButton.hide();
                        }
                        else{
                            backButton.show();
                        }

                        if (i==panels.length-1){
                            nextButton.hide();
                        }
                        else{
                            nextButton.show();
                        }

                        break;
                    }
                }
            }

        };
    };


  //**************************************************************************
  //** setTitle
  //**************************************************************************
    this.setTitle = function(str){
        titleDiv.innerHTML = str;
        document.title = appName + (str.length>0 ? (" - " + str) : "");
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(user){
        currUser = user;
        me.setTitle("");

        if (!dashboardPanel) createDashboardPanel();


      //If no user is supplied, then we are running in stand-alone mode
        if (!user){
            menuButton.hide();
            profileButton.hide();
            var dashboards = [
            "SupplyChain", "ImportSummary", "EUAMap",
            "ProductPurchases", "GlobalSupplyChain"];
            for (var i in dashboards){
                addPanel("bluewave.dashboards." + dashboards[i]);
            }
            raisePanel(bluewave.dashboards.SupplyChain);
            return;
        }


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
        get("dashboards?fields=id,name,className&orderBy=name",{
            success: function(dashboards) {

              //Convert the dashboards array into a datastore
                dashboards = new javaxt.dhtml.DataStore(dashboards);
                config.dataStores["Dashboard"] = dashboards;


              //Add homepage
                var homepage = addPanel("bluewave.Homepage");


              //Add dashboards
                for (var i=0; i<dashboards.length; i++){
                    var dashboard = dashboards.get(i);
                    var className = dashboard.className;
                    if (className.indexOf(".")===-1){
                        dashboard.className = "bluewave.dashboards."+className;
                    }
                    dashboard.app = addPanel(dashboard.className);
                }

              //Add event handler
                homepage.onClick = function(dashboard){
                    if (!dashboard.app){
                        dashboardPanel.hide();
                        backButton.hide();
                        nextButton.hide();
                        getExplorerPanel().show();
                        waitmask.show();
                        get("dashboard?id="+dashboard.id,{
                            success: function(dashboard){
                                waitmask.hide();
                                explorerPanel.update(dashboard, true);
                                me.setTitle(explorerPanel.getTitle());
                            },
                            failure: function(){
                                waitmask.hide();
                            }
                        });
                    }
                    else{
                        raisePanel(dashboard.app);
                    }
                };


              //Switch to first page
                setTimeout(function(){
                    raisePanel(homepage);
                    waitmask.hide();
                }, 800);
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
                var store = config.dataStores[model];

                if (op=="alert"){
                    for (var i=0; i<views.length; i++){
                        try{
                            views[i].app.notify(msg);
                        }
                        catch(e){}
                    }
                    return;
                }


              //Update currUser as needed
                if (model=="User" && (op=="update" || op=="delete")){
                    var id = parseInt(arr[2]);
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
                                    }
                                    else{
                                        for (var key in user) {
                                            if (user.hasOwnProperty(key)){
                                                currUser[key] = user[key];
                                            }
                                        }

                                        if (store){
                                            for (var i=0; i<store.length; i++){
                                                var item = store.get(i);
                                                if (item.id===id){
                                                    store.set(i, user);
                                                    break;
                                                }
                                            }
                                        }

                                    }
                                }
                            });
                            return;
                        }
                    }
                }





              //Update stores
                if (store){
                    var id = parseInt(arr[2]);
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

            }
        });
    };


  //**************************************************************************
  //** addPanel
  //**************************************************************************
  /** Used to add an app to the carousel and update the list of "views"
   *  @param className String used to represent a fully qualified class
   *  name (e.g. "bluewave.dashboards.SupplyChain").
   */
    var addPanel = function(className){
        var div = document.createElement('div');
        div.style.height = "100%";
        carousel.add(div);
        var panels = carousel.getPanels();
        var panel = panels[panels.length-1];

        try{
            var cls = eval(className);
            if (cls){
                var instance = new cls(div, config);
                instance.className = className;
                instance.onUpdate = function(){
                    var app = getVisibleApp();
                    if (app==instance) me.setTitle(instance.getTitle());
                };

                views.push({
                    app: instance,
                    div: panel.div
                });

                return instance;
            }
            else{
                console.log("Cannot instantiate " + className);
            }
        }
        catch(e){
            console.log("Cannot instantiate " + className);
        }
    };


  //**************************************************************************
  //** raisePanel
  //**************************************************************************
  /** Used to bring a panel into view
   *  @param obj Either a class or an instance of a class
   */
    var raisePanel = function(obj){


      //Find view
        var view;
        for (var i in views){
            var v = views[i];

            if (typeof obj === 'function') {
                if (v.app instanceof obj){
                    view = v;
                }
            }
            else{
                if (v.app===obj){
                    view = v;
                }
            }

            if (view) break;
        }
        if (!view) return;


      //Get index of the view and the visiblePanel
        var visiblePanel = 0;
        var panels = carousel.getPanels();
        for (var i=0; i<panels.length; i++){
            var panel = panels[i];
            if (panel.isVisible){
                visiblePanel = i;
            }
            if (view.div===panel.div){
                view = i;
            }
        }
        //console.log(visiblePanel, view);



      //Update carousel
        if (visiblePanel!==view){
            raisingPanel = true;
            carousel.disableAnimation();
            if (view>visiblePanel){
                var diff = view-visiblePanel;
                for (var i=0; i<diff; i++){
                    carousel.next();
                }
            }
            else{
                var diff = visiblePanel-view;
                for (var i=0; i<diff; i++){
                    carousel.back();
                }
            }
            carousel.enableAnimation();
            raisingPanel = false;
        }


      //Fire change events to show/hide nav buttons
        carousel.beforeChange();
        carousel.onChange();
    };


  //**************************************************************************
  //** getVisibleApp
  //**************************************************************************
  /** Returns the application associated with the current view
   */
    var getVisibleApp = function(){
        var panels = carousel.getPanels();
        for (var i=0; i<panels.length; i++){
            var panel = panels[i];
            if (panel.isVisible){
                for (var j=0; j<views.length; j++){
                    var view = views[j];
                    if (view.div===panel.div){
                        return view.app;
                    }
                }
                break;
            }
        }

        if (explorerPanel && explorerPanel.isVisible()) return explorerPanel;
        if (adminPanel && adminPanel.isVisible()) return adminPanel;

        return null;
    };


  //**************************************************************************
  //** getExplorerPanel
  //**************************************************************************
    var getExplorerPanel = function(){
        if (!explorerPanel){
            explorerPanel = new bluewave.Explorer(body, config);
            explorerPanel.onUpdate = function(){
                me.setTitle(explorerPanel.getTitle());
            };
            explorerPanel.onDelete = function(){
                explorerPanel.hide();
                dashboardPanel.show();
                raisePanel(bluewave.Homepage);
            };
        }
        return explorerPanel;
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


            div.appendChild(createMenuOption("Dashboard Home", "home", function(){
                me.setTitle("");
                if (adminPanel) adminPanel.hide();
                if (explorerPanel) explorerPanel.hide();
                dashboardPanel.show();
                raisePanel(bluewave.Homepage);
            }));


            div.appendChild(createMenuOption("Create Dashboard", "plus-circle", function(label){
                dashboardPanel.hide();
                backButton.hide();
                nextButton.hide();
                if (adminPanel) adminPanel.hide();
                me.setTitle(label);
                getExplorerPanel().show();
                explorerPanel.update();
            }));


            div.appendChild(createMenuOption("Edit Dashboard", "edit", function(){
                explorerPanel.setReadOnly(false);
            }));


            div.appendChild(createMenuOption("Screenshot", "image", function(){
                waitmask.show();
                var delay = 1000;
                var app = getVisibleApp();
                if (app.beforeScreenshot){
                    app.beforeScreenshot();
                    delay = 2000;
                }
                setTimeout(function(){
                    const screenshotTarget = me.el; //document.body;
                    new bluewave.Screenshot(screenshotTarget, {
                        onReady: function(){
                            waitmask.hide();
                            this.showSaveOptions({
                                style: config.style,
                                name: app.getTitle(),
                                className: app.className,
                                beforeSave: function(){
                                    waitmask.show();
                                },
                                onSave: function(){
                                    waitmask.hide();
                                    if (app.afterScreenshot) app.afterScreenshot();
                                },
                                onError: function(request){
                                    waitmask.hide();
                                    if (app.afterScreenshot) app.afterScreenshot();
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
                if (explorerPanel) explorerPanel.hide();
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
        var currApp = getVisibleApp();
        var isHomepageVisible = (currApp instanceof bluewave.Homepage);
        var isExplorerVisible = (currApp instanceof bluewave.Explorer);
        var isAdminVisible = (currApp instanceof bluewave.AdminPanel);
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

            if (menuItem.label==="Edit Dashboard"){
                if (isExplorerVisible && explorerPanel.isReadOnly()){
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
        for (var i in views){
            destroy(views[i].app);
        }
        views = [];
        carousel.clear();


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
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var onRender = javaxt.dhtml.utils.onRender;
    var destroy = javaxt.dhtml.utils.destroy;
    var get = bluewave.utils.get;


    init();

};