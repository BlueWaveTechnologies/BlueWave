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
        alignment: "alternating",
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
        div.style.overflowY = "auto";
        parent.appendChild(div);
        me.el = div;



        var timeLineContainer = document.createElement("div");
        timeLineContainer.className = "timeline-container";


        var title = document.createElement("h1");
        if (config.title) title.textContent = config.title;
        timeLineContainer.appendChild(title);


        var timeline = document.createElement("div");
        timeline.className = "timeline";
        timeline.appendChild(document.createElement("ul"));

        //Append to main div
        timeLineContainer.appendChild(timeline);
        div.appendChild(timeLineContainer);
        
        tbody = timeline.firstChild;
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
    this.addEvent = function(date, event, details, options){
        events.push({date, event, details, options});     
    };


  //**************************************************************************
  //** update
  //**************************************************************************

    this.update = function(){
      
      events.forEach(function(e){
        var row = addRow(e.date, e.event, e.details, e.options);
      });
   
    };


  //**************************************************************************
  //** addRow
  //**************************************************************************
    var addRow = function(date, event, details, options){
 

        var alignment = config.alignment;

        var timeFormat = options.timeFormat;
        var color = options.color;

        if (!timeFormat) timeFormat = "%d %b %Y";
        formatTime = d3.timeFormat(timeFormat);

        if (!alignment) alignment = "alternating";
        if (!color) color = "steelblue";


        var li = document.createElement("li");


        var content = document.createElement("div");
        content.className = "timeline-content";

        var h = document.createElement("h3");
        h.textContent = formatTime(date) + " -- "+ event;
        h.style.backgroundColor = color;

        var p = document.createElement("p")
        p.textContent = details;
        p.className = "timeline-details";
        p.style.backgroundColor = color;

        content.append(h, p);


        var point = document.createElement("div");
        point.className = "timeline-point";
        point.style.backgroundColor = color;

        var d = document.createElement("div");
        d.className = "timeline-date";

        // var dateText = document.createElement("h4");
        // dateText.textContent = timeFormat(date);
        // d.appendChild(dateText);

        // li.append(content, point, d);
        li.append(content, point, d);

        tbody.appendChild(li);


        if (alignment !== "alternating"){
          var list = document.querySelectorAll(".timeline ul li");
          list.forEach(function(li){
            if (alignment === "left") li.style.flexDirection = "row";
            if (alignment === "right") li.style.flexDirection = "row-reverse";
          });
        }


        return li;
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
    var merge = javaxt.dhtml.utils.merge;


    init();

};