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
            top: 15,
            right: 5,
            bottom: 65,
            left: 82
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

        pieArea = svg.append("g");
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

        //TODO: Make sure data is not an array of arrays

        let pieData = data.reduce((acc,curVal)=>{
            acc[curVal[chartConfig.pieKey]] = curVal[chartConfig.pieValue];
            return acc;
        },{});


        var pie = d3.pie().value(function (d) {
            return d.value;
        });
        pieData = pie(d3.entries(pieData));


        var margin = config.margin;
        var previewArea = svg.node().parentNode;


        var width = previewArea.offsetWidth;
        var height = previewArea.offsetHeight;
        var radius =
            Math.min(width, height) / 2 -
            margin.left -
            margin.right;
        radius = radius*1.2;


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
        var pieChart = pieArea.append("g");

        pieChart
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



        if (chartConfig.pieLabels==null) chartConfig.pieLabels = true;
        if (chartConfig.pieLabels===true){

          //Another arc that won't be drawn. Just for labels positioning
            var outerArc = d3
              .arc()
              .innerRadius(radius * 0.9)
              .outerRadius(radius * 0.9);


          //Add the polylines between chart and labels:
            let cPositions = [];
            var lines = pieArea.append("g");
            lines
              .selectAll("allPolylines")
              .data(pieData)
              .enter()
              .append("polyline")
              .attr("stroke", "black")
              .style("fill", "none")
              .attr("stroke-width", 1)
              .attr("points", function (d) {
                var posA = arc.centroid(d); // line insertion in the slice
                var posB = outerArc.centroid(d); // line break: we use the other arc generator that has been built only for that
                var posC = outerArc.centroid(d); // Label position = almost the same as posB
                cPositions.forEach((val) => {
                  if (posC[1] < val + 5 && posC[1] > val - 5) {
                    posC[1] -= 14;
                    posB[1] -= 14;
                  }
                });
                cPositions.push(posC[1]);
                var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2; // we need the angle to see if the X position will be at the extreme right or extreme left
                posC[0] = radius * 0.95 * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left
                return [posA, posB, posC];
              });


          //Add the polylines between chart and labels:
            var positions = [];
            var labels = pieArea.append("g");
            labels
              .selectAll("allLabels")
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
                pos[0] = radius * 0.99 * (midangle < Math.PI ? 1 : -1);
                return "translate(" + pos + ")";
              })
              .style("text-anchor", function (d) {
                var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
                return midangle < Math.PI ? "start" : "end";
              });
        }
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