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
        if (mapArea) mapArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        this.clear();
        var parent = svg.node().parentNode;
        onRender(parent, function(){
            var width = parent.offsetWidth;
            var height = parent.offsetHeight;

          //Get min/max values
            var extent = d3.extent(data, function(d) { return parseFloat(d[chartConfig.mapValue]); });

          //Get isObject boolean.
            var isObject = chartConfig.isObject;

          //Set color scale
            var colorScale = {
                "blue": d3.scaleQuantile(extent, d3.schemeBlues[7]),
                "red": d3.scaleQuantile(extent, d3.schemeReds[7])
            };
            if (!chartConfig.colorScale) chartConfig.colorScale = "red";
            if(isObject){
                if(chartConfig.mapLevel == "states"){
                    getData("states", function(mapData) {
                        getData("countries", function(countryData){
                            var countries = topojson.feature(countryData, countryData.objects.countries);
                            var states = topojson.feature(mapData, mapData.objects.states);
                            var projection = d3.geoAlbers()
                                .scale(width / .8)
                                .translate([width / 2, height / 2]);
                            var path = d3.geoPath().projection(projection);

                        mapArea.selectAll('circle').remove();
                        if(chartConfig.mapType === "Point"){
                            mapArea.append("g")
                                .attr("class", "boundary")
                                .selectAll("boundary")
                                .data(countries.features)
                                .enter().append("path")
                                .attr('d', path)
                                .attr('fill', 'lightgray')
                                .attr('stroke', 'white');

                            mapArea.append("g")
                                .attr("class", "boundary")
                                .selectAll("boundary")
                                .data(states.features)
                                .enter()
                                .append("path")
                                .attr('d', path)
                                .attr('fill', 'lightgray')
                                .attr('stroke', 'white')

                            var coords = [];
                            data.forEach(function(d){
                                var lat = parseFloat(d.lat);
                                var lon = parseFloat(d.lon);
                                if (isNaN(lat) || isNaN(lon))return;
                                var coord = projection([lon, lat]);
                                if (!coord) return;
                                coord.push(parseFloat(d[chartConfig.mapValue]));
                                coords.push(coord);
                            });

                            if (coords.length===0){ //use state centroids
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
                                                }
                                            }
                                        }
                                    }
                                });
                            }

                            for (var i=0; i<coords.length; i++){
                                var coord = coords[i];
                                var val = coord[2];
                                if (isNaN(val) || val<=0) continue;
                                var p = val/extent[1];
                                var maxSize = 30;
                                if (!isNaN(chartConfig.pointRadius)) maxSize = maxSize*chartConfig.pointRadius;
                                var r = maxSize*p;
                                mapArea.append("circle")
                                    .attr("cx", coord[0])
                                    .attr("cy", coord[1])
                                    .attr("r", r + "px")
                                    .style("fill", "rgb(217,91,67)");
                            }

                        }else if(chartConfig.mapType === "Area"){
                            data.forEach(function(d){
                                var state = d.state;
                                for(var i = 0; i < states.features.length; i++){
                                    if(state == states.features[i].properties.code){
                                        states.features[i].properties.inData = true;
                                        states.features[i].properties.mapValue = d[chartConfig.mapValue];
                                    }
                                }
                            });

                            mapArea.append("g")
                                .attr("class", "boundary")
                                .selectAll("boundary")
                                .data(countries.features)
                                .enter().append("path")
                                .attr('d', path)
                                .attr('fill', 'lightgray')
                                .attr('stroke', 'white');

                            mapArea.append("g")
                                .attr("class", "boundary")
                                .selectAll("boundary")
                                .data(states.features)
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
                        });
                    });
                }else if(chartConfig.mapLevel == "counties"){
                    getData("states", function(mapData) {
                        getData("counties", function(mapData){
                            var counties = topojson.feature(mapData, mapData.objects.counties);
                            var projection = d3.geoIdentity()
                                .fitSize([width,height],counties);
                            var path = d3.geoPath().projection(projection);
                            mapArea.selectAll('circle').remove();

                            if (chartConfig.mapType === "Point"){

                              //Add counties
                                mapArea.selectAll("path")
                                    .data(counties.features)
                                    .enter()
                                    .append("path")
                                    .attr('d', path)
                                    .attr('fill', 'lightgray');


                              //Add state boundaries
                                mapArea
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

                                var coords = [];
                                data.forEach(function(d){
                                    var lat = parseFloat(d.lat);
                                    var lon = parseFloat(d.lon);
                                    if (isNaN(lat) || isNaN(lon))return;
                                    var coord = projection([lon, lat]);
                                    if (!coord) return;
                                    coord.push(parseFloat(d[chartConfig.mapValue]));
                                    coords.push(coord);
                                });

                                if (coords.length===0){ //use county centroids
                                    data.forEach(function(d){
                                        var county = d.county;
                                        for (var i = 0; i < counties.features.length; i++){
                                            var feature = counties.features[i];
                                            if (county === feature.id){
                                                if (chartConfig.mapValue){
                                                    var val = parseFloat(d[chartConfig.mapValue]);
                                                    if (!isNaN(val) && val>0){
                                                        var coord = path.centroid(feature);
                                                        coord.push(d[chartConfig.mapValue]);
                                                        coords.push(coord);
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }


                                for (var i=0; i<coords.length; i++){
                                    var coord = coords[i];
                                    var val = coord[2];
                                    if (isNaN(val) || val<=0) continue;
                                    var p = val/extent[1];
                                    var maxSize = 30;
                                    if (!isNaN(chartConfig.pointRadius)) maxSize = maxSize*chartConfig.pointRadius;
                                    var r = maxSize*p;
                                    mapArea.append("circle")
                                        .attr("cx", coord[0])
                                        .attr("cy", coord[1])
                                        .attr("r", r + "px")
                                        .style("fill", "rgb(217,91,67)");
                                }

                            }
                            else if(chartConfig.mapType === "Area"){

                                data.forEach(function(d){
                                    var county = d.county;
                                    for (var i = 0; i < counties.features.length; i++){
                                        if (county === counties.features[i].id){
                                            counties.features[i].properties.mapValue = d[chartConfig.mapValue];
                                        }
                                    }
                                });

                              //Add counties
                                mapArea.selectAll("path")
                                    .data(counties.features)
                                    .enter()
                                    .append("path")
                                    .attr('d', path)
                                    .attr('fill', function(d){

                                        var v = parseFloat(d.properties.mapValue);
                                        if (isNaN(v) || v<0) v = 0;
                                        //else v = Math.log10(1+v);

                                        var fill = colorScale[chartConfig.colorScale](v);
                                        if (!fill) return "#f8f8f8";
                                        else return fill;

                                    });

                              //Add state boundaries
                                mapArea
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
                            }
                        });
                    });
                }else if(chartConfig.mapLevel == "countries"){
                    getData("countries", function(mapData){
                        var countries = topojson.feature(mapData, mapData.objects.countries);
                        var projection = d3.geoMercator()
                                        .scale(width / 2 / Math.PI)
                                        .translate([width / 2, height / 2]);
                        var path = d3.geoPath().projection(projection);
                        mapArea.selectAll('circle').remove();
                        if(chartConfig.mapType === "Point"){
                            mapArea.selectAll("path")
                                .data(countries.features)
                                .enter()
                                .append("path")
                                .attr('d', path)
                                .attr('fill', 'lightgray')
                                .attr('stroke', 'white');

                            var coords = [];
                            data.forEach(function(d){
                                var lat = parseFloat(d.lat);
                                var lon = parseFloat(d.lon);
                                if (isNaN(lat) || isNaN(lon))return;
                                var coord = projection([lon, lat]);
                                if (!coord) return;
                                coord.push(parseFloat(d[chartConfig.mapValue]));
                                coords.push(coord);
                            });
                            if (coords.length===0){ //use state centroids
                                data.forEach(function(d){
                                    var country = d.country;
                                    for (var i = 0; i < countries.features.length; i++){
                                        var feature = countries.features[i];
                                        console.log(feature);
                                        if (country === feature.properties.code){
                                            if (chartConfig.mapValue){
                                                var val = parseFloat(d[chartConfig.mapValue]);
                                                if (!isNaN(val) && val>0){
                                                    var coord = path.centroid(feature);
                                                    coord.push(d[chartConfig.mapValue]);
                                                    coords.push(coord);
                                                }
                                            }
                                        }
                                    }
                                });
                            }

                            for (var i=0; i<coords.length; i++){
                                var coord = coords[i];
                                var val = coord[2];
                                if (isNaN(val) || val<=0) continue;
                                var p = val/extent[1];
                                var maxSize = 30;
                                if (!isNaN(chartConfig.pointRadius)) maxSize = maxSize*chartConfig.pointRadius;
                                var r = maxSize*p;
                                mapArea.append("circle")
                                    .attr("cx", coord[0])
                                    .attr("cy", coord[1])
                                    .attr("r", r + "px")
                                    .style("fill", "rgb(217,91,67)");
                            }

                        }else if(chartConfig.mapType === "Area"){
                            var aggregateState = 0;
                            data.forEach(function(d){
                                var state;
                                var country;
                                if(d.state) {
                                    state = d.state;
                                    aggregateState = aggregateState + parseFloat(d[chartConfig.mapValue]);
                                    //console.log(aggregateState);
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
                    });
                }
            }else{
                if(chartConfig.mapLevel == "countries"){
                    getData("countries", function(mapData){
                        var countries = topojson.feature(mapData, mapData.objects.countries);
                        var projection = d3.geoMercator()
                                        .scale(width / 2 / Math.PI)
                                        .translate([width / 2, height / 2]);
                        var path = d3.geoPath().projection(projection);
                        if(chartConfig.mapType === "Area"){
                            var nodes = data.nodes;
                            for(var country in nodes){
                                if(nodes.hasOwnProperty(country)){
                                    countryCode = nodes[country].country;
                                    //console.log(country + " -> " + countryCode);
                                    for(var i = 0; i < countries.features.length; i++){
                                        if(countryCode == countries.features[i].properties.code){
                                            countries.features[i].properties.inData = true;
                                            countries.features[i].properties.mapValue = 1000;
                                        }
                                    }
                                }
                            }
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
                    });
                }
            }
        });
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var getData = bluewave.utils.getData;

    init();
};