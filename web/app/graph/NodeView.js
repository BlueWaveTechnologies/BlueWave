if(!bluewave) var bluewave={};

//******************************************************************************
//**  NodeView
//******************************************************************************
/**
 *   Used to render nodes in the graph using circle packing.
 *
 ******************************************************************************/

bluewave.NodeView = function(parent, config) {

    var me = this;
    var defaultConfig = {
        url: "graph/nodes"
    };
    var svg; //d3
    var getColor; //d3 function
    var nodes = [];
    var waitmask;
    var form, tooltip;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Clone the config so we don't modify the original config object
        var clone = {};
        merge(clone, config);


      //Merge clone with default config
        merge(clone, defaultConfig);
        config = clone;


      //Parse config
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create main div
        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.position = "relative";
        parent.appendChild(div);
        me.el = div;


      //Create svg
        svg = d3
        .select(div)
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%");

      //Create color function
        getColor = d3.scaleOrdinal(getColorPalette());

        createMenu(div);
        createTooltip(div);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        svg.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();

        waitmask.show();
        get(config.url, {
            success: function(data) {
                nodes = data;
                var key = "count"; //vs relations
                render(nodes,key);
                waitmask.hide();
            },
            failure: function(request){
                waitmask.hide();
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** render
  //**************************************************************************
    var render = function(data, key){
        me.clear();
        if (!data) return;
        data = JSON.parse(JSON.stringify(data)); //clone the data so d3 doesn't mess it up

        var width = me.el.offsetWidth;
        var height = me.el.offsetHeight;

        var maxVal = 0;
        for (var i=0; i<data.length; i++){
            maxVal = Math.max(maxVal, data[i][key]);
        }

      //Size scale
        var size = d3.scaleLinear()
        .domain([0, maxVal])
        .range([7,55])  // circle will be between 7 and 55 px wide


        // Initialize the circle: all located at the center of the svg area
        var node = svg.append("g")
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("r", function(d){ return size(d[key]); })
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .style("fill", function(d){ return getColor(d.node); })
        .attr("stroke", function(d){ return getColor(d.node); })
        .style("fill-opacity", 0.8)
        .style("stroke-width", 0)
        .on("mousemove", function(d) {
            this.style.strokeWidth=4;
            this.style.fillOpacity=1;
            tooltip.show();
            tooltip.innerHTML = "<b>" + d.node + "</b><br>" +
            formatNumber(d[key]) + " " + (key=="count"? "nodes" : key);
            tooltip.style.left = event.pageX+20 + "px";
            tooltip.style.top = event.pageY + "px";
        })
        .on("mouseleave", function(){
            this.style.strokeWidth=0;
            this.style.fillOpacity=0.8;
            tooltip.hide();
        })
        .on("click", function(){
            getRelationshipOnClick(width, height, node);
        })
        .call(d3.drag() // call specific function when circle is dragged
            .on("start", function(d) {
                if (!d3.event.active) simulation.alphaTarget(.03).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", function(d) {
                d.fx = d3.event.x;
                d.fy = d3.event.y;
            })
            .on("end", function(d) {
                if (!d3.event.active) simulation.alphaTarget(.03);
                d.fx = null;
                d.fy = null;
            })
        );


        // Features of the forces applied to the nodes:
        var simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(width / 2, height / 2)) //Attraction to the center of the svg area
        .force("charge", d3.forceManyBody().strength(.1)) // Nodes are attracted one each other of value is > 0
        .force("collide", d3.forceCollide() // Force that avoids circle overlapping
            .strength(.2)
            .radius(function(d){ return (size(d[key])+3); })
            .iterations(1));

        // Apply these forces to the nodes and update their positions.
        // Once the force algorithm is happy with positions ('alpha' value is low enough), simulations will stop.
        simulation.nodes(data)
        .on("tick", function(d){
            node
              .attr("cx", function(d){ return d.x; })
              .attr("cy", function(d){ return d.y; })
        });

    };


  //**************************************************************************
  //** createMenu
  //**************************************************************************
    var createMenu = function(parent){
        var div = document.createElement("div");
        div.className = "dashboard-item";
        div.style.width = "150px";
        div.style.position = "absolute";
        div.style.top = 0;
        div.style.right = 0;
        parent.appendChild(div);

        form = new javaxt.dhtml.Form(div, {
            style: config.style.form,
            items: [
                {
                    name: "type",
                    label: "",
                    type: "radio",
                    alignment: "vertical",
                    options: [
                        {
                            label: "Node Count",
                            value: "count"
                        },
                        {
                            label: "Relations",
                            value: "relations"
                        }
                    ]
                }
            ]
        });
        form.setValue("type","count");
        form.onChange = function(formInput, value){
            render(nodes, value);
        };
    };


  //**************************************************************************
  //** createTooltip
  //**************************************************************************
    var createTooltip = function(parent){
        tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.style.top = 0;
        addShowHide(tooltip);
        tooltip.hide();
        parent.appendChild(tooltip);
    };


  //**************************************************************************
  //** getRelationshipOnClick
  //**************************************************************************
    var getRelationshipOnClick = function(width, height, nodes){
        var simulation = d3.forceSimulation()
            .velocityDecay(0.1)
            .force("x", d3.forceX(width / 2).strength(.05))
            .force("y", d3.forceY(height / 2).strength(.05))
            .force("charge", d3.forceManyBody().strength(.1))
            .force("collide", d3.forceCollide(30).strength(1).iterations(1))
            .on('tick', ticked);

        function ticked() {
          nodes.attr('cx', function (d) { return d.x = pythag(d.rad, d.y, d.x); })
                  .attr('cy', function (d) { return d.y = pythag(d.rad, d.x, d.y); });
        }




        var clickedNodeRelUrl = "http://localhost:8080/graph/relationships?id=19";
        var graph = fetch(clickedNodeRelUrl)
        .then(function(response) {
            return response.json();
        }).then(function(json) {
            return drawClickedNodeRelationship(json);
        });
    };

  //**************************************************************************
  //** drawClickedNodeRelationship
  //**************************************************************************
    var drawClickedNodeRelationship = function(graph) {


    }


    var pythag = function(r, b, coord) {
        r += 5;
        var radius = 430/2;
        var hyp2 = Math.pow(radius, 2);
        // force use of b coord that exists in circle to avoid sqrt(x<0)
        b = Math.min(430 - r - 4, Math.max(r + 4, b));

        var b2 = Math.pow((b - radius), 2),
            a = Math.sqrt(hyp2 - b2);

        // radius - sqrt(hyp^2 - b^2) < coord < sqrt(hyp^2 - b^2) + radius
        coord = Math.max(radius - a + r + 4,
                    Math.min(a + radius - r - 4, coord));

        return coord;
    }


  //**************************************************************************
  //** formatNumber
  //**************************************************************************
    const formatNumber = (x) => {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var getColorPalette = bluewave.utils.getColorPalette;

    init();
};
