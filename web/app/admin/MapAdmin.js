if(!bluewave) var bluewave={};

//******************************************************************************
//**  MapAdmin
//******************************************************************************
/**
 *   Panel used to manage available map services and layers
 *
 ******************************************************************************/

bluewave.MapAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };
    var waitmask;
    var basemaps = [];
    var grid, editor;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;

      //Row 1
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "panel-toolbar";
        tr.appendChild(td);
        createToolbar(td);


      //Row 2
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);


        parent.appendChild(table);
        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        basemaps = [];
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();

        waitmask.show(500);
        get("admin/settings/basemap", {
            success: function(arr){
                basemaps = arr;
               //grid.update();
               waitmask.hide();
            },
            failure: function(request){
                alert(request);
                waitmask.hide();
            }
        });
    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){

    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

    };


  //**************************************************************************
  //** deleteUser
  //**************************************************************************
    var updateConfig = function(){
        save("admin/settings/basemap", JSON.stringify(basemaps), {
            success: function(){
                //editor.close();
                //grid.update();
            },
            failure: function(request){
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var get = bluewave.utils.get;
    var save = javaxt.dhtml.utils.post;

    init();
};