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
        //temp height
        div.style.height = "550";
        div.style.overflowY = "auto";
        parent.appendChild(div);
        me.el = div;



      //Create main table
        // var table = createTable();
        // tbody = table.firstChild;
        // tbody = me.el;



        // div.appendChild(table);

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
   
      onRender(tbody, function(){

          // drawLine();
      })

      
    };


  //**************************************************************************
  //** addRow
  //**************************************************************************
    var addRow = function(date, event, details, options){
 
      
        var timeFormat = options.timeFormat;
        var alignment = options.alignment;

        if (!timeFormat) timeFormat = d3.timeFormat("%d %b %Y");
        if (!alignment) alignment = "alternating";


        var li = document.createElement("li");


        var content = document.createElement("div");
        content.className = "timeline-content";

        var h = document.createElement("h3");
        h.textContent = timeFormat(date) + " -- "+ event;

        var p = document.createElement("p")
        p.textContent = details;

        content.append(h, p);


        var point = document.createElement("div");
        point.className = "timeline-point";

        var d = document.createElement("div");
        d.className = "timeline-date";

        // var dateText = document.createElement("h4");
        // dateText.textContent = timeFormat(date);
        // d.appendChild(dateText);

        // li.append(content, point, d);
        li.append(content, point, d);

        tbody.appendChild(li);

alignment = "right"


        if (alignment !== "alternating"){
          var list = document.querySelectorAll(".timeline ul li");
          list.forEach(function(li){
            if (alignment === "left") li.style.flexDirection = "row";
            if (alignment === "right") li.style.flexDirection = "row-reverse";
          });
        }


        
  
        // var lineContainer = d3.select(d).append("svg");
        // lineContainer
        //   .append("line")
        //   .style("stroke", "black")
        //   .style("stroke-width", 3)
        //   .attr("x1", 0)
        //   .attr("y1", 0)
        //   .attr("x2", 200)
        //   .attr("y2", 200);

        return li;
    };


  //**************************************************************************
  //** drawLine
  //**************************************************************************
    var drawLine = function(){

          d3.selectAll(".timeline-point")
            .append("svg")
            .append("line")
            .style("stroke", "black")
            .style("stroke-width", 5)
            .attr("x1", function(d, i){

              var width = this.getBoundingClientRect().width;
              // console.log(bbox)
              // console.log(this)
              return width/2;

            })
            .attr("y1", function(){
              return 0;
            })
            .attr("x2", function(){
              // return this.getBoundingClientRect().x;
              return 0
            })
            .attr("y2", function(){
              return 500;
            });

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