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
    var title = "Medical Glove Supply Chain";

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
    var countryNames = {};
    var worldMapIsReady = false;

    var importsByCountry = [];
    var productCodes = {};
    var mapPanel, sankeyPanel;
    var popup, importSummary, usMap; //popup windows
    var tooltip;
    var waitmask;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        if (!config) config = {};
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;
        tooltip = createTooltip();

        var mainDiv = document.createElement("div");
        mainDiv.style.position = "relative";
        mainDiv.style.width = "100%";
        mainDiv.style.height = "100%";
        mainDiv.style.overflow = "hidden";
        mainDiv.style.overflowY = "auto";
        mainDiv.style.textAlign = "center";
        parent.appendChild(mainDiv);
        me.el = mainDiv;


        var panel = document.createElement("div");
        panel.className = "global-supply-chain";
        panel.style.width = "1400px";
        panel.style.height = "100%";
        panel.style.display = "inline-block";
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
        if (importSummary) importSummary.hide();
        if (popup) popup.hide();
        importsByCountry = [];
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
        td.style.padding = "7px 0";
        td.style.verticalAlign = "top";
        tr.appendChild(td);
        var leftCol = td;


      //Column 2
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.padding = "7px 0";
        tr.appendChild(td);
        var rightCol = td;



      //Populate left column
        table = createTable();
        leftCol.appendChild(table);
        tbody = table.firstChild;
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "1px";
        tr.appendChild(td);
        
      //Create panel to hold the map and sankey charts
        var div = document.createElement("div");
        div.style.width = "990px";
        div.style.height = "485px";
        div.style.display = "inline-block";
        div.style.position = "relative";
        div.style.border = "1px solid #e0e0e0";
        td.appendChild(div);        
        
      //Add map
        mapPanel = createWorldMap(div);
        
      //Add sankey
        sankeyPanel = createSankeyPanel(div);
        sankeyPanel.hide();
        
      //Add toggle button to switch from map to sankey view
        var toggleBar = document.createElement("div");
        toggleBar.style.position = "absolute";
        toggleBar.style.top = "7px";
        toggleBar.style.right = "7px";
        toggleBar.style.zIndex = 2;
        div.appendChild(toggleBar);
        bluewave.utils.createToggleButton(toggleBar, {
            options: ["Map","Sankey"],
            defaultValue: "Map",
            onChange: function(val){
                if (val==="Map"){
                    sankeyPanel.hide();
                    mapPanel.show();
                }
                else{
                    mapPanel.hide();
                    sankeyPanel.show();
                }
            }
        });
        
        
      //Create line chart
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.verticalAlign = "top";
        td.style.padding = "7px 0 0";
        tr.appendChild(td);
        var lineChart = createLineChart(td);



        var div = document.createElement("div");
        div.style.width = "400px";
        div.style.height = "100%";
        rightCol.appendChild(div);

        table = createTable();
        tbody = table.firstChild;
        div.appendChild(table);

        var createCell = function(){
            tr = document.createElement("tr");
            tbody.appendChild(tr);
            td = document.createElement("td");
            td.style.width = "100%";
            td.style.height = "25%";
            td.style.padding = (tbody.childNodes.length>1 ? "7px" : "0") + " 0px 0px 0px";
            tr.appendChild(td);
            return td;
        };



        var productPanel = createDashboardItem("Top ProCodes", createCell());
        var countryPanel = createDashboardItem("Top Countries by ProCode", createCell());
        var manufacturerPanel = createDashboardItem("Top Manufacturers by ProCode", createCell());
        var consigneePanel = createDashboardItem("Top Consignees by ProCode", createCell());


        panel.clear = function(){
            if (popup) popup.hide();
            productPanel.innerDiv.innerHTML = "";
            countryPanel.innerDiv.innerHTML = "";
            manufacturerPanel.innerDiv.innerHTML = "";
            consigneePanel.innerDiv.innerHTML = "";
            //mapPanel.map.clear();
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
                                updateWorldMap(text, mapPanel.map);
                            }
                        };

                        timer = setTimeout(checkWidth, 200);
                    }
                    else{
                        updateWorldMap(text, mapPanel.map);
                    }
                }
            });


          //Update sankey
            get("import/network2", {
                success: function(text) {
                    if (!sankeyPanel.sankey) return;
                    updateSankey(text, sankeyPanel.sankey);
                    sankeyPanel.onPopup = function(){
                        var sankey = new bluewave.charts.SankeyChart(popup.getBody(), {});
                        updateSankey(text, sankey);
                    };
                }
            });
            
            
          //Update sankey
            get("import/history?groupBy=country", {
                success: function(text) {
                    var data = d3.csvParse(text);
                    lineChart.update(data);
                }
            });


          //Update bar charts
            get("import/ProductCode?include=country_of_origin", {
            //get("test/imports/country_of_origin.csv", {
                success: function(text) {
                    var data = d3.csvParse(text);
                    importsByCountry = data;

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


                  //Look-up product codes
                    get("SupplyChain/ProductCodes?code="+Object.keys(productValues), {
                        success: function(arr) {
                            arr.forEach((d)=>{
                                productCodes[d.product_code] = d;
                            });
                        }
                    });


                  //Render top products
                    renderTopProducts(productPanel.innerDiv, data, colorMap);
                    productPanel.onPopup = function(){
                        renderTopProducts(popup.getBody(), data, colorMap);
                    };


                  //Render top countries
                    renderTopCountries(countryPanel.innerDiv, data, colorMap);
                    countryPanel.onPopup = function(){
                        renderTopCountries(popup.getBody(), data, colorMap);
                    };


                  //Render top manufacturers
                    get("import/ProductCode?include=manufacturer", {
                        success: function(text) {
                            var data = d3.csvParse(text);
                            renderTopManufacturers(manufacturerPanel.innerDiv, data, colorMap);
                            manufacturerPanel.onPopup = function(){
                                renderTopManufacturers(popup.getBody(), data, colorMap);
                            };
                        }
                    });


                  //Render top consignee
                    get("import/ProductCode?include=consignee", {
                        success: function(text) {
                            var data = d3.csvParse(text);
                            renderTopConsignees(consigneePanel.innerDiv, data, colorMap);
                            consigneePanel.onPopup = function(){
                                renderTopConsignees(popup.getBody(), data, colorMap);
                            };
                        }
                    });

                }
            });
        };

        return panel;
    };


  //**************************************************************************
  //** renderTopProducts
  //**************************************************************************
    var renderTopProducts = function(parent, data, colorMap){

        var barChart = createBarChart(parent, data, "product_code", yAxis, null, 10, colorMap);

        var mouseover = function(label) {
            var product = productCodes[label];
            if (product) label += ": " + product.device_name;
            tooltip.html(label).show();
        };

        var labels = barChart.getXAxis().selectAll("text");
        labels.on("mouseover", mouseover);
        labels.on("mousemove", mousemove);
        labels.on("mouseleave", mouseleave);
        labels.on("click",function(label){

        });
    };


  //**************************************************************************
  //** renderTopCountries
  //**************************************************************************
    var renderTopCountries = function(parent, data, colorMap){

        var barChart = createBarChart(parent, data, "country_of_origin", yAxis, "product_code", 10, colorMap);

        var mouseover = function(label) {
            var countryName = countryNames[label];
            if (countryName) label = countryName;
            tooltip.html(label).show();
        };

        var labels = barChart.getXAxis().selectAll("text");
        labels.on("mouseover", mouseover);
        labels.on("mousemove", mousemove);
        labels.on("mouseleave", mouseleave);

        var countries;
        labels.on("click",function(label){
            if (!countries){
                countries = {};
                data.forEach((d)=>{
                    countries[d.country_of_origin] = d.country_of_origin;
                });
            }
            showImportSummary(label);
        });
    };


  //**************************************************************************
  //** renderTopManufacturers
  //**************************************************************************
    var renderTopManufacturers = function(parent, data, colorMap){

        var manufacturerNames = {};

        data.forEach((d)=>{
            var label = getLabel(d.manufacturer);
            manufacturerNames[label] = d.manufacturer;
            d.manufacturer = label;
        });
        var barChart = createBarChart(parent, data, "manufacturer", yAxis, "product_code", 10, colorMap);



        var mouseover = function(label) {
            var manufacturerName = manufacturerNames[label];
            if (manufacturerName) label = manufacturerName;
            tooltip.html(label).show();
        };


        var labels = barChart.getXAxis().selectAll("text");
        labels.on("mouseover", mouseover);
        labels.on("mousemove", mousemove);
        labels.on("mouseleave", mouseleave);
        labels.on("click",function(label){
            //console.log(label);
        });
    };


  //**************************************************************************
  //** renderTopConsignees
  //**************************************************************************
    var renderTopConsignees = function(parent, data, colorMap){


        var consigneeNames = {};
        data.forEach((d)=>{
            var label = getLabel(d.consignee);
            consigneeNames[label] = d.consignee;
            d.consignee = label;
        });
        var barChart = createBarChart(parent, data, "consignee", yAxis, "product_code", 10, colorMap);


        var mouseover = function(label) {
            var consigneeName = consigneeNames[label];
            if (consigneeName) label = consigneeName;
            tooltip.html(label).show();
        };

        var labels = barChart.getXAxis().selectAll("text");
        labels.on("mouseover", mouseover);
        labels.on("mousemove", mousemove);
        labels.on("mouseleave", mouseleave);
        labels.on("click",function(label){
            //console.log(label);
        });
    };


    var mousemove = function() {
        var e = d3.event;
        if (tooltip) tooltip
        .style('top', (e.clientY) + "px")
        .style('left', (e.clientX + 20) + "px");
    };

    var mouseleave = function() {
        if (tooltip) tooltip.hide();
    };


    var maxLen = 10;
    var getLabel = function(str){
        if (isNumeric(str)){
            return str+"_";
        }
        else{
            if (str.length<=maxLen) return str;
            str = str.substring(0, maxLen-3) + "...";
            return str;
        }
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
            showTooltip: true,
            sort: "descending"
        };


        var topKeys = getTopValues(data, xAxis, yAxis, numBars);
        var filteredData = data.filter(function (d) {
            return topKeys.includes(d[xAxis]);
        });
        var barChart = new bluewave.charts.BarChart(parent, {});
        barChart.getBarColor = function(d, i, arr){
            var productCode = arr[0].product_code;
            var color = colorMap[productCode];
            if (!color) color = "#bebcc1";
            return color;
        };
        barChart.getTooltipLabel = function(d, i, arr){
            var productCode = arr[0].product_code;
            return productCode + ": " + formatNumber(d.value);
        };
        barChart.update(config, [filteredData]);
        return barChart;
    };


  //**************************************************************************
  //** createLineChart
  //**************************************************************************
    var createLineChart = function(parent){

        var div = document.createElement("div");
        div.style.width = "990px";
        div.style.height = "100%";
        div.style.display = "inline-block";
        div.style.position = "relative";
        div.style.overflow = "hidden";
        parent.appendChild(div);

        var panel = createDashboardItem(
            "Import History",
            "Shipments to the US by country of origin",
            div
        );



        var chartConfig = {
            yGrid: true,
            endTags: true,
            stackValues: false,
            accumulateValues: false,
            animationSteps: 0
        };

        var lineChart = new bluewave.charts.LineChart(panel.innerDiv, chartConfig);



        panel.clear = function(){
            lineChart.clear();
        };
        
        panel.update = function(data){
            panel.clear();
            console.log(data);
            
            var importsByCountry = {};
            var importTotals = {};
            data.forEach((d)=>{
                var key = d.country;
                var val = d[yAxis] = parseFloat(d[yAxis]);

                var dt = Date.parse(d.date);
                if (!isNaN(dt)){
                    //d.date = dt;
                    var date = new Date(dt);
                    if (date.getFullYear()>2019){                                                                                    
                        d.date = date;

                        var arr = importsByCountry[key];
                        if (!arr){
                            arr = [];
                            importsByCountry[key] = arr;
                        }
                        arr.push(d);


                        var currTotal = importTotals[key];
                        if (isNaN(currTotal)) importTotals[key] = val;
                        else importTotals[key] += val;                    
                    }
                }

            });



            //console.log(importTotals);
            var arr = [];
            for (var key in importsByCountry){
                if (importsByCountry.hasOwnProperty(key)){
                    arr.push({
                        establishment: key,
                        totalImports: importTotals[key]
                    });
                }
            }    
            arr.sort((a, b)=>{
                return b.totalImports - a.totalImports;
            });
            
            
var smoothing = 90;
var smoothingType = "movingAverage";
                
            //console.log(importsByCountry);
            lineChart.clear();
            var lines = [];
            var other = null;
            var includeOtherData = true;
            var lastDate = null;
            arr.forEach((d, i)=>{
                var key = d.establishment;
                var data = importsByCountry[key];

                if (i<5){


                    data.sort(function(a, b){
                        return a.date - b.date;
                    });

                    if (!lastDate) lastDate = data[data.length-1].date.getTime();
                    else lastDate = Math.min(lastDate, data[data.length-1].date.getTime());

                    var line = new bluewave.chart.Line({
                        label: countryNames[key],
                        smoothing: smoothingType,
                        smoothingValue: smoothing
                    });

                    lines.push({
                        line: line,
                        data: data
                    });

                    //console.log(data);                        
                    //lineChart.addLine(line, data, "date", yAxis);    
                }
                else{

                    if (includeOtherData){

                        if (!other) other = data;
                        else{
                            data.forEach((d)=>{
                                var dt = d.date.getTime();
                                var addRow = true;
                                other.every((o)=>{
                                    if (o.date.getTime()===dt){
                                        addRow = false;
                                        o[yAxis]+=d[yAxis];
                                        return false;
                                    }
                                    return true;
                                });

                                if (addRow) other.push(d);

                            });
                        }

                    }

                }
            });
            
            
          //Add lines
            if (other){
                other.sort(function(a, b){
                    return a.date - b.date;
                });

                var arr = [];
                other.forEach((d)=>{
                    if (d.date.getTime()<=lastDate){
                        arr.push(d);
                    }
                });
                other = arr;

                var line = new bluewave.chart.Line({
                    label: "Other",
                    color: "#bebcc1",
                    smoothing: smoothingType,
                    smoothingValue: smoothing
                });   
                lineChart.addLine(line, other, "date", yAxis); 
            }
            lines.forEach((l, i)=>{
                var lineColor = colors[i % colors.length];
                l.line.setColor(lineColor);

                var arr = [];
                l.data.forEach((d)=>{
                    if (d.date.getTime()<=lastDate){
                        arr.push(d);
                    }
                });
                l.data = arr;                    


                lineChart.addLine(l.line, l.data, "date", yAxis);
            });


            lineChart.update();
            
        };
        

        return panel;
    };
    
    
  //**************************************************************************
  //** createSankeyPanel
  //**************************************************************************
    var createSankeyPanel = function(parent){

        var div = document.createElement("div");
        div.style.width = "990px";
        div.style.height = "100%";
        div.style.display = "inline-block";
        div.style.position = "relative";
        div.style.overflow = "hidden";
        parent.appendChild(div);
        addShowHide(div);
        
        var panel = createDashboardItem(
            "Supply Chain from Source to Consignee",
            "Top manufacturers to top consignees",
            div
        );
        panel.show = function(){
            div.show();
        };
        panel.hide = function(){
            div.hide();
        };
        
        
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

        panel.sankey = sankey;

        return panel;
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

      //Render sankey
        sankey.update();


      //Resize the chart when ready
        var g = sankey.getChart();
        if (g){
            g.attr("transform", "scale(0.95,0.95)");
        }
        else {
            var timer;
            var getChart = function(){
                g = sankey.getChart();
                if (g){
                    clearTimeout(timer);
                    g.attr("transform", "scale(0.95,0.95)");
                }
                else {
                    timer = setTimeout(getChart, 100);
                }
            };
            timer = setTimeout(getChart, 100);
        }

    };


  //**************************************************************************
  //** createWorldMap
  //**************************************************************************
    var createWorldMap = function(parent){

        var div = document.createElement("div");
        div.style.width = "990px";
        div.style.height = "485px";
        //div.style.height = "65%";
        div.style.display = "inline-block";
        div.style.position = "relative";
        div.style.overflow = "hidden";
        //div.style.border = "1px solid #e0e0e0";
        parent.appendChild(div);
        addShowHide(div);

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


            countries.features.forEach((feature)=>{
                var p = feature.properties;
                countryNames[p.code] = p.name;
            });



            map.setExtent([60, 70], [59, -68]); //US in the middle
            map.update(function(){
                worldMapIsReady = true;
            });
        });
        
        
        
        div.map = map;
        return div;
    };


  //**************************************************************************
  //** updateWorldMap
  //**************************************************************************
    var updateWorldMap = function(csv, map){
        var data = d3.csvParse(csv);
        if (data.length===0) return;

        var links = {};
        var manufacturers = {};
        var consignees = {};
        var ports = {};
        var countries = {};

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

            var val = countries[d.manufacturer_cc];
            if (!val) val = 0;
            countries[d.manufacturer_cc] = val + v;

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
                var e = o.event;
                //if (e.detail === 2) { //double click
                    var countryCode = o.feature.properties.code;
                    if (!countries[countryCode]) return;

                    if (countryCode==='US'){
                        showUSMap(data);
                    }
                    else{
                        showImportSummary(countryCode);
                    }
                //}
            },
            onMouseOver: function(o){
                var countryCode = o.feature.properties.code;
                if (!countries[countryCode]) return;

                o.element.transition().duration(100);
                o.element.attr("fill", "rgba(0,0,0,0.3)");
            },
            onMouseLeave: function(o){
                var countryCode = o.feature.properties.code;
                if (!countries[countryCode]) return;

                o.element.transition().duration(100);
                o.element.attr("fill", "rgba(0,0,0,0.0)");
            }
        });


        map.update();
    };


  //**************************************************************************
  //** updateUSMap
  //**************************************************************************
    var updateUSMap = function(data, map){
        //var data = d3.csvParse(csv);

        var links = {};
        var consignees = {};
        var ports = {};

        var z = 15;
        data.forEach((d)=>{

            if (d.unladed_port_lat==0 && d.unladed_port_lon==0) return;
            if (d.consignee_lat==0 && d.consignee_lat==0) return;

            var p = kartographia.utils.getTileCoordinate(d.unladed_port_lat, d.unladed_port_lon, z);
            var c = kartographia.utils.getTileCoordinate(d.consignee_lat, d.consignee_lon, z);
            var v = parseFloat(d.lines);


            var val = ports[p.join()];
            if (!val) val = 0;
            ports[p.join()] = val + v;

            var val = consignees[c.join()];
            if (!val) val = 0;
            consignees[c.join()] = val + v;


            var link = p.join() + "," + c.join(); // + "," + c.join();
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
                var midPoint = null; //map.getMidPoint(line, 0.1);


                if (midPoint){ line.splice(1, 0, midPoint);
                //
                }
                lines.push(line);

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
        addPoints(consignees, "orange");
        addPoints(ports, "red");

        map.update();
    };


  //**************************************************************************
  //** showUSMap
  //**************************************************************************
    var showUSMap = function(data){
        if (!usMap){
            var win = new javaxt.dhtml.Window(document.body, {
                title: "US Network",
                width: 1060,
                height: 600,
                modal: true,
                style: config.style.window,
                resizable: true
            });


            var map = new bluewave.charts.MapChart(win.getBody(), {});
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

                var states = mapData.states;
                map.addPolygons(states.features, {
                    name: "states",
                    style: {
                        fill: "#f8f8f8",
                        stroke: "#ccc"
                    }
                });

                map.setProjection("Albers");
                //map.setExtent([-130, 50.5], [-65, 25.8]);
                map.setExtent([-130, 40.5], [-65, 25.8]);
                map.update();
            });


            usMap = {
                update: function(data){
                    updateUSMap(data, map);
                },
                show: function(){
                    win.show();
                },
                hide: function(){
                    win.hide();
                }
            };

        }

        usMap.show();
        usMap.update(data);

    };


  //**************************************************************************
  //** showImportSummary
  //**************************************************************************
    var showImportSummary = function(countryCode){
        if (!importSummary){
            var win = new javaxt.dhtml.Window(document.body, {
                title: "Import Summary",
                width: 1410,
                height: (1080-300),
                modal: true,
                style: config.style.window,
                resizable: true
            });

            importSummary = new bluewave.dashboards.ImportSummary(win.getBody(), config);
            importSummary.show = function(){
                win.show();
            };
            importSummary.hide = function(){
                win.hide();
            };
        }

        importSummary.clear();
        importSummary.show();
        importSummary.update(importsByCountry, countryCode);
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
  //** createDashboardItem
  //**************************************************************************
    var createDashboardItem = function(title, subtitle, parent){
        if (arguments.length==2){
            parent = subtitle;
            subtitle = null;
        }

        var dashboardItem = bluewave.utils.createDashboardItem(parent, {
            title: title,
            subtitle: subtitle,
            width: "100%",
            height: "100%",
            settings: true
        });
        dashboardItem.el.style.minHeight = "180px";
        var icon = dashboardItem.settings.getElementsByTagName("i")[0];
        if (icon) icon.className = "fas fa-expand";
        dashboardItem.settings.onclick = function(){
            if (!popup){
                popup = new javaxt.dhtml.Window(document.body, {
                    width: 1060,
                    height: 600,
                    modal: true,
                    style: config.style.window,
                    resizable: true
                });
            }
            popup.getBody().innerHTML = "";
            popup.setTitle(title);
            popup.show();
            if (dashboardItem.onPopup) dashboardItem.onPopup();
        };
        return dashboardItem;
    };
    
    
  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var isNumeric = javaxt.dhtml.utils.isNumber;
    
    var get = bluewave.utils.get;
    var createTooltip = bluewave.chart.utils.createTooltip;
    var formatNumber = bluewave.utils.formatNumber;

    init();
};