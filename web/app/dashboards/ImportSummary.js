if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  ImportSummary
//******************************************************************************
/**
 *   Used render a summary of imports by country, company, product code, etc
 *
 ******************************************************************************/

bluewave.dashboards.ImportSummary = function(parent, config) {

    var me = this;
    var initializing = true;
    var title = "Import Summary";

    var dashboardPanel;

  //Variables for the map panel
    var mapData = {};
    var worldMapIsReady = false;


  //Variables for the second panel
    var grid;
    var data = [];
    var lineData = [];
    var countryOptions, productOptions, establishmentOptions; //dropdowns
    var slider, thresholdInput;
    var lineChart, barChart, scatterChart;
    var yAxis;
    var nodeView;


    var companyProfile; //popup
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


        data = [];
        lineData = [];
        grid.clear();
        establishmentOptions.setValue("Manufacturer", true);
        countryOptions.setValue("TH", true); //Select Thailand by default for demo purposes
        productOptions.setValue("All", true);
        yAxis = "totalLines";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){

        dashboardPanel.clear();
        dashboardPanel.show();
        dashboardPanel.update();


        if (true) return;

        var onReady = function(){
            me.clear();
            update();
        };

        if (initializing){
            var timer;

            var checkStatus = function(){
                if (initializing){
                    timer = setTimeout(checkStatus, 100);
                }
                else{
                    clearTimeout(timer);
                    onReady();
                }
            };

            timer = setTimeout(checkStatus, 100);
        }
        else{
            onReady();
        }
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


        var createBarChart = function(parent, data, xAxis, yAxis, groupBy, numBars) {

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
            barChart.update(config, [filteredData]);
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
            get("import/network",{
                success: function(csv){
                    var data = d3.csvParse(csv);
                    data.forEach((d)=>{
                        d.lines = parseFloat(d.lines);
                    });

                }
            });

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
                    createBarChart(countryOfOrigin.innerDiv, data, "country_of_origin", "lines", "product_code", 10);
                }
            });

            get("test/imports/manufacturer", {
                success: function(text) {
                    var data = d3.csvParse(text);
                    createBarChart(manufacturers.innerDiv, data, "manufacturer", "lines", "product_code", 10);
                }
            });

            get("test/imports/consignee", {
                success: function(text) {
                    var data = d3.csvParse(text);
                    createBarChart(consignees.innerDiv, data, "consignee", "lines", "product_code", 10);
                }
            });
        };

        return panel;
    };


  //**************************************************************************
  //** createImportsPanel
  //**************************************************************************
    var createImportsPanel = function(parent){

      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;

      //Create toolbar
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createToolbar(td);


      //Create grid
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        createGrid(td);


      //Create charts
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "350px";
        tr.appendChild(td);
        createCharts(td);


        parent.appendChild(table);

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(){
        if (companyProfile) companyProfile.hide();
        if (grid) grid.setSortIndicator(3, "DESC");


        if (true) return;

        waitmask.show(500);


        var establishment = getEstablishment();
        var country = countryOptions.getValue();
        var threshold = parseFloat(thresholdInput.value);
        if (isNaN(threshold)) threshold = "";

        data = [];
        get("import/summary?country=" + country + "&establishment=" + establishment + "&threshold=" + threshold, {
            success: function(csv){
                var rows = parseCSV(csv, ",");
                var header = rows.shift();
                var createRecord = function(row){
                    var r = {};
                    header.forEach((field, i)=>{
                        var val = row[i];
                        if (field==="fei"||field==="manufacturer"||field==="shipper"||
                            field==="importer"||field==="consignee"||field==="dii"){
                            val = val.split(",");
                        }
                        else if (field!="name"){
                            val = Math.round(parseFloat(val));
                        }
                        r[field] = val;
                    });
                    return r;
                };
                rows.forEach((row)=>{
                    data.push(createRecord(row));
                });

                data.sort(function(a,b){
                    return b.totalLines-a.totalLines;
                });


              //Update main table
                grid.update(data);



              //Update line chart
                lineChart.clear();
                get("import/history?country=" + country + "&threshold=" + threshold, {
                    success: function(csv){
                        lineData = [];

                        var rows = parseCSV(csv, ",");
                        var header = rows.shift();
                        var createRecord = function(row){
                            var r = {};
                            header.forEach((field, i)=>{
                                var val = row[i];
                                if (field!=="date"){
                                    val = Math.round(parseFloat(val));
                                }
                                r[field] = val;
                            });
                            return r;
                        };

                        rows.forEach((row)=>{
                            var d = createRecord(row);

                            var date = new Date(d.date).getTime();
                            if (!isNaN(date)){
                                d.date = date;
                                lineData.push(d);
                            }
                        });

                        lineData.sort(function(a,b){
                            return a.date-b.date;
                        });

//                        var firstDate = new Date(lineData[0].date);
//                        var lastDate = new Date(lineData[lineData.length-1].date);
//                        console.log(lineData.length);
//                        console.log(firstDate, lastDate);


                        lineData.forEach((d)=>{
                            var date = new Date(d.date);
                            d.date = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();
                        });

                        lineChart.update();
                    }
                });



              //Update bar chart
                if (barChart){
                    var chartData = [];
                    for (var i=0; i<Math.min(10,data.length); i++){
                        var d = data[i];
                        chartData.push({
                            name: d.name,
                            quantity: d.totalLines
                        });
                    }
                    barChart.update({
                        xAxis: "name",
                        yAxis: "quantity"
                    }, [chartData]);
                }


                scatterChart.update();


              //Update graph
                var feis = {};
                var nodes = [];
                var links = [];
                var entityTypes = ["manufacturer","shipper","importer","consignee","dii"];
                data.forEach((d)=>{

                    entityTypes.forEach((entity)=>{
                        if (entity!==establishment){
                            d[entity].forEach((fei)=>{
                                if (!feis[fei]){
                                    feis[fei] = false;
                                }
                            });
                        }
                    });

                    d.fei.forEach((fei)=>{
                        feis[fei] = d.name;
                    });

                    nodes.push({
                        name: d.name,
                        fei: d.fei,
                        type: establishment
                    });

                });


              //Generate list of FEIs to match
                var numFEIs = 0;
                var str = "";
                for (var fei in feis) {
                    if (feis.hasOwnProperty(fei)){
                        if (!feis[fei]){
                            if (str.length>0) str += ",";
                            str += fei;
                            numFEIs++;
                        }
                    }
                }
                //console.log(nodes.length, numFEIs);

              //Match FEIs
                get("import/EstablishmentNames", str, {
                    success: function(csv){

                      //Update FEIs
                        var rows = parseCSV(csv, ",");
                        rows.shift(); //remove header
                        rows.forEach((arr)=>{
                            var name = arr[0];
                            var ids = arr[1].split(",");

                            nodes.push({
                                name: name,
                                fei: ids
                            });

                            ids.forEach((fei)=>{
                                feis[fei] = name;
                            });
                        });



                      //Create Links
                        data.forEach((d)=>{

                            entityTypes.forEach((entity)=>{
                                if (entity!==establishment){
                                    var ids = d[entity];
                                    var name;
                                    for (var fei in feis) {
                                        if (feis.hasOwnProperty(fei)){
                                            ids.every((id)=>{
                                                var foundMatch = false;
                                                if (id===fei){
                                                    name = feis[fei];
                                                    foundMatch = true;
                                                }
                                                return !foundMatch;
                                            });
                                            if (name) break;
                                        }
                                    }

                                    if (d.name!==name){
                                        var source = d.name;
                                        var target = name;
                                        var addLink = true;

                                        links.every((link)=>{
                                            var foundMatch = false;
                                            if (link.source===source && link.target===target){
                                                if (link.relationship.indexOf(entity)===-1){
                                                    link.relationship += "," + entity;
                                                }
                                                addLink = false;
                                            }
                                            return !foundMatch;
                                        });

                                        if (addLink){
                                            links.push({
                                                source: source,
                                                target: target,
                                                relationship: entity
                                            });
                                        }
                                    }
                                }
                            });



                        });


                      //Update node.type attributes using realtionships
                        var nodeTypes = {};
                        links.forEach((link)=>{
                            if (link.relationship){
                                var relationships = link.relationship.split(",");
                                if (nodeTypes[link.target]){
                                    var currRelationships = nodeTypes[link.target];
                                    relationships.forEach((relationship)=>{
                                        var foundMatch = false;
                                        for (var i=0; i<currRelationships.length; i++){
                                            if (currRelationships[i]===relationship){
                                                foundMatch = true;
                                            }
                                        }
                                        if (!foundMatch){
                                            currRelationships.push(relationship);
                                        }
                                    });

                                }
                                else{
                                    nodeTypes[link.target] = link.relationship.split(",");
                                }
                            }
                        });
                        nodes.forEach((node)=>{
                            if (!node.type){
                                var relationships = nodeTypes[node.name];
                                if (relationships){
                                    node.type = relationships.join(",");
                                }
                            }
                        });



                      //Update graph
                        nodeView.update(nodes, links);

                    }
                });



                waitmask.hide();
            },
            failure: function(request){
                waitmask.hide();
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){

        var div = document.createElement("div");
        div.className = "dashboard-toolbar";
        parent.appendChild(div);


        var table = createTable();
        table.style.width = "";
        div.appendChild(table);
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;

        var paddingLeft = "15px";
        var createDropdown = function(label, width){
            td = document.createElement("td");
            td.innerHTML = label + ":";
            tr.appendChild(td);
            if (td.previousSibling) td.style.paddingLeft = paddingLeft;
            td = document.createElement("td");
            if (isNaN(width)) width = 200;
            td.style.width = width + "px";
            tr.appendChild(td);
            td.style.paddingLeft = "7px";
            return new javaxt.dhtml.ComboBox(td, {
                style: config.style.combobox,
                readOnly: true
            });
        };


      //Create entity dropdown
        establishmentOptions = createDropdown("Entity Type", 160);
        ["Manufacturer","Shipper","Importer","Consignee","DII"].forEach((n)=>{
            establishmentOptions.add(n, n);
        });
        establishmentOptions.setValue("Manufacturer");
        establishmentOptions.onChange = function(name, value){
            update();
        };


      //Create country dropdown
        countryOptions = createDropdown("Country of Origin", 80);
        countryOptions.add("Any", "");
        countryOptions.setValue("Any");
        countryOptions.onChange = function(name, value){
            update();
        };


      //Create product dropdown
        productOptions = createDropdown("Product Code", 100);
        productOptions.add("All", "");
        productOptions.setValue("All");
        productOptions.onChange = function(name, value){

        };


      //Create slider
        td = document.createElement("td");
        td.style.paddingLeft = paddingLeft;
        td.innerHTML = "PREDICT Filter:";
        tr.appendChild(td);
        td = document.createElement("td");
        td.style.width = "175px";
        td.style.padding = "0 10px";
        tr.appendChild(td);
        slider = document.createElement("input");
        slider.type = "range";
        slider.className = "dashboard-slider";
        slider.style.width = "100%";
        slider.setAttribute("min", 1);
        slider.setAttribute("max", 21);
        slider.value = 1;
        slider.getValue = function(){
            var val = this.value-1;
            return val;
        };
        slider.onchange = function(){
            var val = this.getValue();
            if (val>0){
                thresholdInput.value = (5*val) + "%";
            }
            else{
                thresholdInput.value = "";
            }
            update();
        };
        td.appendChild(slider);
        td = document.createElement("td");
        td.style.width = "45px";
        tr.appendChild(td);
        thresholdInput = document.createElement("input");
        thresholdInput.className = "form-input";
        thresholdInput.style.width = "100%";
        td.appendChild(thresholdInput);




      //Get data and populate the dropdowns
        waitmask.show(500);
        getData("Imports_Products", function(csv){

            var productCodes = [];
            var uniqueCountries = {};

          //Parse csv
            var rows = parseCSV(csv, ",");
            for (var i=1; i<rows.length; i++){ //skip header
                var col = rows[i];
                var productCode = col[0];
                var productCount = parseFloat(col[1]);
                var countries = getArray(col[2]);

                productCodes.push(productCode);
                for (var j=0; j<countries.length; j++){
                    uniqueCountries[countries[j]] = true;
                }
            }


          //Update productOptions
            productCodes.sort();
            for (var i=0; i<productCodes.length; i++){
                var productCode = productCodes[i];
                productOptions.add(productCode, productCode);
            }


          //Update countryOptions
            var arr = [];
            for (var country in uniqueCountries) {
                if (uniqueCountries.hasOwnProperty(country)){
                    arr.push(country);
                }
            }
            arr.sort();
            for (var i=0; i<arr.length; i++){
                var country = arr[i];
                countryOptions.add(country, country);
            }


            initializing = false;

            //waitmask.hide();
        });
    };


  //**************************************************************************
  //** getEstablishment
  //**************************************************************************
    var getEstablishment = function(){
        return establishmentOptions.getValue().toLowerCase();
    };


  //**************************************************************************
  //** createGrid
  //**************************************************************************
    var createGrid = function(parent){

      //Create grid control
        grid = new javaxt.dhtml.DataGrid(parent, {
            style: config.style.table,
            localSort: true,
            columns: [
                {header: 'Name', width:'100%', sortable: true},
                {header: 'Reported Quantity', width:'200px', align:'right', sortable: true},
                {header: 'Reported Value', width:'150px', align:'right', sortable: true},
                {header: 'Total Lines', width:'120px', align:'right', sortable: true},
                {header: 'Field Exams', width:'120px', align:'right', sortable: true},
                {header: 'Label Exams', width:'120px', align:'right', sortable: true},
                {header: 'Samples', width:'120px', align:'right', sortable: true},
                {header: '% Elevated Risk', width:'135px', align:'right', sortable: true}

            ],
            update: function(row, d){
                var name = d.name;
                if (d.fei.length>1) name += " (" + formatNumber(d.fei.length) + ")";
                row.set('Name', name);
                row.set('Reported Quantity', formatNumber(d.totalQuantity));
                row.set('Reported Value', "$"+formatNumber(d.totalValue));
                row.set('Total Lines', formatNumber(d.totalLines));
                if (d.fieldExams>0){
                    var str = formatNumber(d.fieldExams);
                    if (d.failedFieldExams>0) str += " (" + formatNumber(d.failedFieldExams) + " Failed)";
                    row.set('Field Exams', str);
                }
                if (d.labelExams>0){
                    var str = formatNumber(d.labelExams);
                    if (d.failedLabelExams>0) str += " (" + formatNumber(d.failedLabelExams) + " Failed)";
                    row.set('Label Exams', str);
                }
                if (d.totalSamples>0){
                    var str = formatNumber(d.totalSamples);
                    if (d.badSamples>0){
                        str += " (" + formatNumber(d.badSamples) + " Bad)";

                    }
                    row.set('Samples', str);
                }
                var p = (d.highPredict/d.totalLines)*100;
                if (p>0){
                    p = round(p, 1);
                    row.set('% Elevated Risk', formatNumber(p)+"%");
                }
                else{
                    row.set('% Elevated Risk', "0%");
                }

            }
        });


      //TODO: Update header
        var headerRow = grid.el.getElementsByClassName("table-header")[0];


      //Add custom update method
        grid.update = function(){
            grid.clear();
            grid.load(data);
        };

        grid.setSortIndicator(3, "DESC");
        grid.onSort = function(idx, sortDirection){

            var key;
            switch (idx) {
                case 1:
                    key = "totalQuantity";
                    break;
                case 2:
                    key = "totalValue";
                    break;
                case 3:
                    key = "totalLines";
                    break;
                default:
                    break;
            }

            if (key && key!==yAxis){
                yAxis = key;
                scatterChart.update();
                lineChart.update();
            }


        };
        grid.onRowClick = function(row, e){
            if (e.detail === 2) {
                showCompanyProfile(row.record);
            }
        };
    };


  //**************************************************************************
  //** createCharts
  //**************************************************************************
    var createCharts = function(parent){

      //Create table
        var table = createTable();
        parent.appendChild(table);
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;


      //Create line chart
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "34%";
        td.style.padding = "10px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createLineChart(td);


      //Create bar chart
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "33%";
        td.style.padding = "10px 0px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        //createBarChart(td);
        createRelationshipGraph(td);


      //Create scatter chart
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "33%";
        td.style.padding = "10px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createScatterChart(td);
    };


  //**************************************************************************
  //** createLineChart
  //**************************************************************************
    var createLineChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            title: "Timeline",
            width: "100%",
            height: "360px"
        });
        dashboardItem.el.style.margin = "0px";
        //dashboardItem.el.style.display = "table";
        lineChart = new bluewave.charts.LineChart(dashboardItem.innerDiv,{});
        lineChart._update = lineChart.update;
        lineChart.update = function(){

            var key;
            switch (yAxis) {
                case "totalQuantity":
                    key = "quantity";
                    break;
                case "totalValue":
                    key = "value";
                    break;
                case "totalLines":
                    key = "lines";
                    break;
                default:
                    break;
            }


            var title = yAxis.replace("total","");
            dashboardItem.title.innerText = title + " Per Day";

            var rawValueLine = new bluewave.chart.Line({
                color: "#6699cc" //blue
            });

            var movingAverageLine = new bluewave.chart.Line({
                color: "#ff7800", //orange
                smoothing: "movingAverage",
                smoothingValue: 30
            });

            lineChart.addLine(rawValueLine, lineData, "date", key);
            lineChart.addLine(movingAverageLine, lineData, "date", key);
            lineChart._update();
        };
    };


  //**************************************************************************
  //** createBarChart
  //**************************************************************************
    var createBarChart = function(parent, config){
        var dashboardItem = createDashboardItem(parent,{
            title: config.title,
            width: "100%",
            height: config.height
        });
        //dashboardItem.el.style.margin = "0px";
        return new bluewave.charts.BarChart(dashboardItem.innerDiv,{});
    };


  //**************************************************************************
  //** createMapChart
  //**************************************************************************
    var createMapChart = function(parent, config){
        var map = new bluewave.charts.MapChart(parent, {});
        return map;
    };


  //**************************************************************************
  //** createSankeyChart
  //**************************************************************************
    var createSankeyChart = function(parent){

    };


  //**************************************************************************
  //** createScatterChart
  //**************************************************************************
    var createScatterChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            title: "Exams",
            width: "100%",
            height: "360px"
        });
        dashboardItem.el.style.margin = "0px";
        //dashboardItem.el.style.display = "table";
        scatterChart = new bluewave.charts.ScatterChart(dashboardItem.innerDiv,{

        });
        scatterChart._update = scatterChart.update;
        scatterChart.update = function(){

            var title = yAxis.replace("total","");
            dashboardItem.title.innerText = title + " vs Exams";

            var chartData = [];
            data.forEach((d)=>{
                var totalExams = d.totalExams;
                if (!isNaN(totalExams)){
                    if (totalExams>0){

                        var failedExams = 0;
                        if (!isNaN(d.failedFieldExams)) failedExams+=d.failedFieldExams;
                        if (!isNaN(d.failedLabelExams)) failedExams+=d.failedLabelExams;

                        chartData.push({
                            Exams: totalExams,
                            yAxis: d[yAxis],
                            label: d.name,
                            failedExams: failedExams
                        });
                    }
                }
            });

            scatterChart._update({
                xAxis: "Exams",
                yAxis: "yAxis",
                xGrid: true,
                yGrid: true,
                xLabel: true,
                yLabel: false,
                margin: {
                    top: 15,
                    right: 65,
                    bottom: 32,
                    left: 82
                },
                pointLabels: true,
                getPointLabel: function(d){
                    return d.label;
                },
                getPointColor: function(d){
                    if (d.failedExams>0) return "#e66869";
                    return "#6699cc";
                }
            },[chartData]);
        };
    };


  //**************************************************************************
  //** createRelationshipGraph
  //**************************************************************************
    var createRelationshipGraph = function(parent){

      //Create dashboard item
        var dashboardItem = createDashboardItem(parent,{
            title: "Relationships",
            width: "100%",
            height: "360px"
        });
        dashboardItem.el.style.margin = "0px";
        //dashboardItem.el.style.display = "table";


      //Get colors
        var themeColors = getColorPalette(true);
        var numColors = themeColors.length/2;
        var colors = {};
        var i = 0;
        ["blue","green","red","orange","purple","gray"].forEach((color)=>{
            colors[color] = {dark: themeColors[i], light: themeColors[i+numColors]};
            i++;
        });
        var colorMap = {
            manufacturer: "green",
            shipper: "orange",
            importer: "red",
            consignee: "blue",
            dii: "purple"
        };


      //Create relationship graph
        nodeView = new bluewave.charts.ForceDirectedChart(dashboardItem.innerDiv,{
            getNodeFill: function(node){
                var color = colorMap[node.type];
                if (color){
                    return colors[color].light;
                }
                else{
                    return "#dcdcdc";
                }
            },
            getNodeOutline: function(node){
                var color = colorMap[node.type];
                if (color){
                    return colors[color].dark;
                }
                else{
                    return "#777";
                }
            },
            getNodeRadius: function(node){
                var establishment = getEstablishment();
                if (node.type===establishment){
                    return 20;
                }
                else{
                    return 10;
                }
            }
        });
    };


  //**************************************************************************
  //** showCompanyProfile
  //**************************************************************************
    var showCompanyProfile = function(d){
        if (!companyProfile){

            var win = new javaxt.dhtml.Window(document.body, {
                title: "Company Profile",
                width: 1060,
                height: 600,
                modal: true,
                style: config.style.window,
                resizable: true
            });

            companyProfile = new bluewave.dashboards.CompanyProfile(win.getBody(), config);
            companyProfile.show = win.show;
            companyProfile.hide = win.hide;
        }

        companyProfile.update(d.name,d.fei,getEstablishment());
        companyProfile.show();
    };


  //**************************************************************************
  //** getArray
  //**************************************************************************
    var getArray = function(str){
        str = str.substring(1);
        return str.substring(0, str.length-1).split(", ");
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
    var round = javaxt.dhtml.utils.round;

    var get = bluewave.utils.get;
    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var getColorPalette = bluewave.utils.getColorPalette;
    var formatNumber = bluewave.utils.formatNumber;

    init();
};