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
    var politicalBoundaries;


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
        if(chartConfig.mapProjectionValue === null) return;

        this.clear();

        var parent = svg.node().parentNode;
        onRender(parent, function(){

            var width = parent.offsetWidth;
            var height = parent.offsetHeight;
            var projection = chartConfig.mapProjectionValue
                            .translate([width/2,height/2]);
            var colorScale = d3.scaleThreshold()
                            .domain([100000, 1000000, 10000000, 30000000, 100000000, 500000000])
                            .range(d3.schemeBlues[7]);
            var margin = config.margin;


            let tempData = d3.map();
            mapArea
                .selectAll("path")
                .data(politicalBoundaries.features)
                .enter().append("path")
                    .attr("fill", function(d){
                        if(chartConfig.mapType==="Area"){
                            d.total = tempData.get(d.id)||0;
                            return colorScale(d.total);
                        }else{
                            return colorScale(0);
                        }
                    })
                    .attr("d", d3.geoPath()
                        .projection(projection))
                    .style("stroke", "#fff");

            mapArea.selectAll('circle').remove();
            if(chartConfig.mapType === "Point"){
                let filteredData = data.filter((val)=>{
                    let lat = parseFloat(val[chartConfig.latitude]);
                    let lon = parseFloat(val[chartConfig.longitude]);
                    let isValidProjection = projection([lat, lon]);
                    if(!isValidProjection[0] || !isValidProjection[1]){
                        return false;
                    }else{
                        return true;
                    }
                });
                mapArea.selectAll("circle")
                        .data(filteredData)
                        .enter()
                        .append("circle")
                        .attr("cx", function (d) {
                            let lat = parseFloat(d.lat);
                            let lon = parseFloat(d.lon);
                            return projection([lat,lon])[0];
                        })
                            .attr("cy", function (d) {
                            let lat = parseFloat(d.lat);
                            let lon = parseFloat(d.lon);
                            return projection([lat,lon])[1];
                        })
                        .attr("r", "2px")
                        .attr("fill", "red");
            };
        });
    }

    //**************************************************************************
    //** Utils
    //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;


    init();
};