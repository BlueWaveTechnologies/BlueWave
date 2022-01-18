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
        layout: "vertical", 
        animationSteps: 1500, //duration in milliseconds
        stackValues: false
    };
    var svg, chart, plotArea;
    var x, y;
    var xAxis, yAxis;


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


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(data, parent){

        var chartConfig = config;


        var width = parent.offsetWidth;
        var height = parent.offsetHeight;
        var axisHeight = height;
        var axisWidth = width;
        plotArea = chart.append("g");
        plotArea
            .attr("width", width)
            .attr("height", height);


      //Get chart options
        var layout = chartConfig.barLayout;
        var stackValues = chartConfig.stackValues===true;



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

        var dataSets = data;
        var colors = bluewave.utils.getColorPalette(true);


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



        //Reformat data if "group by" is selected
        var group = chartConfig.group;
        if(group !== null && group !== undefined && group!==""){

            var groupData = d3.nest()
            .key(function(d){return d[group];})
            .entries(data[0]);

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
            if ((!xAxisN || !yAxisN) && !group && barType !== "histogram" && i>0) continue;

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




      //Render X/Y axis
        var axisKey, axisValue;
        if (barType === "histogram") {
            axisKey = "key";
            axisValue = "key";
            if (layout === "vertical") {
                leftLabel = "Frequency";
                bottomLabel = chartConfig.xAxis;
            }
            else if (layout === "horizontal") {
                leftLabel = chartConfig.xAxis;
                bottomLabel = "Frequency";
            }
        }
        else{
            if (layout === "vertical") {
                axisKey = "key";
                axisValue = "value";
                leftLabel = chartConfig.yAxis;
                bottomLabel = chartConfig.xAxis;
            }
            else if (layout === "horizontal") {
                axisKey = "value";
                axisValue = "key";
                leftLabel = chartConfig.xAxis;
                bottomLabel = chartConfig.yAxis;
            }
        }


      //Render X/Y axis
        var axes = drawAxes(plotArea, axisWidth, axisHeight, axisKey, axisValue, maxData, null, chartConfig, "barChart");


      //Update X/Y axis as needed
        var margin = axes.margin;
        if (margin){

            var marginLeft = margin.left;
            var marginRight = margin.right;
            var marginTop = margin.top;
            var marginBottom = margin.bottom;



            if (marginTop>0 || marginBottom>0 || marginLeft>0 || marginRight>0){
                axisHeight-=(marginTop+marginBottom);
                axisWidth-=(marginLeft+marginRight);
                plotArea.selectAll("*").remove();
                plotArea
                    .attr(
                        "transform",
                        "translate(" + marginLeft + "," + marginTop + ")"
                    );

                axes = drawAxes(plotArea, axisWidth, axisHeight, axisKey, axisValue, maxData, null, chartConfig, "barChart");
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
        xAxis = axes.xAxis;
        yAxis = axes.yAxis;


        height = height-(margin.top+margin.bottom);
        width = width-(margin.left+margin.right);


        if (stackValues){

            //Nest merged data object by X-axis value for stack
            var groupedStackData = d3.nest()
                .key((d) => d[xKey])
                .entries(mergedData);


            let stackGroup = [];
            let stackLength = groupedStackData[0].values.length;
            for (let i = 0; i < stackLength; i++) {
                stackGroup.push(i);
            }

            var stackedData = d3.stack()
                // .keys(subgroups)
                .keys(stackGroup)
                .value(function (d, key) {

                    let v = d.values[key];
                    return v[yKey];

                })
                (groupedStackData)


            let colorIncrementer = 0;
            plotArea.append("g")
                .selectAll("g")
                .data(stackedData)
                .enter().append("g")
                .selectAll("rect")

                .data(function (d) { return d; })
                .enter().append("rect")
                .attr("x", function (d) {

                    // return x(new Date(d.data.key));
                    //keep in case we change how we're handling timescale
                    return layout === "vertical" ? x(d.data.key) : x(d[0]);
                })
                .attr("y", function (d) {

                    return layout === "vertical" ? y(d[1]) : y(d.data.key);
                })
                .attr("height", function (d) {

                    return layout === "vertical" ? y(d[0]) - y(d[1]) : y.bandwidth();
                })
                .attr("width", function(d){

                    return layout==="vertical" ? x.bandwidth() : x(d[1]) - x(d[0]);
                });


                //Mod through color array assigning barId. Rolls over at number of stacks
                plotArea.selectAll("rect").attr("barID", function(d, i){

                    if (i%stackLength === 0) colorIncrementer++;
                    return colorIncrementer-1;

                });

        }



        for (let i=0; i<dataSets.length; i++){

            if (stackValues) break;


            var sumData = arr[i];

            let fillOpacity = parseFloat(chartConfig["fillOpacity" + i]);
            if (isNaN(fillOpacity) || fillOpacity<0 || fillOpacity>1) fillOpacity = 1;


            if (barType === "histogram"){


                let binWidth = parseInt(chartConfig.binWidth);
                if (isNaN(binWidth) || binWidth<1) binWidth = 10;

                //Ensure consistent bin size
                x.nice();

                var histogram = d3.histogram()
                    .value(function(d) { return d.key; })
                    .domain(x.domain())
                    .thresholds(x.ticks(binWidth));


                    //TODO: find general solution for time and ordinal scale
                    // .thresholds(x.domain()) //Not sure why this doesn't work for dates/strings

                 var bins = histogram(sumData);

                 var frequencyMax = d3.max(bins, d => d.length)

                 var frequencyAxis = d3.scaleLinear()
                    .range(layout === "vertical" ? [height, 0] : [0, width]);
                    frequencyAxis.domain([0, frequencyMax]);

                if (layout === "vertical") displayHistogramAxis(x, frequencyAxis, axisHeight);
                else if(layout === "horizontal") displayHistogramAxis(frequencyAxis, y, axisHeight);


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


            let keyType = getType(sumData[0].key);
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
            let bar = d3.select(this);
            let barID = parseInt(d3.select(this).attr("barID"));
            bar.attr("fill", getBarColor(barID));
        });



        //Bar transitions
        var animationSteps = chartConfig.animationSteps;
        if (!isNaN(animationSteps) && animationSteps>50){
            var max = d3.max(maxData, d => parseFloat(d.value));
            if (layout === "vertical"){

                var heightRatio = max / height;
                bars.attr("y", height).attr("height", 0);

                bars.transition().duration(animationSteps)
                    .attr("y", function (d) { return height - d.value / heightRatio; })
                    .attr("height", function (d) { return d.value / heightRatio; });
            }else if(layout === "horizontal"){

                var widthRatio = max/width;
                bars.attr("x", 0).attr("width", 0);

                bars.transition().duration(animationSteps)
                    .attr("width", function (d) { return d.value / widthRatio; });

            }
        }
        else{

            //Create d3 event listeners for bars
            bars.on("mouseover", function() {
                d3.select(this).transition().duration(100).attr("opacity", "0.8")
            });

            bars.on("mouseout", function() {
                d3.select(this).transition().duration(100).attr("opacity", "1.0")
            });

        };


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

//        //Draw labels if checked
//        if(chartConfig.xLabel || chartConfig.yLabel){
//            drawLabels(plotArea, chartConfig.xLabel, chartConfig.yLabel,
//                axisHeight, axisWidth, margin, bottomLabel, leftLabel);
//        }


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
  //** displayHistogramAxis
  //**************************************************************************
    var displayHistogramAxis = function (x, y, axisHeight) {

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
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;

    var initChart = bluewave.chart.utils.initChart;
    var drawAxes = bluewave.chart.utils.drawAxes;
    var drawLabels = bluewave.chart.utils.drawLabels;
    var drawGridlines = bluewave.chart.utils.drawGridlines;
    var getType = bluewave.chart.utils.getType;


    init();
};