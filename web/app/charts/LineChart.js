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
        endTags: false,
        animationSteps: 1500
    };
    var svg, chart, plotArea;
    var x, y;
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
  /** Used to set the horizontal scaling option. Options include "logarithmic"
   *  and "linear" (default)
   */
    this.setScaling = function(scale){
        config.scaling = scale==="logarithmic" ? "logarithmic" : "linear";
    };


  //**************************************************************************
  //** displayEndTags
  //**************************************************************************
  /** Used to specify whether to display tags at the end of the lines
   */
    this.displayEndTags = function(b){
        config.endTags = b===true ? true : false;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        clearChart();
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
        if (data.length === 0) return;


        var width = parent.offsetWidth;
        var height = parent.offsetHeight;
        var axisHeight = height;
        var axisWidth = width;
        plotArea = chart.append("g");
        plotArea
            .attr("width", width)
            .attr("height", height);



      //Get chart options
        var showLabels = chartConfig.endTags;
        if (showLabels===true || showLabels===false){}
        else showLabels = data.length>1;
        var stackValues = chartConfig.stackValues===true;
        var accumulateValues = chartConfig.accumulateValues===true;


      //Generate unique list of x-values across all layers
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



      //Create dataset to render
        var arr = [];
        for (let i=0; i<layers.length; i++){
            if (!layers[i].line) continue;


            let xKey = layers[i].xAxis;
            let yKey = layers[i].yAxis;


            //If axes not picked, skip pushing/rendering this dataset
            if (!xKey || !yKey) continue;


            var sumData = d3.nest()
                .key(function(d){return d[xKey];})
                .rollup(function(d){
                    return d3.sum(d,function(g){
                        return g[yKey];
                    });
            }).entries(layers[i].data);


          //Get lineConfig
            var lineConfig = layers[i].line.getConfig();


          //Accumulate y-values as needed
            if (accumulateValues){
                sumData.forEach(function(d, idx){
                    var val = sumData[idx].value;
                    if (isNaN(val)) sumData[idx].value = 0;
                    if (idx>0){
                        sumData[idx].value += sumData[idx-1].value;
                    }
                });
            }


          //Smooth the data as needed
            var smoothingType = lineConfig.smoothing;
            if (smoothingType){
                var smoothingValue = lineConfig.smoothingValue;
                applySmoothing(smoothingType, smoothingValue, sumData);
            }


            arr.push( {lineConfig: lineConfig, sumData: sumData} );
        };



      //Stack values
        if (stackValues){


          //Sort arr by largest data set for stacking
            if (accumulateValues){
                arr.sort(function(a, b){
                    a = a.sumData;
                    a = a[a.length-1].value;
                    b = b.sumData;
                    b = b[b.length-1].value;
                    return b-a;
                });
            }
            else{
                var temp = [];
                arr.forEach(function(d){
                    var sumData = d.sumData;
                    var sumValue = 0;
                    sumData.forEach((d) => sumValue+=d.value);
                    temp.push({
                        sumValue: sumValue,
                        sumData: sumData,
                        lineConfig: d.lineConfig
                    });
                });
                temp.sort(function(a, b){
                    return b.sumValue-a.sumValue;
                });

                arr = [];
                temp.forEach((d) => arr.push({
                    sumData: d.sumData,
                    lineConfig: d.lineConfig
                }));
            }



          //Analyze all the keys and get key type (e.g. number, string, date)
            var xType = getType(xKeys);


          //Analyze keys in each dataset and determine sort direction
            var xSorts = {};
            arr.forEach(function(d, i){
                var sumData = d.sumData;

                var sortDir = "none";
                var asc = 0;
                var desc = 0;
                var unk = 0;


                if (sumData.length<2){
                    //No sort if there are only 1 or 0 elements
                }
                else{
                    for (var j=0; j<sumData.length-1; j++){

                        var currKey = sumData[j].key;
                        var nextKey = sumData[j+1].key;

                        if (xType=="date"){
                            currKey = new Date(currKey).getTime();
                            nextKey = new Date(nextKey).getTime();
                            if (nextKey>=currKey) asc++;
                            if (nextKey<=currKey) desc++;
                        }
                        else if (xType=="number"){
                            currKey = parseFloat(currKey);
                            nextKey = parseFloat(nextKey);
                            if (nextKey>currKey) asc++;
                            if (nextKey<currKey) desc++;
                            if (nextKey==currKey) unk++;
                        }
                        else {
                            var x = currKey.localeCompare(nextKey);
                            if (x<0) asc++;
                            if (x>0) desc++;
                            if (x==0) unk++;
                        }
                    }

                    //console.log("asc", asc+unk, sumData.length-1);
                    //console.log("desc", desc+unk, sumData.length-1);
                    if (asc+unk==sumData.length-1) sortDir = "asc";
                    if (desc+unk==sumData.length-1) sortDir = "desc";
                    //console.log(d.lineConfig.label, xType, sortDir);

                    var sort = xSorts[sortDir];
                    if (!sort){
                        sort = [];
                        xSorts[sortDir] = sort;
                    }
                    sort.push(i);
                }

            });


            var sortKeys = Object.keys(xSorts);
            var xSort = sortKeys.length==1 ? sortKeys[0] : null;


          //Sort xKeys
            if (xSort){
                xKeys.sort(function(a, b){
                    if (xType=='number'){
                        if (xSort=="asc"){
                            return parseFloat(a)-parseFloat(b);
                        }
                        else{
                            return parseFloat(b)-parseFloat(a);
                        }
                    }
                    else if (xType=='date'){
                        if (xSort=="asc"){
                            return (new Date(a).getTime())-(new Date(b).getTime());
                        }
                        else{
                            return (new Date(b).getTime())-(new Date(a).getTime());
                        }
                    }
                    else{
                        if (xSort=="asc"){
                            return a.localeCompare(b);
                        }
                        else{
                            return b.localeCompare(a);
                        }
                    }
                });

            }



          //Fill in missing values
            arr.forEach(function(d){
                var sumData = d.sumData;
                var newData = [];

              //Get value for each key
                xKeys.forEach(function(key){

                    var val;
                    for (var i=0; i<sumData.length; i++){
                        var k = sumData[i].key;
                        var v = sumData[i].value;
                        if (k==key){
                            val = v;
                            break;
                        }
                    }

                    newData.push({
                        key: key,
                        value: val
                    });

                });


              //Trim leading null values
                while (newData.length>0){
                    var firstVal = newData[0].value;
                    if (!isNaN(firstVal)) break;
                    if (isNaN(firstVal)) newData.shift();
                }


                d.sumData = newData;

            });




          //Compute new values for each entry in arr
            var arr2 = [];
            arr.forEach(function(d, i){
                var sumData = d.sumData;



              //Clone sumData into newData
                var newData = [];
                sumData.forEach(function(d){
                    newData.push({
                        key: d.key,
                        value: d.value
                    });
                });


              //Update values in the newData
                sumData.forEach(function(data, idx){
                    var key = data.key;
                    var val = data.value;


                  //If val is null, use previous value in this series
                    if (isNaN(val)){

                        for (var n=idx-1; n>-1; n--){
                            var prevVal = sumData[n].value;
                            if (!isNaN(prevVal)){
                                val = prevVal;
                                break;
                            }
                        }

                        if (isNaN(val)) val = 0;
                    }


                  //Find value under the current line
                    var prevVals;
                    for (var j=0; j<arr2.length; j++){
                        var prevSumData = arr2[j].sumData;
                        prevSumData.every(function(d){
                            var k = d.key;
                            var v = d.value;
                            if (k==key){
                                if (!isNaN(v)){
                                    prevVals = v;
                                    return false;
                                }
                            }
                            return true;
                        });
                    }


                  //Update val
                    if (!isNaN(prevVals)) val+=prevVals;


                  //Set value in the newData array
                    newData[idx].value = val;

                });


              //Update arr2 with newData
                arr2.push( {lineConfig: d.lineConfig, sumData: newData} );
            });

            arr = arr2;
        }




      //Generate min/max datasets
        var minData = [];
        var maxData = [];
        arr.forEach(function(a){
            var sumData = a.sumData;
            xKeys.forEach(function(key){
                
                if (key instanceof Date && !stackValues) key = key+""; //hack to deal with dates as keys
                

                for (var i=0; i<sumData.length; i++){
                    var d = sumData[i];
                    var xKey = d.key;
                    if (xKey===key){
                        var val = d.value;

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
                                entry.value = Math.max(entry.value, val);
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
        var axes = drawAxes(plotArea, axisWidth, axisHeight, "key", "value", maxData, minData, config);


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
                layers.forEach(function(layer, i){
                    if (!layer.line) return;
                    var label = layer.line.getLabel();
                    if (!label) label = "Series " + (i+1);


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
                });
                // marginRight+=maxLabelWidth;
                marginRight = maxLabelWidth + 5;
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

                axes = drawAxes(plotArea, axisWidth, axisHeight, "key", "value", maxData, minData, config);
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

            //if(stack) break;
            var sumData = arr[i].sumData;

            let fillConfig = arr[i].lineConfig.fill;

            let lineColor = fillConfig.color;
            let startOpacity = fillConfig.startOpacity;
            let endOpacity = fillConfig.endOpacity;
            var smoothingType = arr[i].lineConfig.smoothing;

            let keyType = getType(sumData[0].key);

            var getX = function(d){
                if(keyType==="date"){
                    return x(new Date(d.key));
                }else{
                    return x(d.key);
                }
            };

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

            var sumData = arr[i].sumData;
            let lineConfig = arr[i].lineConfig;
            let pointConfig = lineConfig.point;

            let lineColor = lineConfig.color;
            let lineStyle = lineConfig.style;
            let lineWidth = lineConfig.width;
            let opacity = lineConfig.opacity;

            let pointRadius = pointConfig.radius;
            let pointColor = pointConfig.color;

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
            };

            
          //Display end tags if checked
            if (showLabels){
                var label = lineConfig.label;
                if (!label) label = "Series " + (i+1);

                var line = chartElements[i].line2;
                chartElements[i].tag = createTag(sumData, lineColor, label, line);

            }
        
        };

        //Add animations
        var animationSteps = chartConfig.animationSteps;
        if (!isNaN(animationSteps) && animationSteps > 50) {

            let lines = lineGroup.selectAll("path");
            let circles = circleGroup.selectAll("circle");
            let fill = fillGroup.selectAll("path");

            let min = d3.min(minData, d => parseFloat(d.value));
            let scaleY = config.scaling === "logarithmic" ? y(min) : y(0);

            //playing with rendering lines one at a time
            // function animateLine(){
            //     let length = this.getTotalLength();
            //     i = d3.interpolateString("0," + length, length + "," + length);
            //     return function (t) { return i(t); };
            // }
            
            //Reset lines to y=0
            lines.attr("d", d3.line().x(getX).y(scaleY));

            circles.attr("cx", getX).attr("cy", scaleY);

            fill.attr("d", d3.area()
                    .x(getX)
                    .y0( axisHeight )
                    .y1(scaleY)
                );

            //Transition back to calculated y-values
            lines.transition().duration(animationSteps)
                .attr("d", getLine())

                // .delay(function(d, i) { return i * 2000; })
                // .attrTween("stroke-dasharray", animateLine)

            circles.transition().duration(animationSteps)
                .attr("cx", getX).attr("cy", getY)

            fill.transition().duration(animationSteps)
                .attr(
                    "d", d3.area()
                    .x(getX)
                    .y0(axisHeight)
                    .y1(getY)
                    );

            if (showLabels) {
                for (var i = 0; i < chartElements.length; i++) {

                    var poly = chartElements[i].tag.poly;
                    var text = chartElements[i].tag.text;

                    var polyTransform = poly.attr("transform");
                    var textTransform = text.attr("transform");

                    //Get x-coordinate from transform string
                    var polyX = polyTransform.slice(10).split(",")[0];
                    var textX = textTransform.slice(10).split(",")[0];

                    //Set polygon vertex to (x, 0)
                    poly.attr("transform", "translate(" + (polyX) + "," + (axisHeight - 9.6) + ")");
                    text.attr("transform", "translate(" + (textX) + "," + (axisHeight) + ")");

                    poly.transition().duration(animationSteps)
                        .attr("transform", polyTransform)

                    text.transition().duration(animationSteps)
                        .attr("transform", textTransform)

                }
            };

        };

      //Draw grid lines if option is checked
        if (chartConfig.xGrid || chartConfig.yGrid){
            drawGridlines(plotArea, x, y, axisHeight, axisWidth, chartConfig.xGrid, chartConfig.yGrid);
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
    var drawGridlines = bluewave.chart.utils.drawGridlines;

    init();
};