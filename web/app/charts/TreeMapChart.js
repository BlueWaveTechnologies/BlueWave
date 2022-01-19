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
         margin : {top: 10, right: 10, bottom: 10, left: 10},
         groupNames : ["boss1", "boss2", "boss3"],
        // dayLabel: true,
        // yearLabel: true,
        // date: "date",
        // value: "value",
        colors: [ "#402D54", "#D18975", "#8FD175"], //first set of colors
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
            treeMapArea = g;
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
        if (treeMapArea) treeMapArea.selectAll("*").remove();
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
        var
        width = parent.offsetWidth - config.margin.left - config.margin.right,
        height = parent.offsetHeight - config.margin.top - config.margin.bottom;

 
        // Give the data to this cluster layout:
        var root = d3.hierarchy(data).sum(function(d){ return d.value}) // Here the size of each leave is given in the 'value' field in input data

        // Use d3.treemap to compute the position of each element of the hierarchy
        d3.treemap()
            .size([width, height])
            .paddingTop(28)
            .paddingRight(7)
            .paddingInner(3)      // Padding between each rectangle
            //.paddingOuter(6)
            //.padding(20)
            (root)

        // color scale
        var color = d3.scaleOrdinal()
            .domain(config.groupNames)
            .range(config.colors)   

        // opacity scale
        var opacity = d3.scaleLinear()
            .domain([10, 30])
            .range([.5,1])

        // add rectangles
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

        // add text labels
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

        // add text labels
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

        // Add title for each group
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

        // Add title for each group
        svg
            .append("text")
            .attr("x", 0)
            .attr("y", 14)    // +20 to adjust position (lower)
            .attr("font-size", "19px")
            .attr("fill",  "grey" )


    }
  //**************************************************************************
  //** Utils
  //**************************************************************************
   var merge = javaxt.dhtml.utils.merge;
   var onRender = javaxt.dhtml.utils.onRender;
   var initChart = bluewave.chart.utils.initChart;
   var getColorRange = bluewave.chart.utils.getColorRange;
   var getNaturalBreaks = bluewave.chart.utils.getNaturalBreaks;
   var getHighestElements = javaxt.dhtml.utils.getHighestElements;


   init();


}