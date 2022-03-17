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


            var p = d3.select(parent)
            .append("div")
            .classed("svg-container", true) ;

            var svg = p.append("svg")
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("height","100%")
                .attr("width","100%")
                .attr("viewBox", "0 0 600 400")
                .classed("svg-content-responsive", true);


            javaxt.dhtml.utils.onRender(parent, function(){
                var width = parent.offsetWidth;
                var height = parent.offsetHeight;
                svg.attr("viewBox", `0 0 ${width} ${height}`);
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
    drawAxes: function(plotArea, axisWidth, axisHeight, xKey, yKey,
        chartData, minData, chartConfig, chartType){

        var getType = bluewave.chart.utils.getType;
        var getScale = bluewave.chart.utils.getScale;
        var getDateFormat = bluewave.chart.utils.getDateFormat;


        var xAxis, yAxis, xBand, yBand, x, y;
        var sb;

        let xType = getType(chartData[0][xKey]);
        if (chartType=="barChart" && xType == "date") xType = "string";
        sb = getScale(xKey,xType,[0,axisWidth],chartData,minData);
        x = sb.scale;
        xBand = sb.band;

        let yType = getType(chartData[0][yKey]);
        if (chartType=="barChart" && yType == "date") yType = "string";
        var scaleOption = chartConfig.scaling==="logarithmic" ? "logarithmic" : "linear";
        sb = getScale(yKey,yType,[axisHeight,0],chartData,minData,scaleOption);
        y = sb.scale;
        yBand = sb.band;



        var labelWidth = 10;
        var domainLength = x.domain().length;
        var widthCheck = domainLength * labelWidth < axisWidth;


//        const formatMillisecond = d3.timeFormat(".%L"),
//            formatSecond = d3.timeFormat(":%S"),
//            formatMinute = d3.timeFormat("%I:%M"),
//            formatHour = d3.timeFormat("%b %d"),
//            formatDay = d3.timeFormat("%b %d"),
//            formatWeek = d3.timeFormat("%b %d"),
//            formatMonth = d3.timeFormat("%B"),
//            formatYear = d3.timeFormat("%Y");
//
//        function multiFormat(date) {
//            return (d3.timeSecond(date) < date ? formatMillisecond
//                : d3.timeMinute(date) < date ? formatSecond
//                    : d3.timeHour(date) < date ? formatMinute
//                        : d3.timeDay(date) < date ? formatHour
//                            : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
//                                : d3.timeYear(date) < date ? formatMonth
//                                    : formatYear)(date);
//        }

        var tickFilter = function(d, i) {

            let maxLabels = parseInt(axisWidth / labelWidth);

            //Ensure first tick is displayed and every multiple of maxLabels
            if (i === 0) return true;
            return !(i % maxLabels);
        };

        var updateDefaultTicks = function(axis, type){
            var numWholeNumbers;
            var years;
            var days;

            axis
            .selectAll("text").each(function(value, index, nodeList) {
                var label = nodeList[index].textContent;
                if (type === "number") {
                    if (isNaN(numWholeNumbers)){
                        numWholeNumbers = 0;
                        nodeList.forEach(function(n){
                            var wholeNumber = parseFloat(n.textContent) % 1 == 0;
                            if (wholeNumber) numWholeNumbers++;
                        });
                    }
                    if (numWholeNumbers==nodeList.length){
                        var format = d3.format(",");
                        nodeList[index].textContent = format(label);
                    }
                }
                else if (type === "date"){

                    if (!years){
                        years = {};
                        days = {};
                        nodeList.forEach(function(n){
                            var date = new Date(n.textContent); //assumes m/d/yyyy
                            var y = date.getFullYear();
                            var d = date.getDate();
                            years[y+""] = true;
                            days[d+""] = true;
                        });
                        years = Object.keys(years);
                        days = Object.keys(days);
                    }

                    if (years.length>1){
                        if (days.length==1){
                            var format = d3.timeFormat("%m/%y");
                            label = format(value);
                        }
                    }
                    else{
                        if (days.length==1){
                            var format = d3.timeFormat("%b");
                            label = format(value);
                        }
                    }

                    if (label.indexOf("0")===0) label = label.substring(1);
                    label = label.replaceAll("/0", "/");
                    nodeList[index].textContent = label;
                }
            });
        };

        var getTickFormat = function(type, pattern){
            var format;
            if (type === "date"){
                format = d3.timeFormat(getDateFormat(pattern));
            }
            else if (type === "number") {
                var numDecimals = 1;
                format = d3.format("." + numDecimals + "f");
            }
            return format;
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
        var xFormat = getTickFormat(xType, chartConfig.xFormat);
        xAxis = plotArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(
                d3.axisBottom(x)
                .ticks(chartConfig.xTicks)
                .tickValues(widthCheck ? null : x.domain().filter(tickFilter))
                .tickFormat(xFormat)
            );


        if (!chartConfig.xFormat) updateDefaultTicks(xAxis, xType);


        var foundIntersection = function(boxes, buffer=0){
            var foundIntersection = false;

            boxes.forEach(function(box){
                box.top -= buffer;
                box.left -= buffer;
                box.right += buffer;
                box.bottom += buffer;
            });

            for (var i = 0; i < boxes.length; i++) {
                var box = boxes[i];
                for (var j = 0; j < boxes.length; j++) {
                    if (j === i) continue;
                    var b = boxes[j];
                    if (javaxt.dhtml.utils.intersects(box, b)) {
                        foundIntersection = true;
                        break;
                    }
                }
                if (foundIntersection) break;
            }
            return foundIntersection;
        };

      //Rotate x-axis labels as needed
        var xBoxes = getBoxes(xAxis);
        var xLabelsIntersect = foundIntersection(xBoxes, 3);

        if (xLabelsIntersect){
            xAxis
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");
        }



      //Render y-axis
        var yFormat = getTickFormat(yType, chartConfig.yFormat);
        yAxis = plotArea
            .append("g")
            .call(scaleOption==="linear" ?
                d3.axisLeft(y).tickFormat(yFormat)
                :
                d3.axisLeft(y)
                    .ticks(10, ",")
                    .tickFormat(yFormat)
            );

        if (!chartConfig.yFormat) updateDefaultTicks(yAxis, yType);

      //Hide every other y-tick if they're crowded
        var yBoxes = getBoxes(yAxis);
        var yLabelsIntersect = foundIntersection(yBoxes, 3);

        if (yLabelsIntersect) {

            let length = yAxis.selectAll("text").size();

            yAxis
                .selectAll("text")
                .attr("visibility", function (text, i) {
                    //Check cardinality to ensure top tick is always displayed
                    if (length%2) {
                        return (i + 1) % 2 === 0 ? "hidden" : "visible";
                    }
                    else return i % 2 === 0 ? "hidden" : "visible";
                })

        }

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


        var marginLeft = xExtents.left-left; //extra space for the left-most x-axis label
        if (marginLeft<0) marginLeft = 0;

        var marginRight = (xExtents.right-right); //extra space for the right-most x-axis label
        if (marginRight<0) marginRight = 0;


        marginLeft = Math.max(yExtents.width, marginLeft); //extra space for the y-axis labels

        var marginTop = top-yExtents.top; //extra space for the top-most y-axis label
        var marginBottom = xExtents.height;


        var labelOffset = 16;

      //Add x-axis label as needed
        var xLabel = chartConfig.xLabel;
        if (xLabel){

            var t = xAxis.append("text")
            .attr("x", (xExtents.right-xExtents.left)/2)
            .attr("y", marginBottom+labelOffset)
            .attr("class", "chart-axis-label")
            .style("text-anchor", "middle")
            .text(xLabel);

            var r = javaxt.dhtml.utils.getRect(t.node());
            marginBottom+=(r.height+labelOffset);
        }


      //Add y-axis label as needed
        var yLabel = chartConfig.yLabel;
        if (yLabel){

            var t = yAxis.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -(yExtents.height/2)) //set vertical position
            .attr("y", -(yExtents.width+labelOffset)) //set horizontal position
            .attr("class", "chart-axis-label")
            .style("text-anchor", "middle")
            .text(yLabel);

            var r = javaxt.dhtml.utils.getRect(t.node());
            marginLeft = Math.max(marginLeft+(r.width+labelOffset), marginLeft);
        }



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

                var timeRange = [ new Date(d3.min(chartData, d=>d[key])), new Date(d3.max(chartData, d=>d[key])) ];

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
  //** extendScale
  //**************************************************************************

    extendScale: function (scaleBandObj, axisRange, scalingFactor, type) {

        var domain = scaleBandObj.scale.domain();
        var scale, band;

        var getType = bluewave.chart.utils.getType;
        if (!type) type = getType(domain[0]);
        if (!scalingFactor) scalingFactor = 1;

        if (type === 'date') {
            let endDate = domain[1];
            let startDate = domain[0];
            let dateinMilliseconds = endDate.getTime();


            let timeDiff = endDate - startDate;
            let timetoAdd = timeDiff * scalingFactor;
            let extendedDate = new Date(dateinMilliseconds + timetoAdd);

            scale = d3
                    .scaleTime()
                    .domain([startDate, extendedDate])
                    .rangeRound(axisRange);

            band = d3
                    .scaleBand()
                    .domain(d3.timeDay.range(...scale.domain()))
                    .rangeRound(axisRange)
                    .padding(0.2);



        } else if (type === 'string') {

            let numExtraTicks = Math.ceil(domain.length * scalingFactor);
            let spaceString = "";
            let ordinalDomain = domain;
            //Hackyest hack in ever - creates space strings of increasing length. Ordinal domain values must be unique
            for(let i=0; i<numExtraTicks; i++){

                spaceString = spaceString + " ";
                ordinalDomain.push(spaceString);
            }

            scale = d3
                    .scaleBand()
                    .domain(ordinalDomain)
                    .range(axisRange)
                    .padding(0.2);


        } else { //Number

            let numDomain = [domain[0], domain[1]*(scalingFactor + 1)]

            scale = d3.scaleLinear()
                    .domain(numDomain)
                    .range(axisRange);
        }


        return {
            scale: scale,
            band: band
        };

    },

  //**************************************************************************
  //** reDrawAxes
  //**************************************************************************
    reDrawAxes: function(svg, xAxis, x, yAxis, y, axisHeight) {


        if (xAxis){
            xAxis.remove();
            xAxis = svg
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(
                d3.axisBottom(x)
            );

        }

        if (yAxis){
            yAxis.remove()
            yAxis = svg
            .append("g")
            .call(
                d3.axisLeft(y)
            );

        }
    },

  //**************************************************************************
  //** getType
  //**************************************************************************
    getType: function(value) {

        var arr = javaxt.dhtml.utils.isArray(value) ? value : [value];

        var getType = function(value){
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

        var numbers = 0;
        var dates = 0;
        var strings = 0;
        var other = 0;
        arr.forEach(function(value){
            var dataType = getType(value);
            switch (dataType) {
                case "string":
                    strings++;
                    break;
                case "number":
                    numbers++;
                    break;
                case "date":
                    dates++;
                    break;
                default:
                    other++;
                    break;
            }
        });

        if (dates==arr.length) return "date";
        if (numbers==arr.length) return "number";
        if (strings==arr.length) return "string";
        return null;
    },


  //**************************************************************************
  //** getDateFormat
  //**************************************************************************
  /** Used to convert common date formatting pattern to D3 pattern
   *  @param pattern Date pattern like "YYYY-MM-DD" or "m/d/yy" or "dddd, MMMM D h:mm:ss A"
   */
    getDateFormat: function(pattern){
        var dateFormat = "%m/%d/%Y";
        if (pattern){
            dateFormat = pattern;
            dateFormat = dateFormat.replace("YYYY", "%Y");
            dateFormat = dateFormat.replace("YY", "%y");
            dateFormat = dateFormat.replace("MMMM", "%B");
            dateFormat = dateFormat.replace("MM", "%m");
            dateFormat = dateFormat.replace("M", "%m"); //TODO: replace leading digit
            dateFormat = dateFormat.replace("DD", "%d");
            dateFormat = dateFormat.replace("D", "%d"); //TODO: replace leading digit
            dateFormat = dateFormat.replace("A", "%p");
            dateFormat = dateFormat.replace("dddd", "%A");
            dateFormat = dateFormat.replace("HH", "%H");
            dateFormat = dateFormat.replace("h", "%I");
            dateFormat = dateFormat.replace("mm", "%M");
            dateFormat = dateFormat.replace("ss", "%S");
        }
        return dateFormat;
    },


  //**************************************************************************
  //** getColorRange
  //**************************************************************************
  /** Returns a range of colors using a given set of colors
   *  @param numColors Number of colors to return
   *  @param colors An array of colors (e.g. ["#f8f8f8", "#6699cc"]).
   *  Minimum of 2 colors are required
   */
    getColorRange: function(numColors, colors){

        var arr = [];

        if (colors.length>2){
            var numBins = colors.length-1;
            var colorsPerBin = numColors/numBins;
            var wholeNumber = colorsPerBin % 1 == 0;
            if (!wholeNumber) colorsPerBin = Math.floor(colorsPerBin);

            for (var i=0; i<colors.length-1; i++){
                var r = [colors[i], colors[i+1]];
                var fn = d3.scaleLinear().domain([0, colorsPerBin-1]).range(r);
                for (var j=0; j<colorsPerBin; j++){
                    arr.push(d3.color(fn(j)).formatHex());
                }
            }
        }
        else {
            var fn = d3.scaleLinear().domain([0, numColors-1]).range(colors);
            for (var i=0; i<numColors; i++){
                arr.push(d3.color(fn(i)).formatHex());
            }
        }


        return arr;
    },


  //**************************************************************************
  //** getNaturalBreaks
  //**************************************************************************
  /** Used to classify data using Jenks natural breaks optimization
   *  @param data An array of numbers
   *  @param n_classes Number of classes
   *  @return Array of values or null
   */
    getNaturalBreaks: function(data, n_classes) {


        // Adjust n_classes to reflect data
        var numDistinctVals = [...new Set(data)].length;
        n_classes = Math.min(n_classes, numDistinctVals-1);


        // Compute the matrices required for Jenks breaks. These matrices
        // can be used for any classing of data with `classes <= n_classes`
        function getMatrices(data, n_classes) {

            // in the original implementation, these matrices are referred to
            // as `LC` and `OP`
            //
            // * lower_class_limits (LC): optimal lower class limits
            // * variance_combinations (OP): optimal variance combinations for all classes
            var lower_class_limits = [],
                variance_combinations = [],
                // loop counters
                i, j,
                // the variance, as computed at each step in the calculation
                variance = 0;

            // Initialize and fill each matrix with zeroes
            for (i = 0; i < data.length + 1; i++) {
                var tmp1 = [], tmp2 = [];
                for (j = 0; j < n_classes + 1; j++) {
                    tmp1.push(0);
                    tmp2.push(0);
                }
                lower_class_limits.push(tmp1);
                variance_combinations.push(tmp2);
            }

            for (i = 1; i < n_classes + 1; i++) {
                lower_class_limits[1][i] = 1;
                variance_combinations[1][i] = 0;
                // in the original implementation, 9999999 is used but
                // since Javascript has `Infinity`, we use that.
                for (j = 2; j < data.length + 1; j++) {
                    variance_combinations[j][i] = Infinity;
                }
            }

            for (var l = 2; l < data.length + 1; l++) {

                // `SZ` originally. this is the sum of the values seen thus
                // far when calculating variance.
                var sum = 0,
                    // `ZSQ` originally. the sum of squares of values seen
                    // thus far
                    sum_squares = 0,
                    // `WT` originally. This is the number of
                    w = 0,
                    // `IV` originally
                    i4 = 0;

                // in several instances, you could say `Math.pow(x, 2)`
                // instead of `x * x`, but this is slower in some browsers
                // introduces an unnecessary concept.
                for (var m = 1; m < l + 1; m++) {

                    // `III` originally
                    var lower_class_limit = l - m + 1,
                        val = data[lower_class_limit - 1];

                    // here we're estimating variance for each potential classing
                    // of the data, for each potential number of classes. `w`
                    // is the number of data points considered so far.
                    w++;

                    // increase the current sum and sum-of-squares
                    sum += val;
                    sum_squares += val * val;

                    // the variance at this point in the sequence is the difference
                    // between the sum of squares and the total x 2, over the number
                    // of samples.
                    variance = sum_squares - (sum * sum) / w;

                    i4 = lower_class_limit - 1;

                    if (i4 !== 0) {
                        for (j = 2; j < n_classes + 1; j++) {
                            // if adding this element to an existing class
                            // will increase its variance beyond the limit, break
                            // the class at this point, setting the lower_class_limit
                            // at this point.
                            if (variance_combinations[l][j] >=
                                (variance + variance_combinations[i4][j - 1])) {
                                lower_class_limits[l][j] = lower_class_limit;
                                variance_combinations[l][j] = variance +
                                    variance_combinations[i4][j - 1];
                            }
                        }
                    }
                }

                lower_class_limits[l][1] = 1;
                variance_combinations[l][1] = variance;
            }

            // return the two matrices. for just providing breaks, only
            // `lower_class_limits` is needed, but variances can be useful to
            // evaluage goodness of fit.
            return {
                lower_class_limits: lower_class_limits,
                variance_combinations: variance_combinations
            };
        }



        // the second part of the jenks recipe: take the calculated matrices
        // and derive an array of n breaks.
        function breaks(data, lower_class_limits, n_classes) {

            var k = data.length - 1,
                kclass = [],
                countNum = n_classes;

            // the calculation of classes will never include the upper and
            // lower bounds, so we need to explicitly set them
            kclass[n_classes] = data[data.length - 1];
            kclass[0] = data[0];

            // the lower_class_limits matrix is used as indexes into itself
            // here: the `k` variable is reused in each iteration.
            while (countNum > 1) {
                kclass[countNum - 1] = data[lower_class_limits[k][countNum] - 2];
                k = lower_class_limits[k][countNum] - 1;
                countNum--;
            }

            return kclass;
        }

        if (n_classes > data.length) {
            return null;
        }

        // sort data in numerical order, since this is expected
        // by the matrices function
        data = data.slice().sort(function (a, b) { return a - b; });

        // get our basic matrices
        var matrices = getMatrices(data, n_classes),
            // we only need lower class limits here
            lower_class_limits = matrices.lower_class_limits;

        // extract n_classes out of the computed matrices
        var arr = [];
        try{
            arr = breaks(data, lower_class_limits, n_classes);
            arr.unshift(0);
            arr = [...new Set(arr)];
        }
        catch(e){
            console.log(e);
        }
        return arr;
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
    },


  //**************************************************************************
  //** createTooltip
  //**************************************************************************
    createTooltip: function(){
        var tooltip = bluewave.chart.utils.Tooltip;
        var getHighestElements = javaxt.dhtml.utils.getHighestElements;
        if (!tooltip){
            tooltip = bluewave.chart.utils.Tooltip =
            d3.select(document.body)
            .append("div")
            .style("opacity", 0)
            .style("top", 0)
            .style("left", 0)
            .style("display", "none")
            .attr("class", "tooltip");


            tooltip.show = function(){

              //Get zIndex
                var highestElements = getHighestElements();
                var zIndex = highestElements.zIndex;
                if (!highestElements.contains(tooltip.node())) zIndex++;

              //Update tooltip
                tooltip
                .style("opacity", 1)
                .style("display", "block")
                .style("z-index", zIndex);
            };

            tooltip.hide = function(){
                tooltip
                .style("opacity", 0)
                .style("display", "none");
            };
        }
        return tooltip;
    }


};