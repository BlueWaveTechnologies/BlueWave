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


        var parent = svg.node().parentNode;


        onRender(parent, function(){

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
    };


  //**************************************************************************
  //** Utils
//   **************************************************************************
    // var merge = javaxt.dhtml.utils.merge;
    // var onRender = javaxt.dhtml.utils.onRender;
    // var initChart = bluewave.utils.initChart;

    init();

};