if(!bluewave) var bluewave={};

//******************************************************************************
//**  AdminPanel
//******************************************************************************
/**
 *   Panel used to render admin components (e.g. UserList)
 *
 ******************************************************************************/

bluewave.AdminPanel = function(parent, config) {

    var me = this;
    var mainPanel;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config.style) config.style = javaxt.dhtml.style.default;

      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;

        tr = document.createElement("tr");
        tbody.appendChild(tr);

      //Create nav
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        //createNav(td);


      //Create body
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        mainPanel = td;

        new bluewave.UserList(mainPanel, config);


        //table.style.borderTop = "1px solid #cccccc";
        parent.appendChild(table);
        me.el = table;

        addShowHide(me);
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){

    };


  //**************************************************************************
  //** createNav
  //**************************************************************************
    var createNav = function(parent){
        var div = document.createElement("div");
        div.style.width = "250px";
        parent.appendChild(div);
        //TODO: Add elements
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};