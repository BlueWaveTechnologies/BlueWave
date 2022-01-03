if(!bluewave) var bluewave={};
if(!bluewave.chart) bluewave.chart={};
bluewave.chart.utils = {


  //**************************************************************************
  //** initChart
  //**************************************************************************
    initChart: function(parent, callback, scope){
        var svg;
        if (parent instanceof d3.selection){
            svg = parent;
        }
        else if (parent instanceof SVGElement) {
            svg = d3.select(parent);
        }
        else{
            svg = d3.select(parent).append("svg");
            javaxt.dhtml.utils.onRender(parent, function(){
                var width = parent.offsetWidth;
                var height = parent.offsetHeight;
                svg.attr("width", width);
                svg.attr("height", height);
            });
        }

        var g = svg.append("g");
        if (callback) callback.apply(scope,[svg, g]);
    },


  //**************************************************************************
  //** drawGridlines
  //**************************************************************************
    drawGridlines: function(svg, xScale, yScale, height, width, xGrid, yGrid){

        if(xGrid){
            svg.append("g")
            .attr("class", "grid")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xScale)
            .tickSize(-height)
            .tickFormat("")
            );
        }

        if(yGrid){
            svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat("")
            );
        }
    },


  //**************************************************************************
  //** drawLabels
  //**************************************************************************
  /** Used to render labels along the x and y axis
   */
    drawLabels: function(svg, showX, showY, height, width, margin, xLabel, yLabel){

      //Add X-axis label
        if(showX){

            var y = height;
            if (margin) y+= margin.bottom - 2;

            svg.append("text")
            .attr("x", width/2)
            .attr("y", y)
            .style("text-anchor", "middle")
            .text(xLabel);
        }


      //Add Y-axis label
        if(showY){

            var x = 0;
            if (margin) x = x - margin.left;

            svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", 0 - (height/2))
            .attr("y", x)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text(yLabel);
        }

    },



  //**************************************************************************
  //** drawAxes
  //**************************************************************************
  /** Used to render x/y axis on the plotArea
   */
    drawAxes: function(plotArea, axisWidth, axisHeight, xKey, yKey, chartData, minData, scaleOption, chartType){
        if (!scaleOption) scaleOption = "linear";

        var getType = bluewave.chart.utils.getType;
        var getScale = bluewave.chart.utils.getScale;

        var xAxis, yAxis, xBand, yBand, x, y;
        var sb;

        let xType = getType(chartData[0][xKey]);
        if (chartType=="barChart" && xType == "date") xType = "string";
        sb = getScale(xKey,xType,[0,axisWidth],chartData,minData);
        x = sb.scale;
        xBand = sb.band;

        let yType = getType(chartData[0][yKey]);
        if (chartType=="barChart" && yType == "date") yType = "string";
        sb = getScale(yKey,yType,[axisHeight,0],chartData,minData,scaleOption);
        y = sb.scale;
        yBand = sb.band;



        var labelWidth = 10;
        var domainLength = x.domain().length;
        var widthCheck = domainLength * labelWidth < axisWidth;

        var tickFilter = function(d, i) {

            let maxLabels = parseInt(axisWidth / labelWidth);

            //Ensure first tick is displayed and every multiple of maxLabels
            if (i === 0) return true;
            return !(i % maxLabels);
        };

        var getBoxes = function(axis){
            var boxes = [];
            axis.selectAll("text").each(function(d, i) {
                var box = javaxt.dhtml.utils.getRect(this);
                boxes.push({
                    left: box.x,
                    right: box.x+box.width,
                    top: box.y,
                    bottom: box.y+box.height
                });
            });
            return boxes;
        };


      //Render x-axis
        xAxis = plotArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(
                d3.axisBottom(x)
                .tickValues(widthCheck ? null : x.domain().filter(tickFilter))
            );


      //Rotate x-axis labels as needed
        var boxes = getBoxes(xAxis);
        var foundIntersection = false;
        for (var i=0; i<boxes.length; i++){
            var box = boxes[i];
            for (var j=0; j<boxes.length; j++){
                if (j===i) continue;
                var b = boxes[j];
                if (javaxt.dhtml.utils.intersects(box, b)){
                    foundIntersection = true;
                    break;
                }
            }
            if (foundIntersection) break;
        }
        if (foundIntersection){
            xAxis
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");
        }





      //Render y-axis
        yAxis = plotArea
            .append("g")
            .call(scaleOption==="linear" ? d3.axisLeft(y) :
                    d3.axisLeft(y)
                    .ticks(10, ",")
                    .tickFormat(d3.format("d"))
            );



      //Calculate margins required to fit the labels
        var xExtents = javaxt.dhtml.utils.getRect(xAxis.node());
        var yExtents = javaxt.dhtml.utils.getRect(yAxis.node());

        var left = Number.MAX_VALUE;
        var right = 0;
        var top = Number.MAX_VALUE;
        var bottom = 0;
        xAxis.selectAll("line").each(function(d, i) {
            var box = javaxt.dhtml.utils.getRect(this);
            left = Math.min(box.x, left);
            right = Math.max(box.x+box.width, right);
        });

        yAxis.selectAll("line").each(function(d, i) {
            var box = javaxt.dhtml.utils.getRect(this);
            top = Math.min(box.y, top);
            bottom = Math.max(box.y+box.height, bottom);
        });


        var marginLeft = Math.abs(xExtents.left-left); //extra space for the left-most x-axis label
        var marginRight = (xExtents.right-left)-axisWidth; //extra space for the right-most x-axis label

        marginLeft = Math.max(yExtents.width, marginLeft); //extra space for the y-axis labels

        var marginTop = top-yExtents.top; //extra space for the top-most y-axis label
        var marginBottom = xExtents.height;



      //Return axis objects
        return {
            xAxis: xAxis, //d3 svg selection
            yAxis: yAxis, //d3 svg selection
            xBand: xBand,
            yBand: yBand,
            x: x,
            y: y,
            margin: {
                top: marginTop,
                right: marginRight,
                bottom: marginBottom,
                left: marginLeft
            }
        };
    },


  //**************************************************************************
  //** getScale
  //**************************************************************************
    getScale : function(key, type, axisRange, chartData, minData, scaleOption){
        let scale;
        let band;

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


                break;

            default: //number

                var minVal, maxVal;
                if (!minData){
                    var extent = d3.extent(chartData, function(d) { return parseFloat(d[key]); });
                    minVal = 0;
                    maxVal = extent[1];
                }
                else{
                    minVal = d3.min(minData, function(d) { return parseFloat(d[key]);} );
                    maxVal = d3.max(chartData, function(d) { return parseFloat(d[key]);} );
                }
                if (minVal === maxVal) maxVal = minVal + 1;


                if (!scaleOption) scaleOption = "linear";

                if (scaleOption === "linear"){

                    if (minVal>0) minVal=0;

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
    },


  //**************************************************************************
  //** getType
  //**************************************************************************
    getType: function(value) {
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
    },


  //**************************************************************************
  //** getStyleEditor
  //**************************************************************************
    getStyleEditor : function(config){
      //Create styleEditor as needed
        if (!bluewave.charts.styleEditor){
            bluewave.charts.styleEditor = new javaxt.dhtml.Window(document.body, {
                title: "Edit Style",
                width: 400,
                valign: "top",
                modal: false,
                resizable: false,
                style: config.style.window
            });
        }
        return bluewave.charts.styleEditor;
    }


};