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
    var title = "Global Supply Chain";

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
        mainDiv.className = "global-supply-chain center";
        mainDiv.style.position = "relative";
        mainDiv.style.width = "1400px";
        mainDiv.style.height = "100%";
        parent.appendChild(mainDiv);
        me.el = mainDiv;


        var panel = document.createElement("div");
        panel.style.width = "100%";
        panel.style.height = "100%";
        mainDiv.appendChild(panel);



        dashboardPanel = createDashboardPanel(panel);
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
    var createDashboardPanel = function(panel){



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

        var sankey = createSankey(td);

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
            title: "Top Manufacturers",
            width: "100%",
            height: "100%"
        });
        var consignees = createDashboardItem(createCell(), {
            title: "Top Consignees",
            width: "100%",
            height: "100%"
        });




        panel.clear = function(){
            countryOfOrigin.innerDiv.innerHTML = "";
            manufacturers.innerDiv.innerHTML = "";
            consignees.innerDiv.innerHTML = "";
        };

        panel.update = function(){

          //Update map
            get("import/network", {
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


          //Update sankey
            get("import/network2", {
                success: function(text) {
                    updateSankey(text, sankey);
                }
            });


          //Update bar charts
            get("import/ProductCode?include=country_of_origin", {
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


                    get("import/ProductCode?include=manufacturer", {
                        success: function(text) {
                            var data = d3.csvParse(text);
                            data.forEach((d)=>{
                                d.manufacturer = "m" + d.manufacturer;
                            });
                            createBarChart(manufacturers.innerDiv, data, "manufacturer", yAxis, "product_code", 10, colorMap);
                        }
                    });

                    get("import/ProductCode?include=consignee", {
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
            stackValues: true,
            sort: "descending"
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
  //** createSankey
  //**************************************************************************
    var createSankey = function(parent){
        
        var div = document.createElement("div");
        div.style.width = "990px";
        div.style.height = "33%";
        div.style.display = "inline-block";
        div.style.position = "relative";
        div.style.overflow = "hidden";
        parent.appendChild(div);
        
        var panel = createDashboardItem(div, {
            title: "Supply Chain from Source to Consignee",
            subtitle: "Top manufacturers to top consignee",
            width: "100%",
            height: "100%"
        });
        
        
        var outerDiv = document.createElement("div");
        outerDiv.style.width = "100%";
        outerDiv.style.height = "100%";
        outerDiv.style.position = "relative";
        outerDiv.style.overflow = "hidden";
        outerDiv.style.overflowY = "auto";
        panel.innerDiv.appendChild(outerDiv);
        

        var innerDiv = document.createElement("div");
        innerDiv.style.width = "990px";
        innerDiv.style.height = "500px";
        innerDiv.style.position = "absolute";
        outerDiv.appendChild(innerDiv);
        

        
        var sankey = new bluewave.charts.SankeyChart(innerDiv, {});
        sankey.getNodeLabel = function(node){
            var name = node.name;
            var idx = name.indexOf("_");
            if (idx>-1) name = name.substring(0,idx);
            return name;
        };
        return sankey;
    };
    
    
  //**************************************************************************
  //** updateSankey
  //**************************************************************************
    var updateSankey = function(csv, sankey){
        
        var data = d3.csvParse(csv);
        data.forEach((d)=>{
            d[yAxis] = parseFloat(d[yAxis]);
        });
        
        var getString = function(s){
            if (!s) return null;
            s = (s+"").trim();
            if (s.length==0 || s=='null' || s=='undefined') s = null;
            return s;
        };
        
        var getTopManufacturers = function(data){


            var manufacturers = {};
            var totalLines = 0;
            data.forEach((d)=>{
                var manufacturer = getString(d.manufacturer_name);
                var v = manufacturers[manufacturer];
                if (isNaN(v)) v = 0;
                manufacturers[manufacturer] = (v+d.lines);
                totalLines += d.lines;
            });

            var arr = [];
            for (var manufacturer in manufacturers){
                if (manufacturers.hasOwnProperty(manufacturer)){
                    var val = manufacturers[manufacturer];
                    arr.push({
                        manufacturer: manufacturer,
                        lines: val
                    });
                }
            }

            arr.sort(function(a,b){
                return b.lines-a.lines;
            });

            manufacturers = {};
            var topLines = 0;
            arr.slice(0, Math.min(data.length, 20)).forEach((d)=>{
                manufacturers[d.manufacturer] = d.lines;
                topLines += d.lines;
            });
            manufacturers["Other"] = totalLines-topLines;
            return manufacturers;
        };


        var getTopConsignees = function(data){


            var consignees = {};
            var totalLines = 0;
            data.forEach((d)=>{
                var consignee = getString(d.consignee_name);
                var v = consignees[consignee];
                if (isNaN(v)) v = 0;
                consignees[consignee] = (v+d.lines);
                totalLines += d.lines;
            });

            var arr = [];
            for (var consignee in consignees){
                if (consignees.hasOwnProperty(consignee)){
                    var val = consignees[consignee];
                    arr.push({
                        consignee: consignee,
                        lines: val
                    });
                }
            }

            arr.sort(function(a,b){
                return b.lines-a.lines;
            });

            consignees = {};
            var topLines = 0;
            arr.slice(0, Math.min(data.length, 20)).forEach((d)=>{
                consignees[d.consignee] = d.lines;
                topLines += d.lines;
            });
            consignees["Other"] = totalLines-topLines;
            return consignees;
        };
        

      //Reduce data to the top 10 manufacturers
        var topManufacturers = getTopManufacturers(data);
        var data2 = [];
        data.forEach((d)=>{
            var manufacturer = getString(d.manufacturer_name);
            if (topManufacturers[manufacturer]) data2.push(d);
        });
        data = data2;

      //Reduce data to the top 10 consignees
        var topConsignees = getTopConsignees(data);




        var nodes = {};
        var createNode = function(name, group){
            var node = {
                name: name,
                group: group
            };
            var key = node.name+"_"+node.group;
            nodes[key] = node;
        };



      //Add links
        data.forEach((d)=>{
            var value = d.lines;
            var country = getString(d.manufacturer_cc);
            var manufacturer = getString(d.manufacturer_name);
            var consignee = getString(d.consignee_name);
            //var port = getString(d.unladed_port);

            if (!topConsignees[consignee]) return;



          //Stringify FEIs
            if (manufacturer) manufacturer+="_m";
            if (consignee) consignee+="_c";
            //if (port) port+="_p";

            if (country) createNode(country, "country");
            if (manufacturer) createNode(manufacturer, "manufacturer");
            if (consignee) createNode(consignee, "consignee");
            //if (port) createNode(port, "port");

            if (country && manufacturer && consignee){
                sankey.addLink(country, manufacturer, value);
                sankey.addLink(manufacturer, consignee, value);
            }
        });


      //Add nodes
        Object.values(nodes).forEach((node)=>{
            sankey.addNode(node);
        });

        sankey.update();
        
        sankey.getChart().attr("transform", "scale(0.95,0.95)");
        
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
        div.style.position = "relative";
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