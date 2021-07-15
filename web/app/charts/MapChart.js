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
    }

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
//        console.log(data);
//        console.log(chartConfig);
        onRender(parent, function(){
            var width = parent.offsetWidth;
            var height = parent.offsetHeight;
            var dataDomain = [];
            data.forEach(function(d){
                var domainValue = d[chartConfig.mapValue];
                dataDomain.push(domainValue);
            });
            var colorScale = {
                "blue": d3.scaleQuantile([d3.min(dataDomain), d3.max(dataDomain)], d3.schemeBlues[7]),
                "red": d3.scaleQuantile([d3.min(dataDomain), d3.max(dataDomain)], d3.schemeReds[7])
            };

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
                        mapArea.selectAll("path")
                            .data(countries.features)
                            .enter()
                            .append("path")
                            .attr('d', path)
                            .attr('fill', 'lightgray')
                            .attr('stroke', 'white');

                        mapArea.selectAll("path")
                            .data(states.features)
                            .enter()
                            .append("path")
                            .attr('d', path)
                            .attr('fill', 'lightgray')
                            .attr('stroke', 'white');

                        data.forEach(function(d){
                            var lat = parseFloat(d.lat);
                            var lon = parseFloat(d.lon);
                            if (isNaN(lat) || isNaN(lon))return;
                            var coord = projection([lon, lat]);
                            if (!coord) return;
                            mapArea.append("circle")
                                .attr("cx", coord[0])
                                .attr("cy", coord[1])
                                .attr("r", "8px")
                                .style("fill", "rgb(217,91,67)");

                        })
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
                getData("counties", function(mapData){
                    var counties = topojson.feature(mapData, mapData.objects.counties);
                    var projection = d3.geoIdentity()
                        .fitSize([width,height],counties);
                    var path = d3.geoPath().projection(projection);
                    mapArea.selectAll('circle').remove();
                    if(chartConfig.mapType === "Point"){
                        mapArea.selectAll("path")
                            .data(states.features)
                            .enter()
                            .append("path")
                            .attr('d', path)
                            .attr('fill', 'lightgray')
                            .attr('stroke', 'white');
                        projection = d3.geoAlbersUsa()
                            .scale(1850)
                            .translate([(width/2)+50, (height/2)-15]);

                        data.forEach(function(d){
                            var lat = parseFloat(d.lat);
                            var lon = parseFloat(d.lon);
                            if (isNaN(lat) || isNaN(lon))return;
                            var coord = projection([lon, lat]);
                            if (!coord) return;
                            mapArea.append("circle")
                                .attr("cx", coord[0])
                                .attr("cy", coord[1])
                                .attr("r", "8px")
                                .style("fill", "rgb(217,91,67)");

                        })
                    }else if(chartConfig.mapType === "Area"){
                        data.forEach(function(d){
                            var county = d.county;
                            for(var i = 0; i < counties.features.length; i++){
                                if(county == counties.features[i].id){
                                    counties.features[i].properties.inData = true;
                                    counties.features[i].properties.mapValue = d[chartConfig.mapValue];
                                }
                            }
                        });
                        mapArea.selectAll("path")
                            .data(counties.features)
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
            }else if(chartConfig.mapLevel == "countries"){
                getData("countries", function(mapData){
                    var countries = topojson.feature(mapData, mapData.objects.countries);
                    var projection = d3.geoMercator();
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
                        data.forEach(function(d){
                        var lat = parseFloat(d.lat);
                        var lon = parseFloat(d.lon);
                        if (isNaN(lat) || isNaN(lon))return;
                        var coord = projection([lon, lat]);
                        if (!coord) return;
                        mapArea.append("circle")
                            .attr("cx", coord[0])
                            .attr("cy", coord[1])
                            .attr("r", "8px")
                            .style("fill", "rgb(217,91,67)");

                        })
                    }else if(chartConfig.mapType === "Area"){
                        var aggregateState = 0;
                        data.forEach(function(d){
                            var state;
                            var country;
                            if(d.state) {
                                state = d.state;
                                aggregateState = aggregateState + parseFloat(d[chartConfig.mapValue]);
                                console.log(aggregateState);
                            }
                           if(d.country) country = d.country;
                            for(var i = 0; i < countries.features.length; i++){
                                if(country == countries.features[i].properties.code){
                                    countries.features[i].properties.inData = true;
                                    countries.features[i].properties.mapValue = d[chartConfig.mapValue];
                                }else if(countries.features[i].properties.code == "US"){
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
                })
            }
        })
    }

    //**************************************************************************
    //** Utils
    //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var getData = bluewave.utils.getData;

    init();
};