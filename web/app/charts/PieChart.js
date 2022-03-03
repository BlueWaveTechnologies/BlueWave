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
        pieCutout: 0.65,
        showLabels: true,
        labelOffset: 100,
        lineColor: "#777",
        extendLines: false,
        colors: ["#6699cc","#f8f8f8"], //start->end
        colorScaling: "linear",
        otherColor: "#b8b8b8",
        animationSteps: 1500
    };
    var svg, pieArea;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        me.setConfig(config);

        initChart(parent, function(s, g){
            svg = s;
            pieArea = g;
        });
    };


  //**************************************************************************
  //** setConfig
  //**************************************************************************
    this.setConfig = function(chartConfig){
        if (!chartConfig) config = defaultConfig;
        else config = merge(chartConfig, defaultConfig);
    };


  //**************************************************************************
  //** getTooltipLabel
  //**************************************************************************
    this.getTooltipLabel = function(d){
        return d.key + "<br/>" + d.value;
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
        me.setConfig(chartConfig);


        var parent = svg.node().parentNode;
        onRender(parent, function(){
            update(data, parent);
        });
    };

    var update = function(data, parent){

        if (isArray(data) && isArray(data[0])) data = data[0];
        if (!config.pieKey || !config.pieValue) return;

      //Sort values as needed
        var pieSort = config.pieSort;
        pieSort = (pieSort+"").toLowerCase();
        var sortDir = (config.pieSortDir+"").toLowerCase();
        if (pieSort === "key") {
            data.sort(function(a, b){
                return sort(a[config.pieKey],b[config.pieKey],sortDir);
            });
        }
        else if(pieSort === "value") {
            data = data.sort(function(a,b){
                a = parseFloat(a[config.pieValue]);
                b = parseFloat(b[config.pieValue]);
                return sort(a,b,sortDir);
            });
        }



      //Truncate data as needed
        var numSlices = data.length;
        var maxSlices = parseFloat(config.maximumSlices);
        var hasOther = false;
        if (!isNaN(maxSlices) && maxSlices>0) {
            if (maxSlices<numSlices){

                var otherSlices;
                if (sortDir==="descending"){
                    otherSlices = data.slice(maxSlices);
                    data = data.slice(0, maxSlices);
                }
                else{
                    otherSlices = data.slice(0, numSlices-maxSlices);
                    data = data.slice(numSlices-maxSlices, numSlices);
                }

                if (config.showOther===true){

                    var otherSlicesValue = 0;
                    otherSlices.forEach(function(d){
                        var val = parseFloat(d[config.pieValue]);
                        if (!isNaN(val)) otherSlicesValue+=val;
                    });

                    data.push({[config.pieKey]: "Other", [config.pieValue]: otherSlicesValue});
                    hasOther = true;
                }

                numSlices = data.length;
            }
        }



        let pieData = data.reduce((acc,curVal)=>{
            acc[curVal[config.pieKey]] = curVal[config.pieValue];
            return acc;
        },{});

        var padding = 0;
        if (typeof config.piePadding !== "undefined") {
            padding = config.piePadding * Math.PI / 180;

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
        var cutout = config.pieCutout;
        if (cutout==null) cutout = 0.65;
        var innerRadius = radius*cutout;


        var tooltip;
        if (config.showTooltip===true){
            tooltip = createTooltip();
        }


        var mouseover = function(d) {
            if (tooltip){
                var label = me.getTooltipLabel(d.data);
                tooltip.html(label).show();
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
            if (tooltip) tooltip.hide();
            d3.select(this).transition().duration(100).attr("opacity", "1");
        };



      //Get color config
        var colors = config.colors;
        if (!colors) colors = ["#6699cc","#f8f8f8"];
        var colorScaling = config.colorScaling;
        if (!colorScaling) colorScaling = "linear";
        var otherColor = config.otherColor;
        if (!otherColor) otherColor = "#b8b8b8";


      //Create function to create fill colors
        var getColor;
        if (colorScaling==="linear"){
            var maxColors = numSlices-(hasOther?2:1);
            getColor = d3.scaleLinear().domain([0,maxColors]).range(colors);
        }
        else if (colorScaling==="ordinal"){
            getColor = d3.scaleOrdinal(colors);
        }


        var arc = d3.arc()
         .innerRadius(innerRadius)
         .outerRadius(radius);

      //Render pie chart
        var pieGroup = pieChart.append("g");
        pieGroup.attr("name", "pie");
        pieGroup.selectAll("*")
        .data(pieData)
        .enter()
        .append("path")
        .attr("d", arc)
        .attr("fill", function (d,i) {
            if (hasOther && i==numSlices-1){
                return otherColor;
            }
            return getColor(i);
        })
        .attr("stroke", "#777")
        .style("stroke-width", "1px")
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);


      //Render lines and labels as needed
        var showLabels = config.showLabels===true ? true : false;
        if (showLabels && pieData[0].data.key !== "undefined" && !isNaN(pieData[0].value)){

            var labelOffset = parseFloat(config.labelOffset);
            if (isNaN(labelOffset) || labelOffset<0) labelOffset = 100;
            var labelEnd = 0;
            if (labelOffset>100){
                labelEnd = radius * (labelOffset/100);
            }
            else{
                var w = radius-innerRadius;
                labelEnd = innerRadius + w*(labelOffset/100);
            }

            var extendLines = config.extendLines===true ? true : false;
            if (extendLines && labelOffset<=110) extendLines = false;


          //Create donut used to define the start of the lines
            var firstArc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(innerRadius + (radius - innerRadius) * 90/50);


          //Create donut used to define the second point on the lines. If
          //we're extending lines, this will be used to define the midpoint
          //of the lines. Otherwise, this will be used to define the end of
          //the lines.
            var secondArc = d3.arc()
            .innerRadius(radius)
            .outerRadius(radius+((labelEnd-radius)*2)); //side thickness 2x larger than the labelOffset


          //Debugging code used to render labelOffset
            var debug = false;
            if (debug){
                var testGroup = pieChart.append("g").attr("name", "test");
                testGroup.selectAll("*")
                .data([{
                    startAngle: 0,
                    endAngle: 360*Math.PI/180
                }])
                .enter()
                .append("path")
                .attr("d", d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(labelEnd))
                .attr("fill", "none")
                .attr("stroke", "#ff0000")
                .attr("stroke-width", 1);
            }



          //Add the polylines between chart and labels
            let endPoints = [];
            var lineGroup = pieChart.append("g");
            lineGroup.attr("name", "lines");
            lineGroup.selectAll("*")
            .data(pieData)
            .enter()
            .append("polyline")
            .attr("opacity", "0")
            .attr("stroke", config.lineColor)
            .style("fill", "none")
            .attr("stroke-width", 1)
            .attr("points", function(d) {

              //Create line
                var a = firstArc.centroid(d);
                var b = secondArc.centroid(d);
                var line = [a, b];


              //Check angle to see if the X position is right or left
                var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                var isRight = (midangle < Math.PI ? true : false);


              //Add 3rd coordinate as needed
                if (extendLines){
                    line.push([
                        labelEnd * (isRight ? 1 : -1), //x coordinate
                        b[1] //y coordinate
                    ]);
                }


              //Update endPoints
                endPoints.push(line[line.length-1]);

                return line;
            });

            if (labelOffset > 110) {
                lineGroup.selectAll("polyline").attr("opacity", "1");
            }


          //Add the labels
            var labelGroup = pieChart.append("g");
            labelGroup.attr("name", "labels");
            labelGroup.selectAll("*")
            .data(pieData)
            .enter()
            .append("text")
            .text(function(d) {
                return d.data.key;
            })
            .attr("transform", function (d, i) {
                return "translate(" + endPoints[i] + ")";
            })
            .style("text-anchor", function(d, i) {
                if (i==numSlices-1 && !extendLines){
                    return "middle";
                }
                else{
                    var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                    return midangle < Math.PI ? "start" : "end";
                }
            });



          //Get dimension of all the elements in the chart
            var box = getMinMax(pieArea);
            box.width = (box.maxX - box.minX)*1.1;
            box.height = (box.maxY - box.minY)*1.1;




          //Update pieChart scale and position as needed
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
                var rect = javaxt.dhtml.utils.getRect(parent);
                var y = rect.y;
                var x = rect.x;
                var cx = rect.x+(rect.width/2);
                var cy = rect.y+(rect.height/2);

                var rect = javaxt.dhtml.utils.getRect(pieChart.node());
                var dy = (height - rect.height)/2;
                var dx = (width - rect.width)/2;


                var x2 = rect.x+(rect.width/2);
                var y2 = rect.y+(rect.height/2);

                var dx = cx-x2;
                var dy = cy-y2;



                //console.log(cx, x2, dx, width/2);
                //console.log(cy, y2, dy, height/2);

                if (dy<0){
                    dy = 0; //seems to work - not sure why
                }

                if (dx<0){
                    dx = 0; //not tested
                }


                pieChart
                  .attr("transform",
                    "translate(" + ((width/2)+dx) + "," + ((height/2)+dy) + ") " +
                    "scale(" + scale + ")"
                );

            }

        };

        //Add animations
        var animationSteps = config.animationSteps;
        if (!isNaN(animationSteps) && animationSteps > 50) {

          var totalDelay = 0;
          animationSteps /= 2;
          var arcs = pieGroup.selectAll("path");


          var zeroaArc = d3.arc()
         .innerRadius(0)
         .outerRadius(0);
         //Reset arcs
          arcs.attr("d", zeroaArc);

          arcs
            .transition().delay(function (d, i) {
              var angleDiff = Math.abs(d.startAngle - d.endAngle) + (d.padAngle);
              var angleRatio = angleDiff / (2 * Math.PI);

              var thisDelay = totalDelay;
              var nextDelay = angleRatio * animationSteps;

              totalDelay += nextDelay ;

              return thisDelay;
            })
            .duration(function (d) {
              var angleDiff = Math.abs(d.startAngle - d.endAngle) + (d.padAngle);
              var angleRatio = angleDiff / (2 * Math.PI);
              return angleRatio * animationSteps;
            })
            .ease(d3.easeLinear)
            .attrTween('d', function (d) {

              var interpolater = d3.interpolate(d.startAngle, d.endAngle);
              return function (t) {
                d.endAngle = interpolater(t);
                return arc(d);
              }
            });

            if(showLabels){

              var labels = labelGroup.selectAll("text");
              var polylines = lineGroup.selectAll("polyline");

              //Reset opacity for lines and labels to 0 for transition
              polylines.attr("opacity", 0);
              labels.attr("opacity", 0);

              var delayTransition = function(d, i){
                return i*animationSteps/numSlices;
              }

              //All the coordinates for the labels and polylines are in endPoints, so we can do any positioning transition I think
              polylines.transition()
                .delay(delayTransition)
                .duration(animationSteps)
                .attr("opacity", 1);

              labels.transition()
                .delay(delayTransition)
                .duration(animationSteps)
                .attr("opacity", 1);
            }


        };




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
  //** getMinMax
  //**************************************************************************
    var getMinMax = function(g){
        var minX = Number.MAX_VALUE;
        var maxX = 0;
        var minY = Number.MAX_VALUE;
        var maxY = 0;
        g.selectAll("*").each(function(){
            var rect = javaxt.dhtml.utils.getRect(d3.select(this).node());
            minX = Math.min(rect.left, minX);
            maxX = Math.max(rect.right, maxX);
            minY = Math.min(rect.top, minY);
            maxY = Math.max(rect.bottom, maxY);
        });
        return {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY
        };
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var isArray = javaxt.dhtml.utils.isArray;
    var initChart = bluewave.chart.utils.initChart;
    var createTooltip = bluewave.chart.utils.createTooltip;

    init();
};