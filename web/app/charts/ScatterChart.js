if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  ScatterChart
//******************************************************************************
/**
 *   Panel used to create scatter charts
 *
 ******************************************************************************/

bluewave.charts.ScatterChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        },
        links: {
            color: "#ccc",
            opacity: 0.3
        }
    };
    var svg, scatterArea;


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
        }

        scatterArea = svg.append("g");
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        scatterArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();

        if (!data) return;

        if (chartConfig){
            if (chartConfig.margin) config.margin = chartConfig.margin;
            if (chartConfig.links) config.links = chartConfig.links;
        }


        var margin = config.margin;
        scatterArea.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        onRender(svg.node().parentNode, function(){

            var width = parent.offsetWidth;
            var height = parent.offsetHeight;
            svg.attr("width", width);



          //Update width and height for the scatter
            width = width - margin.left - margin.right;
            height = height - margin.top - margin.bottom;


          // Add X axis

          var x = d3.scaleLinear()
          .domain([0, 3000])
          .range([0, width]);

          svg.append("g")
             .attr("transform", "translate(0," + height + ")")
             .call(d3.axisBottom(x));

          // Add Y axis
            var y = d3.scaleLinear()
              .domain([0, 400000])
              .range([ height, 0]);
            svg.append("g")
              .call(d3.axisLeft(y));




           // Add dots
             svg.append('g')
               .selectAll("dot")
               .data(data) // the .filter part is just to keep a few dots on the chart, not all of them
               .enter()
               .append("circle")
                 .attr("cx", function (d) { return x(d.GrLivArea); } )
                 .attr("cy", function (d) { return y(d.SalePrice); } )
                 .attr("r", 7)
                 .style("fill", "#69b3a2")
                 .style("opacity", 0.3)
                 .style("stroke", "white")
//               .on("mouseover", mouseover )
//               .on("mousemove", mousemove )
//               .on("mouseleave", mouseleave )

          //Create function to colorize categorical data
            var getColor = d3.scaleOrdinal(d3.schemeCategory10);

        });
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;

    init();
};