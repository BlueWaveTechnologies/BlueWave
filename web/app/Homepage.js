if(!bluewave) var bluewave={};

//******************************************************************************
//**  Homepage
//******************************************************************************
/**
 *   Landing page for the app.
 *
 ******************************************************************************/

bluewave.Homepage = function(parent, config) {

    var me = this;
    var mainDiv;
    var t = new Date().getTime();
    var dashboardItems = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


        var div = document.createElement("div");
        div.className = "dashboard-homepage";
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";
        parent.appendChild(div);
        me.el = div;

        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        div.appendChild(innerDiv);
        mainDiv = innerDiv;


      //Add listeners to the "Dashboard" store
        var dashboards = config.dataStores["Dashboard"];
        dashboards.addEventListener("add", function(dashboard){
            refresh();
        }, me);

        dashboards.addEventListener("update", function(dashboard){
            t = new Date().getTime();
            refresh();
        }, me);

        dashboards.addEventListener("remove", function(dashboard){
            refresh();
        }, me);

    };


  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        return "Dashboards";
    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
    this.onUpdate = function(){};


  //**************************************************************************
  //** onClick
  //**************************************************************************
    this.onClick = function(dashboard){};


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        refresh();
        me.onUpdate();
    };


  //**************************************************************************
  //** getDashboardItems
  //**************************************************************************
  /** Returns all the dashboard items in the view
   */
    this.getDashboardItems = function(){
        return dashboardItems;
    };


  //**************************************************************************
  //** refresh
  //**************************************************************************
    var refresh = function(){
        dashboardItems = [];
        mainDiv.innerHTML = "";
        var dashboards = config.dataStores["Dashboard"];
        var groups = config.dataStores["DashboardGroup"];

        if (dashboards && groups){
            render();
        }
        else{
            get("dashboard/groups",{
                success: function(groups) {
                    groups = new javaxt.dhtml.DataStore(groups);
                    config.dataStores["DashboardGroup"] = groups;
                    render();
                },
                failure: function(){
                    if (!document.user){ //standalone mode
                        groups = new javaxt.dhtml.DataStore(groups);
                        config.dataStores["DashboardGroup"] = groups;
                        render();
                    }
                }
            });
        }
    };


  //**************************************************************************
  //** render
  //**************************************************************************
    var render = function(){
        var dashboards = config.dataStores["Dashboard"];
        var groups = config.dataStores["DashboardGroup"];

      //Create groups as needed
        if (groups.length===0){
            var myDashboards = [];
            var sharedDashboards = [];
            for (var i=0; i<dashboards.length; i++){
                var dashboard = dashboards.get(i);
                if (dashboard.className && dashboard.className.indexOf("bluewave.dashboards.")===0){
                    sharedDashboards.push(dashboard.id);
                }
                else{
                    myDashboards.push(dashboard.id);
                }
            }
            if (myDashboards.length>0){
                groups = new javaxt.dhtml.DataStore();
                groups.add({
                    name: "My Dashboards",
                    dashboards: myDashboards
                });
                groups.add({
                    name: "Shared Dashboards",
                    dashboards: sharedDashboards
                });
            }
        }


      //Render dashboards by group
        if (groups.length===0){
            var arr = [];
            for (var i=0; i<dashboards.length; i++){
                arr.push(dashboards.get(i));
            }
            sort(arr);
            for (var i=0; i<arr.length; i++){
                add(arr[i], mainDiv);
            }
        }
        else{
            for (var i=0; i<groups.length; i++){
                var group = groups.get(i);
                var arr = [];
                if (group.dashboards){
                    for (var j=0; j<group.dashboards.length; j++){
                        var dashboardID = group.dashboards[j];
                        for (var k=0; k<dashboards.length; k++){
                            var dashboard = dashboards.get(k);
                            if (dashboard.id===dashboardID){
                                arr.push(dashboard);
                            }
                        }
                    }
                }
                var g = createGroupBox(group);
                sort(arr);
                for (var j=0; j<arr.length; j++){
                    add(arr[j], g);
                }
            }
        }
    };


  //**************************************************************************
  //** sort
  //**************************************************************************
    var sort = function(arr){
        arr.sort(function(a, b){
            return a.name.localeCompare(b.name);
        });
    };


  //**************************************************************************
  //** add
  //**************************************************************************
    var add = function(dashboard, parent){
        var title = dashboard.name;


        var dashboardItem = createDashboardItem(parent, {
            width: 360,
            height: 230,
            subtitle: title
        });
        dashboardItem.dashboard = dashboard;
        dashboardItems.push(dashboardItem);


        dashboardItem.innerDiv.style.cursor = "pointer";
        dashboardItem.innerDiv.style.textAlign = "center";
        dashboardItem.innerDiv.onclick = function(){
            me.onClick(dashboardItem);
        };


        var icon = document.createElement("i");
        icon.className = "fas fa-camera";
        dashboardItem.innerDiv.appendChild(icon);


        var img = document.createElement("img");
        img.className = "noselect";
        img.style.cursor = "pointer";
        img.onload = function() {
            dashboardItem.innerDiv.innerHTML = "";
            var rect = javaxt.dhtml.utils.getRect(dashboardItem.innerDiv);            
            dashboardItem.innerDiv.appendChild(this);
            this.style.border = "1px solid #ececec"; //this should be in the css
            
            
            var maxWidth = rect.width;
            var maxHeight = rect.height;
            var width = 0;
            var height = 0;

            var setWidth = function(){
                var ratio = maxWidth/width;
                width = width*ratio;
                height = height*ratio;
            };

            var setHeight = function(){
                var ratio = maxHeight/height;
                width = width*ratio;
                height = height*ratio;
            };


            var resize = function(img){
                width = img.width;
                height = img.height;

                if (maxHeight<maxWidth){

                    setHeight();
                    if (width>maxWidth) setWidth();
                }
                else{
                    setWidth();
                    if (height>maxHeight) setHeight();
                }

                if (width===0 || height===0) return;
                
                
                img.width = width;
                img.height = height;
                
                //TODO: Insert image into a canvas and do a proper resize
                //ctx.putImageData(img, 0, 0);
                //resizeCanvas(canvas, width, height, true);
                //var base64image = canvas.toDataURL("image/png");

            };

            resize(this);
            
        };
        img.src = "dashboard/thumbnail?id=" + dashboard.id + "&_=" + t;
    };


  //**************************************************************************
  //** createGroupBox
  //**************************************************************************
    var createGroupBox = function(group){
        var div = document.createElement("div");
        div.className = "dashboard-group";
        div.style.position = "relative";

        var label = document.createElement("div");
        label.className = "dashboard-group-label";
        label.style.position = "absolute";
        label.innerHTML = group.name;
        div.appendChild(label);

        mainDiv.appendChild(div);
        return div;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var createDashboardItem = bluewave.utils.createDashboardItem;

    init();
};