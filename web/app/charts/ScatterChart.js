if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  ScatterChart
//******************************************************************************
/**
 *   Panel used to create scatter charts
 *
 ******************************************************************************/

bluewave.charts.ScatterChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin: {
            top: 15,
            right: 15,
            bottom: 65,
            left: 82
        },
        getPointLabel: function(d){
            return "";
        },
        getPointRadius: function(d){
            var pointRadius = parseFloat(config.pointRadius);
            if (isNaN(pointRadius)) pointRadius = 7;
            return pointRadius;
        },
        getPointColor: function(d){
            var pointColor = config.pointColor;
            if (!pointColor) pointColor = "#6699cc";
            return pointColor;
        },
        getPointOpacity: function(d){
            var pointOpacity = parseFloat(config.pointOpacity);
            if (isNaN(pointOpacity)) pointOpacity = 0.8;
            return pointOpacity;
        }
    };
    var svg, chart, plotArea, line;
    var x, y;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        config = merge(config, defaultConfig);


        initChart(parent, function(s, g){
            svg = s;
            chart = g;
        });
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (chart) chart.selectAll("*").remove();
        config = merge({}, defaultConfig);
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();

        config = merge(chartConfig, config);

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(data, parent);
        });
    };


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(data, parent){
        //me.clear();

        var width = parent.offsetWidth;
        var height = parent.offsetHeight;
        var margin = config.margin;
        var axisHeight = height - margin.top - margin.bottom;
        var axisWidth = width - margin.left - margin.right;
        var plotHeight = height - margin.top - margin.bottom;
        var plotWidth = width - margin.left - margin.right;
        plotArea = chart.append("g");
        plotArea
            .attr("width", plotWidth)
            .attr("height", plotHeight)
            .attr(
                "transform",
                "translate(" + margin.left + "," + (margin.top) + ")"
            );


        let xKey = config.xAxis;
        let yKey = config.yAxis;
        if (!xKey || !yKey) return;


      //Only use the first dataset
        data = data[0];
        if (data.length==0) return;



      //Render X/Y axis
        var axes = drawAxes(plotArea, axisWidth, axisHeight, xKey, yKey, data, null, config);
        x = axes.x;
        y = axes.y;



        let xType = getType(data[xKey]);
        let yType = getType(data[yKey]);



        var tooltip = d3.select(parent)
         .append("div")
         .style("opacity", 0)
         .attr("class", "tooltip")
         .style("background-color", "white")
         .style("border", "solid")
         .style("border-width", "1px")
         .style("border-radius", "5px")
         .style("padding", "10px");

        var mouseover = function(d) {
            if (config.tooltip!==true) return;
            tooltip.style("opacity", 1);
        };

        var mousemove = function(d) {
            if (config.tooltip!==true) return;
            tooltip
            .html("X: " + d[xKey]+ "     Y: " + d[yKey])
            .style("left", (d3.mouse(this)[0]+90) + "px")
            .style("top", (d3.mouse(this)[1]) + "px");
        };

        var mouseleave = function(d) {
            if (config.tooltip!==true) return;
            tooltip
            .transition()
            .duration(200)
            .style("opacity", 0);
        };


      //Draw grid lines if option is checked
        if (config.xGrid || config.yGrid){
            drawGridlines(plotArea, x, y, axisHeight, axisWidth, config.xGrid, config.yGrid);
        }


        var getX = function(d){
            if (xType==="date"){
                return x(new Date(d[xKey]));
            }
            else{
                return x(d[xKey]);
            }
        };

        var getY = function (d) {
            return y(d[yKey]);
        };


      //Draw points
        var pointGroup = plotArea.append("g");
        pointGroup.attr("name", "points");
        pointGroup.selectAll("*")
           .data(data)
           .enter()
           .append("circle")
              .attr("cx", getX)
              .attr("cy", getY)
              .attr("r", config.getPointRadius)
              .style("fill", config.getPointColor)
              .style("opacity", config.getPointOpacity)
              .style("stroke", "white")
              .on("mouseover", mouseover)
              .on("mousemove", mousemove)
              .on("mouseleave", mouseleave);



      //Draw labels
        if (config.pointLabels===true){
            var labelGroup = plotArea.append("g");
            labelGroup.attr("name", "labels");
            labelGroup.append("g")
            .selectAll("text")
            .data(data)
            .enter()
            .append("text")
                .attr("x", function(d){
                    var cx = getX(d);
                    var r = config.getPointRadius(d);
                    return cx+r+1;
                })
                .attr("y", getY)
                .attr("font-size", 10)
                .text(config.getPointLabel)
                .on("click", function(node){
                    //selectNode(node, this);
                });
        }



      //Draw labels if checked
        if (config.xLabel || config.yLabel){
            drawLabels(plotArea, config.xLabel, config.yLabel,
                axisHeight, axisWidth, margin, config.xAxis, config.yAxis);
        }


      //Show regression line
        if (config.showRegLine) {
            var linReg = calculateLinReg(data, xKey, yKey,
                d3.min(data, function(d) {return d[xKey]}),
                d3.min(data, function(d) { return d[yKey]}));


            let xScale = getScale(xKey,xType,[0,axisWidth], data).scale;
            let yScale = getScale(yKey,yType,[axisHeight,0], data).scale;

            line = d3.line()
            .x(function(d) { return xScale(d[0])})
            .y(function(d) { return yScale(d[1])});

             plotArea.append("path")
                  .datum(linReg)
                  .attr("class", "line")
                  .attr("d", line)
                  .attr("stroke", function(d) { return "#000000"; })
                  .attr("stroke-linecap", 'round')
                  .attr("stroke-width", 500);

        }
    };


  //**************************************************************************
  //** calculateLinReg
  //**************************************************************************
    var calculateLinReg = function(data, xKey, yKey, minX, minY) {
        // Let n = the number of data points
        var n = data.length;

        // Get just the points
        var pts = [];
        var xAxisData =[];
        var yAxisData = [];

        data.forEach((val) => {
          var obj = {};
          obj.x = parseFloat(val[xKey]);
          obj.y = parseFloat(val[yKey]);
          obj.mult = obj.x*obj.y;
          pts.push(obj);

          xAxisData.push(parseFloat(val[xKey]));
          yAxisData.push(parseFloat(val[yKey]));
        });

        var sum_x = 0;
        var sum_y = 0;
        var sum_xy = 0;
        var sum_xx = 0;
        var count = 0;


        var x = 0;
        var y = 0;
        var valuesLength = xAxisData.length;

        if (valuesLength != yAxisData.length) {
            throw new Error('The values in xAxis and yAxis need to have same size!');
        }


        if (valuesLength === 0) {
            return [ [], [] ];
        }

        for (var v = 0; v < valuesLength; v++) {
            x = xAxisData[v];
            y = yAxisData[v];
            sum_x += x;
            sum_y += y;
            sum_xx += x*x;
            sum_xy += x*y;
            count++;
        }

        var m = (count*sum_xy - sum_x*sum_y) / (count*sum_xx - sum_x*sum_x);
        var b = (sum_y/count) - (m*sum_x)/count;

        var finalResults = [];

        for (var v = 0; v < valuesLength; v++) {
            x = xAxisData[v];
            y = x * m + b;
            finalResults.push([x, y]);
        }

        return finalResults;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;

    var initChart = bluewave.chart.utils.initChart;
    var getType = bluewave.chart.utils.getType;
    var getScale = bluewave.chart.utils.getScale;
    var drawAxes = bluewave.chart.utils.drawAxes;
    var drawLabels = bluewave.chart.utils.drawLabels;
    var drawGridlines = bluewave.chart.utils.drawGridlines;


    init();

};