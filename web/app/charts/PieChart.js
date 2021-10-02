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
        margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    };
    var svg, pieArea;


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
            onRender(parent, function(){
                var width = parent.offsetWidth;
                var height = parent.offsetHeight;
                svg.attr("width", width);
                svg.attr("height", height);
            });
        }

        pieArea = svg.append("g").append("g");
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (pieArea) pieArea.selectAll("*").remove();
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


            var pie = d3.pie().value(function (d) {
                return d.value;
            });
            pieData = pie(d3.entries(pieData));


            var margin = config.margin;
            var width = parent.offsetWidth;
            var height = parent.offsetHeight;
            var radius = Math.min(width, height) / 2;
            if (width>=height){
                radius = radius - margin.left - margin.right;
            }
            else{
                radius = radius - margin.top - margin.bottom;
            }


            var cutout = chartConfig.pieCutout;
            if (cutout==null) cutout = 0.65;
            var innerRadius = radius*cutout;
            var arc = d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(radius);

            pieArea
                .attr("width", width)
                .attr("height", height)
                .attr(
                    "transform",
                    "translate(" + width/2 + "," + height/2 + ")"
                );


            pieArea.append("g")
                .selectAll("whatever")
                .data(pieData)
                .enter()
                .append("path")
                .attr("d", arc)
                .attr("fill", function (d) {
                    return getColor(d.data.key);
                })
                .attr("stroke", "#777")
                .style("stroke-width", "1px")
                .style("opacity", 0.7);



            if (chartConfig.pieLabels===null) chartConfig.pieLabels = true;
            if (chartConfig.pieLabels===true){


                var labelStart = radius - ((radius-innerRadius)*0.2);
                var labelEnd = radius * 1.2;

                var innerArc = d3.arc()
                  .innerRadius(labelStart)
                  .outerRadius(labelStart);

                var outerArc = d3.arc()
                  .innerRadius(labelEnd)
                  .outerRadius(labelEnd);



              //Add the polylines between chart and labels:
                let endPoints = [];
                var lineGroup = pieArea.append("g");
                lineGroup.selectAll("*")
                  .data(pieData)
                  .enter()
                  .append("polyline")
                  .attr("stroke", "black")
                  .style("fill", "none")
                  .attr("stroke-width", 1)
                  .attr("points", function (d) {
                    var posA = innerArc.centroid(d); //line start
                    var posB = outerArc.centroid(d); //line break (will be adjusted below)
                    var posC = outerArc.centroid(d); //line end (will be adjusted below)

                    endPoints.forEach((val) => {
                      if (posC[1] < val + 5 && posC[1] > val - 5) {
                        posC[1] -= 14;
                        posB[1] -= 14;
                      }
                    });


                    endPoints.push(posC[1]);

                    var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2; // we need the angle to see if the X position will be at the extreme right or extreme left
                    posC[0] = labelEnd * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left
                    return [posA, posB, posC];
                  });


              //Add the polylines between chart and labels:
                var positions = [];
                var labelGroup = pieArea.append("g");
                labelGroup.attr("name", "labels");
                labelGroup.selectAll("*")
                  .data(pieData)
                  .enter()
                  .append("text")
                  .text(function (d) {
                      return d.data.key;
                  })
                  .attr("transform", function (d) {
                    var pos = outerArc.centroid(d);
                    positions.forEach((val) => {
                      if (pos[1] < val + 5 && pos[1] > val - 5) {
                        pos[1] -= 14;
                      }
                    });
                    positions.push(pos[1]);

                    var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                    pos[0] = labelEnd * (midangle < Math.PI ? 1 : -1);
                    return "translate(" + pos + ")";
                  })
                  .style("text-anchor", function (d) {
                    var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                    return midangle < Math.PI ? "start" : "end";
                  });


              //Update pieArea as needed
                var box = labelGroup.node().getBBox();
                if (box.width>width || box.height>height){
                    var scale, x, y;
                    if (box.width>=box.height){
                        scale = width/box.width;
                        x = width/2; //needs to be updated...
                        y = height/2;
                    }
                    else{
                        scale = height/box.height;
                        x = width/2;
                        y = box.height-height; //not sure about this...
                    }

                    pieArea
                      .attr("width", box.width)
                      .attr("height", box.height)
                      .attr("transform",
                        "translate(" + x + "," + y + ") " +
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
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());

    init();
};