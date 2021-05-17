if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  SankeyChart
//******************************************************************************
/**
 *   Panel used to create sankey charts
 *
 ******************************************************************************/

bluewave.charts.SankeyChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
        }
    };
    var svg, sankeyArea;


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

        sankeyArea = svg.append("g");
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        sankeyArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(data){
        me.clear();

        var margin = config.margin;

        sankeyArea.attr("transform", "translate(" + margin.left + "," + margin.top + ")");


        console.log(svg.attr("width"));

      //Update width and height for the sankey
        var width = svg.attr("width") - margin.left - margin.right;
        var height = svg.attr("height") - margin.top - margin.bottom;

        var sankey = d3
          .sankey()
          .nodeId((d) => d.name)
          .nodeWidth(20)
          .nodePadding(20)
          .iterations([6])
          .size([width, height]);



        let graph = sankey(data);
        var size = sankey.size();
        var width = size[0];

        var formatNumber = d3.format(",.0f"); // zero decimal places


      //Add the nodes
        var node = sankeyArea
          .append("g")
          .selectAll(".node")
          .data(graph.nodes)
          .enter()
          .append("g")
          .attr("class", "sankey-node");


      //Add the rectangles for the nodes
        node
          .append("rect")
          .attr("x", function (d) {
            return d.x0;
          })
          .attr("y", function (d) {
            return d.y0;
          })
          .attr("height", function (d) {
            return d.y1 - d.y0;
          })
          .attr("width", sankey.nodeWidth())
          .style("fill", function (d) {
            return (d.color = getColor(d.name.replace(/ .*/, "")));
          })
          .style("stroke", function (d) {
            return d3.rgb(d.color).darker(2);
          })
          .append("title")
          .text(function (d) {
            return d.name + "\n" + formatNumber(d.value);
          });




      //Add the links
        var link = sankeyArea
          .append("g")
          .selectAll(".link")
          .data(graph.links)
          .enter()
          .append("path")
          .attr("class", "sankey-link")
          .attr("d", d3.sankeyLinkHorizontal())
          .attr("stroke-width", function (d) {
            return d.width;
          })
          .style("stroke-opacity", function (d) {
            return (d.opacity=0.3);
          })
          .style("stroke", function (d) {
            return d.source.color;
          })
          .on('mouseover', function(d){
            d3.select(this).style("stroke-opacity", 0.6);
          })
          .on('mouseout', function(d){
            d3.select(this).style("stroke-opacity", d.opacity);
          });



      //Add link labels
        link.append("title").text(function (d) {
          return d.source.name + " → " + d.target.name + "\n" + formatNumber(d.value);
        });



      //Add node labels
        node
          .append("text")
          .attr("x", function (d) {
            return d.x0 - 6;
          })
          .attr("y", function (d) {
            return (d.y1 + d.y0) / 2;
          })
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .text(function (d) {
            return d.name;
          })
          .filter(function (d) {
            return d.x0 < width / 2;
          })
          .attr("x", function (d) {
            return d.x1 + 6;
          })
          .attr("text-anchor", "start");

    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());

    init();
};