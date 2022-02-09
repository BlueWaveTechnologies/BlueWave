if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  MapChart
//******************************************************************************
/**
 *   Panel used to create Map charts
 *
 ******************************************************************************/

bluewave.charts.MapChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        style: {
        }
    };
    var svg, mapArea; //d3 elements
    var projection, scale, translate, rotate, center;
    var panningDisabled = false;
    var layers = [];
    var extent = {};
    var projectionType = "Mercator";


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        config = merge(config, defaultConfig);

        initChart(parent, function(s, g){
            svg = s;
            mapArea = g;
        });


        panningDisabled = false;

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
  //** setProjection
  //**************************************************************************
    this.setProjection = function(name){
        projectionType = name;
        projection = d3["geo"+name]();
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
  //** enablePan
  //**************************************************************************
    this.enablePan = function(){
        panningDisabled = false;
    };


  //**************************************************************************
  //** disablePan
  //**************************************************************************
    this.disablePan = function(){
        panningDisabled = true;
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


        var width = parent.offsetWidth;
        var height = parent.offsetHeight;


        var centerLat = parseFloat(config.lat);
        var centerLon = parseFloat(config.lon);
        if (isNaN(centerLat)) centerLat = 0;
        if (isNaN(centerLon)) centerLon = 0;


        if (!projection) me.setProjection("Mercator");

        projection
            // .geoMercator()
            // .geoConicConformal()
            // .geoAlbers()
            // .geoEquirectangular()
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

            if (!layer.config) layer.config = {};


            var name = layer.config.name;
            if (!name) name = "layer"+i;

            var style = layer.config.style;
            if (!style) style = {};

            var opacity = style.opacity;
            if (!opacity) opacity = 1.0;

            var g = mapArea.append("g");
            g.attr("name", name);


            if (layer.type === "polygons"){

                var color = style.fill;
                if(!color) color = "red";

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

            }
            else if (layer.type === "points"){

                var color = style.fill;
                if(!color) color = "red";

                var radius = parseInt(style.radius);
                if (isNaN(radius)) radius = 3;
                if (radius < 0) radius = 1;
                g.selectAll("points")
                    .data(layer.features)
                    .enter()
                    .append("circle")
                    .attr("r", radius)
                    //.attr("class", config.className)
                    .attr("transform", function (d) {
                        var coords = getCoordinates(d);
                        if (coords) coords = projection(coords);
                        return coords ? "translate(" + coords + ")" : "";
                    })
                    .attr("opacity", opacity)
                    .style("fill", color)
                    .attr("stroke", "white")
                    // .attr("stroke-width", radius/5)
                    .attr("stroke-width", 2)
                    .attr("stroke-opacity", opacity);
            }
            else if (layer.type === "labels"){

                var fontSize = parseFloat(style.fontSize);
                if (isNaN(fontSize)) fontSize = 12;

                var color = style.color;
                if (!color) color = style.fill;
                if (!color) color = "#000";

                var textAlign = style.textAlign;
                if (!textAlign) textAlign = "left";


                g.selectAll("text")
                    .data(layer.features)
                    .enter()
                    .append("text")
                    .attr("transform", function (d) {
                        var coords = getCoordinates(d);
                        if (coords) coords = projection(coords);
                        var x = coords[0];
                        var y = coords[1];
                        return coords ? `translate(  ${x}, ${y}  )` : "";
                    })
                    .attr("font-size", fontSize)
                    .attr("text-anchor", ()=>{
                        if (textAlign=="center") return "middle";
                        return textAlign;
                    })
                    //.attr("font-weight", 900)
                    .style("fill", color)
                    //.style("stroke", color)
                    //.style("stroke-width", 1)
                    .text((d)=>{
                        if (d.properties && layer.config.label){
                            return d.properties[layer.config.label];
                        }
                        else{
                            return "";
                        }
                    });
            }
            else if (layer.type === "lines"){

                var width = parseInt(style.width);
                if (isNaN(width)) width = 3;

                var lineStyle = style.lineStyle;
                if (!lineStyle) lineStyle = "solid";

                  g.selectAll("lines")
                    .data(layer.features)
                    .enter()
                    .append("path")
                    //.attr("class", config.className)
                    .attr("d", function(d){
                        return path({type: "LineString", coordinates: d})
                    })
                    .attr("fill", "none")
                    .attr("opacity", opacity)
                    .style("stroke", color)
                    .style("stroke-width", width)
                    .attr("stroke-dasharray", function(d){
                      if(lineStyle==="dashed") return "10, 10";
                      else if(lineStyle==="dotted") return "0, 10";
                    })
                    .attr("stroke-linecap", function(d){
                      if(lineStyle==="dotted") return "round";
                    });

                };

        });
    };

    var getCoordinates = function(d){
        if (isArray(d)){
            return d;
        }
        else{
            if (d.geometry){
                return d.geometry.coordinates;
            }
        }
        return null;
    };


  //**************************************************************************
  //** addPolygons
  //**************************************************************************
    this.addPolygons = function(polygons, config){
        layers.push({
            type: "polygons",
            features: polygons,
            config: config
        });
    };


  //**************************************************************************
  //** addPoints
  //**************************************************************************
    this.addPoints = function(points, config){
        layers.push({
            type: "points",
            features: points,
            config: config
        });
    };


  //**************************************************************************
  //** addLabels
  //**************************************************************************
    this.addLabels = function(points, config){
        layers.push({
            type: "labels",
            features: points,
            config: config
        });
    };


  //**************************************************************************
  //** addLines
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
        if (!projection || panningDisabled) return;


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

        var rect = javaxt.dhtml.utils.getRect(svg.node());
        var w = rect.width;
        var h = rect.height;

        if (projectionType == "Albers"){

          //"The greatest accuracy is obtained if the selected standard parallels enclose two-thirds the height of the map"
          projection.parallels( [lowerRight[1] + Math.abs(lowerRight[1]*(1/6)), upperLeft[1] - Math.abs(upperLeft[1]*(1/6))] )

//           let center = [-160, 18];
//           projection
//           .rotate([-center[0], 0])
//           .center([0, center[1]]);
        }


        //Need to map to svg coords with projection first to avoid trig and invert after calculations
        var initialUpperLeft = projection([windowExtent.left, windowExtent.top]);
        var initialLowerRight = projection([windowExtent.right, windowExtent.bottom]);

        //Initial extent needed for ratio
        var extentLongDiff = Math.abs(initialUpperLeft[0] - initialLowerRight[0]);
        var extentLatDiff = Math.abs(initialUpperLeft[1] - initialLowerRight[1]);

        //If lower right extent is set over the edge of the map, flip the map. Not gonna work for albers
        if (projection(upperLeft)[0] > projection(lowerRight)[0]){
            projection.rotate([180, 0])
        }

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

        //for albers I think we're gonna need to rotate and center first - then the scaling will be ~ linear
        projection.scale(scale / scaleRatio);


        //New coords for scaled projection
        ulCartesian = projection(upperLeft);

        var centerCartesian = [ulCartesian[0] + w/2, ulCartesian[1] + h/2];
        var center = projection.invert(centerCartesian)


        projection
        .rotate([-center[0], 0])
        .center([0, center[1]]);

        // var geoJson = {
        //           "type": "Point",
        //           "coordinates": [30.0, 10.0]
        //           };

        // .fitExtent([[w, h], geoJson]);


        draw();
    };

  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var isArray = javaxt.dhtml.utils.isArray;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.chart.utils.initChart;

    init();
};