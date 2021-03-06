if(!bluewave) var bluewave={};

//******************************************************************************
//**  UserAdmin
//******************************************************************************
/**
 *   Panel used to manage users and render usage reports
 *
 ******************************************************************************/

bluewave.UserAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {
        maxIdleTime: 5*60*1000 //5 minutes
    };
    var userList, userStats;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;


      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Create stats panel
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createStats(td);


      //Create user list
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        userList = new bluewave.UserList(td, config);


        parent.appendChild(table);
        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** updateActivity
  //**************************************************************************
    this.updateActivity = function(userID, op){
        userList.updateActivity(userID, op);
        userStats.updateActivity(userID, op);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        userList.clear();
        userStats.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        get("report/activeUsers", {
            success: function(activeUsers){
                userList.update(activeUsers);
                userStats.update(activeUsers);
            }
        });
    };


  //**************************************************************************
  //** createStats
  //**************************************************************************
    var createStats = function(parent){
        var div = document.createElement("div");
        div.style.height = "250px";
        parent.appendChild(div);
        userStats = new bluewave.UserStats(div, config);
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};