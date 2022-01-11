if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  TimelineChart
//******************************************************************************
/**
 *   Panel used to view events in either a horizontal or vertical timeline
 *
 ******************************************************************************/

bluewave.charts.TimelineChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        layout: "vertical",
        equalInterval: false,
        style: {

        }
    };
    var titleDiv, body;
    var mainDiv;
    var tbody;

    var events = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        me.setConfig(config);

        var div = document.createElement("div");
        div.style.height = "100%";
        parent.appendChild(div);
        me.el = div;


      //Create main table
        var table = createTable();
        tbody = table.firstChild;




        div.appendChild(table);
    };


  //**************************************************************************
  //** setConfig
  //**************************************************************************
    this.setConfig = function(chartConfig){
        if (!chartConfig) config = defaultConfig;
        else config = merge(chartConfig, defaultConfig);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        tbody.innerHTML = "";
    };


  //**************************************************************************
  //** addEvent
  //**************************************************************************
    this.addEvent = function(date, details, options){
        if (config.layout==="vertical"){
            addRow(date, details, options);
        }
        else{

        }
    };


  //**************************************************************************
  //** addRow
  //**************************************************************************
    var addRow = function(date, details, options){
        var tr, td;
        tr = document.createElement("tr");
        tbody.appendChild(tr);

        td = document.createElement("td");
        td.className = "timeline-date";
        td.innerText = date;
        tr.appendChild(td);


        td = document.createElement("td");
        td.className = "timeline-column";
        tr.appendChild(td);


        td = document.createElement("td");
        td.className = "timeline-info";
        td.style.width = "100%";
        tr.appendChild(td);

        if (typeof details === "string"){
            td.innerHTML = details;
        }
        else{
            td.appendChild(details);
        }

    };


  //**************************************************************************
  //** addColumn
  //**************************************************************************
    var addColumn = function(){

    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var round = javaxt.dhtml.utils.round;
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;


    init();

};