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
         title, // given d in data, returns the title text
         cellSize = config.cellSize,
         weekday = config.weekday,
         formatDay = i => "SMTWTFS"[i], // given a day number in [0, 6], the day-of-week label
         formatMonth = "%b", // format specifier string for months (above the chart)
         yFormat, // format specifier string for values (in the title)
         colors = d3.interpolatePiYG;

        // Compute values.
        const dates = d3.map(data, d => new Date(d[config.date])); //array of dates
        const values = d3.map(data, d => d[config.value]); //array of values
        const dateRange = d3.range(dates.length);



        const countDay = weekday === "sunday" ? i => i : i => (i + 6) % 7;
        const timeWeek = weekday === "sunday" ? d3.utcSunday : d3.utcMonday;
        const weekDays = weekday === "weekday" ? 5 : 7;
        const height = cellSize * (weekDays + 2);

        // Compute a color scale. This assumes a diverging color scheme where the pivot
        // is zero, and we want symmetric difference around zero.
        const max = d3.quantile(values, 0.9975, Math.abs);
        const color = d3.scaleSequential([-max, +max], colors).unknown("none");

        // Construct formats.
        formatMonth = d3.utcFormat(formatMonth);

        // Compute titles.
        if (title === undefined) {
          const formatDate = d3.utcFormat("%B %-d, %Y");
          const formatValue = color.tickFormat(100, yFormat);
          title = i => `${formatDate(dates[i])}\n${formatValue(values[i])}`;
        } else if (title !== null) {
          const T = d3.map(data, title);
          title = i => T[i];
        }

        // Group the index by year, in reverse input order. (Assuming that the input is
        // chronological, this will show years in reverse chronological order.)
        const years = d3.groups(dateRange, i => dates[i].getUTCFullYear()).reverse();
        console.log(years);


        function pathMonth(t) {
          const d = Math.max(0, Math.min(weekDays, countDay(t.getUTCDay())));
          const w = timeWeek.count(d3.utcYear(t), t);
          return `${d === 0 ? `M${w * cellSize},0`
              : d === weekDays ? `M${(w + 1) * cellSize},0`
              : `M${(w + 1) * cellSize},0V${d * cellSize}H${w * cellSize}`}V${weekDays * cellSize}`;
        }


        const year = svg.selectAll("g")
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

        const cell = year.append("g")
          .selectAll("rect")
          .data(weekday === "weekday"
              ? ([, dateRange]) => dateRange.filter(i => ![0, 6].includes(dates[i].getUTCDay()))
              : ([, dateRange]) => dateRange)
          .join("rect")
            .attr("width", cellSize - 1)
            .attr("height", cellSize - 1)
            .attr("x", i => timeWeek.count(d3.utcYear(dates[i]), dates[i]) * cellSize + 0.5)
            .attr("y", i => countDay(dates[i].getUTCDay()) * cellSize + 0.5)
            .attr("fill", i => color(values[i]));

        if (title) cell.append("title")
            .text(title);

        const month = year.append("g")
          .selectAll("g")
          .data(([, dateRange]) => d3.utcMonths(d3.utcMonth(dates[dateRange[0]]), dates[dateRange[dateRange.length - 1]]))
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

        return Object.assign(svg.node(), {scales: {color}});
    };



   //**************************************************************************
   //** Utils
   //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.chart.utils.initChart;


    init();

};