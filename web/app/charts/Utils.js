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
            svg.append("text")
            .attr("x", width/2)
            .attr("y", height+margin.bottom - 2)
            .style("text-anchor", "middle")
            .text(xLabel);
        }

        //Add Y-axis label
        if(showY){
            svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", 0 - (height/2))
            .attr("y", 0 - margin.left)
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
    drawAxes: function(plotArea, axisWidth, axisHeight, xKey, yKey, chartData, minData, scaleOption, chartType, ticks){
        if (!scaleOption) scaleOption = "linear";

        var getType = bluewave.chart.utils.getType;
        var getScale = bluewave.chart.utils.getScale;
        var autoRotateLabels = bluewave.chart.utils.autoRotateLabels;

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
        var timeFormat = d3.timeFormat("%d-%b-%y");

        const formatMillisecond = d3.timeFormat(".%L"),
            formatSecond = d3.timeFormat(":%S"),
            formatMinute = d3.timeFormat("%I:%M"),
            formatHour = d3.timeFormat("%b %d"),
            formatDay = d3.timeFormat("%b %d"),
            formatWeek = d3.timeFormat("%b %d"),
            formatMonth = d3.timeFormat("%B"),
            formatYear = d3.timeFormat("%Y");

        function multiFormat(date) {
            return (d3.timeSecond(date) < date ? formatMillisecond
                : d3.timeMinute(date) < date ? formatSecond
                    : d3.timeHour(date) < date ? formatMinute
                        : d3.timeDay(date) < date ? formatHour
                            : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
                                : d3.timeYear(date) < date ? formatMonth
                                    : formatYear)(date);
        }

        var tickFilter = function(d, i) {

            let maxLabels = parseInt(axisWidth / labelWidth);

            //Ensure first tick is displayed and every multiple of maxLabels
            if (i === 0) return true;
            return !(i % maxLabels);
        };

        xAxis = plotArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(
                d3.axisBottom(x)
                .ticks(ticks)
                .tickValues(widthCheck ? null : x.domain().filter(tickFilter))
                .tickFormat(xType == "date" ? multiFormat : null)
            );


        autoRotateLabels(xAxis, axisWidth);

        yAxis = plotArea
            .append("g")
            .call(scaleOption==="linear" ? d3.axisLeft(y) :
                    d3.axisLeft(y)
                    .ticks(10, ",")
                    .tickFormat(d3.format("d"))
            );

        return {
            xAxis: xAxis,
            yAxis: yAxis,
            xBand: xBand,
            yBand: yBand,
            x: x,
            y: y
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
  //** autoRotateLabels
  //**************************************************************************
    autoRotateLabels : function(axis, axisWidth){

        let labelWidths = [];
        // 1 - phi
        const minRatio = 0.618/1.618;

        axis
            .selectAll("text")
            .each(function (d) {
                let me = this;
                labelWidths.push(me.getBBox().width);
            });

        let widthSum = d3.sum(labelWidths);
        let meanWidth = d3.mean(labelWidths);
        
        let axisRatio = widthSum / axisWidth;
        if (axisRatio > 1) axisRatio = 1;
        
        var angleScale = d3.scaleLinear()
            .domain([minRatio, 1])
            .range([-15, -60]);

        var offsetScale = d3.scaleLinear()
            .domain([minRatio, 1])
            .range([0, -10]);


        //If labels take up more than ~38% of the axis width, start rotating
        var getTransform = function(){
            if (axisRatio < minRatio) return `translate(0,0)rotate(0)`;

            let offset = offsetScale(axisRatio);
            let angle = angleScale(axisRatio);

            return `translate(${offset},1)rotate(${angle})`;
        }

        axis
            .selectAll("text")
            .attr("transform", getTransform)
            .style("text-anchor", function(){
                return (axisRatio < minRatio) ? "middle" : "end";
            });
            // .attr("transform", "translate(-10,0)rotate(-45)")
            // .style("text-anchor", "end");
            

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