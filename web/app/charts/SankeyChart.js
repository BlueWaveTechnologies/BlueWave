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
        },
        links: {
            color: "#ccc",
            opacity: 0.3
        }
    };
    var svg, chart, sankeyArea;
    var nodes = [];
    var links = [];
    var getColor = d3.scaleOrdinal(d3.schemeCategory10);
    

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        me.setConfig(config);

        initChart(parent, function(s, g){
            svg = s;
            chart = g;
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
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return sankeyArea;
    };


  //**************************************************************************
  //** getNodeColor
  //**************************************************************************
    this.getNodeColor = function(d){
        return getColor(d.name.replace(/ .*/, ""));
    };


  //**************************************************************************
  //** getNodeLabel
  //**************************************************************************
    this.getNodeLabel = function(d){
        return d.name;
    };


  //**************************************************************************
  //** addNode
  //**************************************************************************
    this.addNode = function(name, group){
        if (!name) return;
        var node;
        if (name.name) node = name;
        else node = {
            name: name,
            group: group
        };
        nodes.push(node);
        return node;
    };


  //**************************************************************************
  //** addLink
  //**************************************************************************
    this.addLink = function(source, target, value){
        if (!source || !target) return;
        if (source.name) source = source.name;
        if (target.name) target = target.name;
        var link = {
            source: source,
            target: target,
            value: value
        };
        links.push(link);
        return link;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        clearChart();
        nodes = [];
        links = [];
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        //me.clear();
        me.setConfig(chartConfig);

        if (data){
            me.clear();
            if (data.nodes){
                nodes = data.nodes;
            }
            if (data.links){
                links = data.links;
            }
        }


        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(parent);
        });
    };


  //**************************************************************************
  //** clearChart
  //**************************************************************************
    var clearChart = function(){
        if (chart) chart.selectAll("*").remove();
    };


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(parent){
        clearChart();


        var width = parent.offsetWidth;
        var height = parent.offsetHeight;
        sankeyArea = chart.append("g");
        sankeyArea
            .attr("name", "sankey")
            .attr("width", width)
            .attr("height", height);



      //Create sankey
        var sankey = d3
          .sankey()
          .nodeId((d) => d.name)
          .nodeWidth(20)
          .nodePadding(20)
          .iterations([6])
          .size([width, height]);


      //Add nodes and links to the sankey
        let graph = sankey({
            nodes: nodes,
            links: links
        });


        var size = sankey.size();
        var width = size[0];

        var formatNumber = d3.format(",.0f"); // zero decimal places






      //Add the links
        var linkGroup = sankeyArea.append("g");
        linkGroup.attr("name", "links");

        var link = linkGroup.selectAll("*")
          .data(graph.links)
          .enter()
          .append("path")
          .attr("class", "sankey-link")
          .attr("d", d3.sankeyLinkHorizontal())
          .attr("stroke-width", function (d) {
            return Math.max(d.width, 1);
          })
          .style("stroke-opacity", function (d) {
            return (d.opacity=config.links.opacity);
          })
          .style("stroke", function (d) {
              return config.links.color;
          })
          .on('mouseover', function(d){
              var opacity = Math.min(1, config.links.opacity*1.3);
              d3.select(this).style("stroke-opacity", opacity);
          })
          .on('mouseout', function(d){
            d3.select(this).style("stroke-opacity", d.opacity);
          });



      //Add the nodes
        var nodeGroup = sankeyArea.append("g");
        nodeGroup.attr("name", "nodes");

        var node = nodeGroup.selectAll("*")
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
              return Math.max(d.y1 - d.y0, 1);
          })
          .attr("width", sankey.nodeWidth())
          .style("fill", function (d) {
            return (d.color = me.getNodeColor(d));
          })
          .style("stroke", function (d) {
            return d3.rgb(d.color).darker(2);
          })
          .append("title")
          .text(function (d) {
            return d.name + "\n" + formatNumber(d.value);
          });




      //Update link color AFTER node color is set
        if (config.links.color==="source"){
            link.each(function() {
                var path = d3.select(this);
                path.style("stroke", function (d) {
                    return d.source.color;
                });
            });
        }



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
              return me.getNodeLabel(d);
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
    var initChart = bluewave.chart.utils.initChart;

    init();
};