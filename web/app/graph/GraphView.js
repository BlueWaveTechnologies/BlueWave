if(!bluewave) var bluewave={};

//******************************************************************************
//**  GraphView
//******************************************************************************
/**
 *   Used to render nodes and edges (aka links) in a force directed graph.
 *   Provides an option to render small graphs using D3 and render larger
 *   graphs using image tiles via the remoteRender option.
 *
 ******************************************************************************/

bluewave.GraphView = function(parent, config) {

    var me = this;
    var defaultConfig = {
        url: "graph/network",
        remoteRender: false,
        animate: false,
        colorBy: "labels",
        label: "labels",
        style: {
            node: "graph-node",
            edge: "graph-link"
        }
    };
    var svg, graph, getColor; //d3 stuff
    var map, extent, vectorLayer;
    var waitmask;


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
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create main div
        var div = createElement("div", parent, {
            height: "100%"
        });
        me.el = div;


        if (config.remoteRender===true){

          //Get base url from config
            var url = config.url;
            if (url.lastIndexOf("/")!==url.length) url+="/";
            config.url = url;


          //Create map
            map = new ol.Map({
                target: div,
                view: new ol.View({
                    maxZoom: 23,
                    constrainResolution: true
                })
            });


          //Create vector layer
            vectorLayer = new ol.layer.Vector({
                source: new ol.source.Vector()
            });
            vectorLayer.clear = function(){
                this.getSource().clear(true);
            };
            vectorLayer.addFeature = function(feature){
                this.getSource().addFeature(feature);
            };
            map.addLayer(vectorLayer);


          //Watch for mouse events
            map.on('singleclick', function(evt) {
                get(url + "select?point="+evt.coordinate.join(","),{
                    success: function(arr){
                        if (arr.length>0) selectNode(arr[0]);
                    }
                });
            });
            map.on("pointermove", function(evt){

            });
        }
        else{


          //Create svg
            svg = d3
            .select(div)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%");


          //Create color function
            getColor = d3.scaleOrdinal(getColorPalette());
        }
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (config.remoteRender===true){
            if (vectorLayer) vectorLayer.clear();
            var arr = [];
            map.getLayers().forEach(function(layer) {
                if (layer instanceof ol.layer.Tile) {
                    arr.push(layer);
                }
            });
            for (var i=0; i<arr.length; i++){
                map.removeLayer(arr[i]);
            }
        }
        else{
            if (svg) svg.selectAll("*").remove();
        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();

        waitmask.show();


        if (config.remoteRender===true){
            updateMap();
        }
        else{
            updateD3();
        }

    };


  //**************************************************************************
  //** updateMap
  //**************************************************************************
    var updateMap = function(){

      //Get extents
        get(config.url + "extents",{
            success: function(text){
                vectorLayer.clear();


              //Add points to set extents
                var style = getPointStyle('rgba(0,0,0,0)', 1);
                var arr = text.split(",");
                for (var i=0; i<arr.length; i++){
                    var pt = arr[i].trim().split(" ");
                    var x = parseFloat(pt[0]);
                    var y = parseFloat(pt[1]);
                    var feature = new ol.Feature({
                        geometry: new ol.geom.Point([x, y])
                    });
                    feature.setStyle(style);
                    vectorLayer.addFeature(feature);
                }


              //Zoom to extent
                var view = map.getView();
                extent = vectorLayer.getSource().getExtent();
                view.fit(extent, map.getSize());


              //Set min zoom
                var minZoom = Math.round(view.getZoom()-1);
                view.setMinZoom(minZoom);


              //Add graph
                map.getLayers().insertAt(0, new ol.layer.Tile({
                    source: new ol.source.XYZ({
                      url: config.url + 'image/{z}/{x}/{y}'
                    })
                }));


              //Hide waitmask
                waitmask.hide();
            }
        });
    };


  //**************************************************************************
  //** updateD3
  //**************************************************************************
    var updateD3 = function(){
        get(config.url, {
            success: function(data) {
                waitmask.hide();

                var links = data.links;
                var nodes = data.nodes;
                var animate = config.animate;
                var width = me.el.offsetWidth;
                var height = me.el.offsetHeight;


                graph = d3.forceSimulation(nodes)
                .force("link", d3.forceLink().id(function(d) { return d.id; }))
                .force("charge", d3.forceManyBody())
                .force("center", d3.forceCenter(width / 2, height / 2));
		if (!animate) graph.stop();

                graph.force("link").links(links);
                if (!animate) graph.tick(300);


                var link = svg.append("g")
                .attr("class", config.style.edge)
                .selectAll("line")
                .data(links)
                .enter().append("line")
                .attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; })
                .attr("stroke-width", function(d) {
                    return Math.sqrt(d.value);
                });


              //Create group for nodes and labels
                var node = svg.append("g")
                .attr("class", config.style.node)
                .selectAll("g")
                .data(nodes)
                .enter().append("g");


              //Add circles
                var circles = node.append("circle")
                .attr("r", 5)
                .attr("fill", function(d) { return getColor(d[config.colorBy]); })
                if (animate){
                    circles.call(d3.drag()
                    .on("start", function(d) {
                        if (!d3.event.active) graph.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on("drag", function(d) {
                        d.fx = d3.event.x;
                        d.fy = d3.event.y;
                    })
                    .on("end", function(d) {
                        if (!d3.event.active) graph.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    }));
                }
                else{
                    circles.attr("cx", function(d) { return d.x; });
                    circles.attr("cy", function(d) { return d.y; });
                }


              //Add labels
                var labels = node.append("text")
                .text(function(d) {
                    var label = d[config.label];
                    if (label==null) return "";
                    if (isArray(label)) label = label.join();
                    return label;
                });
                if (animate){
                    labels.attr("x", function(d) { return 6; });
                    labels.attr("y", function(d) { return 3; });
                }
                else{
                    labels.attr("x", function(d) { return d.x+6; });
                    labels.attr("y", function(d) { return d.y+3; });
                }



              //Update nodes and lines during animation steps
                graph
                  .nodes(nodes)
                  .on("tick", function() {

                      link
                        .attr("x1", function(d) { return d.source.x; })
                        .attr("y1", function(d) { return d.source.y; })
                        .attr("x2", function(d) { return d.target.x; })
                        .attr("y2", function(d) { return d.target.y; });


                      node
                        .attr("transform", function(d) {
                            if (animate){
                                return "translate(" + d.x + "," + d.y + ")";
                            }
                            else{
                                //TODO: Figure out how to move the nodes and labels
                                return "";
                            }
                        });

                    }
                );
            },
            failure: function(request){
                waitmask.hide();
                alert(request);
            }
        });

    };


  //**************************************************************************
  //** selectNode
  //**************************************************************************
    var selectNode = function(node){
        if (config.remoteRender===true){
            var id = node.id;
            var label = node.label;
            if (label==null || label=="null") label = id;
            var x = node.x;
            var y = node.y;
            var feature = new ol.Feature({
                geometry: new ol.geom.Point([x, y])
            });
            var style = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255,255,255,0.4)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#3399CC',
                    width: 1.25
                }),
                text: new ol.style.Text({
                    font: '12px Calibri,sans-serif',
                    fill: new ol.style.Fill({ color: '#000' }),
                    stroke: new ol.style.Stroke({
                        color: '#fff', width: 2
                    }),
                    text: label+""
                })
            });
            feature.setStyle(style);
            vectorLayer.clear();
            vectorLayer.getSource().addFeature(feature);
        }
        else{
            //D3
        }
    };


  //**************************************************************************
  //** getPointStyle
  //**************************************************************************
    var getPointStyle = function(color, size){

        var fill = new ol.style.Fill({
            color: color
        });

        var stroke = new ol.style.Stroke({
            color: color,
            width: 0
        });

        return new ol.style.Style({
            image: new ol.style.Circle({
                fill: fill,
                stroke: stroke,
                radius: size
            }),
            fill: fill,
            stroke: stroke
        });
    };


  //**************************************************************************
  //** get
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var isArray = javaxt.dhtml.utils.isArray;
    var createElement = javaxt.dhtml.utils.createElement;
    var getColorPalette = bluewave.utils.getColorPalette;

    init();
};