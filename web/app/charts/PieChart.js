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
        pieKey: "key",
        pieValue: "value",
        pieLabels: true,
        pieCutout: 0.65,
        labelOffset: 100        
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


          //Sort values as needed
            var pieSort = chartConfig.pieSort;
            pieSort = (pieSort+"").toLowerCase();
            if (pieSort === "key") {
                data.sort(function(a, b){
                    return sort(a[chartConfig.pieKey],b[chartConfig.pieKey],chartConfig.pieSortDir);
                });
            }
            else if(pieSort === "value") {
                data = data.sort(function(a,b){
                    a = parseFloat(a[chartConfig.pieValue]);
                    b = parseFloat(b[chartConfig.pieValue]);
                    return sort(a,b,chartConfig.pieSortDir);
                });
            }


            
          //Truncate data as needed
            var maxSlices = parseFloat(chartConfig.maximumSlices);
            if (!isNaN(maxSlices) && maxSlices>0) {
                

                var numSlices = data.length;
                if (maxSlices<numSlices){
                
                    if (chartConfig.showOther === true) {
                        //Show Others
                        var otherSlicesValue = data.slice(maxSlices).map(entry => entry[chartConfig.pieValue]).reduce((prev, next) => parseFloat(prev) + parseFloat(next));
                        var otherSlicesEntry = {[chartConfig.pieKey]: "Other", [chartConfig.pieValue]: otherSlicesValue};
                        data = data.slice(0, maxSlices).concat(otherSlicesEntry);
                    } else {
                        //Truncate after max slice
                        data = data.slice(0, maxSlices);
                    }
                }
            }




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


            var tooltip = d3.select(parent)
              .append("div")
              .style("opacity", 0)
              .attr("class", "tooltip")
              
            var mouseover = function (d) {
              tooltip
                .style("opacity", 1)
                .style("display", "block");

                d3.select(this).transition().duration(100).attr("opacity", "0.8")
            };

            var mousemove = function (d) {
              tooltip
                .html(d.value)
                .style('top', (d3.event.layerY) + "px")
			          .style('left', (d3.event.layerX + 20) + "px");
            };

            var mouseleave = function (d) {
              tooltip
                .style("opacity", 0)
                .style("display", "none");

                d3.select(this).transition().duration(100).attr("opacity", "1")
            };


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
                .on("mouseover", mouseover)
                .on("mousemove", mousemove)
                .on("mouseleave", mouseleave);



            if (chartConfig.pieLabels===null) chartConfig.pieLabels = true;
            if (chartConfig.pieLabels===true && pieData[0].data.key !== "undefined" && !isNaN(pieData[0].value)){

                chartConfig.labelOffset = parseFloat(chartConfig.labelOffset);
                if (isNaN(chartConfig.labelOffset) || chartConfig.labelOffset<0) chartConfig.labelOffset = 100;


                var labelStart = radius - ((radius-innerRadius)*0.1);
                var labelEnd = radius * 1.2;

                var labelArea = innerRadius + (radius - innerRadius) * chartConfig.labelOffset/50;

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
                let endPoints = [];
                lineGroup.attr("name", "lines");
                lineGroup.selectAll("*")
                  .data(pieData)
                  .enter()
                  .append("polyline")
                  .attr("stroke", "black")
                  .style("fill", "none")
                  .attr("stroke-width", 1)
                  .attr("points", function (d) {

                  var firstArc = d3.arc().innerRadius(innerRadius).outerRadius(innerRadius + (radius - innerRadius) * 90/50);
                  var breakArc = d3.arc().innerRadius(innerRadius).outerRadius(innerRadius + (radius - innerRadius) * (chartConfig.labelOffset)/50);

                  var posA = firstArc.centroid(d);
                  var posB = breakArc.centroid(d);
                  var posC = newArc.centroid(d);


                  endPoints.forEach((val) => {
                    if (posC[1] < val + 5 && posC[1] > val - 5) {
                      posC[1] -= 14;
                      posB[1] -= 14;
                    }
                  });


                  endPoints.push(posC[1]);

                  var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2; // we need the angle to see if the X position will be at the extreme right or extreme left
                  posC[0] = labelArea * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left


                  return [posA, posB, posC];
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
                    if (parseInt(chartConfig.labelOffset) > 100) {
                        var pos = newArc.centroid(d);
                        positions.forEach((val) => {
                          if (pos[1] < val + 5 && pos[1] > val - 5) {
                            pos[1] -= 14;
                          }
                        });
                        positions.push(pos[1]);

                        var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                        pos[0] = labelArea * (midangle < Math.PI ? 1 : -1);


                        return "translate(" + pos + ")";
                    }
                    return "translate(" + newArc.centroid(d) + ")";

                  })
                  .style("text-anchor", function (d) {
                   if (parseInt(chartConfig.labelOffset) > 100) {
                      var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                      return midangle < Math.PI ? "start" : "end";
                   }

                    return "middle";
                  });


              //Update pieChart as needed
                var box = pieArea.node().getBBox();
                if (box.width>width || box.height>height){
                    var scale, x, y;
                    var widthDiff = box.width - width;
                    var heightDiff = box.height - height;

                    if (widthDiff > heightDiff){
                        scale = width/box.width;
                        if (scale>1){
                            scale = 1+(1-scale);
                        }
                        x = width/2; //needs to be updated...
                        y = height/2;
                    }
                    else if (heightDiff > widthDiff) {
                        scale = height/box.height;
                        x = width/2;
                        y = (box.height); //not quite right...
                    }


                  //Apply scaling and position
                    pieChart
                      .attr("transform",
                        "translate(" + x + "," + y + ") " +
                        "scale(" + scale + ")"
                    );

                  //Update position
                    var dy = javaxt.dhtml.utils.getRect(parent).y - javaxt.dhtml.utils.getRect(pieChart.node()).y;
                    var dx = javaxt.dhtml.utils.getRect(parent).x - javaxt.dhtml.utils.getRect(pieChart.node()).x;
                    
                    pieChart
                      .attr("transform",
                        // "translate(" + (x) + "," + (y+dy) + ") " +
                        "translate(" + (x+dx) + "," + (y+dy) + ") " +
                        "scale(" + scale + ")"
                    );

                }
            }
        });
    };


  //**************************************************************************
  //** sort
  //**************************************************************************
    var sort = function(x, y, sortDir){

        var compareStrings = (typeof x === "string" && typeof y === "string");

        sortDir = (sortDir+"").toLowerCase();
        if (sortDir === "descending") {
            if (compareStrings) return y.localeCompare(x);
            else return y-x;
        }
        else{
            if (compareStrings) return x.localeCompare(y);
            else return x-y;
        }
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var isArray = javaxt.dhtml.utils.isArray;
    var initChart = bluewave.chart.utils.initChart;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());

    init();
};