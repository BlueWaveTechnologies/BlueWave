if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  GlobalSupplyChain
//******************************************************************************
/**
 *   Used render a summary of imports by country, company, product code, etc
 *
 ******************************************************************************/

bluewave.dashboards.GlobalSupplyChain = function(parent, config) {

    var me = this;
    var title = "Import Summary";

    var dashboardPanel;
    var yAxis = "lines";
    var colors = [
        "#4e79a7", //dark blue
        "#a0cbe8", //light blue
        "#f28e2b", //dark orange
        "#ffbe7d", //light orange
        "#59a14f"  //green
    ];

  //Variables for the map panel
    var mapData = {};
    var worldMapIsReady = false;



    var waitmask;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        if (!config) config = {};
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;

        var mainDiv = document.createElement("div");
        mainDiv.style.width = "100%";
        mainDiv.style.height = "100%";
        parent.appendChild(mainDiv);
        me.el = mainDiv;

        dashboardPanel = createDashboardPanel(mainDiv);
    };


  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        return title;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

        dashboardPanel.clear();

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){

        dashboardPanel.clear();
        dashboardPanel.show();
        dashboardPanel.update();

    };


  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(){

    };


  //**************************************************************************
  //** createDashboardPanel
  //**************************************************************************
    var createDashboardPanel = function(parent){

        var panel = document.createElement("div");
        panel.className = "global-supply-chain";
        panel.style.width = "100%";
        panel.style.height = "100%";
        parent.appendChild(panel);
        addShowHide(panel);


      //Create table with 2 columns
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;
        panel.appendChild(table);


      //Row 1
        tr = document.createElement("tr");
        tbody.appendChild(tr);


      //Column 1
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        td.style.verticalAlign = "top";
        tr.appendChild(td);
        var map = createWorldMap(td);



//        var sankey = createSankeyChart(td, {
//            title: "Manufacturer to Consignee"
//        });



      //Column 2
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);


        var div = document.createElement("div");
        div.style.width = "400px";
        div.style.height = "100%";
        td.appendChild(div);

        table = createTable();
        tbody = table.firstChild;
        div.appendChild(table);

        var createCell = function(){
            tr = document.createElement("tr");
            tbody.appendChild(tr);
            td = document.createElement("td");
            td.style.width = "100%";
            td.style.height = "33%";
            td.style.padding= "0 10px 10px 0px";
            tr.appendChild(td);
            return td;
        };


        var countryOfOrigin = createDashboardItem(createCell(), {
            title: "Country of Origin",
            width: "100%",
            height: "100%"
        });
        var manufacturers = createDashboardItem(createCell(), {
            title: "Manufacturers",
            width: "100%",
            height: "100%"
        });
        var consignees = createDashboardItem(createCell(), {
            title: "Consignees",
            width: "100%",
            height: "100%"
        });




        panel.clear = function(){
            if (true) return;
            //map.clear();
            //sankey.clear();
            countryOfOrigin.innerDiv.innerHTML = "";
            //countryOfOrigin.clear();
            manufacturers.clear();
            consignees.clear();
        };

        panel.update = function(){

            get("test/imports/network4", {
                success: function(text) {


                    if (!worldMapIsReady){
                        var timer;

                        var checkWidth = function(){
                            if (!worldMapIsReady){
                                timer = setTimeout(checkWidth, 200);
                            }
                            else{
                                clearTimeout(timer);
                                updateWorldMap(text, map);
                            }
                        };

                        timer = setTimeout(checkWidth, 200);
                    }
                    else{
                        updateWorldMap(text, map);
                    }


                }
            });

            get("test/imports/country_of_origin.csv", {
                success: function(text) {
                    var data = d3.csvParse(text);

                  //Get product codes and values
                    var productValues = {};
                    data.forEach((d)=>{
                        var val = parseFloat(d[yAxis]);
                        var productCode = d.product_code;
                        var currVal = productValues[productCode];
                        if (isNaN(currVal)) currVal = 0;
                        productValues[productCode] = currVal + val;
                    });

                  //Sort product codes by value
                    var arr = [];
                    for (var productCode in productValues) {
                        if (productValues.hasOwnProperty(productCode)){
                            arr.push({
                                productCode: productCode,
                                value: productValues[productCode]
                            });
                        }
                    }
                    arr.sort((a, b)=>{
                        return b.value - a.value;
                    });


                  //Create color map
                    var colorMap = {};
                    for (var i=0; i<colors.length; i++){
                        if (i>arr.length) break;
                        colorMap[arr[i].productCode] = colors[i];
                    }

                    createBarChart(countryOfOrigin.innerDiv, data, "country_of_origin", yAxis, "product_code", 10, colorMap);


                    get("test/imports/manufacturer", {
                        success: function(text) {
                            var data = d3.csvParse(text);
                            data.forEach((d)=>{
                                d.manufacturer = "m" + d.manufacturer;
                            });
                            createBarChart(manufacturers.innerDiv, data, "manufacturer", yAxis, "product_code", 10, colorMap);
                        }
                    });

                    get("test/imports/consignee", {
                        success: function(text) {
                            var data = d3.csvParse(text);
                            data.forEach((d)=>{
                                d.consignee = "c" + d.consignee;
                            });
                            createBarChart(consignees.innerDiv, data, "consignee", yAxis, "product_code", 10, colorMap);
                        }
                    });


                }
            });
        };

        return panel;
    };


    var getTopValues = function(data, key, value, numBars){

        //Hopefully this isn't slow =(
        var sumData = d3.nest()
        .key(function(d){return d[key];})
        .rollup(function(d){
            return d3.sum(d,function(g){
                return g[value];
            });
        })
        .entries(data)
        .sort(function(a, b){
            return d3.ascending(a.value, b.value);
        });

        var topVals = sumData.slice(sumData.length - numBars);
        return topVals.map(d => d.key);
    };


  //**************************************************************************
  //** createBarChart
  //**************************************************************************
    var createBarChart = function(parent, data, xAxis, yAxis, groupBy, numBars, colorMap) {

        var config = {
            xAxis: xAxis,
            yAxis: yAxis,
            group: groupBy,
            stackValues: true
        };


        var topKeys = getTopValues(data, xAxis, yAxis, numBars);
        var filteredData = data.filter(function (d) {
            return topKeys.includes(d[xAxis]);
        });
        var barChart = new bluewave.charts.BarChart(parent, {});
        barChart.getBarColor = function(d, i){
            var productCode = d.product_code;
            var color = colorMap[productCode];
            if (!color) color = "#bebcc1";
            return color;
        };
        barChart.update(config, [filteredData]);
    };


  //**************************************************************************
  //** createWorldMap
  //**************************************************************************
    var createWorldMap = function(parent){

        var div = document.createElement("div");
        div.style.width = "990px";
        //div.style.height = "485px";
        div.style.height = "65%";
        div.style.display = "inline-block";
        div.style.position = "realtive";
        div.style.overflow = "hidden";
        div.style.border = "1px solid #e0e0e0";
        parent.appendChild(div);

        var innerDiv = document.createElement("div");
        innerDiv.style.width = "990px";
        innerDiv.style.height = "560px";
        innerDiv.style.ansolute = "realtive";
        div.appendChild(innerDiv);


        var map = new bluewave.charts.MapChart(innerDiv, {});
        map.disablePan();
        map.update();

        bluewave.utils.getMapData(function(data){
            mapData = data;
            var countries = mapData.countries;
            map.addPolygons(countries.features, {
                name: "countries",
                style: {
                    fill: "#f8f8f8",
                    stroke: "#ccc"
                }
            });

            map.setExtent([60, 70], [59, -68]); //US in the middle
            map.update(function(){
                worldMapIsReady = true;
            });
        });
        return map;
    };


  //**************************************************************************
  //** updateWorldMap
  //**************************************************************************
    var updateWorldMap = function(csv, map){
        var data = d3.csvParse(csv);

        var links = {};
        var manufacturers = {};
        var consignees = {};
        var ports = {};

        var z = 9;
        data.forEach((d)=>{

            if (d.manufacturer_lat==0 && d.manufacturer_lon==0) return;
            if (d.unladed_port_lat==0 && d.unladed_port_lon==0) return;
            if (d.consignee_lat==0 && d.consignee_lat==0) return;

            var m = kartographia.utils.getTileCoordinate(d.manufacturer_lat, d.manufacturer_lon, z);
            var p = kartographia.utils.getTileCoordinate(d.unladed_port_lat, d.unladed_port_lon, z);
            var c = kartographia.utils.getTileCoordinate(d.consignee_lat, d.consignee_lon, z);
            var v = parseFloat(d.lines);


            var val = manufacturers[m.join()];
            if (!val) val = 0;
            manufacturers[m.join()] = val + v;

            var val = ports[p.join()];
            if (!val) val = 0;
            ports[p.join()] = val + v;

            var val = consignees[c.join()];
            if (!val) val = 0;
            consignees[c.join()] = val + v;


            var link = m.join() + "," + p.join(); // + "," + c.join();
            var val = links[link];
            if (!val) val = 0;
            links[link] = val + v;
        });



        var addPoints = function(facilities, color){
            var features = [];

            var extent = d3.extent(Object.values(facilities));
            var maxVal = extent[1];
            var maxRadius = 10;

            Object.keys(facilities).forEach((tileCoord)=>{
                var arr = tileCoord.split(",");
                arr.forEach((a,i)=>{
                    arr[i] = parseInt(a);
                });
                var lat = tile2lat(arr[1], z);
                var lon = tile2lon(arr[0], z);

                var feature = {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [lon, lat]
                    },
                    properties: {
                        value: facilities[tileCoord]
                    }
                };

                features.push(feature);
            });

            map.addPoints(features, {
                style: {
                    fill: color,
                    opacity: 0.5,
                    radius: function(d){
                        var r = Math.round((d.properties.value/maxVal)*maxRadius);
                        if (r<1) r = 1;
                        return r;
                    }
                }
            });
        };

        var addLines = function(){

            var lines = [];
            Object.keys(links).forEach((link)=>{
                var arr = link.split(",");
                arr.forEach((a,i)=>{
                    arr[i] = parseInt(a);
                });
                var manufacturer_lat = tile2lat(arr[1], z);
                var manufacturer_lon = tile2lon(arr[0], z);
                var unladed_port_lat = tile2lat(arr[3], z);
                var unladed_port_lon = tile2lon(arr[2], z);
                var value = links[link];


                var line = [[manufacturer_lon, manufacturer_lat], [unladed_port_lon, unladed_port_lat]];
                var midPoint = null;

                if (unladed_port_lon<-90){
                    midPoint = map.getMidPoint(line, 0.2, "north");
                }
                else{
                    if (manufacturer_lat>20){
                        midPoint = map.getMidPoint(line, 0.2, "north");
                    }
                    else{
                        midPoint = map.getMidPoint(line, 0.2, "south");
                    }
                }

                if (midPoint){ line.splice(1, 0, midPoint);
                lines.push(line);
                }

            });

            map.addLines(lines, {
                name: "links",
                style: {
                    color: "steelblue",
                    opacity: 0.05,
                    width: 1,
                    smoothing: "curveNatural"
                }
            });
        };

        addLines();
        addPoints(manufacturers, "green");
        addPoints(consignees, "orange");
        addPoints(ports, "red");


      //Add overlay for clicking purposes
        map.addPolygons(mapData.countries.features, {
            name: "countryOverlay",
            style: {
                fill: "rgba(0,0,0,0.0)",
                stroke: "none"
            },
            onClick: function(o){
                console.log(o.feature.properties);

//                if (e.detail === 2) {
//                    showCompanyProfile(row.record);
//                }

            },
            onMouseOver: function(o){
                o.element.transition().duration(100);
                o.element.attr("fill", "rgba(0,0,0,0.3)");
            },
            onMouseLeave: function(o){
                o.element.transition().duration(100);
                o.element.attr("fill", "rgba(0,0,0,0.0)");
            }
        });


        map.update();
    };

    Math.toDegrees = function(radians) {
        return radians * (180/Math.PI);
    };

    var tile2lon = function(x, z) {
        return x / Math.pow(2.0, z) * 360.0 - 180;
    };

    var tile2lat = function(y, z) {
        var n = Math.PI - (2.0 * Math.PI * y) / Math.pow(2.0, z);
        return Math.toDegrees(Math.atan(Math.sinh(n)));
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var get = bluewave.utils.get;
    var createDashboardItem = bluewave.utils.createDashboardItem;

    init();
};