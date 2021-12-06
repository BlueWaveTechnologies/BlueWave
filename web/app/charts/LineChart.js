if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  LineChart
//******************************************************************************
/**
 *   Panel used to create line charts
 *
 ******************************************************************************/

bluewave.charts.LineChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin: {
            top: 25,
            right: 75,
            bottom: 65,
            left: 82
        }
    };
    var svg, chart, plotArea;
    var xAxis, yAxis;
    var axisWidth, axisHeight;
    var x, y, xBand, yBand;
    var timeAxis;
    var dataSets;
    var scaleOption;


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
        me.clear();

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




      //Check that axis exist and are populated
        var xKey = chartConfig.xAxis;
        var yKey = chartConfig.yAxis;
        if ((xKey===null || xKey===undefined) || (yKey===null || yKey===undefined)) return;


        let xKey2;
        let yKey2;
        if(chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
            xKey2 = chartConfig.xAxis2;
            yKey2 = chartConfig.yAxis2;
        }

        scaleOption = chartConfig.scaleOption;
        if (!scaleOption) scaleOption = chartConfig.scaleOption = "linear";


        var group = chartConfig.group;
        var showLabels = chartConfig.endTags;
        if (showLabels!==false) showLabels = chartConfig.endTags = true;


        var data1 = data[0];
        var data2 = data[1];
        dataSets = data;
        data = data1;

        var globalxKeyType = typeOfAxisValue(data1[0][xKey]);

        var mergedData = d3.merge(dataSets);
        // if (data2!==null && data2!==undefined && xKey2 && yKey2){
        //     data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
        // }

        //Get max line
        var maxData = d3.nest()
            .key(function (d) { return d[xKey]; })
            .rollup(function (d) {
                return d3.sum(d, function (g) {
                    return parseFloat(g[yKey]);
                });
            }).entries(mergedData);

        //Get minimum line
        var minData = d3.nest()
            .key(function (d) { return d[xKey]; })
            .rollup(function (d) {
                return d3.min(d, function (g) {
                    return parseFloat(g[yKey]);
                });
            }).entries(mergedData);

         //Set axes with merged data
        displayAxis("key", "value", maxData, minData);


      //Reformat data if "group by" is selected
        if(group !== null && group !== undefined && group !==""){

            let groupData = d3.nest()
            .key(function(d){return d[group];})
            .entries(data);

            let tempDataSets = [];
            groupData.forEach(function(g){

                tempDataSets.push(g.values)
            })

            dataSets = tempDataSets;
            var subgroups = groupData.map(function(d) { return d["key"]; });
        }

        if (chartConfig.stack){
        //Nest merged data object by X-axis value for stacked area
        var groupedStackData = d3.nest()
            .key( (d) => d[xKey])
            .entries(mergedData)

        console.log("data", mergedData)
        console.log("groupedStackData", groupedStackData)

        let stackGroup=[];
        let stackLength = groupedStackData[0].values.length;
        for (let i=0; i<stackLength; i++){
            stackGroup.push(i);
        }
            console.log(stackGroup)
        // console.log(subgroups)
        var stackedData = d3.stack()
            // .keys(subgroups) no idea why this doesn'r work
            .keys(stackGroup)
            .value(function (d, key) {

                let v = d.values[key];
                return v[yKey];

            })
            (groupedStackData)
        console.log(stackedData)
        
        var colors = bluewave.utils.getColorPalette(true);

        plotArea
            .selectAll("stacks")
            .data(stackedData)
            .enter()
            .append("path")
            .attr("dataset", (d, i) => i )
            .style("fill", function(d, i){
                //Get color from config or mod through color array
                return chartConfig["lineColor" + i] || colors[i%colors.length];
            })
            .style("opacity", function(d, i){
                return chartConfig["opacity" + i];
            })
            .attr("d", d3.area()
                .x(function (d, i) { 

                    let subData = d.data;
                    let subKey = d.data.key;

                    if (globalxKeyType === "date"){
                        subKey = new Date(subKey)
                    }
 
                    return x(subKey);
                    
                })
                .y0(function (d) { return y(d[0]); })
                .y1(function (d) { return y(d[1]); })
            )
            .attr("class", "stackarea")
            .on("click", function(d){
                var datasetID = parseInt(d3.select(this).attr("dataset"));
                me.onClick(this, datasetID, d);
            });

        }



      //Create dataset to render
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


          //Smooth the data as needed
            var smoothingType = chartConfig["smoothingType" + i];
            if (smoothingType){
                var smoothingValue = chartConfig["smoothingValue" + i];
                applySmoothing(smoothingType, smoothingValue, sumData);
            }

            arr.push(sumData);
        }



      //Update chartConfig with line colors
        var colors = bluewave.utils.getColorPalette(true);
        for (let i=0; i<arr.length; i++){
            var lineColor = chartConfig["lineColor" + i];
            if (!lineColor){
                lineColor = colors[i%colors.length];
                chartConfig["lineColor" + i] = lineColor;
            }
        }


        var chartElements = [];
        for (let i=0; i<arr.length; i++){
            chartElements.push({
               area: null,
               line: null,
               line2: null,
               tag: null,
               point: null
            });
        }



      //Draw areas under lines first!
        var fillGroup = plotArea.append("g");
        fillGroup.attr("name", "fill");
        for (let i=0; i<arr.length; i++){

            if(chartConfig.stack) break;
            var sumData = arr[i];

            let lineColor = chartConfig["lineColor" + i];
            let startOpacity = chartConfig["startOpacity" + i];
            let endOpacity = chartConfig["endOpacity" + i];
            let keyType = typeOfAxisValue(sumData[0].key);

            var getX = function(d){
                if(keyType==="date"){
                    return x(new Date(d.key));
                }else{
                    return x(d.key);
                }
            };

// Why are we adding 1 here if I forget to ask? to avoid log(0)=-inf?
            var getY = function(d){
                var v = parseFloat(d["value"]);
                return (scaleOption === "logarithmic") ? y(v+1):y(v);
            };

          //Don't render area if the start and end opacity is 0
            if (startOpacity===0 && endOpacity===0) continue;


          //Add color gradient to area
            let className = "fill-gradient-" + i;
            addColorGradient(lineColor, startOpacity, endOpacity, className, fillGroup);


          //Define and fill area under line
            chartElements[i].area = fillGroup
                .append("path")
                .datum(sumData)
                .attr("fill", `url(#${className})`)
                .attr(
                    "d", d3.area()
                    .x(getX)
                    .y0(plotHeight)
                    .y1(getY)
                );

        }



      //Draw lines
        var lineGroup = plotArea.append("g");
        var circleGroup = plotArea.append("g");
        circleGroup.attr("name", "circles");
        lineGroup.attr("name", "lines");
        for (let i=0; i<arr.length; i++){

            if(chartConfig.stack) break;
            var sumData = arr[i];

            let lineColor = chartConfig["lineColor" + i];
            let lineStyle = chartConfig["lineStyle" + i];
            let lineWidth = chartConfig["lineWidth" + i];
            let opacity = chartConfig["opacity" + i];

            let pointRadius = parseFloat(chartConfig["pointRadius" + i]);
            if (isNaN(pointRadius) || pointRadius<0) pointRadius = 0;
            let pointColor = chartConfig["pointColor" + i];

            if (lineWidth == null) lineWidth = 1;
            if (opacity == null) opacity = 1;
            if (lineStyle == null) lineStyle = "solid";


            var smoothingType = chartConfig["smoothingType" + i];

            var getLine = function(){
                if (smoothingType && smoothingType==="spline"){
                    return d3.line().x(getX).y(getY).curve(d3.curveMonotoneX);
                }
                return d3.line().x(getX).y(getY);
            };



          //Draw line
            chartElements[i].line = lineGroup
                .append("path")
                .datum(sumData)
                .attr("fill", "none")
                .attr("stroke", lineColor)
                .attr("stroke-width", lineWidth)
                .attr("opacity", opacity)
                .attr("stroke-dasharray", function(d){
                    if(lineStyle==="dashed") return "5, 5";
                    else if(lineStyle==="dotted") return "0, 5";
                })
                .attr("stroke-linecap", function(d){
                    if(lineStyle==="dotted") return "round";
                })
                .attr("d", getLine());


          //Draw thick line for selection purposes
            chartElements[i].line2 = lineGroup
                .append("path")
                .datum(sumData)
                .attr("dataset", i)
                .attr("fill", "none")
                .attr("stroke", "#ff0000")
                .attr("stroke-width", 10)
                .attr("opacity", 0)
                .attr("d", getLine())
                .on("click", function(d){
                    var datasetID = parseInt(d3.select(this).attr("dataset"));
                    raiseLine(chartElements[datasetID]);
                    me.onClick(this, datasetID, d);
                });


          //Add circles
            if (pointRadius){
                chartElements[i].point = circleGroup
                    .selectAll("points")
                    .data(sumData)
                    .enter()
                    .append("circle")
                    .attr("dataset", i)
                    .attr("fill", pointColor)
                    .attr("stroke", "none")
                    .attr("cx", getX )
                    .attr("cy", getY )
                    .attr("r", pointRadius)
                    .on("click", function(d){
                        var datasetID = parseInt(d3.select(this).attr("dataset"));
                        raiseLine(chartElements[datasetID]);
                        me.onClick(this, datasetID, d);
                    });
            }


          //Display end tags if checked
            if (showLabels){
                var label;
                if (group){
                    let d = dataSets[i][0];
                    label = d[group];
                    if (!label) label = group + " " + i;
                }
                else{
                    var labelKey = "label" + (i>0 ? i+1 : "");
                    label = chartConfig[labelKey];
                    if (!label) label = "Series " + (i+1);
                }
                var line = chartElements[i].line2;
                chartElements[i].tag = createLabel(sumData, lineColor, label, line);
            }
        };



      //Draw grid lines if option is checked
        if (chartConfig.xGrid || chartConfig.yGrid){
            drawGridlines(plotArea, x, y, axisHeight, axisWidth, chartConfig.xGrid, chartConfig.yGrid);
        }

      //Draw labels if checked
        if (chartConfig.xLabel || chartConfig.yLabel){
            drawLabels(plotArea, chartConfig.xLabel, chartConfig.yLabel,
                axisHeight, axisWidth, margin, chartConfig.xAxis, chartConfig.yAxis);
        }
    };


  //**************************************************************************
  //** onClick
  //**************************************************************************
    this.onClick = function(line, datasetID, renderedData){};


  //**************************************************************************
  //** createLabelTag
  //**************************************************************************
    var createLabel = function(dataSet, color, label, line){

        var lastItem = dataSet[dataSet.length - 1];
        var lastKey = lastItem.key;
        var lastVal = lastItem.value;
        var keyType = typeOfAxisValue(dataSet[0].key);


        if(keyType==="date"){
            var tx = x(new Date(lastKey))
        }else{
            var tx = x(lastKey)
        }

        var ty = (scaleOption==="logarithmic") ? y(lastVal+1) : y(lastVal);

        var temp = plotArea.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", "start")
            .text(label);
        var box = temp.node().getBBox();
        temp.remove();

        var w = Math.max(box.width+8, 60);
        var h = box.height;
        var a = h/2;
        var vertices = [
          [0, 0], //ul
          [w, 0], //ur
          [w, h], //11
          [0, h], //lr
          [-a,a] //arrow point
        ];


      //Add tag (rect)
        var poly = plotArea.append("polygon")
            .attr("points", vertices.join(" "))
            .attr("transform", "translate("+ (tx+(a)) +","+ (ty-(a)) +")")
            .style("fill", color)
            .on("click", function(d){
                line.dispatch('click');
            });

      //Add label
        var text = plotArea.append("text")
            .attr("transform", "translate("+ (tx+a+4) +","+ty +")")
            .attr("dy", ".35em")
            .attr("text-anchor", "start")
            .style("fill", "#fff")
            .text(label)
            .on("click", function(d){
                line.dispatch('click');
            });

        return {
            poly: poly,
            text: text
        };

    };


  //**************************************************************************
  //** addColorGradient
  //**************************************************************************
    var addColorGradient = function(lineColor, startOpacity, endOpacity, className, parent){
        if (startOpacity == null) startOpacity = 0;
        if (endOpacity == null) endOpacity = 0;

        parent
        .append("defs")
        .append("linearGradient")
        .attr("id", className)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%")
        .selectAll("stop")
        .data([
            { offset: "0%", color: lineColor, opacity: startOpacity },
            { offset: "100%", color: lineColor, opacity: endOpacity }
        ])
        .enter().append("stop")
        .attr("offset", (d) => d.offset)
        .attr("stop-color", (d) => d.color)
        .attr("stop-opacity", (d) => d.opacity);

    };


  //**************************************************************************
  //** raiseLine
  //**************************************************************************
    var raiseLine = function(chartElements) {
        if (!chartElements) return;

      //Raise line
        chartElements.line.raise();
        chartElements.line2.raise();
        if (chartElements.point) chartElements.point.raise();


      //Remove and reinsert tag
        var tag = chartElements.tag;
        if (tag){
            var tagParent = tag.poly.node().parentNode;
            var poly = tag.poly.node().cloneNode(true);
            var text = tag.text.node().cloneNode(true);

            tag.poly.remove();
            tag.text.remove();

            tagParent.appendChild(poly);
            tagParent.appendChild(text);

            chartElements.tag.poly = d3.select(poly);
            chartElements.tag.text = d3.select(text);
        }

    };


  //**************************************************************************
  //** displayAxis
  //**************************************************************************
    var displayAxis = function(xKey,yKey,chartData,minData){

        let axisTemp = createAxisScale(xKey,'x',chartData,minData);
        x = axisTemp.scale;
        xBand = axisTemp.band;

        axisTemp = createAxisScale(yKey,'y',chartData, minData, scaleOption);
        y = axisTemp.scale;
        yBand = axisTemp.band;


        if (xAxis) xAxis.selectAll("*").remove();
        if (yAxis) yAxis.selectAll("*").remove();

        var labelWidth = 10;
        var domainLength = x.domain().length;
        var widthCheck = domainLength * labelWidth < axisWidth;

        var tickFilter = function(d, i) {
            
            let maxLabels = parseInt(axisWidth / labelWidth);

            //Ensure first tick is displayed and every multiple of maxLabels
            if (i === 0) return true;
            return !(i % maxLabels)
        }

        xAxis = plotArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(
                d3.axisBottom(x)
                .tickValues(widthCheck ? null : x.domain().filter(tickFilter))
            )
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        yAxis = plotArea
            .append("g")
            .call(scaleOption==="linear" ? d3.axisLeft(y) :
                    d3.axisLeft(y)
                    .ticks(10, ",")
                    .tickFormat(d3.format("d"))
            );

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
    var createAxisScale = function(key, axisName, chartData, minData, scaleOption){
        let scale;
        let band;
        let type = typeOfAxisValue(chartData[0][key]);


        let axisRange;
        let axisRangePadded;
        if (axisName === "x"){
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
                .padding(1);
                break;

            case "date":

                var timeRange = [new Date(chartData[0][key]),new Date(chartData[chartData.length-1][key])];
                chartData.map((val) => {
                    val[key] = new Date(val[key]);
                    return val;
                });

                scale = d3
                    .scaleTime()
                    .domain(timeRange)
                    .rangeRound(axisRange);

                band = d3
                    .scaleBand()
                    .domain(d3.timeDay.range(...scale.domain()))
                    .rangeRound(axisRange)
                    .padding(0.2);

                timeAxis = axisName;
                break;

            default: //number

                // var extent = d3.extent(chartData, function(d) { return parseFloat(d[key]); });
                // var minVal = extent[0];
                // var maxVal = extent[1];
                //Having objects for both the min and max lines could possibly come in handy
                var minVal = d3.min(minData, function(d) { return parseFloat(d[key]);} );
                var maxVal = d3.max(chartData, function(d) { return parseFloat(d[key]);} );
                if (minVal == maxVal) maxVal = minVal + 1;

                if (scaleOption === "linear"){

                    if (minVal>0) minVal=1;

                    scale = d3.scaleLinear()
                    .domain([minVal, maxVal]);

                }
                else if (scaleOption === "logarithmic"){

                    // minVal = Math.pow(10, Math.floor(Math.log10(minVal+1)));
                    // maxVal = Math.pow(10, Math.ceil(Math.log10(maxVal)));
                    if(minVal<1) minVal = 1;

                    scale = d3.scaleLog()
                    .domain([minVal, maxVal+1]);

                }

                scale.range(axisRange);


                break;
        }


        return {
            scale,
            band
        };
    };


  //**************************************************************************
  //** applySmoothing
  //**************************************************************************
    var applySmoothing = function(smoothingType, smoothingValue, data){
        if (smoothingType==="movingAverage"){
            if (!isNaN(smoothingValue) && smoothingValue>0){

                var values = data.map(d => d.value);

                function movingAverage(vals, n){
                    let arr=[vals[0]];
                    let sum=0;
                    for (let i=1; i<n; i++){
                        sum += vals[i];
                        arr.push(sum/i);
                    }

                    for (let i=n; i<vals.length; i++){
                        let mean = d3.mean(vals.slice(i - n/2, i + n/2));
                        arr.push(mean);
                    }

                    return arr;
                }

                let average = movingAverage(values, smoothingValue);

                data.forEach(function(d, i){
                    d.value = average[i];
                });
            }
        }
        else if (smoothingType==="kde"){


          //Extract values from data and compute basic stats
            var values = data.map(d => d.value);
            var numValues = values.length;
            var extent = d3.extent(values);
            var minVal = extent[0];
            var maxVal = extent[1];
            var sumData = values.reduce((a, b) => a + b, 0); //sum of all the values in the array



          //Generate simulated data for the KDE curve
            var spacing = (maxVal-minVal)/numValues;
            spacing = Math.round(spacing);
            var sampleData = [];
            for (var i=0; i<values.length; i++) {
                for (var j=0; j<values[i]; j++) {
                    sampleData.push(i+0.5);
                    j+=spacing;
                }
            }


          //Compute density values using epanechnikov kernel
            var density = [];
            var kernel = epanechnikov(smoothingValue);
            for (var i=0; i<values.length; i++) {
                var val = d3.mean(sampleData, function(v) {
                    return kernel(i - v);
                });
                density.push([i, val]);
            }


          //Update data values
            data.forEach(function(d, i){
                d.value = density[i][1]*sumData;
            });

        }
    };


  //**************************************************************************
  //** epanechnikov
  //**************************************************************************
    var epanechnikov = function(bandwidth) {
        return x => Math.abs(x /= bandwidth) <= 1 ? 0.75 * (1 - x * x) / bandwidth : 0;
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
    var initChart = bluewave.utils.initChart;
    var drawGridlines = bluewave.utils.drawGridlines;
    var drawLabels = bluewave.utils.drawLabels;

    init();
};