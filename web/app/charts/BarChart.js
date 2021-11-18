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
    var svg, chart, plotArea;
    var xAxis, yAxis;
    var axisWidth, axisHeight;
    var x, y, xBand, yBand;
    var timeAxis;


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
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(chartConfig, data, parent);
        });
    };


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(chartConfig, data, parent){

        var width = parent.offsetWidth;
        var height = parent.offsetHeight;
        var margin = config.margin;
        axisHeight = height - margin.top - margin.bottom;
        axisWidth = width - margin.left - margin.right;
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


        var xKey;
        var yKey;
        let xKey2;
        let yKey2;
        var barType = chartConfig.barType;
        if (barType === "histogram"){
            xKey = chartConfig.values;
            yKey = xKey;
        }
        else{
            xKey = chartConfig.xAxis;
            yKey = chartConfig.yAxis;
        }
        if ((xKey===null || xKey===undefined) || (yKey===null || yKey===undefined)) return;


        if (chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
            xKey2 = chartConfig.xAxis2;
            yKey2 = chartConfig.yAxis2;
        }

        var data1 = data[0];
        var data2 = data[1];
        var dataSets = data;
        // data = data1;


        var mergedData = d3.merge(dataSets);

        //Get max bar
        var maxData = d3.nest()
            .key(function (d) { return d[xKey]; })
            .rollup(function (d) {
                return d3.sum(d, function (g) {
                    return parseFloat(g[yKey]);
                });
            }).entries(mergedData);
        //Get sum of tallest bar
        //TODO: axis being set by first dataset - set with largest data


            // if(data2!==null && data2!==undefined && xKey2 && yKey2){
            //     data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
            // }

        //Reformat data if "group by" is selected
        var group = chartConfig.group;
        if(group !== null && group !== undefined && group!==""){

            var groupData = d3.nest()
            .key(function(d){return d[group];})
            .entries(data1);

            maxData = d3.nest()
            .key(function (d) { return d[xKey]; })
            .rollup(function (d) {
                return d3.max(d, function (g) {
                    return parseFloat(g[yKey]);
                });
            }).entries(mergedData);

            let tempDataSets = [];
            groupData.forEach(function(g){
                tempDataSets.push(g.values);
            });

            dataSets = tempDataSets;

            var x0 = d3.scaleBand()
            .rangeRound([0, width])
            .paddingInner(0.1);

            var subgroups = groupData.map(function(d) { return d["key"]; });
            x0.domain(subgroups);
        }


        //Get x and y values for each data set and format object for rendering
        var arr = [];
        for (let i=0; i<dataSets.length; i++){

            let xAxisN = chartConfig[`xAxis${i+1}`];
            let yAxisN = chartConfig[`yAxis${i+1}`];

            //If axes not picked, skip pushing/rendering this dataset
            if ((!xAxisN || !yAxisN) && !group && i>0) continue;

            if (chartConfig.hasOwnProperty(`xAxis${i+1}`) && chartConfig.hasOwnProperty(`yAxis${i+1}`)){

                xKey = xAxisN;
                yKey = yAxisN;
            }

            // if(!xKey || !yKey) continue;

            var sumData = d3.nest()
                .key(function(d){return d[xKey];})
                .rollup(function(d){
                    return d3.sum(d,function(g){
                        return g[yKey];
                    });
            }).entries(dataSets[i]);

            arr.push(sumData);
        }


        //Flip axes if layout is horizontal
        var leftLabel, bottomLabel;

        //Set intitial value for layout to vertical and barType to barchart
        if (!chartConfig.barLayout) chartConfig.barLayout = "vertical";
        var layout = chartConfig.barLayout;

        if (barType === "histogram") {
            if (layout === "vertical") {
                displayAxis("key", "key", maxData);
                leftLabel = "Frequency";
                bottomLabel = chartConfig.xAxis;
            } else if (layout === "horizontal") {
                displayAxis("key", "key", maxData);
                leftLabel = chartConfig.xAxis;
                bottomLabel = "Frequency";
            }
        }
        else{
            if (layout === "vertical") {
                displayAxis("key", "value", maxData);
                leftLabel = chartConfig.yAxis;
                bottomLabel = chartConfig.xAxis;
            } else if (layout === "horizontal") {
                displayAxis("value", "key", maxData);
                leftLabel = chartConfig.xAxis;
                bottomLabel = chartConfig.yAxis;
            }
        }



        width = plotWidth;
        height = plotHeight;

        for (let i=0; i<dataSets.length; i++){
            var sumData = arr[i];

            let fillOpacity = parseFloat(chartConfig["fillOpacity" + i]);
            if (isNaN(fillOpacity) || fillOpacity<0 || fillOpacity>1) fillOpacity = 1;


            if (barType === "histogram"){


                let binWidth = parseInt(chartConfig.binWidth);
                if (isNaN(binWidth) || binWidth<1) binWidth = 10;

                var histogram = d3.histogram()
                    .value(function(d) { return d.key; })
                    .domain(x.domain())
                    .thresholds(x.ticks(binWidth));

                    // .thresholds(x.ticks(100))
                    //TODO: find general solution for time and ordinal scale
                    // .thresholds(x.domain()) //Not sure why this doesn't work for dates/strings

                 var bins = histogram(sumData);

                 var frequencyMax = d3.max(bins, d => d.length)

                 var frequencyAxis = d3.scaleLinear()
                    .range(layout === "vertical" ? [height, 0] : [0, width]);
                    frequencyAxis.domain([0, frequencyMax]);

                if (layout === "vertical") displayHistogramAxis(x, frequencyAxis);
                else if(layout === "horizontal") displayHistogramAxis(frequencyAxis, y);


                plotArea.selectAll("rect")
                    .data(bins)
                    .enter()
                    .append("rect")

                    .attr("x", function (d) {
                        return (layout === "vertical") ? x(d.x0) : 0;
                    })
                    .attr("y", function (d) {
                        return (layout === "vertical") ? frequencyAxis(d.length) : height - x(d.x1)/(width/height) //This is a dumb way of doing this probably
                        // y(d.key) - height/sumData.length / 2;
                    })
                    .attr("width", function (d) {
                        return (layout === "vertical") ? (x(d.x1) - x(d.x0) - 0.5) : frequencyAxis(d.length);
                    })
                    .attr("height", function (d) {
                        return (layout === "vertical") ? height - frequencyAxis(d.length) : (x(d.x1) - x(d.x0))/(width/height) - 0.5;
                    })
                    .attr("opacity", fillOpacity)
                    .attr("barID", i);


            }
            else { //regular bar chart


            let keyType = typeOfAxisValue(sumData[0].key);
            if(keyType == "date") keyType = "string";

            var getX = function (d) {

                if (keyType === "date") {
                    return x(new Date(d.key));
                } else {
                    return x(d.key);
                }

            };

            var getY = function(d){
                var v = parseFloat(d["value"]);
                return y(v);
            };


            if (y.bandwidth || x.bandwidth) {
                if (chartConfig.barLayout === "vertical"){

                    var getWidth = function(d){
                        if(group){
                            return x.bandwidth ? x.bandwidth()/dataSets.length : getX(d);
                        }else{
                            return x.bandwidth ? x.bandwidth() : getX(d);
                        }
                    };


                    plotArea
                        .selectAll("mybar")
                        .data(sumData)
                        .enter()
                        .append("rect")
                        .attr("x", function(d) {
                            var w = getWidth(d);
                            var left = x.bandwidth ? getX(d) : 0;
                            return group ? left+(w*i): getX(d);
                        })
                        .attr("y", getY)
                        .attr("height", function (d) {


                            return y.bandwidth
                                ? y.bandwidth()
                                : height - getY(d);
                        })
                        .attr("width", function (d) {
                            return getWidth(d);
                        })
                        .attr("opacity", fillOpacity)
                        .attr("barID", function(d, n, j){
                            // i is external loop incrementor for multiple data sets and grouping
                            // n is for single data set where all bars are rendered on enter()
                            return group ? i : 0;
                        })

                }
                else if(chartConfig.barLayout === "horizontal"){
                    plotArea
                        .selectAll("mybar")
                        .data(sumData)
                        .enter()
                        .append("rect")
                        .attr("x", function (d) {
                            return 0;
                        })
                        .attr("y", function (d) {

                            var w = y.bandwidth ? y.bandwidth()/dataSets.length : height - y(d["key"]);
                            var left = y.bandwidth ? y(d["key"]) : 0;
                            return group ? left+(w*i): y(d["key"]);

                        })
                        .attr("height", function (d) {

                            if(group){
                                return y.bandwidth ? y.bandwidth()/dataSets.length : height - y(d["value"]);
                            }else{
                                return y.bandwidth ? y.bandwidth() : height - y(d["value"]);
                            }

                        })
                        .attr("width", function (d) {
                            return x.bandwidth ? x.bandwidth() : x(d["value"]);
                        })
                        .attr("opacity", fillOpacity)
                        .attr("barID", function(d, n, j){
                            // i is external loop incrementor for multiple data sets and grouping
                            // n is for single data set where all bars are rendered on enter()
                            return group ? i : 0;
                        })

                        // .attr("fill", getBarColor(i));
                }
            }
            //No bandwith
            else {
                // if(timeAxis === "x")
                if (chartConfig.barLayout === "vertical") {

                    if(!group){
                    plotArea
                        .selectAll("mybar")
                        .data(sumData)
                        .enter()
                        .append("rect")
                        .attr("x", function (d) {
                            return getX(d) - width/sumData.length / 2;
    //                        return x(d[xKey]) - width/data.length / 2;
                        })
                        .attr("y", getY)
                        .attr("height", function (d) {
                            return height - getY(d);
    //                        return height - y(d[yKey]);
                        })
                        .attr("width", function (d) {
                            return width/sumData.length-5;
                        })
                        .attr("opacity", fillOpacity)
                        .attr("barID", function(d, n, j){
                            // i is external loop incrementor for multiple data sets and grouping
                            // n is for single data set where all bars are rendered on enter()
                            return group ? i : 0;
                        })

                        // .attr("fill", getBarColor(i));
                    }

                }
                // else if(timeAxis === "y")
                else if (chartConfig.barLayout === "horizontal") {

                    plotArea
                        .selectAll("mybar")
                        .data(sumData)
                        .enter()
                        .append("rect")
                        .attr("x", function (d) {
                            return 0;
                        })
                        .attr("y", function (d) {
                            if (keyType === "date") {
                                return y(new Date(d.key)) - height/sumData.length / 2;
                            } else {
                                return y(d.key) - height/sumData.length / 2;
                            }
                            // return y(d["key"]) - height/sumData.length / 2;
                        })
                        .attr("height", function (d) {
                            return height/sumData.length-5;
                        })
                        .attr("width", function (d) {
                            return x(d["value"]);
                        })
                        .attr("opacity", fillOpacity)
                        .attr("barID", function(d, n, j){
                            // i is external loop incrementor for multiple data sets and grouping
                            // n is for single data set where all bars are rendered on enter()
                            return group ? i : 0;
                        })
                        // .attr("fill", getBarColor(i));
                }
            }
        }
        }

        //Set color defaults
        var colors = bluewave.utils.getColorPalette(true);
        var getBarColor = function(i){
            var barColor = chartConfig["barColor" + i];
            if (!barColor) {
                barColor = colors[i%colors.length];
                chartConfig["barColor" + i] = barColor;
            }
            return barColor;
        };

        //Set bar colors
        var bars = plotArea.selectAll("rect");

        bars.each(function (d, i) {

            //i is a d3 internal callback incrementer
            let bar = d3.select(this);
            let barID = parseInt(d3.select(this).attr("barID"));
            bar.attr("fill", getBarColor(barID));
        })


        //Create d3 event listeners for bars
        bars.on("mouseover", function(){
            d3.select(this).transition().duration(100).attr("opacity", "0.8")
        });

        bars.on("mouseout", function(){
            d3.select(this).transition().duration(100).attr("opacity", "1.0")
        });

        var getSiblings = function(bar){
            var arr = [];
            bars.each(function() {
                arr.push(this);
            });
            return arr;
        };

        bars.on("click", function(d){
            // me.onClick(this, getSiblings(this));
            var barID = parseInt(d3.select(this).attr("barID"));
            me.onClick(this, barID, d);
        });

        bars.on("dblclick", function(){
            me.onDblClick(this, getSiblings(this));
        });


        //Draw grid lines
        if(chartConfig.xGrid || chartConfig.yGrid){
            drawGridlines(plotArea, x, y, axisHeight, axisWidth, chartConfig.xGrid, chartConfig.yGrid);
        }

        //Draw labels if checked
        if(chartConfig.xLabel || chartConfig.yLabel){
            drawLabels(plotArea, chartConfig.xLabel, chartConfig.yLabel,
                axisHeight, axisWidth, margin, bottomLabel, leftLabel);
        }


        //Display legend
        // var legendContainer = document.querySelector(".bar-legend");
        // if(chartConfig.barLegend && !document.querySelector(".bar-legend")){

        //     var div = d3.select(parent).append("div");

        //     div
        //      .attr("class", "bar-legend")
        //      .html("<div>Data Set</div>")
        //      .style("background-color", "white")
        //      .style("border-radius", "2px")
        //      .style("padding", "10px")
        //      .style("display", "flex")
        //      .style("justify-content", "center")
        //      .style("align-items", "center")
        //      .style("position", "absolute")
        //      .attr("draggable", "true")
        //      .style("left", plotWidth/2 + "px")
        //      .style("top", 0 + "px")
        //      .style("cursor", "move")
        //      .style("text-align", "center")


        //     //Temporary drag function - will make a better one
        //      .call(d3.drag()
        //         .on('start.interrupt', function () {
        //         div.interrupt();
        //     })
        //     .on('start drag', function () {
        //         div.style('top', d3.event.y  + 'px')
        //         div.style('left', d3.event.x  + 'px')
        //     }))

        //     //Add legend color
        //      div.insert("div", ":first-child")
        //      .style("background-color", getBarColor)
        //      .style("height", "1.618em")
        //      .style("width", "1.618em")
        //      .style("margin", "auto 10px auto 0px")
        //      .style("border-radius", "2px")


        // }else if(!chartConfig.barLegend){
        //     let legendContainer = document.querySelector(".bar-legend");
        //     if(legendContainer) legendContainer.remove();
        // }
    };


  //**************************************************************************
  //** onClick
  //**************************************************************************
    this.onClick = function(bar, bars){};
    this.onDblClick = function(bar, bars){};

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
            .call(d3.axisBottom(x));

            xAxis
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        yAxis = plotArea
            .append("g")
            .call(d3.axisLeft(y));
    };

  //**************************************************************************
  //** displayHistogramAxis
  //**************************************************************************
    var displayHistogramAxis = function (x, y) {

        if (xAxis) xAxis.selectAll("*").remove();
        if (yAxis) yAxis.selectAll("*").remove();

        xAxis = plotArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(d3.axisBottom(x));

            xAxis
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
        if (type === "date") type = "string";
        let max = 0;
        let timeRange;
        let axisRange;
        let axisRangePadded;
        if(axisName === "x"){
            // type = "string";
            axisRange = [0,axisWidth];
            axisRangePadded = [10,axisWidth-10];
        }
        else{
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
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.utils.initChart;
    var drawGridlines = bluewave.utils.drawGridlines;
    var drawLabels = bluewave.utils.drawLabels;

    init();
};