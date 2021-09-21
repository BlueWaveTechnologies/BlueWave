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
            right: 5,
            bottom: 65,
            left: 82
        }
    };
    var svg, scatterArea, line, regression;
        var xAxis, yAxis;
        var axisWidth, axisHeight;
        var x, y, xBand, yBand;
        var timeAxis;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        config = merge(config, defaultConfig);


        if (parent instanceof d3.selection){
            svg = parent;
        }
        else if (parent instanceof SVGElement) {
            svg = d3.select(parent);
        }
        else{
            svg = d3.select(parent).append("svg");
            onRender(parent, function(){
                var width = parent.offsetWidth;
                var height = parent.offsetHeight;
                svg.attr("width", width);
                svg.attr("height", height);
            });
        }

        scatterArea = svg.append("g").append("g");
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (scatterArea) scatterArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();

        var parent = svg.node().parentNode;


        onRender(parent, function(){

            var width = parent.offsetWidth;
            var height = parent.offsetHeight;
            var margin = config.margin;
            axisHeight = height - margin.top - margin.bottom;
            axisWidth = width - margin.left - margin.right;
            var plotHeight = height - margin.top - margin.bottom;
            var plotWidth = width - margin.left - margin.right;
            scatterArea
                .attr("width", plotWidth)
                .attr("height", plotHeight)
                .attr(
                    "transform",
                    "translate(" + margin.left + "," + (margin.top) + ")"
                );

             // Setup:
            // Check that axis exist and are populated
            let xKey;
            let yKey;
            let xKey2;
            let yKey2;
            let group;

            if(chartConfig.xAxis===null || chartConfig.yAxis===null){
                return;
            }else{
                xKey = chartConfig.xAxis;
                yKey = chartConfig.yAxis;
                group = chartConfig.group;
            }

            if(chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
                xKey2 = chartConfig.xAxis2;
                yKey2 = chartConfig.yAxis2;
            }

            var data1 = data[0];
            var data2 = data[1];
            data = data1;

            if (data2!==null && data2!==undefined && xKey2 && yKey2){
                data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
            }
               let xType = typeOfAxisValue();

               displayAxis(xKey, yKey, data);

               var tooltip = d3.select(parent)
                 .append("div")
                 .style("opacity", 0)
                 .attr("class", "tooltip")
                 .style("background-color", "white")
                 .style("border", "solid")
                 .style("border-width", "1px")
                 .style("border-radius", "5px")
                 .style("padding", "10px")

               var mouseover = function(d) {
                  tooltip
                  .style("opacity", 1)
               }

               var mousemove = function(d) {
                  tooltip
                  .html("X: " + d[xKey]+ "     Y: " + d[yKey])
                  .style("left", (d3.mouse(this)[0]+90) + "px")
                  .style("top", (d3.mouse(this)[1]) + "px")
               }

               var mouseleave = function(d) {
                  tooltip
                  .transition()
                  .duration(200)
                  .style("opacity", 0)
               }

               let keyType = typeOfAxisValue(data[0].xKey);
               scatterArea
                   .selectAll("dot")
                   .data(data)
                   .enter()
                   .append("circle")
                      .attr("cx", function (d) {
                      if(keyType==="date"){
                        return x(new Date(d[xKey]));
                      } else{
                        return x(d[xKey]);
                      }})
                      .attr("cy", function (d) { return y(d[yKey]); } )
                      .attr("r", 7)
                      .style("fill", "#12b84c")
                      .style("opacity", 0.3)
                      .style("stroke", "white")
                      .on("mouseover", mouseover)
                      .on("mousemove", mousemove)
                      .on("mouseleave", mouseleave);


            var linReg = calculateLinReg(data, xKey, yKey, d3.min(data, function(d) {return d[xKey]}), d3.min(data, function(d) { return d[yKey]}));

            let xTemps = createAxisScale(xKey, 'x', data);
            let xScale = xTemps.scale;
            let yTemps = createAxisScale(yKey, 'y', data);
            let yScale = yTemps.scale;

            line = d3.line()
            .x(function(d) { return xScale(d[0])})
            .y(function(d) { return yScale(d[1])});

            if (chartConfig.showRegLine) {
            	 scatterArea.append("path")
                      .datum(linReg)
                      .attr("class", "line")
                      .attr("d", line)
                      .attr("stroke", function(d) { return "#000000"; })
                      .attr("stroke-linecap", 'round')
                      .attr("stroke-width", 500);

            }

        });
    };

      //**************************************************************************
      //** typeOfAxisValue
      //**************************************************************************
         var typeOfAxisValue = function(value) {
            let dataType;

            const validNumberRegex = /^[\+\-]?\d*\.?\d+(?:[Ee][\+\-]?\d+)?$/;
            switch (typeof value) {
                case "string":
                    if(value.match(validNumberRegex)){
                        dataType =  "number";
                    }else if (Date.parse(value)){
                        dataType =  "date";
                    }else{
                        dataType = "string";
                    }
                    break;
                case "number":
                    dataType = "number";
                    break;
                case "object":
                    dataType = "date";
                    break;
                default:
                    break;
            }
            return dataType;
        };

  //**************************************************************************
  //** displayAxis
  //**************************************************************************
    var displayAxis = function(xKey,yKey,chartData){
        let xAxisTemp = createAxisScale(xKey,'x',chartData);
        x = xAxisTemp.scale;
        xBand = xAxisTemp.band;

        let yAxisTemp = createAxisScale(yKey,'y',chartData);
        y = yAxisTemp.scale;
        yBand = yAxisTemp.band;


        if (xAxis) xAxis.selectAll("*").remove();
        if (yAxis) yAxis.selectAll("*").remove();

        xAxis = scatterArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        yAxis = scatterArea
            .append("g")
            .call(d3.axisLeft(y));
    };


  //**************************************************************************
  //** createAxisScale
  //**************************************************************************
    var createAxisScale = function(key,axisName,chartData){
        let scale;
        let band;
        let type = typeOfAxisValue(chartData[0][key]);
        let max = 0;
        let min = 0;
        let timeRange;
        let axisRange;
        let axisRangePadded;
        if(axisName === "x"){
            axisRange = [0,axisWidth];
            axisRangePadded = [10,axisWidth-10];
        }else{
            axisRange = [axisHeight,0];
            axisRangePadded = [axisHeight-10,10];
        }

        switch (type) {
            case "string":
                scale = d3
                .scaleBand()
                .domain(
                    chartData.map(function (d) {
                        return d[key];
                    })
                )
                .range(axisRange)
                .padding(0.2);
                break;
            case "date":

                timeRange = [new Date(chartData[0][key]),new Date(chartData[chartData.length-1][key])];
                chartData.map((val) => {
                    val[key] = new Date(val[key]);
                    return val;
                });

                scale = d3
                    .scaleTime()
                    .domain(timeRange)
                    .rangeRound(axisRangePadded);

                band = d3
                    .scaleBand()
                    .domain(d3.timeDay.range(...scale.domain()))
                    .rangeRound(axisRangePadded)
                    .padding(0.2);

                timeAxis = axisName;
                break;
            default:

                chartData.forEach((val) => {
                    let curVal = parseFloat(val[key]);
                    if (curVal > max) {
                        max = curVal;
                    }
                });

                min = max;

                chartData.forEach((val) => {
                    let curVal = parseFloat(val[key]);
                    if (curVal < min) {
                        min = curVal;
                    }
                });


                scale = d3
                    .scaleLinear()
                    .domain([min, max])
                    .range(axisRange);
                break;
        }
        return {
            scale,
            band
        };
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
  }


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;

    init();

};