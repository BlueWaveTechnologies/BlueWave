if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  CalendarChart
//******************************************************************************
/**
 *   Panel used to create calendar charts
 *
 ******************************************************************************/

bluewave.charts.CalendarChart = function(parent, config) {

    console.log("initialized calendarChart")
    
    var me = this;
    var defaultConfig = {
        margin: {
            top: 15,
            right: 5,
            bottom: 65,
            left: 82
        }
    };
    var svg, calendarArea;
    // var xAxis, yAxis;
    // var axisWidth, axisHeight;
    // var x, y, xBand, yBand;
    // var timeAxis;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        config = merge(config, defaultConfig);


        initChart(parent, function(s, g){
            svg = s;
            calendarArea = g;
        });
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (calendarArea) calendarArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data, {
            x = ([x]) => x, // given d in data, returns the (temporal) x-value
            y = ([, y]) => y, // given d in data, returns the (quantitative) y-value
            title, // given d in data, returns the title text
            width = 928, // width of the chart, in pixels
            cellSize = 17, // width and height of an individual day, in pixels
            weekday = "monday", // either: weekday, sunday, or monday
            formatDay = i => "SMTWTFS"[i], // given a day number in [0, 6], the day-of-week label
            formatMonth = "%b", // format specifier string for months (above the chart)
            yFormat, // format specifier string for values (in the title)
            colors = d3.interpolatePiYG
        } = {})
        {
        me.clear();


        const height = cellSize * (weekDays + 2);


        console.log("datap preset");
        console.log(data)

        // FIX THE FORMAT OF THE DATE IF ITS NOT already in proper date format
        for (i in data){
        data[i]["date"] = new Date(data[i]["date"])
        }
        

        var X = d3.map(data, x);
        console.log(X);

        var Y = d3.map(data, y);
        var I = d3.range(X.length);

        var countDay = weekday === "sunday" ? i => i : i => (i + 6) % 7;
        var weekday = "monday";
        var timeWeek = weekday === "sunday" ? d3.utcSunday : d3.utcMonday;
        var weekDays = weekday === "weekday" ? 5 : 7;



        const max = d3.quantile(Y, 0.9975, Math.abs);
        console.log(max);
        const color = d3.scaleSequential([-max, +max], colors).unknown("none");
        
        // for computing titles
        formatMonth = d3.utcFormat(formatMonth);
        console.log(formatMonth());

        if (title === undefined) {
            console.log("computing another title")
            console.log(typeof(title))
            const formatDate = d3.utcFormat("%B %-d, %Y");
            
            console.log(formatDate());
            
            const formatValue = color.tickFormat(100, yFormat);
            title = i => `${formatDate(X[i])}\n${formatValue(Y[i])}`;
            console.log(title())
        }
        else if (title !== null) {
            console.log("title was not null")
            const T = d3.map(data, title);
            title = i => T[i];
        };

        console.log(`resulting title is ${title}`);
        console.log(`X value is ${X}`);
    
        console.log("---------");

        const years = d3.groups(I, i => X[i].getUTCFullYear()).reverse();



        var pathMonth = function(t){
            var d = Math.max(0, Math.min(weekDays, countDay(t.getUTCDay())));
            var w = timeWeek.count(d3.utcYear(t), t);

            return `${d === 0 ? `M${w * cellSize},0`
            : d === weekDays ? `M${(w + 1) * cellSize},0`
            : `M${(w + 1) * cellSize},0V${d * cellSize}H${w * cellSize}`}V${weekDays * cellSize}`;

        }

        var parent = svg.node().parentNode;


        
        onRender(parent, function(){
            renderChart(data,parent)
            // var width = parent.offsetWidth;
            // var height = parent.offsetHeight;
            // var margin = config.margin;
            // axisHeight = height - margin.top - margin.bottom;
            // axisWidth = width - margin.left - margin.right;
            // var plotHeight = height - margin.top - margin.bottom;
            // var plotWidth = width - margin.left - margin.right;
            // calendarArea = chart.append("g");
            // calendarArea
            //     .attr("width", plotWidth)
            //     .attr("height", plotHeight)
            //     .attr(
            //         "transform",
            //         "translate(" + margin.left + "," + (margin.top) + ")"
            //     );

            //  // Setup:
            // // Check that axis exist and are populated
            // let xKey;
            // let yKey;
            // let xKey2;
            // let yKey2;
            // let group;

            // if(chartConfig.xAxis===null || chartConfig.yAxis===null){
            //     return;
            // }else{
            //     xKey = chartConfig.xAxis;
            //     yKey = chartConfig.yAxis;
            //     group = chartConfig.group;
            // }

            // if(chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
            //     xKey2 = chartConfig.xAxis2;
            //     yKey2 = chartConfig.yAxis2;
            // }

            // var data1 = data[0];
            // var data2 = data[1];
            // data = data1;

            // if (data2!==null && data2!==undefined && xKey2 && yKey2){
            //     data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
            // }
            //    let xType = typeOfAxisValue();

            //    displayAxis(xKey, yKey, data);

               var tooltip = d3.select(parent)
                 .append("div")
                 .style("opacity", 0)
                 .attr("class", "tooltip")
                 .style("background-color", "white")
                 .style("border", "solid")
                 .style("border-width", "1px")
                 .style("border-radius", "5px")
                 .style("padding", "10px")

               var mouseover = function(d) {
                  tooltip
                  .style("opacity", 1)
               }

               var mousemove = function(d) {
                  tooltip
                  .html("X: " + d[xKey]+ "     Y: " + d[yKey])
                  .style("left", (d3.mouse(this)[0]+90) + "px")
                  .style("top", (d3.mouse(this)[1]) + "px")
               }

               var mouseleave = function(d) {
                  tooltip
                  .transition()
                  .duration(200)
                  .style("opacity", 0)
               }

            //    let keyType = typeOfAxisValue(data[0].xKey);
            //    calendarArea
            //        .selectAll("dot")
            //        .data(data)
            //        .enter()
            //        .append("circle")
            //           .attr("cx", function (d) {
            //           if(keyType==="date"){
            //             return x(new Date(d[xKey]));
            //           } else{
            //             return x(d[xKey]);
            //           }})
            //           .attr("cy", function (d) { return y(d[yKey]); } )
            //           .attr("r", 7)
            //           .style("fill", "#12b84c")
            //           .style("opacity", 0.3)
            //           .style("stroke", "white")
            //           .on("mouseover", mouseover)
            //           .on("mousemove", mousemove)
            //           .on("mouseleave", mouseleave);



            // let xTemps = createAxisScale(xKey, 'x', data);
            // let xScale = xTemps.scale;
            // let yTemps = createAxisScale(yKey, 'y', data);
            // let yScale = yTemps.scale;

            // line = d3.line()
            // .x(function(d) { return xScale(d[0])})
            // .y(function(d) { return yScale(d[1])});

            // if (chartConfig.showRegLine) {
            // 	 calendarArea.append("path")
            //           .datum(linReg)
            //           .attr("class", "line")
            //           .attr("d", line)
            //           .attr("stroke", function(d) { return "#000000"; })
            //           .attr("stroke-linecap", 'round')
            //           .attr("stroke-width", 500);

            // }

        });
      //**************************************************************************
      //** renderChart
      //**************************************************************************
        var renderChart = function(data, parent){
            svg
            .attr("width", width)
            .attr("height", height * years.length)
            .attr("viewBox", [0, 0, width, height * years.length])
            .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10);

            var year = svg.selectAll("g")
            .data(years)
            .join("g")
                .attr("transform", (d, i) => `translate(40.5,${height * i + cellSize * 1.5})`);
        
            year.append("text")
                .attr("x", -5)
                .attr("y", -5)
                .attr("font-weight", "bold")
                .attr("text-anchor", "end")
                .text(([key]) => key);


            year.append("g")
                .attr("text-anchor", "end")
                .selectAll("text")
                .data(weekday === "weekday" ? d3.range(1, 6) : d3.range(7))
                .join("text")
                .attr("x", -5)
                .attr("y", i => (countDay(i) + 0.5) * cellSize)
                .attr("dy", "0.31em")
                .text(formatDay);
        

            var cell = year.append("g")
                .selectAll("rect")
                .data(weekday === "weekday"
                    ? ([, I]) => I.filter(i => ![0, 6].includes(X[i].getUTCDay()))
                    : ([, I]) => I)
                .join("rect")
                    .attr("width", cellSize - 1)
                    .attr("height", cellSize - 1)
                    .attr("x", i => timeWeek.count(d3.utcYear(X[i]), X[i]) * cellSize + 0.5)
                    .attr("y", i => countDay(X[i].getUTCDay()) * cellSize + 0.5)
                    .attr("fill", i => color(Y[i]));
        
            if (title) cell.append("title")
                .text(title);

        
            var month = year.append("g")
                .selectAll("g")
                .data(([, I]) => d3.utcMonths(d3.utcMonth(X[I[0]]), X[I[I.length - 1]]))
                .join("g");
        
            month.filter((d, i) => i).append("path")
                .attr("fill", "none")
                .attr("stroke", "#fff")
                .attr("stroke-width", 3)
                .attr("d", pathMonth);
        
            month.append("text")
                .attr("x", d => timeWeek.count(d3.utcYear(d), timeWeek.ceil(d)) * cellSize + 2)
                .attr("y", -5)
                .text(formatMonth);

        };


//   **************************************************************************
//   ** Utils
//   **************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.utils.initChart;

    init();

};