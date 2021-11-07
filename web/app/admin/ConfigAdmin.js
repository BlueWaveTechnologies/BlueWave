if(!bluewave) var bluewave={};

//******************************************************************************
//**  ConfigAdmin
//******************************************************************************
/**
 *   Panel used to manage misc config settings
 *
 ******************************************************************************/

bluewave.ConfigAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };
    var waitmask;
    var mapAdmin;

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
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;


        td = document.createElement("td");
        tr.appendChild(td);
        mapAdmin = new bluewave.MapAdmin(td, config);



        parent.appendChild(table);
        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        mapAdmin.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        mapAdmin.update();
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};