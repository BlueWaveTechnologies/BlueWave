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
        pointColor: "#6699cc",
        pointRadius: 7,
        pointOpacity: 0.8,
        pointLabels: false,
        showRegLine: false
    };
    var svg, chart, plotArea, line;
    var x, y;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        me.setConfig(config);

        initChart(parent, function(s, g){
            svg = s;
            chart = g;
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
        if (chart) chart.selectAll("*").remove();
        config = merge({}, defaultConfig);
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();
        me.setConfig(chartConfig);

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(data, parent);
        });
    };


    this.getPointLabel = function(d){
        return "";
    };

    this.getPointRadius = function(d){
        return config.pointRadius;
    };


    this.getPointColor = function(d){
        return config.pointColor;
    };

    this.getPointOpacity = function(d){
        return config.pointOpacity;
    };


  //**************************************************************************
  //** getTooltipLabel
  //**************************************************************************
    this.getTooltipLabel = function(d){
        return config.xAxis + ": " + d[config.xAxis] + "<br/>" + config.yAxis + ": " + d[config.yAxis];
    };
    

    this.onClick = function(el, datasetID, d){};


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(data, parent){

        var width = parent.offsetWidth;
        var height = parent.offsetHeight;
        var axisHeight = height;
        var axisWidth = width;
        plotArea = chart.append("g");
        plotArea
            .attr("width", width)
            .attr("height", height);



        let xKey = config.xAxis;
        let yKey = config.yAxis;
        if (!xKey || !yKey) return;


      //Only use the first dataset
        data = data[0];
        if (data.length==0) return;



//      //Render X/Y axis
//        var axes = drawAxes(plotArea, axisWidth, axisHeight, xKey, yKey, data, null, config);
//        x = axes.x;
//        y = axes.y;
//        var xAxis = axes.xAxis;
//
//        //Extend x-axis if point labels are checked
//        if (config.pointLabels){
//
//            x = extendScale({scale:axes.x, band:axes.xBand}, [0, axisWidth], 8).scale;
//            reDrawAxes(plotArea, xAxis, x, null, null, axisHeight);
//        }





      //Render X/Y axis
        var axes = drawAxes(plotArea, axisWidth, axisHeight, xKey, yKey, data, null, config);
        x = axes.x;
        y = axes.y;

      //Update X/Y axis as needed
        var margin = axes.margin;
        if (margin){

            var marginLeft = margin.left;
            var marginRight = margin.right;
            var marginTop = margin.top;
            var marginBottom = margin.bottom;


          //Update right margin as needed.
            var maxLabelWidth = 0;
            if (config.pointLabels){
                                
              //Check boxes of all the labels and see if the right side of any of
              //the boxes exceeds the right margin. Adjust accordingly
                var temp = plotArea.append("g");
                temp.selectAll("text")
                .data(data)
                .enter()
                .append("text")
                    .attr("x", 0)
                    .attr("y", 0)    
                    .attr("text-anchor", "start")    
                    .attr("font-size", 10)
                    .text(function(d){
                        return me.getPointLabel(d);
                    });
                var box = temp.node().getBBox();
                temp.remove();
                maxLabelWidth = Math.max(box.width, maxLabelWidth);
            }


          //Rerender axis
            if (marginTop>0 || marginBottom>0 || marginLeft>0 || marginRight>0){
                axisHeight-=(marginTop+marginBottom);
                axisWidth-=(marginLeft+marginRight);
                plotArea.selectAll("*").remove();
                plotArea
                    .attr(
                        "transform",
                        "translate(" + marginLeft + "," + marginTop + ")"
                    );

                axes = drawAxes(plotArea, axisWidth, axisHeight, xKey, yKey, data, null, config);
            }
            margin = {
                top: marginTop,
                right: marginRight,
                bottom: marginBottom,
                left: marginLeft
            };
        }


      //Get x and y functions from the axes
        x = axes.x;
        y = axes.y;



        let xType = getType(data[xKey]);

        //Just to show it works after final axes are set
        if (config.pointLabels) {
            let scalingFactor = maxLabelWidth/axisWidth;
            x = extendScale({ scale: axes.x, band: axes.xBand }, [0, axisWidth], scalingFactor).scale;
            reDrawAxes(plotArea, axes.xAxis, x, null, null, axisHeight);
        }


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
        
        
        var tooltip;
        if (config.showTooltip===true){
            tooltip = createTooltip();
        }


        var mouseover = function(d) {
            if (tooltip){
                var label = me.getTooltipLabel(d);
                tooltip.html(label).show();
            }
            d3.select(this).transition().duration(100).attr("opacity", "0.8");
        };

        var mousemove = function() {
            var e = d3.event;
            if (tooltip) tooltip
            .style('top', (e.clientY) + "px")
            .style('left', (e.clientX + 20) + "px");
        };

        var mouseleave = function() {
            if (tooltip) tooltip.hide();
            d3.select(this).transition().duration(100).attr("opacity", "1");
        };        
        


      //Draw points
        var pointGroup = plotArea.append("g");
        pointGroup.attr("name", "points");
        pointGroup.selectAll("*")
           .data(data)
           .enter()
           .append("circle")
              .attr("dataset", 0)
              .attr("cx", getX)
              .attr("cy", getY)
              .attr("r", function(d){
                  return me.getPointRadius(d);
              })
              .style("fill", function(d){
                  return me.getPointColor(d);
              })
              .style("opacity", function(d){
                  return me.getPointOpacity(d);
              })
              .style("stroke", "white")
              .on("mouseover", mouseover)
              .on("mousemove", mousemove)
              .on("mouseleave", mouseleave)     
              .on("click", function(d){
                var datasetID = parseInt(d3.select(this).attr("dataset"));
                me.onClick(this, datasetID, d);
              });
              
              



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
                    var r = me.getPointRadius(d);
                    return cx+r+1;
                })
                .attr("y", getY)
                .attr("font-size", 10)
                .text(function(d){
                    return me.getPointLabel(d);
                })
                .on("mouseover", mouseover)
                .on("mousemove", mousemove)
                .on("mouseleave", mouseleave)                 
                .on("click", function(node){
                    //selectNode(node, this);
                });
        }



      //Show regression line
        if (config.showRegLine) {
            var linReg = calculateLinReg(data, xKey, yKey,
                d3.min(data, function(d) {return d[xKey]}),
                d3.min(data, function(d) { return d[yKey]}), x, y)


            // let xScale = getScale(xKey,xType,[0,axisWidth], data).scale;
            // let yScale = getScale(yKey,yType,[axisHeight,0], data).scale;

            line = d3.line()
            .x(function(d) { return (d[0])})
            .y(function(d) { return (d[1])});

             plotArea.append("path")
                  .datum(linReg)
                //   .attr("class", "line")
                  .attr("dataset", 0)
                  .attr("d", line)
                  .attr("stroke", me.getPointColor())
                  .attr("stroke-linecap", 'round')
                  .attr("stroke-width", 2)
                  .on("click", function(d){
                    var datasetID = parseInt(d3.select(this).attr("dataset"));
                    me.onClick(this, datasetID, d);
                });

        }
    };


  //**************************************************************************
  //** calculateLinReg
  //**************************************************************************
    var calculateLinReg = function(data, xKey, yKey, minX, minY, xScale, yScale) {
        // Let n = the number of data points
        var n = data.length;

        // Get just the points
        var pts = [];
        var xAxisData =[];
        var yAxisData = [];

        data.forEach((val) => {
          var obj = {};
          obj.x = parseFloat(xScale(val[xKey]));
          obj.y = parseFloat(yScale(val[yKey]));
          obj.mult = obj.x*obj.y;
          pts.push(obj);

          xAxisData.push(parseFloat(xScale(val[xKey])));
          yAxisData.push(parseFloat(yScale(val[yKey])));
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
    var extendScale = bluewave.chart.utils.extendScale;
    var reDrawAxes = bluewave.chart.utils.reDrawAxes;
    var createTooltip = bluewave.chart.utils.createTooltip;


    init();

};