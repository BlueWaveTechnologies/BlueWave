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
            console.log(d3.mouse(this))
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

        
        setExtent(extent);

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

            var opacity = style.opacity;
            if (!opacity) opacity = 1.0;

            var color = style.fill;
            if(!color) color = "red";

            var g = mapArea.append("g");
            g.attr("name", name);

            if (layer.type == "polygons"){

                g.selectAll("polys")
                    .data(layer.features)
                    .enter()
                    .append("path")
                    .attr('d', path)
                    .attr('fill', function(d){
                        if (typeof style.fill === 'function') {
                            return style.fill(d);
                        }
                        else return color;
                    })
                    .attr('stroke', 'white');

                } else
            if (layer.type == "points"){

                  var radius = parseInt(style.radius);
                  if (isNaN(radius)) radius = 3;
                  if (radius < 0) radius = 1;

                  g.selectAll("points")
                    .data(layer.features)
                    .enter()
                    .append("circle")
                    .attr("r", radius)
                    .attr("class", config.name)
                    .attr("transform", function (d) {
                      return "translate(" + projection(d) + ")";
                    })
                    .attr("opacity", opacity)
                    .style("fill", color)

                } else
            if (layer.type == "lines"){

                  var width = parseInt(style.width);
                  if (isNaN(width)) width = 3;

                  g.selectAll("lines")
                    .data(layer.features)
                    .enter()
                    .append("path")
                    .attr("class", config.name)
                    .attr("d", function(d){
                      return path({type: "LineString", coordinates: d})
                    })
                    .attr("fill", "none")
                    .attr("opacity", opacity)
                    .style("stroke", color)
                    .style("stroke-width", width)

                };

        });
    };


  //**************************************************************************
  //** addPolygons
  //**************************************************************************
    this.addPolygons = function(polygons, config){
        layers.unshift({
            type: "polygons",
            features: polygons,
            config: config
        });
    };

  //**************************************************************************
  //** addPolygons
  //**************************************************************************
    this.addPoints = function(points, config){
      layers.push({
          type: "points",
          features: points,
          config: config
      });
  };

  //**************************************************************************
  //** addPolygons
  //**************************************************************************
    this.addLines = function(tuples, config){
      layers.push({
          type: "lines",
          features: tuples,
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
        extent.upperLeft = upperLeft;
        extent.lowerRight = lowerRight;
    };
  //**************************************************************************
  //** setExtent
  //**************************************************************************
    var setExtent = function(extent){
 
        var projection = me.getProjection();
        if (!projection) return;
        if (!extent.upperLeft || !extent.lowerRight) return;

        var upperLeft = extent.upperLeft;
        var lowerRight = extent.lowerRight;

        var scale = projection.scale();
        var windowExtent = me.getExtent();

        //Need to map to svg coords with projection first to avoid trig and invert after calculations
        var initialUpperLeft = projection([windowExtent.left, windowExtent.top]);
        var initialLowerRight = projection([windowExtent.right, windowExtent.bottom]);

        //Initial extent needed for ratio
        var extentLongDiff = Math.abs(initialUpperLeft[0] - initialLowerRight[0]);
        var extentLatDiff = Math.abs(initialUpperLeft[1] - initialLowerRight[1]);

        projection.rotate([0]) //Black magic
        var ulCartesian = projection(upperLeft);
        var lrCartesian = projection(lowerRight);

        var longitudeDiff = Math.abs(ulCartesian[0] - lrCartesian[0]);
        var latitudeDiff = Math.abs(ulCartesian[1] - lrCartesian[1]);

        if (longitudeDiff>latitudeDiff){
          var scaleRatio = longitudeDiff/extentLongDiff;
        }
        else{
          var scaleRatio = latitudeDiff/extentLatDiff;
        }

        projection.scale(scale / scaleRatio);
        
        var rect = javaxt.dhtml.utils.getRect(svg.node());
        var w = rect.width;
        var h = rect.height;

        //New coords for scaled projection
        ulCartesian = projection(upperLeft);

        var centerCartesian = [ulCartesian[0] + w/2, ulCartesian[1] + h/2];
        var center = projection.invert(centerCartesian)

        projection
        .rotate([-center[0], 0])
        .center([0, center[1]])
 
        draw();
    };

  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.chart.utils.initChart;

    init();
};