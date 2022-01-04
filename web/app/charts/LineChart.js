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
        xGrid: false,
        yGrid: false,
        scaling: "linear", //"logarithmic"
        stackValues: false,
        endTags: false
    };
    var svg, chart, plotArea;
    var x, y;

    var dataSets=[];
    var layers=[];

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

        me.setScaling(config.scaling);
    };


  //**************************************************************************
  //** setScaling
  //**************************************************************************
    this.setScaling = function(scale){
        config.scaling = scale==="logarithmic" ? "logarithmic" : "linear";
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        clearChart();
        dataSets=[];
        layers=[];
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(parent);
        });
    };


  //**************************************************************************
  //** addLine
  //**************************************************************************
    this.addLine = function(line, data, xAxis, yAxis){
        layers.push({
            line: line,
            data: data,
            xAxis: xAxis+"",
            yAxis: yAxis+""
        });
    };


  //**************************************************************************
  //** getLayers
  //**************************************************************************
    this.getLayers = function(){
        return layers;
    };


  //**************************************************************************
  //** setLayers
  //**************************************************************************
    this.setLayers = function(arr){
        layers = arr;
    };


  //**************************************************************************
  //** clearChart
  //**************************************************************************
    var clearChart = function(){
        if (chart) chart.selectAll("*").remove();
    };


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(parent){
        clearChart();

        var chartConfig = config;
        var data = layers.map( d => d.data );


        var data1 = data[0].slice();
        dataSets = data.slice();
        data = data1;


        var width = parent.offsetWidth;
        var height = parent.offsetHeight;
        var axisHeight = height;
        var axisWidth = width;
        plotArea = chart.append("g");
        plotArea
            .attr("width", width)
            .attr("height", height);



      //Get chart options
        var group = chartConfig.group;
        var showLabels = chartConfig.endTags;
        if (showLabels===true || showLabels===false){}
        else showLabels = data.length>1;
        var stack = chartConfig.stack;


      //Generate unque list of x-values across all layers
        var xKeys = [];
        layers.forEach(function(layer){
            if (!layer.data) return;
            layer.data.forEach(function(d){
                var xKey = d[layer.xAxis];
                var addKey = true;
                for (var i=0; i<xKeys.length; i++){
                    if (xKeys[i]==xKey){
                        addKey = false;
                        break;
                    }
                }
                if (addKey) xKeys.push(xKey);
            });
        });

        //TODO: sort keys



      //Generate min/max datasets
        var minData = [];
        var maxData = [];
        layers.forEach(function(layer){
            if (!layer.data) return;
            xKeys.forEach(function(key){

                for (var i=0; i<layer.data.length; i++){
                    var d = layer.data[i];
                    var xKey = d[layer.xAxis];
                    if (xKey===key){
                        var val = parseFloat(d[layer.yAxis]);

                      //Update minData array
                        var foundMatch = false;
                        for (var j=0; j<minData.length; j++){
                            var entry = minData[j];
                            if (entry.key==key){
                                foundMatch = true;
                                entry.value = Math.min(entry.value, val);
                            }
                        }
                        if (!foundMatch){
                            minData.push({
                                key: key,
                                value: val
                            });
                        }

                      //Update maxData array
                        var foundMatch = false;
                        for (var j=0; j<maxData.length; j++){
                            var entry = maxData[j];
                            if (entry.key==key){
                                foundMatch = true;
                                if (stack) {
                                    entry.value += val;
                                }
                                else{
                                    entry.value = Math.max(entry.value, val);
                                }
                            }
                        }
                        if (!foundMatch){
                            maxData.push({
                                key: key,
                                value: val
                            });
                        }

                    }
                }
            });
        });





      //Render X/Y axis
        var axes = drawAxes(plotArea, axisWidth, axisHeight, "key", "value", maxData, minData, config.scaling);


      //Update X/Y axis as needed
        var margin = axes.margin;
        if (margin){

            var marginLeft = margin.left;
            var marginRight = margin.right;
            var marginTop = margin.top;
            var marginBottom = margin.bottom;


          //Update right margin as needed
            if (showLabels){
                var maxLabelWidth = 0;
                var labelHeight = 0;
                for (let i=0; i<layers.length; i++){
                    var label;
                    if (group){
                        let d = layers[i].data;
                        label = d[group];
                        if (!label) label = group + " " + i;
                    }
                    else{
                        var labelKey = "label" + (i>0 ? i+1 : "");
                        label = chartConfig[labelKey];
                        if (!label) label = "Series " + (i+1);
                    }


                    if (label){
                        var temp = plotArea.append("text")
                            .attr("dy", ".35em")
                            .attr("text-anchor", "start")
                            .text(label);
                        var box = temp.node().getBBox();
                        temp.remove();

                        var w = Math.max(box.width+8, 60)+5;
                        labelHeight = box.height;
                        maxLabelWidth = Math.max(w, maxLabelWidth);
                    }
                }
                marginRight+=maxLabelWidth;
                if (labelHeight>0){
                    marginTop = Math.max((labelHeight/2), marginTop);
                }
            }



            if (marginTop>0 || marginBottom>0 || marginLeft>0 || marginRight>0){
                axisHeight-=(marginTop+marginBottom);
                axisWidth-=(marginLeft+marginRight);
                plotArea.selectAll("*").remove();
                plotArea
                    .attr(
                        "transform",
                        "translate(" + marginLeft + "," + marginTop + ")"
                    );

                axes = drawAxes(plotArea, axisWidth, axisHeight, "key", "value", maxData, minData, config.scaling);
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



        // dataSets.forEach(function(d){
        //     if(typeof d !== object){

        //     }

        // });

        //I think I want to merge dataSets and layers?

        if (stack){
        //Nest merged data object by X-axis value for stacked area
            var mergedData = d3.merge(dataSets);
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
            var globalxKeyType = getType(data1[0][xKey]);

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

        };



      //Create dataset to render
        var arr = [];
        for (let i=0; i<layers.length; i++){
            if (!layers[i].line) continue;


            let xKey = layers[i].xAxis;
            let yKey = layers[i].yAxis;


            //If axes not picked, skip pushing/rendering this dataset
            if ((!xKey || !yKey) && !group && i>0) continue;


            var sumData = d3.nest()
                .key(function(d){return d[xKey];})
                .rollup(function(d){
                    return d3.sum(d,function(g){
                        return g[yKey];
                    });
            // }).entries(dataSets[i]);
            }).entries(layers[i].data);


          //Smooth the data as needed
            var lineConfig = layers[i].line.getConfig();
            var smoothingType = lineConfig.smoothing;
            if (smoothingType){
                // var smoothingValue = chartConfig["smoothingValue" + i];
                var smoothingValue = lineConfig.smoothingValue;
                applySmoothing(smoothingType, smoothingValue, sumData);
            }

            arr.push( {lineConfig: lineConfig, sumData: sumData} );

            //Make sure each push to layers is unique
            // if (layers.length < dataSets.length) {
            //     var line = new bluewave.chart.Line();
            //     me.addLine(line, sumData, chartConfig);
            // }
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

            if(stack) break;
            var sumData = arr[i].sumData;

            let fillConfig = arr[i].lineConfig.fill;

            let lineColor = fillConfig.color;
            let startOpacity = fillConfig.startOpacity;
            let endOpacity = fillConfig.endOpacity;
            // let lineColor = chartConfig["lineColor" + i];
            // let startOpacity = chartConfig["startOpacity" + i];
            // let endOpacity = chartConfig["endOpacity" + i];

            let keyType = getType(sumData[0].key);

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
                return (config.scaling === "logarithmic") ? y(v+1):y(v);
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
                    .y0(axisHeight)
                    .y1(getY)
                );

        }



      //Draw lines
        var lineGroup = plotArea.append("g");
        var circleGroup = plotArea.append("g");
        circleGroup.attr("name", "circles");
        lineGroup.attr("name", "lines");
        for (let i=0; i<arr.length; i++){

            if(stack) break;

            var sumData = arr[i].sumData;
            let lineConfig = arr[i].lineConfig;
            let pointConfig = lineConfig.point;

            let lineStyle = lineConfig.style;
            let lineWidth = lineConfig.width;
            let opacity = lineConfig.opacity;
            // let lineColor = chartConfig["lineColor" + i];
            // let lineColor = chartConfig.layers[i].line.getColor()
            let lineColor = lineConfig.color;
            // let lineStyle = chartConfig["lineStyle" + i];
            // let lineWidth = chartConfig["lineWidth" + i];
            // let opacity = chartConfig["opacity" + i];

            // let pointRadius = parseFloat(chartConfig["pointRadius" + i]);
            // if (isNaN(pointRadius) || pointRadius<0) pointRadius = 0;
            // let pointColor = chartConfig["pointColor" + i];

            let pointRadius = pointConfig.radius;
            let pointColor = pointConfig.color;

            if (lineWidth == null) lineWidth = 1;
            if (opacity == null) opacity = 1;
            if (lineStyle == null) lineStyle = "solid";


            // var smoothingType = chartConfig["smoothingType" + i];
            var smoothingType = lineConfig.smoothing;

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
                chartElements[i].tag = createTag(sumData, lineColor, label, line);
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
  //** createTag
  //**************************************************************************
    var createTag = function(dataSet, color, label, line){

        var lastItem = dataSet[dataSet.length - 1];
        var lastKey = lastItem.key;
        var lastVal = lastItem.value;
        var keyType = getType(dataSet[0].key);


        if(keyType==="date"){
            var tx = x(new Date(lastKey))
        }else{
            var tx = x(lastKey)
        }

        var ty = (config.scaling==="logarithmic") ? y(lastVal+1) : y(lastVal);

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
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;

    var initChart = bluewave.chart.utils.initChart;
    var getType = bluewave.chart.utils.getType;
    var drawAxes = bluewave.chart.utils.drawAxes;
    var drawLabels = bluewave.chart.utils.drawLabels;
    var drawGridlines = bluewave.chart.utils.drawGridlines;

    init();
};