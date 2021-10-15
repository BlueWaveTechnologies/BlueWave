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
    var WKT = new ol.format.WKT(); //the WKT Format for OpenLayers
    var geoJSON = new ol.format["GeoJSON"]();  //the geoJSON format for OpenLayers
    var svg, mapArea; //d3 elements
    var countyData, countryData; //raw json
    var counties, states, countries; //topojson
    var options = []; //aggregation options
    var projection;
    var readOnly;

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
        svg.call(d3.zoom().scaleExtent([1, 1])
            .on('zoom', recenter));
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
  //** onUpdate
  //**************************************************************************
  /** Called after the map has been rendered, after an update
   */
    this.onUpdate = function(){};


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
        mapArea.node().innerHTML = "";
        mapArea.attr("transform", null);
        options = [];
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
    this.update = function(chartConfig, data){
        me.clear();
        getMapData(function(){
            var parent = svg.node().parentNode;
            onRender(parent, function(){
                update(parent, chartConfig, data);
            });
        });
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(parent, chartConfig, data){
        var width = parent.offsetWidth;
        var height = parent.offsetHeight;

      //Get min/max values
        var extent = d3.extent(data, function(d) { return parseFloat(d[chartConfig.mapValue]); });

      //Set color scale
        var colorScale = {
            "blue": d3.scaleQuantile(extent, d3.schemeBlues[7]),
            "red": d3.scaleQuantile(extent, d3.schemeReds[7])
        };
        if (!chartConfig.colorScale) chartConfig.colorScale = "red";

        var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette(true));

        var mapLevel = chartConfig.mapLevel;
        var useWKT = false;
        if(chartConfig.mapLocation && data[0][chartConfig.mapLocation].includes("(")){
            useWKT = true;
        }
        if (mapLevel === "counties"){

            projection = d3.geoAlbersUsa(); //.fitSize([width,height],counties);
            var path = d3.geoPath(projection);

          //Create map layer
            var countyMap = mapArea.append("g");


          //Render county polygons
            var renderCounties = function(){
                return countyMap.selectAll("path")
                  .data(counties.features)
                  .join("path")
                  .attr("fill", 'none')
                  .attr("d", path);
            };


          //Render state boundaries
            var renderStates = function(renderPolygons){
                if (renderPolygons===true){
                    //console.log(states.features);
                    return countyMap.selectAll("whatever")
                    .data(states.features)
                    .enter()
                    .append("path")
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr('stroke', 'white');
                }
                else{
                    countyMap
                      .append("path")
                      .attr("fill", "none")
                      .attr("stroke", "white")
                      .attr("d", path(
                          topojson.mesh(
                            countyData,
                            countyData.objects.states,
                            function(a, b) {
                              return a !== b;
                            }
                          )
                        )
                      );
                }
            };


          //Render data
            if (chartConfig.mapType === "Point"){

              //Render counties
                var countyPolygons = renderCounties();
                countyPolygons.each(function() {
                    var path = d3.select(this);
                    path.attr('fill', function(d){
                        return 'lightgray';
                    });
                });


              //Render states
                renderStates();


              //Get points
                var points = {};
                if (chartConfig.pointData==="geoCoords") {
                    points = getPoints(data, chartConfig, projection);
                }
                else if (chartConfig.pointData==="adminArea"){
                    if(useWKT){
                        points = getPointsWKT(data, chartConfig, projection);
                    }else{
                        points = getCentroids(data, states, chartConfig, path, projection);
                    }
                }


              //Render points
                renderPoints(points, chartConfig, extent);

            }
            else if(chartConfig.mapType === "Area"){

                var area;
                if(true){
                    area = selectArea(data, chartConfig);
                }else{
                    area = "WKT";
                }
                if (area==="counties"){

                  //Render Counties
                    var countyPolygons = renderCounties();

                  //Map countyIDs to data values
                    var values = {};
                    data.forEach(function(d){
                        var countyID = d[chartConfig.mapLocation];
                        values[countyID] = d[chartConfig.mapValue];
                    });


                  //Update fill color of county polygons
                    countyPolygons.each(function() {
                        var path = d3.select(this);
                        var fillColor = path.attr('fill');
                        path.attr('fill', function(d){
                            var v = parseFloat(values[d.id]);
                            if (isNaN(v) || v<0) v = 0;
                            var fill = colorScale[chartConfig.colorScale](v);
                            if (!fill) return fillColor;
                            return fill;
                        });
                    });


                  //Render state boundaries
                    renderStates();
                }
                else if (area==="states"){ //render states
                    var statePolygons = renderStates(true);
                    updateStatePolygons(data, statePolygons, chartConfig, colorScale);
                }
                else if (area==="censusDivisions"){ //render census divisions
                    var statePolygons = renderStates(true);
                    updateCensusPolygons(data, statePolygons, chartConfig, colorScale);
                }
                else if(area==="WKT"){  //Render based on WKT Geometry
                    var countyPolygons = renderCounties();
                    var statePolygons = renderStates(true);
                    countyPolygons.each(function() {
                        var path = d3.select(this);
                        var fillColor = path.attr('fill');
                        path.attr('fill', function(d){
                            return "lightgrey";
                        });
                    });
                    renderWKT(data, chartConfig, colorScale, path, countyMap);
                }
                else{
                    renderCounties();
                    renderStates();
                }
            }

            me.onUpdate();
        }
        else if (mapLevel === "states"){
            var centerLon, centerLat
            if(chartConfig.lat && chartConfig.lon){
                centerLon = chartConfig.lon;
                centerLat = chartConfig.lat;
            }else{
                centerLon = 38.7;
                centerLat = -0.6;
                chartConfig.lon = centerLon;
                chartConfig.lat = centerLat;
            }
            //Might no longer be needed, will comment out for now.
//            centerLat = centerLat + 96;
            projection = d3.geoAlbers()
                .scale(1070)
                .center([centerLat, centerLon])
                .rotate([96, 0]);

            var path = d3.geoPath(projection);

          //Create map layer
            var worldMap = mapArea.append("g");


          //Render countries
            worldMap
                .selectAll("whatever")
                .data(countries.features)
                .enter().append("path")
                .attr('d', path)
                .attr('fill', 'lightgray')
                .attr('stroke', 'white');


          //Render states
            var renderStates = function(){
                return worldMap.selectAll("whatever")
                .data(states.features)
                .enter()
                .append("path")
                .attr('d', path)
                .attr('fill', 'none')
                .attr('stroke', 'white');
            };


          //Render data
            if (chartConfig.mapType === "Point"){

              //Render states
                renderStates();


              //Get points
                var points = {};
                if (chartConfig.pointData==="geoCoords") {
                    points = getPoints(data, chartConfig, projection);
                }
                else if (chartConfig.pointData==="adminArea"){
                    if(useWKT){
                        points = getPointsWKT(data, chartConfig, projection);
                    }else{
                        points = getCentroids(data, states, chartConfig, path, projection);
                    }
                }

              //Render points
                renderPoints(points, chartConfig, extent);

            }
            else if(chartConfig.mapType === "Area"){


              //Render data using the most suitable geometry type
                var area;
                if(true){
                    area = selectArea(data, chartConfig);
                }else{
                    area = "WKT";
                }
                if (area==="counties"){ //render counties

                    var values = {};
                    data.forEach(function(d){
                        var countyID = d[chartConfig.mapLocation];
                        values[countyID] = d[chartConfig.mapValue];
                    });

                    worldMap.selectAll("whatever")
                    .data(counties.features)
                    .enter()
                    .append("path")
                    .attr('d', path)
                    .attr('fill', function(county){
                        var v = parseFloat(values[county.id]);
                        if (isNaN(v) || v<0) v = 0;
                        var fill = colorScale[chartConfig.colorScale](v);
                        if (!fill) return 'none';
                        return fill;
                    });
                    renderStates();
                }
                else if (area==="states"){ //render states
                    var statePolygons = renderStates();
                    updateStatePolygons(data, statePolygons, chartConfig, colorScale);
                }
                else if (area==="censusDivisions"){ //render census divisions
                    var statePolygons = renderStates();
                    updateCensusPolygons(data, statePolygons, chartConfig, colorScale);
                }
                else if(area==="WKT"){
                    var statePolygons = renderStates(true);
                    renderWKT(data, chartConfig, colorScale, path, worldMap);
                }
                else{
                    renderStates();
                }
            }
            else if(chartConfig.mapType === "Links"){
                getData("PortsOfEntry", function(ports){
                    renderLinks(data, countries, ports, path, projection, mapLevel);
                });
            }

            me.onUpdate();
        }
        else if(mapLevel === "world"){
            var centerLon, centerLat;
            if(chartConfig.lat && chartConfig.lon){
                centerLon = parseFloat(chartConfig.lon);
                centerLat = parseFloat(chartConfig.lat);
            }else{
                centerLon = -98.5;
                centerLat = 39.5;
                chartConfig.lon = centerLon;
                chartConfig.lat = centerLat;
            }
            projection = d3.geoMercator().center([centerLon, centerLat]).scale(360).translate([width / 2, height / 2]);
            var path = d3.geoPath(projection);
          //Render countries
            mapArea.selectAll("path")
                .data(countries.features)
                .enter()
                .append("path")
                .attr('d', path)
                .attr('fill', 'lightgray')
                .attr('stroke', 'white');

            if (chartConfig.mapType === "Point"){

              //Get points
                var points = {};
                if (chartConfig.pointData==="geoCoords") {
                    points = getPoints(data, chartConfig, projection);
                }
                else if (chartConfig.pointData==="adminArea"){
                    if(useWKT){
                        points = getPointsWKT(data, chartConfig, projection);
                    }else{
                        points = getCentroids(data, states, chartConfig, path, projection);
                    }
                }

              //Render points
                renderPoints(points, chartConfig, extent);
            }
            else if(chartConfig.mapType === "Area"){
                var aggregateState = 0;
                data.forEach(function(d){
                    var state;
                    var country;
                    if(d.state) {
                        state = d.state;
                        aggregateState = aggregateState + parseFloat(d[chartConfig.mapValue]);
                    }
                   if(d.country) country = d.country;
                    for(var i = 0; i < countries.features.length; i++){
                        if(country == countries.features[i].properties.code){
                            countries.features[i].properties.inData = true;
                            countries.features[i].properties.mapValue = d[chartConfig.mapValue];
                        }else if(countries.features[i].properties.code == "US" &&
                                aggregateState > 0){
                            countries.features[i].properties.inData = true;
                            countries.features[i].properties.mapValue = aggregateState;
                        }
                    }
                });
                mapArea.selectAll("path")
                    .data(countries.features)
                    .enter()
                    .append("path")
                    .attr('d', path)
                    .attr('stroke', 'white')
                    .attr('fill', function(d){
                        var inData = d.properties.inData;
                        if(inData){
                            return colorScale[chartConfig.colorScale](d.properties.mapValue);
                        }else{
                            return "lightgrey";
                        }
                    });
                if(useWKT){
                    //renderWKT(data, chartConfig, colorScale, path, mapArea);
                }
            }
            else if(chartConfig.mapType === "Links"){
                getData("PortsOfEntry", function(ports){
                    renderLinks(data, countries, ports, path, projection, mapLevel);
                });
            }

            me.onUpdate();
        }
    };




  //**************************************************************************
  //** recenter
  //**************************************************************************
  /** Used to recenter the map using d3 mouse events
   */
    var recenter = function(){
        if (!readOnly){
            mapArea.attr('transform', d3.event.transform);
            var projection = me.getProjection();
            if (projection){
                var rect = javaxt.dhtml.utils.getRect(svg.node());
                var w = rect.width;
                var h = rect.height;
                var t = d3.event.transform;
                var x = (w/2)-t.x;
                var y = (h/2)-t.y;
                var p = projection.invert([x,y]);
                me.onRecenter(p[1],p[0]);
            }
        }
    };


  //**************************************************************************
  //** renderLinks
  //**************************************************************************
    var renderLinks = function(data, countries, ports, path, projection, mapLevel){
        var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette(true));
        var nodes = data.nodes;
        var links = data.links;
        var linkArray = []
        var connections = [];
        var coords = [];
        //Split Links up into the component parts.
        for (var link in links){
            if(links.hasOwnProperty(link)){
                var linkage = link.split('->');
                linkage.push(links[link].quantity);
                linkArray.push(linkage);
            }
        };
        if(mapLevel==="states"){
            linkArray.forEach(function(d){
                var connection = {};
                var stateCodeOne = nodes[d[0]].state;
                var stateCodeTwo = nodes[d[1]].state;
                var stateValue = d[2];
                connection.stateCodeOne = stateCodeOne;
                connection.stateCodeTwo = stateCodeTwo;
                connection.quantity = stateValue;
                connections.push(connection);
            });
            connections.forEach(function(d){
                var stateOne = d.stateCodeOne;
                var stateTwo = d.stateCodeTwo;
                var quantity = d.quantity;
                var coordOne = [];
                var coordTwo = [];
                var connectionPath = [];
                for (var i = 0; i < states.features.length; i++){
                    var stateCenter = states.features[i];
                    if (stateOne === stateCenter.properties.code){
                        var lat = stateCenter.properties.latitude;
                        var lon = stateCenter.properties.longitude;
                        coordOne.push(lat);
                        coordOne.push(lon);
                        connectionPath.push(coordOne);
                        break;
                    }
                }
                for(var i = 0; i < states.features.length; i++){
                    var stateCenter = states.features[i];
                    if(stateTwo === stateCenter.properties.code){
                        var lat = stateCenter.properties.latitude;
                        var lon = stateCenter.properties.longitude;
                        coordTwo.push(lat);
                        coordTwo.push(lon);
                        connectionPath.push(coordTwo);
                        connectionPath.push(quantity);
                        break;
                    }
                }
                coords.push(connectionPath);
            });
        }else if(mapLevel==="world"){
            linkArray.forEach(function(d){
                var connection = {};
                var countryCodeOne = nodes[d[0]].country;
                var countryCodeTwo = nodes[d[1]].country;
                var countryValue = d[2];
                if (countryCodeOne && countryCodeTwo){
                    connection.countryCodeOne = countryCodeOne;
                    connection.countryCodeTwo = countryCodeTwo;
                    connection.quantity = countryValue;
                    connections.push(connection);
                }
            });
            connections.forEach(function(d){
                var countryOne = d.countryCodeOne;
                var countryTwo = d.countryCodeTwo;
                var quantity = d.quantity;
                var coordOne = [];
                var coordTwo = [];
                var connectionPath = [];
                if(countryOne !== 'US' && countryTwo === 'US'){
                    for(var i = 0; i < ports.length; i++){
                        if(countryOne === ports[i].iso2){
                            coordOne.push(ports[i].exlatitude);
                            coordOne.push(ports[i].exlongitude);
                            coordTwo.push(ports[i].imlatitude);
                            coordTwo.push(ports[i].imlongitude);
                            connectionPath.push(coordOne);
                            connectionPath.push(coordTwo);
                            connectionPath.push(quantity);
                            coords.push(connectionPath);
                        }
                    }
                }else{
                    for (var i = 0; i < countries.features.length; i++){
                        var countryCenter = countries.features[i];
                        if (countryOne === countryCenter.properties.code){
                            var lat = countryCenter.properties.latitude;
                            var lon = countryCenter.properties.longitude;
                            coordOne.push(lat);
                            coordOne.push(lon);
                            connectionPath.push(coordOne);
                            break;
                        }
                    }
                    for(var i = 0; i < countries.features.length; i++){
                        var countryCenter = countries.features[i];
                        if(countryTwo === countryCenter.properties.code){
                            var lat = countryCenter.properties.latitude;
                            var lon = countryCenter.properties.longitude;
                            coordTwo.push(lat);
                            coordTwo.push(lon);
                            connectionPath.push(coordTwo);
                            connectionPath.push(quantity);
                            break;
                        }
                    }
                    coords.push(connectionPath);
                }
            });
        }
        var quantities = [];
        coords.forEach(function(d){
            quantities.push(d[2]);
        });
        var thicknessExtent = d3.extent(quantities);
        var thicknessScale = d3.scaleQuantile()
            .domain(thicknessExtent)
            .range([6 ,8, 10, 12, 14]);
        mapArea.selectAll("#connection-path").remove();
        mapArea.selectAll("#connection-path")
            .data(coords)
            .enter()
            .append("path")
            .attr("id", "#connection-path")
            .attr("d", function(d) {
                return path({
                    type: "LineString",
                    coordinates: [
                        [d[0][1], d[0][0]],
                        [d[1][1], d[1][0]]
                    ],
                });
            })
            .style("fill", "none")
            .style("stroke-opacity", 0.5)
            .style('stroke-width', (d) =>{
                return thicknessScale(d[2]);
            })
            .style('stroke', (d) =>{
                return getColor(d);
            })

        mapArea.selectAll("#connection-dot").remove();
        let dots = mapArea
            .append("g")
            .attr("id", "connection-dot")
            .selectAll("#connection-dot")
            .data(coords)
            .enter();

        dots.append("circle")
            .attr("cx", function(d){
                let lat = d[0][0];
                let lon = d[0][1];
                return projection([lon, lat])[0];
            })
            .attr("cy", function(d){
                let lat = d[0][0];
                let lon = d[0][1];
                return projection([lon, lat])[1];
            })
            .attr("r", 6)
            .attr("fill", (d) =>{
                return getColor(d);
            });

        dots.append("circle")
            .attr("cx", function(d){
                let lat = d[1][0];
                let lon = d[1][1];
                return projection([lon, lat])[0];
            })
            .attr("cy", function(d){
                let lat = d[1][0];
                let lon = d[1][1];
                return projection([lon, lat])[1];
            })
            .attr("r", 6)
            .attr("fill", (d) =>{
                return getColor(d[0]);
            });
    };
  //**************************************************************************
  //** renderWKT
  //**************************************************************************
    var renderWKT = function(data, chartConfig, colorScale, path, map){
        var collectionOfFeatures =[];
//        data.forEach(function(d){
//            if(d[chartConfig.mapLocation].includes("(")){
//                var geometry = convertWKT(d[chartConfig.mapLocation]);
//                geometry.mapValue = d[chartConfig.mapValue];
//                geometries.push(geometry);
//            }
//        }
        var geoJSONObject = convertWKT("POLYGON((-87.906471 43.038902, -95.992775 36.153980, -75.704722 36.076944, -87.906471 43.038902))");
//        console.log(geoJSONObject);
        geoJSONObject.geometry.coordinates[0].reverse(); //This reverses the coordinate order, which is requried for d3 to work properly.
//        console.log(geoJSONObject);
        collectionOfFeatures.push(geoJSONObject);
        map.selectAll("stuff")
            .data(collectionOfFeatures)
            .enter()
            .append("path")
            .attr('d', path)
            .attr('fill', "green")
            .attr('stroke', 'white');
    }

  //**************************************************************************
  //** convertWKT
  //**************************************************************************
  //Converts a wkt into a geoJSON object;
    var convertWKT = function(val){
        var geoJSONObject = geoJSON.writeFeatureObject(WKT.readFeature(val));
        return geoJSONObject;
    }

  //**************************************************************************
  //** getPointsWKT
  //**************************************************************************
      var getPointsWKT = function(data, chartConfig, projection){
        var coords = [];
        var hasValue;
        data.forEach(function(d){
            if(d[chartConfig.mapLocation].includes("(")){
                var geometry = convertWKT(d[chartConfig.mapLocation]);
                var coordinates = geometry.flatCoordinates;
                var lon = parseFloat(coordinates[0]);
                var lat = parseFloat(coordinates[1]);
                if (isNaN(lat) || isNaN(lon)) return;
                var coord = projection([lon, lat]);
                if (!coord) return;
                if (isNaN(coord[0]) || isNaN(coord[1])) return;
                var val = parseFloat(d[chartConfig.mapValue]);
                if (!isNaN(val)){
                    coord.push(val);
                    hasValue = true;
                }
                coords.push(coord);
            }
        });
        return {
            coords: coords,
            hasValue: hasValue
        };
      }

  //**************************************************************************
  //** getPoints
  //**************************************************************************
    var getPoints = function(data, chartConfig, projection){
        var coords = [];
        var hasValue = false;
        data.forEach(function(d){
            var lat = parseFloat(d[chartConfig.latitude]);
            var lon = parseFloat(d[chartConfig.longitude]);
            if (isNaN(lat) || isNaN(lon)) return;
            var coord = projection([lon, lat]);
            if (!coord) return;
            if (isNaN(coord[0]) || isNaN(coord[1])) return;
            var val = parseFloat(d[chartConfig.mapValue]);
            if (!isNaN(val)){
                coord.push(val);
                hasValue = true;
            }
            coords.push(coord);
        });
        return {
            coords: coords,
            hasValue: hasValue
        };
    };


  //**************************************************************************
  //** getCentroids
  //**************************************************************************
    var getCentroids = function(data, mapData, chartConfig, path, projection){
        var coords = [];
        var hasValue = false;
        data.forEach(function(d){
            var value = d[chartConfig.mapLocation];
            mapData.features.every(function(feature){
                var properties = feature.properties;
                if (value === properties.code){

                  //Get centroid
                    var centroid;
                    if (!isNaN(properties.latitude) && !isNaN(properties.longitude)){
                        centroid = projection([properties.longitude, properties.latitude]);
                    }
                    else{
                        centroid = path.centroid(feature);
                    }

                  //Update coords
                    if (centroid){
                        if (isNaN(centroid[0]) || isNaN(centroid[0])) centroid = null;
                        else coords.push(centroid);
                    }

                  //Set value
                    if (centroid && chartConfig.mapValue){
                        var val = parseFloat(d[chartConfig.mapValue]);
                        if (!isNaN(val)){
                            hasValue = true;
                            centroid.push(val);
                        }
                    }

                    return false;
                }
                return true;
            });
        });
        return {
            coords: coords,
            hasValue: hasValue
        };
    };


  //**************************************************************************
  //** renderPoints
  //**************************************************************************
    var renderPoints = function(points, chartConfig, extent){

        var r = parseInt(chartConfig.pointRadius);
        if (isNaN(r)) r = 3;
        if (r<0) r = 1;

        var c = chartConfig.pointColor;
        if (!c) c = "#ff3c38";

        mapArea.append("g")
        .selectAll("whatever")
        .data(points.coords)
        .enter()
        .append("circle")
        .attr("r",function(coord){
            if (points.hasValue){
                var val = coord[2];
                if (isNaN(val) || val<=0) return r;
                var p = val/extent[1];
                var maxSize = r;
                if (p > 0){
                    return maxSize*p;
                }
                else{
                    return maxSize*.25;
                }
            }
            return r;
        })
        .attr("transform", function(d) {
            return "translate(" + [d[0],d[1]] + ")";
        })
        .style("fill", c);
    };


  //**************************************************************************
  //** selectArea
  //**************************************************************************
  /** Returns most suitable map type based on the "mapLocation" config
   */
    var selectArea = function(data, chartConfig){

      //Analyze data
        var numStates = 0;
        var numCounties = 0;
        var numCensusDivisions = 0;
        data.forEach(function(d){
            var location = d[chartConfig.mapLocation];
            if (typeof location === 'undefined') return;
            var censusDivision = getCensusDivision(d[chartConfig.mapLocation]);

            counties.features.every(function(county){
                if (county.id===location){
                    numCounties++;
                    return false;
                }
                return true;
            });

            states.features.every(function(state){
                var foundMatch = false;

                if (state.properties.name===location || state.properties.code===location){
                    numStates++;
                    foundMatch = true;
                }

                if (!isNaN(censusDivision)){
                    if (state.properties.censusDivision===censusDivision){
                        numCensusDivisions++;
                        foundMatch = true;
                    }
                }

                return !foundMatch;
            });

        });


      //Render data using the most suitable geometry type
        var maxMatches = Math.max(numStates, numCounties, numCensusDivisions);
        if (maxMatches>0){
            if (maxMatches===numCounties){
                return "counties";
            }
            else if (maxMatches===numStates){
                return "states";
            }
            else if (maxMatches===numCensusDivisions){
                return "censusDivisions";
            }
        }
        return null;
    };


  //**************************************************************************
  //** updateStatePolygons
  //**************************************************************************
  /** Used to update the fill color for states using the "mapValue"
   */
    var updateStatePolygons = function(data, statePolygons, chartConfig, colorScale){
        var values = {};
        data.forEach(function(d){
            var location = d[chartConfig.mapLocation];
            if (typeof location === 'undefined') return;
            values[location] = d[chartConfig.mapValue];
        });

        statePolygons.each(function() {
            var path = d3.select(this);
            path.attr('fill', function(state){
                var v = parseFloat(values[state.properties.name]);
                if (isNaN(v)) v = parseFloat(values[state.properties.code]);
                if (isNaN(v) || v<0) v = 0;
                var fill = colorScale[chartConfig.colorScale](v);
                if (!fill) return 'none';
                return fill;
            });
        });
    };


  //**************************************************************************
  //** updateCensusPolygons
  //**************************************************************************
  /** Used to update the fill color for states by census division using "mapValue"
   */
    var updateCensusPolygons = function(data, statePolygons, chartConfig, colorScale){
        var values = {};
        data.forEach(function(d){
            var censusDivision = getCensusDivision(d[chartConfig.mapLocation]);
            if (!isNaN(censusDivision)){
                values[censusDivision+""] = d[chartConfig.mapValue];
            }
        });

        statePolygons.each(function() {
            var path = d3.select(this);
            path.attr('fill', function(state){
                var v = parseFloat(values[state.properties.censusDivision+""]);
                if (isNaN(v) || v<0) v = 0;
                var fill = colorScale[chartConfig.colorScale](v);
                if (!fill) return 'none';
                return fill;
            });
        });
    };


  //**************************************************************************
  //** getCensusDivision
  //**************************************************************************
  /** Used to parse a given string and returns an integer value (1-9)
   */
    var getCensusDivision = function(str){

        if (typeof str === 'undefined') return null;
        var censusDivision = parseInt(censusDivision);
        if (!isNaN(censusDivision)) return censusDivision;

        str = str.toLowerCase();
        if (str.indexOf("new england")>-1) return 1;
        if (str.indexOf("middle atlantic")>-1 || str.indexOf("mid atlantic")>-1) return 2;
        if (str.indexOf("east north central")>-1) return 3;
        if (str.indexOf("west north central")>-1) return 4;
        if (str.indexOf("south atlantic")>-1) return 5;
        if (str.indexOf("east south central")>-1) return 6;
        if (str.indexOf("west south central")>-1) return 7;
        if (str.indexOf("mountain")>-1) return 8;
        if (str.indexOf("pacific")>-1) return 9;

        return null;
    };


  //**************************************************************************
  //** getMapData
  //**************************************************************************
  /** Used to download and parse counties and countries and calls the callback
   *  when ready
   */
    var getMapData = function(callback){
        if (counties){
            if (countries) callback();
            else{
                getData("countries", function(countryData){
                    countries = topojson.feature(countryData, countryData.objects.countries);
                    callback();
                });
            }
        }
        else{
            getData("counties", function(json){
                countyData = json;
                counties = topojson.feature(countyData, countyData.objects.counties);
                states = topojson.feature(countyData, countyData.objects.states);
                if (countries) callback();
                else{
                    getData("countries", function(json){
                        countryData = json;
                        countries = topojson.feature(countryData, countryData.objects.countries);
                        callback();
                    });
                }
            });
        }
    };


  //**************************************************************************
  //** getData
  //**************************************************************************
    var getData = function(name, callback){
        if (!bluewave.data) bluewave.data = {};
        if (bluewave.data[name]){
            callback.apply(this, [bluewave.data[name]]);
        }
        else{
            bluewave.utils.getData(name, callback);
        }
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var initChart = bluewave.utils.initChart;

    init();
};