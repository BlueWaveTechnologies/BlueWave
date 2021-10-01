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
            top: 15,
            right: 75,
            bottom: 65,
            left: 82
        }
    };
    var svg, plotArea;
    var xAxis, yAxis;
    var axisWidth, axisHeight;
    var x, y, xBand, yBand;
    var timeAxis;
    var dataSets;


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

        plotArea = svg.append("g").append("g");
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (plotArea) plotArea.node().innerHTML = ""; //selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            me.clear();

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
            //set default values if not instantiated
            if (chartConfig.lineColor==null) chartConfig.lineColor = "#6699CC";
            if (chartConfig.lineWidth==null) chartConfig.lineWidth = 1;
            if (chartConfig.opacity==null) chartConfig.opacity = 1;
            if (chartConfig.startOpacity==null) chartConfig.startOpacity = 0;
            if (chartConfig.endOpacity==null) chartConfig.endOpacity = 0;


            var data1 = data[0];
            var data2 = data[1];
            dataSets = data;
            data = data1;

            var mergedData = d3.merge(dataSets);
            // if (data2!==null && data2!==undefined && xKey2 && yKey2){
            //     data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
            // }

            ////////////////// Group Case //////////////////
            if (false){

                //Keeping open to allow for multiple "group by" queries
                let lineColor = chartConfig.lineColor;
                let lineWidth = chartConfig.lineWidth;
                let opacity = chartConfig.opacity;
                let startOpacity = chartConfig.startOpacity;
                let endOpacity = chartConfig.endOpacity;

                //Hide label field if "group by"
                let labelField = document.querySelector(".form-input[name=label0]");
                let label = document.querySelector(".label0");
                addShowHide(label);
                addShowHide(labelField);
                labelField.hide();
                label.hide();

                let groupData = d3.nest()
                    .key(function(d){return d[group];})
                    .entries(data);

                displayAxis(xKey,yKey,data);

                //Draw group area
                plotArea
                    .selectAll(".line")
                    .data(groupData)
                    .enter()
                    .append("path")
                    .attr("class", "line-area")
                    .attr(
                        "d",function(d){
                        return d3
                            .area()
                            .x(function (d) {
                                return x(d[xKey]);
                            })
                            .y0(plotHeight)
                            .y1(function (d) {
                                return y(parseFloat(d[yKey]));
                            })(d.values);
                        }
                    );

                //Add color gradient for each element in groupData
                groupData.forEach(function(g){
                    let lineColor = chartConfig[`lineColor${groupData.indexOf(g)}`];
                    if (lineColor == null) lineColor = "#6699CC";

                    let startOpacity = chartConfig[`startOpacity${groupData.indexOf(g)}`];
                    if (startOpacity == null) startOpacity = 0;

                    let endOpacity = chartConfig[`endOpacity${groupData.indexOf(g)}`];
                    if (endOpacity == null) endOpacity = 0;

                    addColorGradient(lineColor, startOpacity, endOpacity);
                })
                

                //Draw group line
                plotArea
                    .selectAll(".line")
                    .data(groupData)
                    .enter()
                    .append("path")
                    .attr("fill", "none")
                    .attr("stroke", function(d){

                        let lineColor = chartConfig[`lineColor${groupData.indexOf(d)}`];
                        return lineColor ? lineColor : "#6699CC";

                    })
                    .attr("stroke-width", function(d){

                        let lineWidth = chartConfig[`lineWidth${groupData.indexOf(d)}`];
                        return lineWidth ? lineWidth : 1;

                    })
                    .attr("opacity", function(d){

                        let opacity = chartConfig[`opacity${groupData.indexOf(d)}`];
                        return (opacity!=null) ? opacity : 1;

                    })
                    .attr(
                        "d",function(d){
                        return d3
                            .line()
                            .x(function (d) {
                                return x(d[xKey]);
                            })
                            .y(function (d) {
                                return y(parseFloat(d[yKey]));
                            })(d.values);
                        }
                    );


                //Draw thick line for selection purposes
                plotArea
                    .selectAll(".line")
                    .data(groupData)
                    .enter()
                    .append("path")
                    .attr("dataset", function(d){
                        return groupData.indexOf(d)
                    })
                    .attr("fill", "none")
                    .attr("stroke", "#ff0000")
                    .attr("stroke-width", 10)
                    .attr("opacity", 0)
                    .attr(
                        "d", function (d) {
                            return d3
                                .line()
                                .x(function (d) {
                                    return x(d[xKey]);
                                })
                                .y(function (d) {
                                    return y(parseFloat(d[yKey]));
                                })(d.values);
                        }
                    )
                    .on("click", function () {
                        me.onClick(this);
                    });

                    //Add group endtags
                    if(chartConfig.endTags){

                        groupData.forEach(function(g){
                            let lineColor = chartConfig[`lineColor${groupData.indexOf(g)}`];
                            if (lineColor == null) lineColor = chartConfig.lineColor;

                            let tempData = g.values;
                            let lastDataPointCopy = {...tempData[tempData.length-1]};
                            lastDataPointCopy.key = lastDataPointCopy[xKey];
                            lastDataPointCopy.value = lastDataPointCopy[yKey];
                            drawLabelTag([lastDataPointCopy], lineColor, group);
                        });

                    }


            }

            ////////////////// Default Case //////////////////
            else{

                //Set axes with merged data
                var axisData = d3.nest()
                    .key(function(d){return d[xKey];})
                    .rollup(function(d){
                        return d3.max(d,function(g){
                            return g[yKey];
                        });
                }).entries(mergedData);

                displayAxis("key","value", axisData);

                let xType = typeOfAxisValue();

                //Reformat data if "group by" is selected
                if(group){

                    //Hide label field
                    let labelField = document.querySelector(".form-input[name=label0]");
                    let label = document.querySelector(".label0");
                    addShowHide(label);
                    addShowHide(labelField);
                    labelField.hide();
                    label.hide();

                    let groupData = d3.nest()
                    .key(function(d){return d[group];})
                    .entries(data);

                    let newDataSets = [];
                    groupData.forEach(function(g){

                        newDataSets.push(g.values)
                    })

                dataSets = newDataSets;
                // displayAxis(xKey,yKey,data);
                }

                var arr = [];
                for (let i=0; i<dataSets.length; i++){

                    if (chartConfig.hasOwnProperty(`xAxis${i+1}`) && chartConfig.hasOwnProperty(`yAxis${i+1}`)){
                        xKey = chartConfig[`xAxis${i+1}`];
                        yKey = chartConfig[`yAxis${i+1}`];
                        if(!xKey || !yKey) continue;
                    }

                    var sumData = d3.nest()
                        .key(function(d){return d[xKey];})
                        .rollup(function(d){
                            return d3.sum(d,function(g){
                                return g[yKey];
                            });
                    }).entries(dataSets[i]);

                    arr.push(sumData);
                }



              //Draw areas under lines first!
                for (let i=0; i<arr.length; i++){
                    var sumData = arr[i];

                    let lineColor = chartConfig["lineColor" + i];
                    let startOpacity = chartConfig["startOpacity" + i];
                    let endOpacity = chartConfig["endOpacity" + i];

                    if (lineColor == null) lineColor = chartConfig.lineColor;
                    if (startOpacity == null) startOpacity = chartConfig.startOpacity;
                    if (endOpacity == null) endOpacity = chartConfig.endOpacity;

                    let keyType = typeOfAxisValue(sumData[0].key);


                  //Define and fill area under line
                    plotArea
                        .append("path")
                        .datum(sumData)
                        .attr("class", "line-area")
                        .attr(
                            "d", d3.area()
                            .x(function(d){
                                 if(keyType==="date"){
                                    return x(new Date(d.key));
                                }else{
                                    return x(d.key);
                                }
                            })
                            .y0(plotHeight)
                            .y1(function(d){
                                return y(d["value"])
                            })
                        );


                  //Add color gradient
                    addColorGradient(lineColor, startOpacity, endOpacity);

                }



              //Draw lines
                for (let i=0; i<arr.length; i++){
                    var sumData = arr[i];

                    let lineColor = chartConfig["lineColor" + i];
                    let lineWidth = chartConfig["lineWidth" + i];
                    let opacity = chartConfig["opacity" + i];

                    if (lineColor == null) lineColor = chartConfig.lineColor;
                    if (lineWidth == null) lineWidth = chartConfig.lineWidth;
                    if (opacity == null) opacity = chartConfig.opacity;

                    let keyType = typeOfAxisValue(sumData[0].key);


                  //Draw line
                    plotArea
                        .append("path")
                        .datum(sumData)
                        .attr("fill", "none")
                        .attr("stroke", lineColor)
                        .attr("stroke-width", lineWidth)
                        .attr("opacity", opacity)
                        .attr(
                            "d",d3.line()
                            .x(function(d){
                                if(keyType==="date"){
                                    return x(new Date(d.key));
                                }else{
                                    return x(d.key);
                                }
                            })
                            .y(function(d){
                                return y(d["value"]);
                            })
                        );

                  //Draw thick line for selection purposes
                    plotArea
                        .append("path")
                        .datum(sumData)
                        .attr("dataset", i)
                        .attr("fill", "none")
                        .attr("stroke", "#ff0000")
                        .attr("stroke-width", 10)
                        .attr("opacity", 0)
                        .attr(
                            "d",d3.line()
                            .x(function(d){
                                if(keyType==="date"){
                                    return x(new Date(d.key));
                                }else{
                                    return x(d.key);
                                }
                            })
                            .y(function(d){
                                return y(d["value"]);
                            })
                        )
                        .on("click", function(){
                            me.onClick(this);
                        });


                    //Display end tags if checked
                    if(chartConfig.endTags){
                        let label = (group || chartConfig["label" + i]);
                        drawLabelTag(sumData, lineColor, label);
                    }

                };

            };

            //Draw grid lines if option is checked
            if(chartConfig.xGrid || chartConfig.yGrid){
                drawGridlines(plotArea, x, y, axisHeight, axisWidth, chartConfig.xGrid, chartConfig.yGrid);
            }

          //Draw labels if checked
            if(chartConfig.xLabel || chartConfig.yLabel){
                drawLabels(plotArea, chartConfig.xLabel, chartConfig.yLabel,
                    axisHeight, axisWidth, margin, chartConfig.xAxis, chartConfig.yAxis);
            }


        });
    };


  //**************************************************************************
  //** onClick
  //**************************************************************************
    this.onClick = function(line){};


  //**************************************************************************
  //** getLinePaths
  //**************************************************************************

    this.getLinePaths = function(){  return plotArea.selectAll(".thick-line");  };

  //**************************************************************************
  //** drawEndLabels
  //**************************************************************************

    var drawLabelTag = function(dataSet, color, label){

        if(!label){
            label = "Add Label"
        }

        var lastItem = dataSet[dataSet.length - 1];
        var lastKey = lastItem.key;
        var lastVal = lastItem.value;
        var keyType = typeOfAxisValue(dataSet[0].key);


        if(keyType==="date"){
            var tx = x(new Date(lastKey))
        }else{
            var tx = x(lastKey)
        }

        var ty = y(lastVal);

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
            .style("fill", color);

      //Add label
        var text = plotArea.append("text")
            .attr("transform", "translate("+ (tx+a+4) +","+ty +")")
            .attr("dy", ".35em")
            .attr("text-anchor", "start")
            .style("fill", "#fff")
            .text(label);

    };

  //**************************************************************************
  //** addColorGradient
  //**************************************************************************
        var addColorGradient = function(lineColor, startOpacity, endOpacity){

            plotArea
                .append("defs")
                .append("linearGradient")
                .attr("id", "fill-gradient")
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
    var drawLabels = bluewave.utils.drawLabels;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};