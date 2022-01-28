if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  MapChart
//******************************************************************************
/**
 *   Panel used to create Map charts
 *
 ******************************************************************************/

bluewave.charts.Map = function(parent, config) {

    var me = this;
    var defaultConfig = {
        style: {
        }
    };
    var svg, mapArea; //d3 elements
    var projection, scale, translate, rotate, center;
    var readOnly;
    var layers = [];
    var extent = {};


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        config = merge(config, defaultConfig);

        initChart(parent, function(s, g){
            svg = s;
            mapArea = g;
        });


        readOnly = false;

      //Watch for panning and zooming events
        svg.call(
            d3.zoom().scaleExtent([1, 1])
            .on('zoom', recenter) //vs .on('end'
        );

      //Watch for mouse click events
        svg.on("click", function() {
            var projection = me.getProjection();
            if (!projection) return;

            console.log(projection.invert(d3.mouse(this)));
            console.log(me.getExtent());
        });
    };


  //**************************************************************************
  //** getProjection
  //**************************************************************************
    this.getProjection = function(){
        return projection;
    };


  //**************************************************************************
  //** onRecenter
  //**************************************************************************
  /** Called whenever the center point of the map is changed
   */
    this.onRecenter = function(lat, lon){};


  //**************************************************************************
  //** onRedraw
  //**************************************************************************
  /** Called whenever the zoom event ends
   */
    this.onRedraw = function(){};


  //**************************************************************************
  //** setReadOnly
  //**************************************************************************
    this.setReadOnly = function(readonly){
        readOnly = (readonly===false) ? false : true;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        clearChart();
        projection = scale = translate = rotate = center = null;
        layers = [];
    };


  //**************************************************************************
  //** clearChart
  //**************************************************************************
    var clearChart = function(){
        mapArea.node().innerHTML = "";
        mapArea.attr("transform", null);
    };


  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(){
        if (mapArea){

        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        clearChart();

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            update(parent);
        });

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(parent){
        clearChart();

        var chartConfig = config;

        var width = parent.offsetWidth;
        var height = parent.offsetHeight;



        var centerLon, centerLat;
        if (chartConfig.lat && chartConfig.lon){
            centerLon = parseFloat(chartConfig.lon);
            centerLat = parseFloat(chartConfig.lat);
        }
        else{
            if (chartConfig.mapType === "Links"){
                centerLon = -180;
                centerLat = 39.5;
            }
            else{
                centerLon = -98.5;
                centerLat = 39.5;
            }
        }
//override for now
centerLat = 0;
centerLon = 0;

        projection = d3
            .geoMercator()
            .scale(width / 2 / Math.PI)
            .rotate([-centerLon, 0])
            .center([0, centerLat])
            .translate([width / 2, height / 2]);




      //Save original projection params as class variable
        scale = projection.scale();
        translate = projection.translate();
        rotate = projection.rotate();
        center = projection.center();

// england to belgium
        // me.setExtent([0,52], [4, 51])

        //glasgow to prague
        me.setExtent([-4.25,55.9], [14.4, 50])

        //beijing 
        // me.setExtent([116,40], [-105, -20])

      //Render layers
        draw();

    };


  //**************************************************************************
  //** draw
  //**************************************************************************
    var draw = function(){
        clearChart();
        var path = d3.geoPath(projection);

        layers.forEach(function(layer, i){

            var name = layer.config.name;
            if (!name) name = "layer"+i;
            var style = layer.config.style;

            var g = mapArea.append("g");
            g.attr("name", name);
            g.selectAll("*")
                .data(layer.features)
                .enter()
                .append("path")
                .attr('d', path)
                .attr('fill', function(d){
                    if (typeof style.fill === 'function') {
                        return style.fill(d);
                    }
                    else return style.fill;
                })
                .attr('stroke', 'white');

        });
    };


  //**************************************************************************
  //** addPolygons
  //**************************************************************************
    this.addPolygons = function(polygons, config){
        layers.unshift({
            features: polygons,
            config: config
        });
    };



  //**************************************************************************
  //** recenter
  //**************************************************************************
  /** Used to recenter the map using d3 mouse events
   */
    var recenter = function(){

        var projection = me.getProjection();
        if (!projection || readOnly) return;


        //mapArea.attr('transform', d3.event.transform); //<--not what we want


      //Get center point of the map
        var rect = javaxt.dhtml.utils.getRect(svg.node());
        var w = rect.width;
        var h = rect.height;
        var t = d3.event.transform;
        var x = (w/2)-t.x;
        var y = (h/2)-t.y;
        var p = projection.invert([x,y]);
        // console.log(p); //I'm not sure this is stil correct - need to validate



      //Redraw map
        var getLat = d3.scaleLinear()
          .domain([0, h])
          .range([0, 180]); //not sure if this is truly valid - some projections only go 84 N/S

        var getLon = d3.scaleLinear()
          .domain([0, w])
          .range([0, 360]);


      //Get x/y pixel offsets
        var tx = translate[0] - t.invertX(translate[0]);
        var ty = translate[1] - t.invertY(translate[1]);


        var lat = (getLat(ty)/2)+center[1];
        var lon = getLon(tx)+rotate[0];

        projection.rotate([lon, rotate[1], rotate[2]]);
        projection.center([0, lat]);


        draw();



      //Fire onRecenter event
        me.onRecenter(p[1],p[0]);
    };


  //**************************************************************************
  //** getExtent
  //**************************************************************************
    this.getExtent = function(){
        var projection = me.getProjection();
        if (!projection) return;

        var rect = javaxt.dhtml.utils.getRect(svg.node());
        var w = rect.width;
        var h = rect.height;

        var ul = projection.invert([0,0]);
        //var ll = projection.invert([0,h]);
        //var ur = projection.invert([w,0]);
        var lr = projection.invert([w,h]);


        return {
            left: ul[0],
            right: lr[0],
            top: ul[1],
            bottom: lr[1]
        };
    };


  //**************************************************************************
  //** setExtent
  //**************************************************************************
    this.setExtent = function(upperLeft, lowerRight){
        var projection = me.getProjection();
        if (!projection) return;
        if (!upperLeft || !lowerRight) return;

        var scale = projection.scale();
        
        // extent.left = ul[0];
        // extent.right = lr[0];
        // extent.top = ul[1];
        // extent.bottom = lr[1];

        var extent = me.getExtent();

        //Need to map to svg coords with projection first to avoid trig and invert after calculations
        var ulCartesian = projection(upperLeft);
        var lrCartesian = projection(lowerRight);

        var initialUpperLeft = projection([extent.left, extent.top]);
        var initialLowerRight = projection([extent.right, extent.bottom]);

        // var extentDiff = Math.abs(extent.left - extent.right);
        var extentLongDiff = Math.abs(initialUpperLeft[0] - initialLowerRight[0]);
        var extentLatDiff = Math.abs(initialUpperLeft[1] - initialLowerRight[1]);

        var longitudeDiff = Math.abs(ulCartesian[0] - lrCartesian[0]);
        var latitudeDiff = Math.abs(ulCartesian[1] - lrCartesian[1]);

        if (longitudeDiff>latitudeDiff){
          var scaleRatio = longitudeDiff/extentLongDiff;
        }
        else{
          var scaleRatio = latitudeDiff/extentLatDiff;
        }
        

        // var center = [ (upperLeft[0] + lowerRight[0])/2 , (upperLeft[1] + lowerRight[1])/2 ];

        projection.scale(scale / scaleRatio);

        var rect = javaxt.dhtml.utils.getRect(svg.node());
        var w = rect.width;
        var h = rect.height;

        // var ul = projection.invert([0, 0]);
        // var lr = projection.invert([w, h]);

        //New coords for scaled projection
        ulCartesian = projection(upperLeft);

        var centerCartesian = [ulCartesian[0] + w/2, ulCartesian[1] + h/2];
        var center = projection.invert(centerCartesian)
        console.log("center", center)

 
        projection.center(center);
        // projection.center(upperLeft)

        // console.log(projection.scale())
        // projection.scale(100)
        // projection.center([0, 0])
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.chart.utils.initChart;

    init();
};