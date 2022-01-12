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
        cellSize: 17 // width and height of an individual day, in pixels
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
         formatDay = i => "SMTWTFS"[i], // given a day number in [0, 6], the day-of-week label
         formatMonth = d3.utcFormat("%b"), // format specifier string for months (above the chart)
         colors = d3.interpolatePiYG;



      //Update date field in the data
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

        // Compute a color scale. This assumes a diverging color scheme where the pivot
        // is zero, and we want symmetric difference around zero.
        const max = d3.quantile(values, 0.9975, Math.abs);
        var getColor = d3.scaleSequential([-max, +max], colors).unknown("none");




      //Create groups for every year
        var yearGroup = calendarArea.selectAll("*")
          .data(years)
          .join("g")
            .attr("transform", (d, i) => `translate(40.5,${height * i + cellSize * 1.5})`);


      //Add year label to every group
        yearGroup.append("text")
            .attr("x", -5)
            .attr("y", -5)
            .attr("font-weight", "bold")
            .attr("text-anchor", "end")
            .text(year => year);


      //Add day of week abbreviation on the left side of each group
        yearGroup.append("g")
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
          .selectAll("rect")
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
            });


      //Create month group
        var monthGroup = yearGroup.append("g")
          .selectAll("g")
          .data(function(year){
              var months = {};
              dates.forEach(function(date){
                  if (date.getUTCFullYear()===year){
                      var month = date.getUTCMonth()+"";
                      if (!months[month]) months[month] = d3.utcMonth(date);
                  }
              });
              months = Object.values(months);
              return d3.utcMonths(months[0], months[months.length - 1]);
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
        monthGroup.append("text")
            .attr("x", d => timeWeek.count(d3.utcYear(d), timeWeek.ceil(d)) * cellSize + 2)
            .attr("y", -5)
            .text(formatMonth);

    };


   //**************************************************************************
   //** Utils
   //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.chart.utils.initChart;


    init();

};