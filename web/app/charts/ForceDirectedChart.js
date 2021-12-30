if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  ForceDirectedChart
//******************************************************************************
/**
 *   Used to render a force directed graph
 *
 ******************************************************************************/

bluewave.charts.ForceDirectedChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        getNodeLabel: function(node){
            return node.name;
        },
        getNodeFill: function(node){
            return "#dcdcdc";
        },
        getNodeOutline: function(node){
            return "#777";
        },
        getNodeRadius: function(node){
            return 10;
        }
    };
    var svg, container;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        config = merge(config, defaultConfig);


        initChart(parent, function(s, g){
            svg = s;
            container = g;


          //Add panning and zooming to the svg element
            svg.call(d3.zoom().on("zoom", function() {
                container.attr("transform", d3.event.transform);
            }));


          //Define style for arrows
            svg.append("svg:defs").selectAll("marker")
                .data(["end"])
              .enter().append("svg:marker")
                .attr("id", String)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 15)
                .attr("refY", -1.5)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
              .append("svg:path")
                .attr("d", "M0,-5L10,0L0,5");

        });
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (container) container.selectAll("*").remove();
        //container.node().innerHTML = "";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(nodes, links){
        me.clear();

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            update(nodes, links);
        });
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(nodes, links){
        me.clear();



        var g = container.append("g");


        var cx = parent.offsetWidth/2;
        var cy = parent.offsetHeight/2;


      //Create graph
        var graph = d3.forceSimulation(nodes)
        .force("link", d3.forceLink().id(function(d) { return d.name; }))
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(cx, cy));



      //Add links
        var link = g.append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
          .style("stroke", "#aaa")
          .attr("marker-end", "url(#end)");



      //Add nodes
        var node = g.append("g")
        .selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
            .attr("transform", function(d) {
                return "translate(" + cx + "," + cy + ")";
            })
            .attr("r", function(node){
                return config.getNodeRadius.apply(me,[node]);
            })
            .style("fill", function(node){
                return config.getNodeFill.apply(me,[node]);
            })
            .attr("stroke-width", 1.5)
            .attr("stroke", function(node){
                return config.getNodeOutline.apply(me,[node]);
            })
            .on("click", function(node){
                selectNode(node, this);
            });


      //Add labels
        var label = g.append("g")
        .selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
            .text(function(node) {
                return config.getNodeLabel.apply(me,[node]);
            })
            .attr("fill", function(node) {
                if (node.type==="search"){
                    return "#fff";
                }
                else{
                    return "#000";
                }
            })
            .on("click", function(node){
                selectNode(node, this);
            });


      //Calculate label sizes and add custom attributes to the corresponding nodes
        label.each(function(n) {
            var box = d3.select(this).node().getBBox();
            n.labelWidth = box.width;
            n.labelHeight = box.height;
        });


      //Create a lookup table to find nodes by node name
        var nodeMap = {};
        node.each(function(n) {
            n.r = parseFloat(d3.select(this).attr("r"));
            nodeMap[n.name] = n;
        });



      //Update position of elements while the graph is being updated
        graph
          .nodes(nodes)
          .on("tick", function() {

            //Update links. Note that for each of the attr functions we can
            //simply return the node.x or node.y coordinate but instead we
            //return a coordinate just outside of the node so we can render
            //arrows. Reference: https://math.stackexchange.com/a/1630886/
              link
                .attr("x1", function(link) {
                    var node = nodeMap[link.source];
                    var x0 = node.x;
                    var y0 = node.y;
                    var x1 = nodeMap[link.target].x;
                    var y1 = nodeMap[link.target].y;
                    var r = node.r;
                    var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                    var t = r/d;
                    return (1-t)*x0+t*x1;
                })
                .attr("y1", function(link) {
                    var node = nodeMap[link.source];
                    var x0 = node.x;
                    var y0 = node.y;
                    var x1 = nodeMap[link.target].x;
                    var y1 = nodeMap[link.target].y;
                    var r = node.r;
                    var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                    var t = r/d;
                    return (1-t)*y0+t*y1;
                })
                .attr("x2", function(link) {
                    var node = nodeMap[link.target];
                    var x0 = node.x;
                    var y0 = node.y;
                    var x1 = nodeMap[link.source].x;
                    var y1 = nodeMap[link.source].y;
                    var r = node.r;
                    var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                    var t = r/d;
                    return (1-t)*x0+t*x1;
                })
                .attr("y2", function(link) {
                    var node = nodeMap[link.target];
                    var x0 = node.x;
                    var y0 = node.y;
                    var x1 = nodeMap[link.source].x;
                    var y1 = nodeMap[link.source].y;
                    var r = node.r;
                    var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                    var t = r/d;
                    return (1-t)*y0+t*y1;
                });


            //Update nodes
              node
                .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y + ")";
                });


            //Update labels
              label
                .attr("transform", function(node) {
                    var x = node.x;
                    var y = node.y;
                    var r = node.r;
                    var w = node.labelWidth;
                    var h = node.labelHeight;


                    if (node.type==="search"){

                      //place text inside node
                        var xOffset = x-(w/2);
                        var yOffset = y+4;
                        return "translate(" + xOffset + "," + yOffset + ")";
                    }
                    else{

                      //Place text outside of node
                        var xOffset;
                        if (x>cx){
                            xOffset = x+r;
                        }
                        else{
                            xOffset = x-(w+r);
                        }

                        return "translate(" + xOffset + "," + (y-(h/2)) + ")";
                    }
                });
            }
        );


      //Recursive function used to find all nodes realted to a given nodeName
        var findRelatedNodes = function(nodeName, relatedNodes){
            links.forEach(function(l){
                if (l.source===nodeName){
                    var targetNode = l.target;
                    if (!relatedNodes[targetNode]){
                        findRelatedNodes(targetNode, relatedNodes);

                        if (!relatedNodes[targetNode]){
                            var idx = 0;
                            for (var key in relatedNodes) {
                                if (relatedNodes.hasOwnProperty(key)){
                                    idx++;
                                }
                            }
                            var alias = "n"+idx;
                            relatedNodes[targetNode] = {
                                alias: alias,
                                source: nodeName,
                                join:"-[:" + l.relationship + "]->"
                            };

                        }
                    }
                }
            });
        };


      //Function used to manage node select events
        var selectNode = function(n, el){

          //Find related nodes
            var nodeName = n.name;
            var relatedNodes = {};
            findRelatedNodes(nodeName, relatedNodes);


          //Update node styles
            node.each(function() {
                d3.select(this).style("opacity", function (n) {
                    if (n.name===nodeName) return 1;
                    return relatedNodes[n.name] ? 1 : 0.15;
                });
            });


          //Update link styles
            link.each(function() {
                d3.select(this).style("opacity", function (l) {
                    if (nodeMap[l.source].name===nodeName) return 1;
                    return relatedNodes[nodeMap[l.source].name] ? 1 : 0.15;
                });
            });


          //Update link styles
            label.each(function() {
                d3.select(this).style("opacity", function (n) {
                    if (n.type==="search"){

                    }
                    else{
                        if (n.name===nodeName) return 1;
                        return relatedNodes[n.name] ? 1 : 0.35;
                    }
                });
            });


        };

    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;

    var initChart = bluewave.chart.utils.initChart;



    init();

};