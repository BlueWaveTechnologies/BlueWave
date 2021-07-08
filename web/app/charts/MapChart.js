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
        onRender(parent, function(){
            var width = parent.offsetWidth;
            var height = parent.offsetHeight;

            var colorScale = d3.scaleThreshold()
                .domain([10000, 100000, 300000, 600000, 1000000, 1500000])
                .range(d3.schemeBlues[7]);

            if(chartConfig.mapProjectionName == "Ablers USA"){
                getData("states", function(mapData) {
                    var states = topojson.feature(mapData, mapData.objects.states);
                    var projection = d3.geoIdentity()
                        .fitSize([width,height],states);
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
                        var state = d.state;
                        for(var i = 0; i < states.features.length; i++){
                            if(state == states.features[i].properties.code){
                                states.features[i].properties.inData = true;
                                states.features[i].properties.mapValue = d[chartConfig.mapValue];
                            }
                        }
                    });
                    mapArea.selectAll("path")
                        .data(states.features)
                        .enter()
                        .append("path")
                        .attr('d', path)
                        .attr('stroke', 'white')
                        .attr('fill', function(d){
                            var inData = d.properties.inData;
                            if(inData){
                                return colorScale(d.properties.mapValue);
                            }else{
                                return "lightgrey";
                            }
                        });
                    }
                });
            }else if(chartConfig.mapProjectionName == "Ablers"){
                getData("countries", function(mapData){
                    var countries = topojson.feature(mapData, mapData.objects.countries);
                    var projection = d3.geoAlbers();
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
                            console.log(d);
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
                                    console.log(countries.features[i]);
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
                                    return colorScale(d.properties.mapValue);
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