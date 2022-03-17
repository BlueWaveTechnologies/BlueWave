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
            backgroundColor: "#fff"
        }
    };
    var svg, mapArea; //d3 elements
    var projection, scale, translate, rotate, center;
    var panningDisabled = false;
    var background;
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


      //Watch for panning and zooming events
        svg.call(
            d3.zoom().scaleExtent([1, 1])
            .on('zoom', recenter) //vs .on('end'
        );

      //Watch for mouse click events
        svg.on("click", function(e) {
            var projection = me.getProjection();
            if (!projection) return;

            var point = d3.mouse(this);
            var coord = projection.invert(point);
            me.onMouseClick(coord[1], coord[0], e);
        });
    };


  //**************************************************************************
  //** addPoints
  //**************************************************************************
  /** Used to add points to the map
   *  @param points Accepts an array of [long, lat] points or a GeoJson object
   *  @param config Style and other rendering options
   */
    this.addPoints = function(points, config){
        layers.push({
            type: "points",
            features: points,
            config: config
        });
    };


  //**************************************************************************
  //** addLines
  //**************************************************************************
  /** Used to add lines to the map
   *  @param lines Accepts an array of lines, each defined by an array of points,
   *  or a GeoJson object
   *  @param config Style and other rendering options
   */
    this.addLines = function(lines, config){
        layers.push({
            type: "lines",
            features: lines,
            config: config
        });
    };


  //**************************************************************************
  //** addPolygons
  //**************************************************************************
  /** Used to add polygons to the map
   *  @param labels Accepts a GeoJson object with polygons
   *  @param config Style and other rendering options
   */
    this.addPolygons = function(polygons, config){
        layers.push({
            type: "polygons",
            features: polygons,
            config: config
        });
    };


  //**************************************************************************
  //** addLabels
  //**************************************************************************
  /** Used to add lables to the map
   *  @param labels Accepts a GeoJson object with coordinates and properties
   *  @param config Style and other rendering options
   */
    this.addLabels = function(labels, config){
        layers.push({
            type: "labels",
            features: labels,
            config: config
        });
    };


  //**************************************************************************
  //** addGrid
  //**************************************************************************
  /** Used to add graticule to the map
   *  @param config Style and other rendering options
   */
    this.addGrid = function(config){
        layers.push({
            type: "grid",
            features: null,
            config: config
        });
    };


  //**************************************************************************
  //** setBackgroundColor
  //**************************************************************************
    this.setBackgroundColor = function(color){
        config.style.backgroundColor = color;
        if (color){
            if (background) background.attr("fill", color);
        }
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
  //** getCentroid
  //**************************************************************************
  /** Returns center point of a given feature
   */
    this.getCentroid = function(feature){
        if (!feature) return null;
        if (!projection) me.setProjection("Mercator");
        var path = d3.geoPath(projection);
        if (isArray(feature)){
            var type = "Point";
            if (isArray(feature[0])) type = "Polygon"; //not always true
            feature = {
                type: "Feature",
                geometry: {
                    type: type,
                    coordinates: feature
                }
            };
        }
        var centroid = path.centroid(feature);
        centroid = projection.invert(centroid);
        return centroid;
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
  //** onMouseClick
  //**************************************************************************
  /** Called whenever the user clicks on the map
   */
    this.onMouseClick = function(lat, lon, e){};


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
  //** setCenter
  //**************************************************************************
   /**
   * @param center Array of [long, lat] coordinate
   */
    this.setCenter = function(center, scale){

      var width = parent.offsetWidth;
      var height = parent.offsetHeight;

      if (!scale) scale = width / 2 / Math.PI;

      projection
      .rotate([-center[0], 0])
      .center([0, center[1]])
      .scale(scale)
      .translate([width / 2, height / 2]);

    };


  //**************************************************************************
  //** getMidPoint
  //**************************************************************************
  /** Returns the midpoint between a pair of coordinates with an optional
   *  perpendicular offset
   *  @param ratio Perpendicular offset (optional). Defined as a ratio of the
   *  distance between the start/end coordinates
   */
    this.getMidPoint = function(coordinates, ratio, inclination){

        if (!projection) me.setProjection("Mercator");
        if (isNaN(ratio)) ratio = 0;

        if (inclination === "south") {
            inclination = 1;
        } else {
            inclination = -1;
        }
        var coords = coordinates.slice();
        //coordinates is a pair of [long, lat] coords
        coords[0] = projection(coords[0]);
        coords[1] = projection(coords[1]);

        //Flip coordinates if line is east to west
        if ((coords[1][0] - coords[0][0]) < 0) coords.reverse();

        var midPointX = (coords[0][0] + coords[1][0])/2;
        var midPointY = (coords[0][1] + coords[1][1])/2;

        var deltaX = coords[1][0] - coords[0][0];
        var deltaY = coords[1][1] - coords[0][1];

        //Vector normal to line from origin scaled by ratio
        var normVector = [-deltaY * ratio * inclination, deltaX * ratio * inclination];

        //Translate vector from origin to midpoint
        var pseudoPoint = [ (normVector[0] + midPointX) , (normVector[1] + midPointY) ];
        pseudoPoint = projection.invert(pseudoPoint);

        return pseudoPoint;

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(callback){
        clearChart();

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            update(parent);
            if (callback) callback();
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

        if (projectionType === "AlbersUsa"){
          projection.translate([width / 2, height / 2]);
          draw();
          return;
        }

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

        //Manual rotation tesing for ortho
        // projection
        // .geoMercator()
        // .geoConicConformal()
        // .geoAlbers()
        // .geoEquirectangular()
        // .scale(width / 2 / Math.PI)
        // .rotate([-116 - 180, 0])
        // .center([0, 40])
        // .translate([width / 2, height / 2]);

      //Render layers
        draw();

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
    this.setExtent = function(upperLeft, lowerRight, callback){
        extent.upperLeft = upperLeft;
        extent.lowerRight = lowerRight;

        if (!projection){
            me.update(function(){
                setExtent(extent);
                if (callback) callback();
            });
        }
        else{
            setExtent(extent);
            if (callback) callback();
        }
    };


  //**************************************************************************
  //** setExtent
  //**************************************************************************
    var setExtent = function(extent, base=10){

        //Base case
        if (base<0 || isNaN(base)) return;

        //TODO: Write a real base case ex: if (extent is within a certain epsilon) break. Keep emergency one though

        if (!projection) return;
        if (projectionType === "AlbersUsa") return;
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
          projection.parallels( [lowerRight[1] + Math.abs(lowerRight[1]*(1/6)), upperLeft[1] - Math.abs(upperLeft[1]*(1/6))] );
        }


        //Need to map to svg coords with projection first to avoid trig and invert after calculations
        var initialUpperLeft = projection([windowExtent.left, windowExtent.top]);
        var initialLowerRight = projection([windowExtent.right, windowExtent.bottom]);

        //Initial extent needed for ratio
        var extentLongDiff = Math.abs(initialUpperLeft[0] - initialLowerRight[0]);
        var extentLatDiff = Math.abs(initialUpperLeft[1] - initialLowerRight[1]);

        //If lower right extent is set over the edge of the map, flip the map. Not gonna work for albers
        if (projection(upperLeft)[0] > projection(lowerRight)[0]){
            projection.rotate([-upperLeft[0]-180, 0]);
        }

        var ulCartesian = projection(upperLeft);
        var lrCartesian = projection(lowerRight);

        var longitudeDiff = Math.abs(ulCartesian[0] - lrCartesian[0]);

        var scaleRatio;
        scaleRatio = longitudeDiff/extentLongDiff;


        //Scale by longtitude first
        projection.scale(scale / scaleRatio);


        //New coords for scaled projection
        ulCartesian = projection(upperLeft);
        lrCartesian = projection(lowerRight);

        var centerCartesian = [ulCartesian[0] + w/2, ulCartesian[1] + h/2];
        var center = projection.invert(centerCartesian);


        projection
        .rotate([-center[0], 0])
        .center([0, center[1]]);

        //True center
        center = me.getMidPoint([upperLeft, lowerRight]);
        //Check if lowerRight is below bottom extent and scale by latitude then center accordingly
        var extentCheck = me.getExtent();
        var latitudeDiff = Math.abs(lowerRight[1] - extentCheck.bottom);

        if(lowerRight[1] < extentCheck.bottom){
          let windowExtent = extentCheck.top - extentCheck.bottom;

          let scaleRatio = latitudeDiff/windowExtent;
          scaleRatio++;

          let scale = projection.scale();

          projection
            .scale(scale / scaleRatio)
        };

        projection
            .rotate([-center[0], 0])
            .center([0, center[1]]);


        // draw();

        setExtent(extent, --base);
    };


  //**************************************************************************
  //** draw
  //**************************************************************************
    var draw = function(){
        clearChart();

      //Create background
        var backgroundGroup = mapArea.append("g");
        backgroundGroup.attr("name", "background");
        background = backgroundGroup.append("rect")
        .attr("width", "100%")
        .attr("height", "100%");
        if (config.style.backgroundColor){
            background.attr("fill", config.style.backgroundColor);
        }


      //Add layers
        var layerGroup = mapArea.append("g");
        layerGroup.attr("name", "layers");
        var path = d3.geoPath(projection);
        layers.forEach(function(layer, i){

          //Create group
            if(!layer.config) layer.config={};
            var name = layer.config.name;
            if (!name) name = "layer"+i;
            var g = layerGroup.append("g");
            g.attr("name", name);


          //Render layer
            if (layer.type === "points"){
                renderPointLayer(layer, g, path);
            }
            else if (layer.type === "lines"){
                renderLineLayer(layer, g, path);
            }
            if (layer.type === "polygons"){
                renderPolygonLayer(layer, g, path);
            }
            else if (layer.type === "labels"){
                renderLabelLayer(layer, g, path);
            }
            else if (layer.type === "grid"){
                renderGridLayer(layer, g, path)
            }
        });
    };


  //**************************************************************************
  //** renderPointLayer
  //**************************************************************************
    var renderPointLayer = function(layer, g, path){

        if (!layer.config) layer.config = {};
        var config = layer.config;
        var style = layer.config.style;
        if (!style) style = {};

        var tooltip;
        if (config.showTooltip===true) tooltip = createTooltip();


        var highlight = false;
        if (tooltip || config.onClick) highlight = true;

        var color = style.fill;
        if(!color) color = "red";

        var opacity = style.opacity;
        if (!opacity) opacity = 1.0;

        var radius = parseInt(style.radius);
        if (isNaN(radius)) radius = 3;
        if (radius < 0) radius = 1;


        var outlineWidth = parseFloat(style.outlineWidth);
        if (isNaN(outlineWidth)) outlineWidth = 1;

        var outlineColor = style.outlineColor;


        var points = g.selectAll("*")
        .data(layer.features)
        .enter()
        .append("circle")
        //.attr("class", config.className)
        .attr('r', function(d){
            if (typeof style.radius === 'function') {
                return style.radius(d);
            }
            else return radius;
        })
        .attr("transform", function (d) {
            var coords = getCoordinates(d);
            if (coords) coords = projection(coords);
            return coords ? "translate(" + coords + ")" : "";
        })
        .attr("opacity", opacity)
        .style("fill", color)
        .attr("stroke", outlineColor)
        .attr("stroke-width", outlineWidth)
        .attr("stroke-opacity", opacity)
        .on("click", function(feature, idx, siblings){
            if (config.onClick){
                var e = d3.event;
                config.onClick.apply(me, [{
                    feature: feature,
                    element: siblings[idx],
                    layer: layer,
                    event: e
                }]);
            }
        });

        layer.elements = points;
    };


  //**************************************************************************
  //** renderLineLayer
  //**************************************************************************
    var renderLineLayer = function(layer, g, path){

        if (!layer.config) layer.config = {};
        var style = layer.config.style;
        if (!style) style = {};

        var width = parseInt(style.width);
        if (isNaN(width)) width = 1;

        var lineStyle = style.lineStyle;
        if (!lineStyle) lineStyle = "solid";

        var smoothing = style.smoothing;
        if (!smoothing || smoothing==="none") smoothing = "curveLinear";


        var color = style.color;
        if(!color) color = "red";

        var opacity = style.opacity;
        if (!opacity) opacity = 1.0;


        var lines = g.selectAll("*")
        .data(layer.features)
        .enter()
        .append("path")
        //.attr("class", config.className)
        .attr("d", function(d){
            var curve = d3.line().curve(d3[smoothing]);
            var arr = d.map(coord => projection(coord));
            return curve(arr);
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

        layer.elements = lines;
    };


  //**************************************************************************
  //** renderGridLayer
  //**************************************************************************
    var renderGridLayer = function(layer, g, path){

        if (!layer.config) layer.config = {};
        var style = layer.config.style;
        if (!style) style = {};

        var width = parseInt(style.width);
        if (isNaN(width)) width = 0.5;

        var lineStyle = style.lineStyle;
        if (!lineStyle) lineStyle = "solid";

        var color = style.color;
        if(!color) color = "gray";

        var opacity = style.opacity;
        if (!opacity) opacity = 0.5;

        var longSteps = style.longSteps;
        if (!longSteps) longSteps = 10;

        var latSteps = style.latSteps;
        if (!latSteps) latSteps = 10;

        var graticule = d3.geoGraticule()
        .step([longSteps, latSteps]);

        var lines = g.selectAll("*")
        .data([graticule()])
        .enter()
        .append("path")
        .attr("d", path)
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

        layer.elements = lines;
    };


  //**************************************************************************
  //** renderPolygonLayer
  //**************************************************************************
    var renderPolygonLayer = function(layer, g, path){

        if (!layer.config) layer.config = {};
        var config = layer.config;
        var style = layer.config.style;
        if (!style) style = {};

        var tooltip;
        if (config.showTooltip===true) tooltip = createTooltip();


        var highlight = false;
        if (tooltip || config.onClick) highlight = true;


        var mouseover = function(feature, idx, siblings) {
            var d = feature;

            if (tooltip){

              //Get label
                var label = me.getTooltipLabel(d.data);

              //Get zIndex
                var highestElements = getHighestElements();
                var zIndex = highestElements.zIndex;
                if (!highestElements.contains(tooltip.node())) zIndex++;

              //Update tooltip
                tooltip
                .html(label)
                .style("opacity", 1)
                .style("display", "block")
                .style("z-index", zIndex);
            }

            var el = d3.select(this);
            if (highlight){
                el.transition().duration(100);
                el.attr("opacity", "0.8");
            }

            if (config.onMouseOver) config.onMouseOver.apply(me, [{
                feature: feature,
                element: el,
                layer: layer
            }]);
        };

        var mousemove = function() {
            var e = d3.event;
            if (tooltip) tooltip
            .style('top', (e.clientY) + "px")
            .style('left', (e.clientX + 20) + "px");
        };

        var mouseleave = function(feature, idx, siblings) {
            if (tooltip) tooltip
            .style("opacity", 0)
            .style("display", "none");

            var el = d3.select(this);
            if (highlight){
                el.transition().duration(100);
                el.attr("opacity", "1");
            }

            if (config.onMouseLeave) config.onMouseLeave.apply(me, [{
                feature: feature,
                element: el,
                layer: layer
            }]);
        };


        var fill = style.fill;
        if (!fill) fill = "#DEDDE0";

        var stroke = style.stroke;
        if (!stroke) stroke = "#fff";

        var polygons = g.selectAll("*")
        .data(layer.features)
        .enter()
        .append("path")
        .attr('d', path)
        .attr('fill', function(d){
            if (typeof style.fill === 'function') {
                return style.fill(d);
            }
            else return fill;
        })
        .attr('stroke', stroke)
        .style("stroke-width", 0.4)
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave)
        .on("click", function(feature, idx, siblings){
            if (config.onClick){
                var e = d3.event;
                config.onClick.apply(me, [{
                    feature: feature,
                    element: siblings[idx],
                    layer: layer,
                    event: e
                }]);
            }
        });

        layer.elements = polygons;
    };


  //**************************************************************************
  //** renderLabelLayer
  //**************************************************************************
    var renderLabelLayer = function(layer, g, path){

        if (!layer.config) layer.config = {};
        var config = layer.config;
        var style = layer.config.style;
        if (!style) style = {};

        var fontSize = parseFloat(style.fontSize);
        if (isNaN(fontSize)) fontSize = 12;

        var color = style.color;
        if (!color) color = style.fill;
        if (!color) color = "#000";

        var textAlign = style.textAlign;
        if (!textAlign) textAlign = "left";


        var labels = g.selectAll("text")
        .data(layer.features)
        .enter()
        .append("text")
        .attr("transform", function (d) {
            var coords = getCoordinates(d);
            if (coords){
                coords = projection(coords);
                var x = coords[0];
                var y = coords[1];
                if (isNaN(x) || isNaN(y)) return "";
                else return `translate(  ${x}, ${y}  )`;
            }
            return "";
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
        })
        .on("click", function(feature, idx, siblings){
            if (config.onClick) config.onClick.apply(me, [{
                feature: feature,
                element: siblings[idx],
                layer: layer
            }]);
        });


        layer.elements = labels;
    };


  //**************************************************************************
  //** getCoordinates
  //**************************************************************************
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
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var isArray = javaxt.dhtml.utils.isArray;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.chart.utils.initChart;
    var createTooltip = bluewave.chart.utils.createTooltip;

    init();
};