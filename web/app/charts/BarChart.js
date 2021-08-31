if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  BarChart
//******************************************************************************
/**
 *   Panel used to create bar charts
 *
 ******************************************************************************/

bluewave.charts.BarChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin: {
            top: 15,
            right: 5,
            bottom: 65,
            left: 82
        }
    };
    var svg, plotArea;
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

        plotArea = svg.append("g");
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (plotArea) plotArea.selectAll("*").remove();
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
            plotArea
                .attr("width", plotWidth)
                .attr("height", plotHeight)
                .attr(
                    "transform",
                    "translate(" + margin.left + "," + (margin.top) + ")"
                );


            let xKey;
            let yKey;
            let xKey2;
            let yKey2;
            if (chartConfig.xAxis===null || chartConfig.yAxis===null){
                return;
            }
            else{
                xKey = chartConfig.xAxis;
                yKey = chartConfig.yAxis;
            }

            if (chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
                xKey2 = chartConfig.xAxis2;
                yKey2 = chartConfig.yAxis2;
            }


            var data1 = data[0];
            var data2 = data[1];
            data = data1;

            if(data2!==null && data2!==undefined && xKey2 && yKey2){
                data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
            }

            var sumData = d3.nest()
                .key(function(d){return d[xKey];})
                .rollup(function(d){
                    return d3.sum(d,function(g){
                        return g[yKey];
                    });
            }).entries(data);





            displayAxis("key","value",sumData);

            width = plotWidth;
            height = plotHeight;

            if (y.bandwidth || x.bandwidth) {

                plotArea
                    .selectAll("mybar")
                    .data(sumData)
                    .enter()
                    .append("rect")
                    .attr("x", function (d) {
                        return x.bandwidth ? x(d["key"]) : 0;
                    })
                    .attr("y", function (d) {
                        return y(d["value"]);
                    })
                    .attr("height", function (d) {
                        //console.log(y.bandwidth);
                        //console.log(height - y(d["value"]));

                        return y.bandwidth
                            ? y.bandwidth()
                            : height - y(d["value"]);
                    })
                    .attr("width", function (d) {
                        return x.bandwidth ? x.bandwidth() : x(d["key"]);
                    })
                    .attr("fill", "#69b3a2");
            }
            else {

                if (timeAxis === "x") {
                    plotArea
                        .selectAll("mybar")
                        .data(sumData)
                        .enter()
                        .append("rect")
                        .attr("x", function (d) {
                            return x(d["key"]) - width/data.length / 2;
    //                        return x(d[xKey]) - width/data.length / 2;
                        })
                        .attr("y", function (d) {
                            return y(d["value"]);
    //                        return y(d[yKey]);
                        })
                        .attr("height", function (d) {
                            return height - y(d["value"]);
    //                        return height - y(d[yKey]);
                        })
                        .attr("width", function (d) {
                            return width/sumData.length-5;
                        })
                        .attr("fill", "#69b3a2");
                } else if (timeAxis === "y") {
                    plotArea
                        .selectAll("mybar")
                        .data(data)
                        .enter()
                        .append("rect")
                        .attr("x", function (d) {
                            return 0;
                        })
                        .attr("y", function (d) {
                            return y(d[yKey]) - height/data.length / 2;
                        })
                        .attr("height", function (d) {
                            return height/data.length-5;
                        })
                        .attr("width", function (d) {
                            return x(d[xKey]);
                        })
                        .attr("fill", "#69b3a2");
                }
            }
            //Create d3 event listeners for bars
            var allRects = plotArea.selectAll("rect").data(data);
            allRects.on("mouseover", function(){
                
                d3.select(this).transition().duration(100).attr("opacity", "0.8")
            })

            allRects.on("mouseout", function(){
                d3.select(this).transition().duration(100).attr("opacity", "1.0")
            })
            
            //Draw grid lines
            if(chartConfig.xGrid || chartConfig.yGrid){
                drawGridlines(plotArea, x, y, axisHeight, axisWidth, chartConfig.xGrid, chartConfig.yGrid);
            }
            
            //Display legend
            // var legendContainer = document.querySelector(".bar-legend");
            if(chartConfig.barLegend && !document.querySelector(".bar-legend")){
                 
                var div = d3.select(parent).append("div");

                div
                 .attr("class", "bar-legend")
                 .html("<div>Data Set</div>")
                 .style("background-color", "white")
                 .style("border-radius", "2px")
                 .style("padding", "10px")
                 .style("display", "flex")
                 .style("justify-content", "center")
                 .style("align-items", "center")
                 .style("position", "absolute")
                 .attr("draggable", "true")
                 .style("left", plotWidth/2 + "px")
                 .style("top", 0 + "px")
                 .style("cursor", "move")
                 .style("text-align", "center")
                
                
                //Temporary drag function - will make a better one
                 .call(d3.drag()
                    .on('start.interrupt', function () {
                    div.interrupt();
                })
                .on('start drag', function () {             
                    div.style('top', d3.event.y  + 'px')
                    div.style('left', d3.event.x  + 'px')
                }))

                //Add legend color
                 div.insert("div", ":first-child")
                 .style("background-color", "red")
                 .style("height", "1.618em")
                 .style("width", "1.618em")
                 .style("margin", "auto 10px auto 0px")
                 .style("border-radius", "2px")
                 

            }else if(!chartConfig.barLegend){
                let legendContainer = document.querySelector(".bar-legend");
                if(legendContainer) legendContainer.remove();
            }
            
        });
    };



  //**************************************************************************
  //** displayAxis
  //**************************************************************************
    var displayAxis = function(xKey,yKey,chartData){
        let axisTemp = createAxisScale(xKey,'x',chartData);
        x = axisTemp.scale;
        xBand = axisTemp.band;

        axisTemp = createAxisScale(yKey,'y',chartData);
        y = axisTemp.scale;
        yBand = axisTemp.band;


        if (xAxis) xAxis.selectAll("*").remove();
        if (yAxis) yAxis.selectAll("*").remove();

        xAxis = plotArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        yAxis = plotArea
            .append("g")
            .call(d3.axisLeft(y));
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
  //** createAxisScale
  //**************************************************************************
    var createAxisScale = function(key,axisName,chartData){
        let scale;
        let band;
        let type = typeOfAxisValue(chartData[0][key]);
        let max = 0;
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

                scale = d3
                    .scaleLinear()
                    .domain([0, max])
                    .range(axisRange);
                break;
        }
        return {
            scale,
            band
        };
    };


  //**************************************************************************
  //** mergeToAxis
  //**************************************************************************
    const mergeToAxis = (data1,data2,xKey1,xKey2,newXKey,yKey1,yKey2,newYKey)=>{
        let mergedArray = [];
        data1.forEach(val=>{
          let updatedVal = {...val,[newXKey]:val[xKey1],[newYKey]:val[yKey1]};
          mergedArray.push(updatedVal);
        });
        if(data2===null || data2 === undefined){
          return mergedArray;
        }
        data2.forEach(val=>{
          let updatedVal = {...val,[newXKey]:val[xKey2],[newYKey]:val[yKey2]}
          mergedArray.push(updatedVal);
        });
        return mergedArray;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var isArray = javaxt.dhtml.utils.isArray;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());
    var drawGridlines = bluewave.utils.drawGridlines;

    init();
};