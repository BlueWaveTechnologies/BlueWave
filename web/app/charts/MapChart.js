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
        },
        margin: {
            top: 15,
            right: 5,
            bottom: 65,
            left: 82
        }
    };
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

        if (parent instanceof d3.selection){
            svg = parent;
        }
        else if (parent instanceof d3.selection){
            svg = d3.select(parent);
        }
        else {
            svg = d3.select(parent).append("svg");
            onRender(parent, function(){
                var width = parent.offsetWidth;
                var height = parent.offsetHeight;
                svg.attr("width", width);
                svg.attr("height", height);
            });
        }

        mapArea = svg.append("g");
        readOnly = false;
        let zoom = d3.zoom()
            .scaleExtent([1, 1])
            .on('zoom', handleZoom);
        svg.call(zoom);
    };

  //**************************************************************************
  //** handleZoom
  //**************************************************************************
    function handleZoom(){
        if(!readOnly){
            var projection = me.getProjection();
            mapArea.attr('transform', d3.event.transform);
            if (projection){
                var rect = javaxt.dhtml.utils.getRect(svg.node());
                var w = rect.width;
                var h = rect.height;
                var t = d3.event.transform;
                var x = (w/2)-t.x;
                var y = (h/2)-t.y;
                var p = projection.invert([x,y]);
                console.log(p);
                me.onRecenter(p[1],p[0]);
            }
        }
    }


  //**************************************************************************
  //** getProjection
  //**************************************************************************
    this.getProjection = function(){
        return projection;
    };


  //**************************************************************************
  //** onRecenter
  //**************************************************************************
  /** Called after the map has been updated
   */
    this.onRecenter = function(){};


  //**************************************************************************
  //** onRender
  //**************************************************************************
  /** Called after the map has been updated
   */
    this.onUpdate = function(){};


  //**************************************************************************
  //** setReadOnly
  //**************************************************************************
    this.setReadOnly = function(readOnly){
        this.readOnly = readOnly;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (mapArea) mapArea.node().innerHTML = "";
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
        if (chartConfig.linkZoom === (width / .8) || chartConfig.linkZoom === width / 2 / Math.PI){
            delete chartConfig.linkZoom;
        }

        var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette(true));

        var mapLevel = chartConfig.mapLevel;
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
                var points = getPoints(data, chartConfig, projection);


              //If points are empty but a mapValue is defined, use county centroids
                if (points.coords.length===0 && chartConfig.mapValue){
                    data.forEach(function(d){
                        var county = d.county;
                        for (var i = 0; i < counties.features.length; i++){
                            var feature = counties.features[i];
                            if (county === feature.id){
                                var val = parseFloat(d[chartConfig.mapValue]);
                                if (!isNaN(val) && val>0){
                                    var coord = path.centroid(feature);
                                    coord.push(d[chartConfig.mapValue]);
                                    points.coords.push(coord);
                                }
                            }
                        }
                    });
                }


              //Render points
                renderPoints(points, chartConfig, extent);

            }
            else if(chartConfig.mapType === "Area"){

                var area = selectArea(data, chartConfig);
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
                else{
                    renderCounties();
                    renderStates();
                }
            }

            me.onUpdate();
        }
        else if (mapLevel === "states"){

            var centerLon, centerLat;
            if(chartConfig.lat && chartConfig.lon){
                centerLon = chartConfig.lon;
                centerLat = chartConfig.lat;
            }else{
                centerLon = 38.7;
                centerLat = -0.6;
            }
            centerLat = centerLat + 96;
            projection = d3.geoAlbers()
                .scale(1070)
                .center([centerLat, centerLon])
                .rotate([96, 0])
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

                renderStates();

                var points = getPoints(data, chartConfig, projection);
                var coords = points.coords;
                if (coords.length===0){ //use state centroids
                    points.hasValue = false;
                    data.forEach(function(d){
                        var state = d[chartConfig.mapLocation];
                        for (var i = 0; i < states.features.length; i++){
                            var feature = states.features[i];
                            if (state === feature.properties.code){
                                if (chartConfig.mapValue){
                                    var val = parseFloat(d[chartConfig.mapValue]);
                                    if (!isNaN(val) && val>0){
                                        var coord = path.centroid(feature);
                                        coord.push(d[chartConfig.mapValue]);
                                        coords.push(coord);
                                        points.hasValue = true;
                                    }
                                }
                            }
                        }
                    });
                    points.coords = coords;
                }
                renderPoints(points, chartConfig, extent);

            }
            else if(chartConfig.mapType === "Area"){


              //Render data using the most suitable geometry type
                var area = selectArea(data, chartConfig);
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
                else{
                    renderStates();
                }
            }
            else if(chartConfig.mapType === "Links"){ //untested...

                var nodes = data.nodes;
                var links = data.links;
                var linkArray = [];
                var connections = [];
                var coords = [];
                //Split Links up into the component parts.
                for(var link in links){
                    if(links.hasOwnProperty(link)){
                        var linkage = link.split('->');
                        linkage.push(links[link].quantity);
                        linkArray.push(linkage);
                    }
                };
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
                    .attr("d", function (d) {
                        return path({
                            type: "LineString",
                            coordinates: [
                                [d[0][1], d[0][0]],
                                [d[1][1], d[1][0]]
                            ]
                        });
                    })
                    .style("fill", "none")
                    .style("stroke-opacity", 0.5)
                    .style('stroke-width', (d) =>{
                        return thicknessScale(d[2]);
                    })
                    .style('stroke', (d) =>{
                        return getColor(d);
                    });

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

            }

            me.onUpdate();
        }
        else if(mapLevel === "world"){
            var centerLon, centerLat;
            console.log(chartConfig);
            if(chartConfig.lat && chartConfig.lon){
                centerLon = chartConfig.lon;
                centerLat = chartConfig.lat;
            }else{
                centerLon = 0;
                centerLat = 0;
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
                var points = getPoints(data, chartConfig, projection);
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
            }
            else if(chartConfig.mapType === "Links"){
                getData("PortsOfEntry", function(ports){
                    renderLinks(data, countries, ports);
                });
            }

            me.onUpdate();
        }
    };


  //**************************************************************************
  //** renderLinks
  //**************************************************************************
    var renderLinks = function(data, countries, ports){
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
                coord.push(coord);
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

    init();
};