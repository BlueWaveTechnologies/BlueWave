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
    var mapArea;
    var svg;

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
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (mapArea) mapArea.node().innerHTML = "";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();
        var parent = svg.node().parentNode;
        onRender(parent, function(){
            update(chartConfig, data);
        });
    };

    var update = function(chartConfig, data){
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
        if (mapLevel === "states" || mapLevel === "census"){
            getData("states", function(mapData) {
                getData("countries", function(countryData){
                    var useCensusData = mapLevel === "census";
                    var countries = topojson.feature(countryData, countryData.objects.countries);
                    var states = topojson.feature(mapData, mapData.objects.states);
                    var projection = d3.geoAlbers().center([-8, 43]);
                    var path = d3.geoPath(projection);


                  //Create map layer
                    var worldMap = mapArea.append("g");



                  //Render countries
                    worldMap.append("g")
                        .attr("class", "boundary")
                        .selectAll("boundary")
                        .data(countries.features)
                        .enter().append("path")
                        .attr('d', path)
                        .attr('fill', 'lightgray')
                        .attr('stroke', 'white');


                  //Render states
                    var statePolygons = worldMap.append("g")
                        .attr("class", "boundary")
                        .selectAll("boundary")
                        .data(states.features)
                        .enter()
                        .append("path")
                        .attr('d', path)
                        .attr('fill', 'none')
                        .attr('stroke', 'white');


                  //Render data
                    if (chartConfig.mapType === "Point"){

                        var points = getPoints(data, chartConfig, projection);
                        var coords = points.coords;
                        if (coords.length===0){ //use state centroids
                            points.hasValue = false;
                            data.forEach(function(d){
                                var state = d.state;
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
                        data.forEach(function(d){
                            if(useCensusData){
                                var location = d[chartConfig.censusRegion];
                                var locations = location.split(",");
                                var censusDivision = locations[1];
                                censusDivision = censusDivision.replace(/\D/g, "");
                                censusDivision = parseInt(censusDivision);
                                for(var i = 0; i < states.features.length; i++){
                                    if(censusDivision == states.features[i].properties.censusDivision){
                                        states.features[i].properties.censusData = true;
                                        states.features[i].properties.mapValue = d[chartConfig.mapValue];
                                    }else if(states.features[i].properties.inData){
                                        states.features[i].properties.inData = false;
                                    }
                                }
                            } else {
                                var state = d.state;
                                for(var i = 0; i < states.features.length; i++){
                                    if(state == states.features[i].properties.code){
                                        states.features[i].properties.inData = true;
                                        states.features[i].properties.mapValue = d[chartConfig.mapValue];
                                    }else if(states.features[i].properties.censusData){
                                        states.features[i].properties.censusData = false;
                                    }
                                }
                            }
                        });


                      //Update fill color of states as needed
                        statePolygons.each(function() {
                            var path = d3.select(this);
                            var fillColor = path.attr('fill');
                            path.attr('fill', function(d){
                                var inData = d.properties.inData;
                                var inCensus = d.properties.censusData;
                                if (inData || inCensus){
                                    return colorScale[chartConfig.colorScale](d.properties.mapValue);
                                }
                                else{
                                    return fillColor;
                                }
                            });
                        });
                    }
                    else if(chartConfig.mapType === "Links"){

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
                                        [d[1][1], d[1][0]],
                                    ]
                                });
                            })
                            .style("fill", "none")
                            .style("stroke-opacity", 0.5)
                            .style('stroke-width', (d) =>{
                                return thicknessScale(d[2])
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

                    }
                });
            });
        }
        else if(mapLevel === "counties"){
            getData("counties", function(mapData){
                var counties = topojson.feature(mapData, mapData.objects.counties);
                var projection = d3.geoAlbersUsa(); //.fitSize([width,height],counties);
                var path = d3.geoPath(projection);

              //Create map layer
                var countyMap = mapArea.append("g");


              //Render county polygons
                var countyPolygons = countyMap.selectAll("path")
                  .data(counties.features)
                  .join("path")
                  .attr("fill", 'lightgray')
                  .attr("d", path);


              //Render state boundaries
                countyMap
                  .append("path")
                  .attr("fill", "none")
                  .attr("stroke", "white")
                  .attr("d", path(
                      topojson.mesh(
                        mapData,
                        mapData.objects.states,
                        function(a, b) {
                          return a !== b;
                        }
                      )
                    )
                  );


              //Render data
                if (chartConfig.mapType === "Point"){

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

                  //Map countyIDs to data values
                    var values = {};
                    data.forEach(function(d){
                        var countyID = d.county+"";
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
                }
            });
        }
        else if(mapLevel === "world"){
            getData("countries", function(mapData){
                if(!chartConfig.linkZoom) chartConfig.linkZoom = (Math.round(width / 2 / Math.PI));
                if(isNaN(chartConfig.centerLongitude)) chartConfig.centerLongitude = 0;
                if(isNaN(chartConfig.centerLatitude)) chartConfig.centerLatitude = 0;
                var zoom = chartConfig.linkZoom;
                var centerLon = 0;
                var centerLat = 20;
                var countries = topojson.feature(mapData, mapData.objects.countries);
//                var projection = d3.geoMercator()
//                                .scale(zoom)
//                                .rotate([centerLon, 0])
//                                .center([0, centerLat])
//                                .translate([width / 2, height / 2]);

                var projection = d3.geoMercator().center([centerLon, centerLat]).scale(180);
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
            });
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