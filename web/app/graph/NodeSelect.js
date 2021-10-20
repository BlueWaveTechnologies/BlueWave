if(!bluewave) var bluewave={};

//******************************************************************************
//**  NodeSelect
//******************************************************************************
/**
 *   Panel used to select nodes and properties
 *
 ******************************************************************************/

bluewave.NodeSelect = function(parent, config) {

    var me = this;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        if (!config) config = {};


      //Create table with 5 columns
        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);

        var tr, td;


      //Nodes
        td = document.createElement("td");
        tr.appendChild(td);


      //Properties
        td = document.createElement("td");
        tr.appendChild(td);


      //Buttons
        td = document.createElement("td");
        tr.appendChild(td);


      //Selected Properties
        td = document.createElement("td");
        tr.appendChild(td);



      //Append table to parent
        parent.appendChild(table);
        me.el = table;
    };


    this.clear = function(){

    };

    this.update = function(nodes){
        me.clear();
    };


  //**************************************************************************
  //** Utilites
  //**************************************************************************
  /** Common functions found in Utils.js
   */
    var createTable = javaxt.dhtml.utils.createTable;


    init();
};