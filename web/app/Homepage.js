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
        innerDiv.style.display = "inline-block";
        innerDiv.style.maxWidth = "1660px";
        div.appendChild(innerDiv);
        mainDiv = innerDiv;


      //Add listiners to the "Dashboard" store
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
  //** refresh
  //**************************************************************************
    var refresh = function(){
        mainDiv.innerHTML = "";
        var dashboards = config.dataStores["Dashboard"];
        for (var i=0; i<dashboards.length; i++){
            var dashboard = dashboards.get(i);
            add(dashboard);
        }
    };


  //**************************************************************************
  //** add
  //**************************************************************************
    var add = function(dashboard){
        var title = dashboard.name;
        var className = dashboard.className;


        var dashboardItem = createDashboardItem(mainDiv, {
            width: 360,
            height: 230,
            subtitle: title
        });


        dashboardItem.innerDiv.style.cursor = "pointer";
        dashboardItem.innerDiv.onclick = function(){
            me.onClick(dashboard);
        };


        var img = document.createElement("img");
        img.src = "dashboard/thumbnail?name=" + className + "&_=" + t;
        img.className = "noselect";
        img.style.cursor = "pointer";
        dashboardItem.innerDiv.appendChild(img);
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createDashboardItem = bluewave.utils.createDashboardItem;

    init();
};