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
    var title = "Import Summary";
    var header;
    var grid;
    var data = [];
    var lineData = [];
    var countryNames = {};
    var countryOptions, productOptions, establishmentOptions; //dropdowns
    var slider, thresholdInput;
    var lineChart, barChart, pieChart, scatterChart;
    var yAxis;
    var nodeView;
    var companyProfile; //popup
    var waitmask;
    var colors = [
        "#6699CC", //blue
        "#98DFAF", //green
        "#FF3C38", //red
        "#FF8C42", //orange
        "#933ed5", //purple
        "#bebcc1"  //gray
    ];
           

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        if (!config) config = {};
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


        var mainDiv = document.createElement("div");
        mainDiv.className = "import-summary center";
        mainDiv.style.position = "relative";
        mainDiv.style.height = "100%";
        parent.appendChild(mainDiv);
        me.el = mainDiv;
        
        

      //Create main table
        var table = createTable();
        var tbody = table.firstChild;        
        var tr, td;
        mainDiv.appendChild(table);


      //Create header
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "import-summary-header";
        tr.appendChild(td);
        createHeader(td);
        
        
      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.verticalAlign = "top";
        tr.appendChild(td);
        
        var outerDiv = document.createElement("div");
        outerDiv.style.position = "relative";
        outerDiv.style.overflowX = "hidden";
        outerDiv.style.overflowY = "auto";
        outerDiv.style.height = "100%";
        td.appendChild(outerDiv);
        
        
        var innerDiv = document.createElement("div");
        innerDiv.style.position = "absolute";
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        outerDiv.appendChild(innerDiv);
        
        
        
        table = createTable();
        table.style.height = "";
        innerDiv.appendChild(table);
        tbody = table.firstChild;
        

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
        td.style.height = "450px";
        tr.appendChild(td);
        createGrid(td);


      //Create charts
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        //td.style.height = "350px";
        tr.appendChild(td);
        createCharts(td);

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
        data = [];
        lineData = [];
        if (lineChart) lineChart.clear();
        if (barChart) barChart.clear();
        if (scatterChart) scatterChart.clear();
        if (nodeView) nodeView.clear();
        grid.clear();
        productOptions.clear();
        countryOptions.clear();
        establishmentOptions.setValue("Manufacturer", true);
        yAxis = "totalLines";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(importsByCountry, defaultCountry){
        me.clear();
        

        var onReady = function(data){

          //Get product codes and values
            var productValues = {};
            var countryValues = {};
            data.forEach((d)=>{
                var val = parseFloat(d.lines);
                var productCode = d.product_code;
                var countryCode = d.country_of_origin;

                var currVal = productValues[productCode];
                if (isNaN(currVal)) currVal = 0;
                productValues[productCode] = currVal + val;
                
                currVal = countryValues[countryCode];
                if (isNaN(currVal)) currVal = 0;
                countryValues[countryCode] = currVal + val;
            });


          //Update productOptions
            var productCodes = Object.keys(productValues);    
            productCodes.sort();
            productCodes.forEach((productCode)=>{
                productOptions.add(productCode, productCode);
            });


          //Update country pulldowns
            var uniqueCountries = Object.keys(countryValues);
            uniqueCountries.sort();
            uniqueCountries.forEach((countryCode)=>{
                //var label = countryCode + " - " + countryNames[countryCode];
                countryOptions.add(countryCode, countryCode);
            });
            
            

          //Update pulldowns
            productOptions.setValue("All", true);
            if (!defaultCountry) defaultCountry = "TH"; //Select Thailand by default for demo purposes
            countryOptions.setValue(defaultCountry, true);
            header.update(countryValues, defaultCountry);
            update();
        };





        waitmask.show(500);
        bluewave.utils.getMapData(function(mapData){
            mapData.countries.features.forEach((feature)=>{
                var p = feature.properties;
                countryNames[p.code] = p.name;
            });
            
            if (!importsByCountry){
                get("import/ProductCode?include=country_of_origin", {
                    success: function(csv){ 
                        onReady(d3.csvParse(csv));
                        waitmask.hide();
                    },
                    failure: function(request){
                        alert(request);
                        waitmask.hide();
                    }
                });
            }
            else{
                onReady(importsByCountry);
                waitmask.hide();
            }
        });
    };


  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(){

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(){
        if (companyProfile) companyProfile.hide();
        if (grid) grid.setSortIndicator(3, "DESC");


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
                get("import/history?country=" + country + "&threshold=" + threshold + "&groupBy=" + establishment, {
                    success: function(csv){
                        lineData = d3.csvParse(csv);
                        lineChart.update();
                    }
                });



              //Update bar chart
                if (barChart) barChart.update(data);


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
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){

        var table = createTable();        
        var tbody = table.firstChild;
        var tr, td;
        
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        
        td = document.createElement("td");
        td.style.width = "100%";
        tr.appendChild(td);
        
        var iconDiv = document.createElement("div");
        iconDiv.className = "import-summary-header-logo";
        td.appendChild(iconDiv);
        
        var titleDiv = document.createElement("div");
        titleDiv.className = "import-summary-header-title";
        td.appendChild(titleDiv);        
        
        
        var addStats = function(){
            td = document.createElement("td");
            tr.appendChild(td);
            
            var div = document.createElement("div");
            div.className = "import-summary-header-stats";
            td.appendChild(div);
            
            var stat = document.createElement("div");
            div.appendChild(stat);
            
            var text = document.createElement("div");
            div.appendChild(text);            
            
            return {
                update: function(a, b){
                    stat.innerText = a;
                    text.innerText = b;
                }
            };
        };
        
        var rank = addStats();
        var percentRank = addStats();
        var totalLines = addStats();
        
        parent.appendChild(table);
        
        
        
        
        header = {
            update: function(countryValues, countryCode){
                
                iconDiv.innerText = countryCode;
                titleDiv.innerText = countryNames[countryCode];
                
                
                var total = 0;
                var target = 0;
                var arr = [];
                for (var key in countryValues){
                    if (countryValues.hasOwnProperty(key)){
                        var val = countryValues[key];
                        total+=val;
                        if (key===countryCode){
                            target = val;
                            totalLines.update(formatNumber(target), "Total lines");
                        }
                        arr.push({
                            countryCode: key,
                            value: val
                        });
                    }
                }
                
                arr.sort((a, b)=>{
                    return b.value - a.value;
                });
                arr.every((d, i)=>{
                    if (d.countryCode===countryCode){
                        var pos = i+1;
                        if (pos===1) pos+="st";
                        else if (pos===2) pos+="nd";
                        else if (pos===3) pos+="rd";
                        else pos+="th";
                        rank.update(pos, "Largest manufacturer");
                        return false;
                    }
                    return true;
                });
                var percent = formatPercent(target/total);
                percentRank.update(percent, "Imports into the US");
            }
        };
        
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
                //row.set('Name', name);
                
                var link = document.createElement("a");
                link.innerText = name;
                link.record = d;
                link.onclick = function(){
                    showCompanyProfile(this.record);
                };
                var div = document.createElement("div");
                div.className = "document-analysis-comparison-results";
                div.appendChild(link);
                row.set('Name', div);
                
                
                row.set('Reported Quantity', formatNumber(d.totalQuantity));
                row.set('Reported Value', "$"+formatNumber(d.totalValue));
                row.set('Total Lines', formatNumber(d.totalLines));
                
                
                var addIcon = function(label){
                    var summary = document.createElement("div");
                    summary.className = "document-analysis-comparison-results";
                    var icon = document.createElement("div");
                    icon.className = "fas fa-exclamation-triangle";
                    summary.appendChild(icon);
                    var span = document.createElement("span");
                    span.innerText = label;
                    summary.appendChild(span);
                    return summary;
                };
                
                if (d.fieldExams>0){
                    var str = formatNumber(d.fieldExams);
                    if (d.failedFieldExams>0){ 
                        str += " (" + formatNumber(d.failedFieldExams) + " Failed)";
                        str = addIcon(str);
                    }
                    row.set('Field Exams', str);
                }
                if (d.labelExams>0){
                    var str = formatNumber(d.labelExams);
                    if (d.failedLabelExams>0){ 
                        str += " (" + formatNumber(d.failedLabelExams) + " Failed)";
                        str = addIcon(str);
                    }
                    row.set('Label Exams', str);
                }
                if (d.totalSamples>0){
                    var str = formatNumber(d.totalSamples);
                    if (d.badSamples>0){
                        str += " (" + formatNumber(d.badSamples) + " Bad)";
                        str = addIcon(str);
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

        var div, table, tbody, tr, td;

      //Create first row
        div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "400px";
        parent.appendChild(div);
        table = createTable();
        div.appendChild(table);
        tbody = table.firstChild;
        tr = document.createElement("tr");
        tbody.appendChild(tr);

      //Create line chart
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "65%";
        td.style.padding = "10px";
        td.style.paddingRight = "0px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createLineChart(td);

      //Create pie chart
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "35%";
        td.style.padding = "10px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createPieChart(td);
        
        
      //Create second row
        div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "400px";
        parent.appendChild(div);
        table = createTable();
        div.appendChild(table);
        tbody = table.firstChild;
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        
        
      //Create scatter chart
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "65%";
        td.style.padding = "10px";
        td.style.paddingRight = "0px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createScatterChart(td);


      //Create exam chart
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "35%";
        td.style.padding = "10px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createBarChart(td);
        
        
      //Create third row
        div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "600px";
        parent.appendChild(div);
        createRelationshipGraph(div);
    };


  //**************************************************************************
  //** createLineChart
  //**************************************************************************
    var createLineChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            width: "100%",
            height: "100%"
        });
        dashboardItem.el.style.margin = "0px";
        lineChart = new bluewave.charts.LineChart(dashboardItem.innerDiv,{
            yGrid: true,
            endTags: true,
            stackValues: false,
            accumulateValues: false,
            animationSteps: 1500
        });
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
            
            var establishment = getEstablishment();            
            var title = yAxis.replace("total","");
            dashboardItem.title.innerText = "Top " + establishment + "s";
            dashboardItem.subtitle.innerText = "Imports per day using entry " + title.toLowerCase();

            
            var yValues = key;
            var smoothing = 90;
            var smoothingType = "movingAverage";            

  
            var t1 = new Date().getTime();
            var t0 = t1;

            var importsByEstablishment = {};
            var importTotals = {};
            lineData.forEach((d)=>{
                var key = d[establishment];
                var val = d[yValues] = parseFloat(d[yValues]);

                var dt = Date.parse(d.date);
                if (!isNaN(dt)){
                    //d.date = dt;
                    var date = new Date(dt);
                    if (date.getFullYear()>2019){
                        d.date = date;

                        var arr = importsByEstablishment[key];
                        if (!arr){
                            arr = [];
                            importsByEstablishment[key] = arr;
                        }
                        arr.push(d);

                        var currTotal = importTotals[key];
                        if (isNaN(currTotal)) importTotals[key] = val;
                        else importTotals[key] += val;                    
                    }
                }
            });
            

                
            t1 = new Date().getTime();
            console.log("Parsed",t1-t0);
            t0 = t1;

            //console.log(importTotals);
            var arr = [];
            for (var key in importsByEstablishment){
                if (importsByEstablishment.hasOwnProperty(key)){
                    arr.push({
                        establishment: key,
                        totalImports: importTotals[key]
                    });
                }
            }    
            arr.sort((a, b)=>{
                return b.totalImports - a.totalImports;
            });
            if (pieChart) pieChart.update(arr);


            t1 = new Date().getTime();
            console.log("Find top establishments",t1-t0);
            t0 = t1;
                

                
            //console.log(importsByEstablishment);
            lineChart.clear();
            var lines = [];
            var other = null;
            var includeOtherData = true;
            var lastDate = null;
            arr.forEach((d, i)=>{
                var key = d.establishment;
                var data = importsByEstablishment[key];

                if (i<5){


                    data.sort(function(a, b){
                        return a.date - b.date;
                    });
                    if (!lastDate) lastDate = data[data.length-1].date.getTime();
                    else lastDate = Math.min(lastDate, data[data.length-1].date.getTime());                    
                    

                    var line = new bluewave.chart.Line({
                        label: key,
                        smoothing: smoothingType,
                        smoothingValue: smoothing
                    });

                    lines.push({
                        line: line,
                        data: data
                    });
 
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
                                        o[yValues]+=d[yValues];
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
                
            t1 = new Date().getTime();
            console.log("Create line data",t1-t0);
            t0 = t1;
                

          //Add lines
            if (other){
                
              //Sort "other" data
                other.sort(function(a, b){
                    return a.date - b.date;
                });
                
                
              //Trim "other" data
                var arr = [];
                other.forEach((d)=>{
                    if (d.date.getTime()<=lastDate){
                        arr.push(d);
                    }
                });
                other = arr;                
                
                
              //Create line
                var line = new bluewave.chart.Line({
                    label: "Other",
                    color: colors[colors.length-1],
                    smoothing: smoothingType,
                    smoothingValue: smoothing
                });   
                
                
              //Add line to chart
                lineChart.addLine(line, other, "date", yValues); 
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
                
                lineChart.addLine(l.line, l.data, "date", yValues);
            });


            //lineChart.update();
            lineChart._update();

            t1 = new Date().getTime();
            console.log("Render line data",t1-t0);
            t0 = t1;
        };
    };


  //**************************************************************************
  //** createPieChart
  //**************************************************************************
    var createPieChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            width: "100%",
            height: "100%"
        });
        dashboardItem.el.style.margin = "0px";
        
        var chartConfig = {
            pieKey: "establishment",
            pieValue: "totalImports",
            showLabels: true,
            colors: colors,
            colorScaling: "ordinal",
            showTooltip: true
        };
        
        pieChart = new bluewave.charts.PieChart(dashboardItem.innerDiv,chartConfig);        
        pieChart._update = pieChart.update;
        pieChart.update = function(rawData){     

            var arr = rawData.slice(0, Math.min(rawData.length, 5));
            var other = 0;
            for (var i=5; i<rawData.length; i++){
                other += rawData[i].totalImports;
            }
            if (other>0) arr.push({
                establishment: "Other",
                totalImports: other
            });
            
            var establishment = getEstablishment(); 
            dashboardItem.title.innerText = "Top " + (arr.length-1) + " " + establishment + "s";
            
            pieChart._update(chartConfig, arr);
        };        
    };


  //**************************************************************************
  //** createBarChart
  //**************************************************************************
    var createBarChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            title: "Exam history",
            width: "100%",
            height: "100%"
        });
        dashboardItem.el.style.margin = "0px";
        
        
        barChart = new bluewave.charts.BarChart(dashboardItem.innerDiv,{});
        barChart._update = barChart.update;
        barChart.update = function(rawData){  
            
            
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
            
            var establishment = getEstablishment();              
            
            var totalLines = 0;
            var totalExams = 0;
            var totalSamples = 0;
            var labelExams = 0;
            
            rawData.forEach((d)=>{
                var name = d.name;
                totalLines+= d.totalLines;
                totalExams+=d.totalExams;
                labelExams+=d.labelExams;
                totalSamples+=d.totalSamples;
            });

            
            
            dashboardItem.innerDiv.innerHTML = "";
            dashboardItem.innerDiv.style.verticalAlign = "top";
            var div = document.createElement("div");
            div.className = "chart-subtitle";
            dashboardItem.innerDiv.appendChild(div);
            
            
            var span = document.createElement("div");
            div.appendChild(span);
            span.innerText = "Total Exams: " + totalExams + " (" + formatPercent(totalExams/totalLines) + ")";
            
            var span = document.createElement("div");
            div.appendChild(span);
            span.innerText = "Total Samples: " + totalSamples + " (" + formatPercent(totalSamples/totalLines) + ")";
            
            var span = document.createElement("div");
            div.appendChild(span);
            span.innerText = "Label Exams: " + labelExams + " (" + formatPercent(labelExams/totalLines) + ")";            
            
        };                
    };


  //**************************************************************************
  //** createScatterChart
  //**************************************************************************
    var createScatterChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            title: "Exams",
            width: "100%",
            height: "100%"
        });
        dashboardItem.el.style.margin = "0px";

        scatterChart = new bluewave.charts.ScatterChart(dashboardItem.innerDiv);
        var chartConfig = {
            xAxis: "Exams",
            yAxis: "yAxis",
            xGrid: true,
            yGrid: true,
            xLabel: true,
            yLabel: false,
            pointLabels: true,
            showTooltip: true
        };
        
        scatterChart.getPointLabel = function(d){
            return d.label;
        };
        
        scatterChart.getPointColor = function(d){
            if (d.failedExams>0) return "#e66869";
            return "#6699cc";
        };
        
        scatterChart.getTooltipLabel = function(d){
            return d.label + "<br/>" + d.Exams + " Exam" + (d.Exams===1 ? "" : "s");
        };        
        
        
        scatterChart._update = scatterChart.update;
        scatterChart.update = function(){

            var title = yAxis.replace("total","");
            dashboardItem.subtitle.innerText = "Number of exams per import " + title.toLowerCase();

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

            scatterChart._update(chartConfig,[chartData]);
        };
    };


  //**************************************************************************
  //** createRelationshipGraph
  //**************************************************************************
    var createRelationshipGraph = function(parent){

/*
            manufacturer: "green",
            shipper: "orange",
            importer: "red",
            consignee: "blue",
            dii: "purple"
 */

      //Create dashboard item
        var dashboardItem = createDashboardItem(parent,{
            title: "Relationships",
            subtitle: "Network graph illustrating relationships between manufacturers, shippers, consignee, importers, and DII",
            width: "100%",
            height: "100%"
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


    var formatPercent = function(f){
        var percent = f*100;
        if (percent>=1) percent = round(percent);
        else{
            percent = round(percent, 2);
            if (percent===0.0) percent = "<0.01";
        } 
        return percent + "%";
    };

  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var round = javaxt.dhtml.utils.round;
    var get = bluewave.utils.get;
    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var getColorPalette = bluewave.utils.getColorPalette;
    var formatNumber = bluewave.utils.formatNumber;

    init();
};