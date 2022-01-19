console.log("running tree map chart")

if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  TreeMapChart
//******************************************************************************
/**
 *   Panel used to create tree map charts
 *
 ******************************************************************************/

bluewave.charts.TreeMapChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        // dayLabel: true,
        // yearLabel: true,
        // date: "date",
        // value: "value",
        // weekday: "monday", // either: weekday, sunday, or monday
        // cellSize: 17, // width and height of an individual day, in pixels
        // colors: ["#fff","#ebf5dc","#cbe9a5","#2a671a"], //green colors
        // showTooltip: false
    };
    var svg, treeMapArea;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        me.setConfig(config);

        initChart(parent, function(s, g){
            svg = s;
            calendarArea = g;
        });

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
        if (calendarArea) calendarArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){

        me.clear();

        config = merge(chartConfig, defaultConfig);

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(data);
        });
    };


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(data){

        var chartConfig = config;
        // var
        // cellSize = config.cellSize,
        // weekday = config.weekday,
        // formatDay = i => "SMTWTFS"[i]; // given a day number in [0, 6], the day-of-week label


        // set the dimensions and margins of the graph
        var margin = {top: 10, right: 10, bottom: 10, left: 10},
        width = 445 - margin.left - margin.right,
        height = 445 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        var svg = d3.select(parent)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        // // read json data
        // d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/data_dendrogram_full.json", function(data) {

        // Give the data to this cluster layout:
        var root = d3.hierarchy(data).sum(function(d){ return d.value}) // Here the size of each leave is given in the 'value' field in input data

        // Then d3.treemap computes the position of each element of the hierarchy
        d3.treemap()
            .size([width, height])
            .paddingTop(28)
            .paddingRight(7)
            .paddingInner(3)      // Padding between each rectangle
            //.paddingOuter(6)
            //.padding(20)
            (root)

        // prepare a color scale
        var color = d3.scaleOrdinal()
            .domain(["boss1", "boss2", "boss3"])
            .range([ "#402D54", "#D18975", "#8FD175"])

        // And a opacity scale
        var opacity = d3.scaleLinear()
            .domain([10, 30])
            .range([.5,1])

        // use this information to add rectangles:
        svg
            .selectAll("rect")
            .data(root.leaves())
            .enter()
            .append("rect")
            .attr('x', function (d) { return d.x0; })
            .attr('y', function (d) { return d.y0; })
            .attr('width', function (d) { return d.x1 - d.x0; })
            .attr('height', function (d) { return d.y1 - d.y0; })
            .style("stroke", "black")
            .style("fill", function(d){ return color(d.parent.data.name)} )
            .style("opacity", function(d){ return opacity(d.data.value)})

        // and to add the text labels
        svg
            .selectAll("text")
            .data(root.leaves())
            .enter()
            .append("text")
            .attr("x", function(d){ return d.x0+5})    // +10 to adjust position (more right)
            .attr("y", function(d){ return d.y0+20})    // +20 to adjust position (lower)
            .text(function(d){ return d.data.name.replace('mister_','') })
            .attr("font-size", "19px")
            .attr("fill", "white")

        // and to add the text labels
        svg
            .selectAll("vals")
            .data(root.leaves())
            .enter()
            .append("text")
            .attr("x", function(d){ return d.x0+5})    // +10 to adjust position (more right)
            .attr("y", function(d){ return d.y0+35})    // +20 to adjust position (lower)
            .text(function(d){ return d.data.value })
            .attr("font-size", "11px")
            .attr("fill", "white")

        // Add title for the 3 groups
        svg
            .selectAll("titles")
            .data(root.descendants().filter(function(d){return d.depth==1}))
            .enter()
            .append("text")
            .attr("x", function(d){ return d.x0})
            .attr("y", function(d){ return d.y0+21})
            .text(function(d){ return d.data.name })
            .attr("font-size", "19px")
            .attr("fill",  function(d){ return color(d.data.name)} )

        // Add title for the 3 groups
        svg
            .append("text")
            .attr("x", 0)
            .attr("y", 14)    // +20 to adjust position (lower)
            .text("Three group leaders and 14 employees")
            .attr("font-size", "19px")
            .attr("fill",  "grey" )


    }

}