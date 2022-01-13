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


    var me = this;
    var defaultConfig = {
        date: "date",
        value: "value",
        weekday: "monday", // either: weekday, sunday, or monday
        cellSize: 17, // width and height of an individual day, in pixels
        colors: ["#f8f8f8", "#6699cc"], //lighter to darker
        showTooltip: false
    };
    var svg, calendarArea;



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
  //** getTooltipLabel
  //**************************************************************************
    this.getTooltipLabel = function(d){
        return d3.utcFormat("%m/%d/%Y")(d.date) + "<br/>" + d.value;
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
    this.update = function(chartConfig, data){
        me.clear();

        config = merge(chartConfig, defaultConfig);

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(data);
        });
    };


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(data){


        var
         cellSize = config.cellSize,
         weekday = config.weekday,
         formatDay = i => "SMTWTFS"[i]; // given a day number in [0, 6], the day-of-week label


      //Update date and value fields in the data
        data.forEach((d)=>{
            var date = d[config.date];
            var value = d[config.value];
            d[config.date] = new Date(date);
            d[config.value] = parseFloat(value);
        });


      //Sort array in reverse chronological order
        data.sort(function(a, b){
            return b[config.date].getTime()-a[config.date].getTime();
        });


      //Create an array of dates and values
        var dates = [];
        var values = [];
        var years = {};
        data.forEach((d)=>{
            var date = d[config.date];
            var value = d[config.value];
            dates.push(date);
            values.push(value);

            var year = date.getUTCFullYear();
            years[year+""] = year;
        });
        years = Object.values(years);
        years.sort(function(a,b){
            return b - a;
        });



        const countDay = weekday === "sunday" ? i => i : i => (i + 6) % 7;
        const timeWeek = weekday === "sunday" ? d3.utcSunday : d3.utcMonday;
        const weekDays = weekday === "weekday" ? 5 : 7;
        const height = cellSize * (weekDays + 2);


      //Create color function using natural breaks
        var numClasses = 10;
        var breaks = bluewave.utils.getNaturalBreaks(values, numClasses); //replace with d3.quantile?
        var colors = config.colors;
        if (!colors) colors = ["#f8f8f8", "#6699cc"];
        colors = d3.scaleLinear().domain([0, breaks.length-1]).range(colors);
        var getColor = function(value){
            for (var i=0; i<breaks.length; i++){
                var currBreak = breaks[i];
                if (value=>currBreak){
                    if (i<breaks.length-1){
                        var nextBreak = breaks[i+1];
                        if (nextBreak>value){
                            var color = colors(i);
                            return color;
                        }
                    }
                    else{
                        var color = colors(i);
                        return color;
                    }
                }
            }
        };


        var tooltip;
        if (config.showTooltip===true){
            tooltip = bluewave.charts.PieChart.Tooltip;
            if (!tooltip){
                tooltip = bluewave.charts.PieChart.Tooltip =
                d3.select(document.body)
                .append("div")
                .style("opacity", 0)
                .attr("class", "tooltip");
            }
        }


        var mouseover = function(d, i) {
            if (tooltip){


              //Get label
                var label = me.getTooltipLabel({date: d, value: values[i]});

              //Get zIndex
                var highestElements = getHighestElements();
                var zIndex = highestElements.zIndex;
                if (!highestElements.contains(tooltip.node())) zIndex++;

              //Update tooltip
                tooltip
                .html(label)
                .style("opacity", 1)
                .style("display", "block")
                .style("z-index", zIndex);
            }

            d3.select(this).transition().duration(100).attr("opacity", "0.8");
        };

        var mousemove = function() {
            var e = d3.event;
            if (tooltip) tooltip
            .style('top', (e.clientY) + "px")
            .style('left', (e.clientX + 20) + "px");
        };

        var mouseleave = function() {
            if (tooltip) tooltip
            .style("opacity", 0)
            .style("display", "none");

            d3.select(this).transition().duration(100).attr("opacity", "1");
        };



      //Create groups for every year
        var yearGroup = calendarArea.selectAll("*")
          .data(years)
          .join("g")
            .attr("transform", (d, i) => `translate(40.5,${height * i + cellSize * 1.5})`);


      //Add year label to every group
        yearGroup.append("text")
          .attr("class", "chart-axis-label")
          .attr("x", -5)
          .attr("y", -5)
          .attr("text-anchor", "end")
          .text(year => year);


      //Add day of week abbreviation on the left side of each group
        yearGroup.append("g")
          .attr("class", "tick")
          .attr("text-anchor", "end")
          .selectAll("text")
          .data(weekday === "weekday" ? d3.range(1, 6) : d3.range(7))
          .join("text")
            .attr("x", -5)
            .attr("y", i => (countDay(i) + 0.5) * cellSize)
            .attr("dy", "0.31em")
            .text(formatDay);


      //Create table and cells
        yearGroup.append("g")
          .selectAll("*")
          .data(function(year){
              var arr = [];
              dates.forEach(function(date){
                  if (date.getUTCFullYear()===year) arr.push(date);
              });
              return arr;
          })
          .join("rect")
            .attr("width", cellSize - 1)
            .attr("height", cellSize - 1)
            .attr("x", date => timeWeek.count(d3.utcYear(date), date) * cellSize + 0.5)
            .attr("y", date => countDay(date.getUTCDay()) * cellSize + 0.5)
            .attr("fill", function(date, i){
                var value = values[i];
                return getColor(value);
            })
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);

      //Create month group
        var monthGroup = yearGroup.append("g")
          .selectAll("g")
          .data(function(year){

              var firstDay, lastDate;
              dates.forEach(function(date){
                  if (date.getUTCFullYear()===year){
                      if (!lastDate) lastDate = date;
                      firstDay = date;
                  }
              });

              firstDay = new Date(firstDay.getTime());
              lastDate = new Date(lastDate.getTime());

              firstDay.setMonth(firstDay.getMonth()-1);
              lastDate.setMonth(lastDate.getMonth()+1);
              return d3.utcMonths(firstDay, lastDate);
          })
          .join("g");


      //Add thick line to seperate months in the grid
        monthGroup.filter((d, i) => i).append("path")
            .attr("fill", "none")
            .attr("stroke", "#fff")
            .attr("stroke-width", 3)
            .attr("d", function(date) {
                const d = Math.max(0, Math.min(weekDays, countDay(date.getUTCDay())));
                const w = timeWeek.count(d3.utcYear(date), date);
                return `${d === 0 ? `M${w * cellSize},0`
                    : d === weekDays ? `M${(w + 1) * cellSize},0`
                    : `M${(w + 1) * cellSize},0V${d * cellSize}H${w * cellSize}`}V${weekDays * cellSize}`;
            });


      //Add month labels
        var renderedMonths = {};
        monthGroup.append("text")
            .attr("class", "tick")
            .attr("x", d => timeWeek.count(d3.utcYear(d), timeWeek.ceil(d)) * cellSize + 2)
            .attr("y", -5)
            .text(function(date){
                var month = d3.utcFormat("%b")(date);
                var year = d3.utcFormat("%Y")(date);
                var key = year+"-"+month;

                var dateInRange = false;
                dates.every(function(d){

                    var m = d3.utcFormat("%b")(d);
                    var y = d3.utcFormat("%Y")(d);
                    var k = y+"-"+m;
                    if (k===key){
                        dateInRange = true;
                        return false;
                    }
                    return true;
                });


                if (dateInRange){
                    if (!renderedMonths[key]){
                        renderedMonths[key]=true;
                        return month;
                    }
                }
            });

    };


   //**************************************************************************
   //** Utils
   //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.chart.utils.initChart;
    var getHighestElements = javaxt.dhtml.utils.getHighestElements;


    init();

};