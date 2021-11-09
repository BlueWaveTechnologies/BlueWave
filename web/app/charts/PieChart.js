if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  PieChart
//******************************************************************************
/**
 *   Panel used to create pie charts
 *
 ******************************************************************************/

bluewave.charts.PieChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
    };
    var svg, pieArea;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        config = merge(config, defaultConfig);

        initChart(parent, function(s, g){
            svg = s;
            pieArea = g;
        });
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (pieArea){
            pieArea.node().innerHTML = "";
            pieArea.attr("transform", null);
        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();

        var parent = svg.node().parentNode;
        onRender(parent, function(){


            if (isArray(data) && isArray(data[0])) data = data[0];


            let pieData = data.reduce((acc,curVal)=>{
                acc[curVal[chartConfig.pieKey]] = curVal[chartConfig.pieValue];
                return acc;
            },{});

            var padding = 0;
            if (typeof chartConfig.piePadding !== "undefined") {
                padding = chartConfig.piePadding * Math.PI / 180;

            }

            var pie = d3.pie().value(function (d) {
                return d.value;
            })
            .sort(null)
            .padAngle(padding);



            pieData = pie(d3.entries(pieData));

          //Get parent width/height
            var width = parent.offsetWidth;
            var height = parent.offsetHeight;



          //Create group to store all the elements of the pie chart
            var pieChart = pieArea.append("g");
            pieChart.attr("transform",
                "translate(" + width/2 + "," + height/2 + ")"
            );


          //Compute inner and outer radius for the pie chart
            var radius = Math.min(width, height) / 2;
            var cutout = chartConfig.pieCutout;
            if (cutout==null) cutout = 0.65;
            var innerRadius = radius*cutout;



          //Render pie chart
            var pieGroup = pieChart.append("g");
            pieGroup.attr("name", "pie");
            pieGroup.selectAll("*")
                .data(pieData)
                .enter()
                .append("path")
                .attr("d", d3.arc()
                    .innerRadius(innerRadius)
                    .outerRadius(radius))
                .attr("fill", function (d) {
                    return getColor(d.data.key);
                })
                .attr("stroke", "#777")
                .style("stroke-width", "1px")
                .style("opacity", 0.7);



            if (chartConfig.pieLabels===null) chartConfig.pieLabels = true;
            if (chartConfig.pieLabels===true && pieData[0].data.key !== "undefined" && !isNaN(pieData[0].value)){


                var labelStart = radius - ((radius-innerRadius)*0.1);
                var labelEnd = radius * 1.2;

                var labelArea = radius;
                if (chartConfig.labelOffset <= 100) {
                labelArea = labelArea + (chartConfig.labelOffset - 50) * 1.3;
                } else {
                labelArea = labelArea + (chartConfig.labelOffset - 50) * 2.5;
                }

                var innerArc = d3.arc()
                  .innerRadius(labelStart)
                  .outerRadius(labelStart);

                var outerArc = d3.arc()
                  .innerRadius(labelEnd)
                  .outerRadius(labelEnd);

                var centerArc = d3.arc()
                  .innerRadius(innerRadius)
                  .outerRadius(radius);

                var insideArc = d3.arc()
                  .innerRadius(innerRadius)
                  .outerRadius(radius/2);

                var newArc = d3.arc()
                  .innerRadius(innerRadius)
                  .outerRadius(labelArea);


              //Add the polylines between chart and labels:
              if (parseInt(chartConfig.labelOffset) > 100) {
                var lineGroup = pieChart.append("g");
                lineGroup.attr("name", "lines");
                lineGroup.selectAll("*")
                  .data(pieData)
                  .enter()
                  .append("polyline")
                  .attr("stroke", "black")
                  .style("fill", "none")
                  .attr("stroke-width", 1)
                  .attr("points", function (d) {

                    var firstArc = d3.arc().innerRadius(innerRadius).outerRadius(radius +50 *1.3);
                    var endArc;
                    if (chartConfig.labelOffset <= 100) {
                        endArc = d3.arc().innerRadius(innerRadius).outerRadius(radius + (chartConfig.labelOffset-50) * 1.3);
                    } else {
                        endArc = d3.arc().innerRadius(innerRadius).outerRadius(radius + (chartConfig.labelOffset-50) * 2.5);
                    }

                    var posA = firstArc.centroid(d);
                    var posB = endArc.centroid(d);

                    return [posA, posB];
                  });
              }


              //Add the labels:
                var positions = [];
                var labelGroup = pieChart.append("g");
                labelGroup.attr("name", "labels");
                labelGroup.selectAll("*")
                  .data(pieData)
                  .enter()
                  .append("text")
                  .text(function (d) {
                      return d.data.key;
                  })
                  .attr("transform", function (d) {
                    return "translate(" + newArc.centroid(d) + ")";

                  })
                  .style("text-anchor", function (d) {
                    return "middle";
                  });


              //Update pieChart as needed
                var box = pieArea.node().getBBox();
                if (box.width>width || box.height>height){
                    var scale, x, y;
                    if (box.width> width){
                        scale = width/box.width;
                        if (scale>1){
                            scale = 1+(1-scale);
                        }
                        x = width/2; //needs to be updated...
                        y = height/2;
                    }
                    else {
                        scale = height/box.height;
                        x = width/2;
                        y = (box.height+box.y); //not quite right...
                    }


                  //Apply scaling and position
                    pieChart
                      .attr("transform",
                        "translate(" + x + "," + y + ") " +
                        "scale(" + scale + ")"
                    );


                  //Update position
                    var d = javaxt.dhtml.utils.getRect(parent).y - javaxt.dhtml.utils.getRect(pieChart.node()).y;
                    pieChart
                      .attr("transform",
                        "translate(" + x + "," + (y+d) + ") " +
                        "scale(" + scale + ")"
                    );

                }
            }
        });
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var isArray = javaxt.dhtml.utils.isArray;
    var initChart = bluewave.utils.initChart;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());

    init();
};