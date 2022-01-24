if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  CompanyProfile
//******************************************************************************
/**
 *   Used to charts and data related to a specific company
 *
 ******************************************************************************/

bluewave.dashboards.CompanyProfile = function(parent, config) {

    var me = this;
    var defaultConfig = {};
    var title = "Company Profile";
    var mainPanel, map;
    var layer = {};
    var importsGrid, productGrid;
    var establishment = {};
    
    var waitmask;
        
    var charts = [];
    var nav, carousel, sliding;

    var titleDiv;
    
    
  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!parent) parent = document.createElement("div");


      //Clone the config so we don't modify the original config object
        var clone = {};
        merge(clone, config);


      //Merge clone with default config
        merge(clone, defaultConfig);
        config = clone;


        if (!config.fx) config.fx = new javaxt.dhtml.Effects();


        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;

        waitmask = new javaxt.express.WaitMask(table);


        tr = document.createElement("tr");
        tbody.appendChild(tr);

        td = document.createElement("td");
        tr.appendChild(td);
        createHeader(td);


        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);


        parent.appendChild(table);


        createPanel("Imports", createImportsPanel);
        createPanel("Products", createProductsPanel);        
        createPanel("Exams", createExamsPanel);
        createPanel("Sales", createSalesPanel);


        onRender(table, function(){

          //Update carousel
            carousel.resize();


          //Select default chart
            var chart = charts[0];
            chart.select();


          //Add default chart to carousel
            var panels = carousel.getPanels();
            for (var i=0; i<panels.length; i++){
                var panel = panels[i];
                if (panel.isVisible){
                    panel.div.appendChild(chart.div);
                    break;
                }
            }
        });
        
        
        me.el = table;

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
        establishment = {};        
        for (var i=0; i<charts.length; i++){
            charts[i].clear();
        }        
    };
    

  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(establishmentName, establishmentIDs, establishmentType){
        me.clear();
        
      //Update establishment
        establishment = {
            name: establishmentName,
            fei: establishmentIDs,
            type: establishmentType,
            establishments: []
        };


      //Update title
        var type = establishment.type;
        titleDiv.innerText = type.substring(0,1).toUpperCase() + type.substring(1) + ": " + establishment.name;


      //Update charts
        try{
            var chart = charts[0];
            chart.select();
            chart.update();
        }
        catch(e){
            console.log(e);
        }
    };


  //**************************************************************************
  //** beforeScreenshot
  //**************************************************************************
  /** Called before a screenshot is generated for this page. By default, the
   *  map contains images from a 3rd party. These tiles are considered unsafe
   *  and inaccessable to javascript. As a workaround, we will load the map
   *  tiles using our local server as a proxy.
   */
    this.beforeScreenshot = function(){
        if (map) map.removeLayer(layer.basemap);
        if (layer.localCache) layer.localCache.show();
    };


  //**************************************************************************
  //** afterScreenshot
  //**************************************************************************
    this.afterScreenshot = function(){
        if (map) map.addLayer(layer.basemap, 0);
        if (layer.localCache) layer.localCache.hide();
    };


  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(){
        if (map) map.resize();
    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){

        var header = document.createElement("div");
        header.className = "carousel-header";
        parent.appendChild(header);


      //Create table with two columns
        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;


      //Create placeholder for title
        td = document.createElement("td");
        td.style.width = "50%";
        tr.appendChild(td);
        titleDiv = document.createElement("div");
        titleDiv.className = "company-profile-title";
        td.appendChild(titleDiv);



      //Create nav in column 2
        td = document.createElement("td");
        td.style.width = "50%";
        td.style.textAlign = "right";
        tr.appendChild(td);
        nav = document.createElement("ul");
        nav.className = "carousel-header-nav noselect";
        td.appendChild(nav);



        header.appendChild(table);
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

      //Create carousel
        carousel = new javaxt.dhtml.Carousel(parent, {
            drag: false, //should be true if touchscreen
            loop: true,
            animate: true,
            animationSteps: 600,
            transitionEffect: "easeInOutCubic",
            fx: config.fx
        });


      //Add panels to the carousel
        var currPanel = document.createElement('div');
        currPanel.style.height = "100%";
        carousel.add(currPanel);

        var nextPanel = currPanel.cloneNode(false);
        carousel.add(nextPanel);

        var prevPanel = currPanel.cloneNode(false);
        carousel.add(prevPanel);


      //Add event handlers
        carousel.beforeChange = function(){
            parent.className = "blur";
            sliding = true;
        };
        carousel.onChange = function(currPanel){
            parent.className = "";
            sliding = false;

            for (var i=0; i<charts.length; i++){
                if (charts[i].isSelected()){
                    charts[i].update(currPanel);
                    break;
                }
            }
        };
    };


  //**************************************************************************
  //** createPanel
  //**************************************************************************
    var createPanel = function(label, createChart){


        var div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "100%";
        div.setAttribute("desc", label);
        var chart = createChart(div);
        chart.div = div;
        chart.name = label;



        var cls = "carousel-header-link";


        var li = document.createElement("li");
        li.className = cls;
        li.tabIndex = -1; //allows the element to have focus
        li.innerHTML = label;

        li.select = function(){
            if (sliding){
                this.blur();
                return;
            }
            this.focus();


          //Find the selected menu item
            var idx = 0;
            var currSelection = -1;
            for (var i=0; i<nav.childNodes.length; i++){
                var li = nav.childNodes[i];
                if (li==this) idx = i;

                if (li.selected){
                    currSelection = i;

                    if (li!==this){
                        li.selected = false;
                        li.className = cls;
                    }
                }
            }


          //Update selected item and the carousel
            if (idx!=currSelection){

              //Update selection
                this.selected = true;
                this.className = cls + " " + cls + "-selected";


              //If nothing was selected, then no need to continue
                if (currSelection==-1) return;


              //Find next panel and previous panel
                var nextPanel, prevPanel;
                var panels = carousel.getPanels();
                for (var i=0; i<panels.length; i++){
                    if (panels[i].isVisible){
                        if (i==0){
                            prevPanel = panels[panels.length-1];
                        }
                        else{
                            prevPanel = panels[i-1];
                        }
                        if (i==panels.length-1){
                            nextPanel = panels[0];
                        }
                        else{
                            nextPanel = panels[i+1];
                        }
                        break;
                    }
                }


              //Update panels
                if (currSelection<idx){
                    var el = prevPanel.div;
                    removeChild(el);
                    el.appendChild(charts[idx].div);
                    removeChild(nextPanel.div);
                    //console.log("slide right");
                    carousel.back();
                }
                else if (currSelection>idx){
                    var el = nextPanel.div;
                    removeChild(el);
                    el.appendChild(charts[idx].div);
                    removeChild(prevPanel.div);
                    //console.log("slide left");
                    carousel.next();
                }
            }
        };
        li.onclick = function(){
            this.select();
        };
        nav.appendChild(li);


        chart.select = function(){
            li.select();
        };
        chart.isSelected = function(){
            return li.selected;
        };
        charts.push(chart);
    };


  //**************************************************************************
  //** createImportsPanel
  //**************************************************************************
    var createImportsPanel = function(parent){


      //Create table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Create main panel
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        createBody2(td);


      //Create importsGrid
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createGrid(td);


        parent.appendChild(table);
        
        var currEstablishment;


        return {
            clear: function(){
                currEstablishment = null;
                mainPanel.clear();
                importsGrid.clear();  
                if (map) map.clear(); 
            },
            update: function(panel){
                
              //Reparent table into panel as needed
                if (table.parentNode!==panel){
                    reparent(table, panel);
                }                
                
                
              //Check if we need to refresh the panel
                if (currEstablishment){
                    if (!isDirty(currEstablishment, establishment)){
                        return;
                    }
                }
                currEstablishment = establishment;
                
                
                

              //Update the importsGrid
                importsGrid.update();        
        

             //Get establishment info and update the main panel & map
                var arr = [];
                establishment.fei.forEach((fei)=>{
                    arr.push(fei);
                });
                var getEstablishment = function(){
                    if (arr.length===0){
                        mainPanel.update();
                        map.update();
                        return;
                    }

                    get("import/establishment?fei=" + arr.shift(), {
                        success: function(json){
                            establishment.establishments.push(json);
                            getEstablishment();
                        }
                    });
                };
                getEstablishment();

            }
        };

    };


  //**************************************************************************
  //** createExamsPanel
  //**************************************************************************
    var createExamsPanel = function(parent){

        var div = document.createElement("div");
        div.style.height = "100%";
        //div.style.backgroundColor = "#C6EDD3";
        parent.appendChild(div);

        return {
            clear: function(){
                div.innerHTML = "";
            },
            update: function(panel){
                


            }
        };

    };


  //**************************************************************************
  //** createProductsPanel
  //**************************************************************************
    var createProductsPanel = function(parent){


      //Create table
        var table = createTable();
        parent.appendChild(table);
        var tbody = table.firstChild;
        var tr, td;


      //Create charts
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        var productCharts = createProductCharts(td);


      //Create grid
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);

        
        var div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "250px";
        div.style.position = "relative";
        div.style.overflowX = "auto";
        td.appendChild(div);

        var innerDiv = document.createElement("div");
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        innerDiv.style.position = "absolute";
        div.appendChild(innerDiv);
        

        var grid = new javaxt.dhtml.DataGrid(innerDiv, {
            style: config.style.table,
            localSort: true,
            columns: [
                {header: 'Facility', width:'115', sortable: true}, 
                {header: 'Code', width:'60', sortable: true}, 
                {header: 'Product Name', width:'100%', sortable: true},
                {header: 'Total Lines', width:'115', align:'right', sortable: true},
                {header: 'Reported Quantity', width:'155', align:'right', sortable: true},
                {header: 'Reported Value', width:'140', align:'right', sortable: true}
            ],
            update: function(row, entry){  
                row.set("Facility", entry.fei);
                row.set("Code", entry.product_code);
                row.set("Product Name", entry.product_name);
                
                var lines = parseFloat(entry.lines);
                if (!isNaN(lines)) row.set('Total Lines', formatNumber(Math.round(lines)));                   
                
                var quantity = parseFloat(entry.quantity);
                if (!isNaN(quantity)) row.set('Reported Quantity', formatNumber(Math.round(quantity)));                
                var value = parseFloat(entry.value);
                if (!isNaN(value)) row.set('Reported Value', "$"+formatNumber(value));                                               
            }
        });
        
        var data = [];
        var currKey;

        
        grid.setSortIndicator(3, "DESC");
        grid.onSort = function(idx, sortDirection){
            
            var key;
            switch (idx) {
                case 4:
                    key = "quantity";
                    break;
                case 5:
                    key = "value";
                    break;
                case 3:
                    key = "lines";
                    break;
                default:
                    break;
            }            
            
            if (key && key!==currKey){
                currKey = key;
                productCharts.update(data, currKey);
            }
        };         
        
        
        var currEstablishment;
        return {
            clear: function(){
                data = [];
                productCharts.clear();
                grid.clear();
            },
            update: function(panel){
                
                
              //Reparent table into panel as needed
                if (table.parentNode!==panel){
                    reparent(table, panel);
                }                
                

              //Check if we need to refresh the panel
                if (currEstablishment){
                    if (!isDirty(currEstablishment, establishment)){
                        return;
                    }
                }
                currEstablishment = establishment;                
                
                

              //Get products associated with the establishmentIDs
                this.clear();
                waitmask.show();
                get("import/products?fei=" + establishment.fei.join(",") + "&establishment=" + establishment.type, {
                    success: function(csv){
                        var rows = parseCSV(csv, ",");      
                        var header = rows.shift();
                        var createRecord = function(row){
                            var r = {};                    
                            header.forEach((field, i)=>{
                                var val = row[i];
                                if (field.indexOf("product_")!=0) val = parseFloat(val);
                                r[field] = val;
                            });
                            return r;
                        };
                        
                        rows.forEach((row)=>{
                            data.push(createRecord(row));
                        });
                        
                        
                        waitmask.hide();
                        
                        
                        grid.load(data);                        
                        grid.setSortIndicator(3, "DESC");
                        currKey = "lines";
                        productCharts.update(data, currKey);
                        
                    },
                    failure: function(request){
                        alert(request);
                        waitmask.hide();
                    }
                });

            }
        };
    };


    var createDashboardItem = function(parent, title){
        var dashboardItem = bluewave.utils.createDashboardItem(parent,{
            title: title,
            width: "100%",
            height: "100%"
        });
        dashboardItem.el.style.margin = "0px";
        dashboardItem.innerDiv.style.textAlign = "center";
        return dashboardItem;
    };

  //**************************************************************************
  //** createProductCharts
  //**************************************************************************
    var createProductCharts = function(parent){


      //Create table
        var table = createTable();
        parent.appendChild(table);
        var tbody = table.firstChild;
        var tr, td;

        tr = document.createElement("tr");
        tbody.appendChild(tr);

      //Facility pie chart
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "10px 0px";
        tr.appendChild(td);
        var facilityPanel = createDashboardItem(td, "Facilities");
        var facilityChart = new bluewave.charts.PieChart(facilityPanel.innerDiv, {});

        
      //Product codes chart
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "10px 10px";
        tr.appendChild(td);
        var procodePanel = createDashboardItem(td, "Product Codes");
        var procodeChart = new bluewave.charts.PieChart(procodePanel.innerDiv, {});
        
        
      //Products pie chart
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "10px 0px";
        tr.appendChild(td);   
        var productPanel = createDashboardItem(td, "Products");
        var productChart = new bluewave.charts.PieChart(productPanel.innerDiv, {});
        
        
        var groupData = function(data, groupBy, type){
            var ret = {};
            data.forEach((d)=>{
                var key = d[type+""];
                var val = d[groupBy];
                var currVal = ret[key];
                if (isNaN(currVal)) currVal = 0;
                ret[key] = currVal+val;
            });
            return ret;   
        };
        
        var toArray = function(rawData){
            var arr = [];
            for (var key in rawData){
                if (rawData.hasOwnProperty(key)){
                    var val = rawData[key];
                    arr.push({
                        key: key,
                        value: val
                    });
                }
            }
            return arr;
        };        
        
        
        var chartConfig = {
            pieKey: "key",
            pieValue: "value",
            pieSort: "value",
            pieSortDir: "descending",            
            pieLabels: false,
            labelOffset: 120,
            maximumSlices: 8,
            showOther: true,
            showTooltip: true
        };        
        
        return {
            clear: function(){
                facilityChart.clear();
                procodeChart.clear();
                productChart.clear();
            },
            update: function(data, key){
                
                var isCurrency = key === "value";

                var facilityData = groupData(data, key, "fei");
                facilityChart.update(chartConfig, toArray(facilityData));
                facilityChart.getTooltipLabel = function(d){
                    var procode = d.key;
                    var value = (isCurrency? "$" : "") + formatNumber(d.value);
                    return procode + ": " + value;
                };
                
                
                var procodeData = groupData(data, key, "product_code");
                procodeChart.update(chartConfig, toArray(procodeData));
                procodeChart.getTooltipLabel = function(d){
                    var procode = d.key;
                    var value = (isCurrency? "$" : "") + formatNumber(d.value);
                    return procode + ": " + value;
                };
                
                var arr = [];                
                data.forEach((d)=>{                    
                    var val = d[key];
                    var productCode = d.product_code;
                    var productName = d.product_name;
                    var entry = {
                        key: productCode + ": " + productName                        
                    };
                    entry[key] = val;
                    arr.push(entry);
                });                
                var productData = groupData(arr, key, "key");
                productChart.update(chartConfig, toArray(productData));   
                productChart.getTooltipLabel = function(d){
                    var product = d.key;
                    var idx = product.indexOf(":");
                    var productName = product.substring(idx+1).trim();
                    var productCode = product.substring(0,idx).trim();
                    var value = (isCurrency? "$" : "") + formatNumber(d.value);
                    var label = productName;
                    if (productCode.length>0) label+= "<br/>" + productCode;
                    label += "<br/>" + value;
                    return label;
                };                
            }
        };
    };


  //**************************************************************************
  //** createSalesPanel
  //**************************************************************************
    var createSalesPanel = function(parent){


        var div = document.createElement("div");
        div.style.height = "100%";
        //div.style.backgroundColor = "#FFB586";
        parent.appendChild(div);

        return {
            clear: function(){

            },
            update: function(panel){


            }
        };
    };





  //**************************************************************************
  //** createBody2
  //**************************************************************************
    var createBody2 = function(parent){
        
      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);        
        var td;


      //Create main panel
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.verticalAlign = "top";
        tr.appendChild(td);
        mainPanel = document.createElement("div"); 
        mainPanel.className = "company-profile";
        mainPanel.style.width = "500px";
        td.appendChild(mainPanel);  
        mainPanel.clear = function(){
            mainPanel.innerHTML = "";
        };        
        mainPanel.update = function(){
            mainPanel.innerHTML = "";
            
            var ul = document.createElement("ul"); 
            mainPanel.appendChild(ul);
            

            establishment.establishments.forEach((d, i)=>{                                                      
                var li = document.createElement("li"); 
                ul.appendChild(li);
                li.innerText = d.fei + ": " + d.name;
            });
        };
        
        

      //Create map
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        var mapDiv = document.createElement("div");        
        mapDiv.style.height = "100%";
        mapDiv.style.position = "relative";
        td.appendChild(mapDiv);
        getBasemap(function(basemap){
            createMap(mapDiv, basemap);
        }); 


        parent.appendChild(table);
    };


  //**************************************************************************
  //** createGrid
  //**************************************************************************
    var createGrid = function(parent){

        var div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "250px";
        div.style.position = "relative";
        div.style.overflowX = "auto";
        parent.appendChild(div);

        var innerDiv = document.createElement("div");
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        innerDiv.style.position = "absolute";
        div.appendChild(innerDiv);
        

        importsGrid = new javaxt.dhtml.DataGrid(innerDiv, {
            style: config.style.table,
            url: "import/lines",
            autoload: false,
            getResponse: function(url, payload, callback){             
                url += "?establishment=" + establishment.type + "&id=" + establishment.fei.join(",");
                get(url, {
                    success: function(csv){
                        
                        var rows = parseCSV(csv, ",");      
                        var header = rows.shift();
                        var createRecord = function(row){
                            var r = {};                    
                            header.forEach((field, i)=>{                                                      
                                r[field] = row[i];
                            });
                            return r;
                        };
                        
                        var data = [];
                        rows.forEach((row)=>{
                            data.push(createRecord(row));
                        });
                        
                        callback.apply(importsGrid, [{
                           status: 200,
                           rows: data
                        }]);
                    },
                    failure: function(request){
                        callback.apply(importsGrid, [request]);
                    }
                });
            },
            parseResponse: function(obj){
                return obj.rows;
            },
            columns: [
                {header: 'Entry/DOC/Line', width:'150'},
                {header: 'Date', width:'85', align:'right'},
                {header: 'Port of Entry', width:'75'},
                {header: 'Unladed Port', width:'75'},
                {header: 'CC', width:'35'},
                {header: 'Shipment Method', width:'75'},
                {header: 'Product Code', width:'75'},
                {header: 'Product Name', width:'100%'},
                {header: 'Quantity', width:'120', align:'right'},
                {header: 'Value', width:'120', align:'right'},
//                {header: 'Manufacturer', width:'75'},
//                {header: 'Shipper', width:'75'},
//                {header: 'Importer', width:'75'},
//                {header: 'Consignee', width:'75'},
//                {header: 'DII', width:'75'},
                {header: 'Affirmations', width:'75'},
                {header: 'Final Disposition', width:'75'},
                {header: 'Predict Risk', width:'75'},
                {header: 'Predict Score', width:'75'}
            ],
            update: function(row, entry){
                //console.log(entry);                
                row.set("Entry/DOC/Line", entry.entry+"/"+entry.doc+"/"+entry.line);
                row.set("Date",entry.date);
                row.set("CC",entry.country_of_origin);
                var quantity = parseFloat(entry.quantity);
                if (!isNaN(quantity)) row.set('Quantity', formatNumber(Math.round(quantity)));                
                var value = parseFloat(entry.value);
                if (!isNaN(value)) row.set('Value', "$"+formatNumber(value));                                               
            }
        });
        
        
        importsGrid.update = function(){
            importsGrid.clear();
            importsGrid.load();
        };        

    };


  //**************************************************************************
  //** createMap
  //**************************************************************************
    var createMap = function(parent, basemap){


      //Create map
        map = new com.kartographia.Map(parent,{
            basemap: null,
            center: [40, -100], //lat, lon (center of the US)
            zoom: 0, //initial zoom
            maxZoom: 10,
            coordinateFormat: "DD"
        });
        
        
      //Set min zoom level (not sure this does anything)
        var v = map.getMap().getView();
        v.setMinZoom(0);
        
        
      //Create waitmask
        map.waitmask = new javaxt.express.WaitMask(parent);
        

        layer.basemap = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: basemap
            })
        });
        map.addLayer(layer.basemap);

        layer.localCache = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'map/tile?url=' + basemap
            }),
            visible: false
        });
        map.addLayer(layer.localCache);


        layer.routes = map.createVectorLayer();
        layer.points = map.createVectorLayer();
        
        
        
        var color = ol.color.asArray("#FF8280");        

        var stroke = new ol.style.Stroke({
            color: color,
            width: 1
        });

        var fill = new ol.style.Fill({
            color: [color[0],color[1],color[2],0.1]
        });        
        
        var style = new ol.style.Style({
            image: new ol.style.Circle({
                fill: fill,
                stroke: stroke,
                radius: 5
            }),
            fill: fill,
            stroke: stroke
        });        
        
        


        map.update = function(){
            
            var points = [];
            var facilities = [];
            var easternFacilities = 0;
            var westernFacilities = 0;
            establishment.establishments.forEach((d, i)=>{
                var address = d.address;
                var lat = parseFloat(address.lat);
                var lon = parseFloat(address.lon);
                
                if (!isNaN(lat) && !isNaN(lon)){
                    
                    if (lon>90){
                        easternFacilities++;
                    }
                    else{
                        if (lon>0){
                            westernFacilities++;
                        }
                    }
                
                    points.push([lon, lat]);
                    var geom = new ol.geom.Point([lon, lat]);
                    geom.transform('EPSG:4326', 'EPSG:3857');


                    var feature = new ol.Feature({
                        id: i,
                        geometry: geom
                    });
                    feature.setStyle(style);
                    layer.points.addFeature(feature);    
                    
                    facilities.push(d.fei);
                }                
            });            



          //Update layer extents
            updateExtents(layer.points);
            

          //Set map extents to include all the facilities
            var geom = new ol.geom.LineString(points);
            geom.transform('EPSG:4326', 'EPSG:3857');
            var extent = geom.getExtent(); 
            map.setExtent(extent);  
            var zoomLevel = map.getZoomLevel();
            var center = map.getCenter();
            map.setCenter(center[0],center[1],Math.min(4,zoomLevel));


            
            //getShipments(facilities);
            
        };
        
        
        map.clear = function(){
            if (layer.points.clear) layer.points.clear();
            if (layer.routes.clear) layer.routes.clear();
        };


      //Resize map when ready
        onRender(parent, function(){
            map.resize();
        });
    };
    
    
  //**************************************************************************
  //** getShipments
  //**************************************************************************    
    var getShipments = function(facilities){
        //map.waitmask.show();
        
        var shipments = [];
        
        var getShipmentSummary = function(){

            if (facilities.length===0){
                getRoutes(shipments);
                return;
            }
            
            var fei = facilities.shift();
            
            get("import/shipments?fei=" + fei + "&establishment=" + establishment.type, {
                success: function(csv){
                    var rows = parseCSV(csv, ",");      
                    var header = rows.shift();
                    var createRecord = function(row){
                        var r = {};                    
                        header.forEach((field, i)=>{                                                      
                            r[field] = row[i];
                        });
                        return r;
                    };

                    
                    rows.forEach((row)=>{
                        var r = createRecord(row);
                        r.fei = fei;                     
                        shipments.push(r);
                    });
                    
                    getShipmentSummary();
                },
                failure: function(){
                    getShipmentSummary();
                }
            });            
            
        };
        getShipmentSummary();
    };
    
    
  //**************************************************************************
  //** getRoutes
  //**************************************************************************
    var getRoutes = function(shipments){

        
      //Generate list of unique routes
        var routes = [];
        var uniqueRoutes = {};
        shipments.forEach((shipment)=>{
            
            var key = shipment.fei+"_"+shipment.port+"_"+shipment.method;
            uniqueRoutes[key] = {
                fei: shipment.fei,
                port: shipment.port,
                method: shipment.method
            };
        });        
        for (var key in uniqueRoutes) {
            if (uniqueRoutes.hasOwnProperty(key)){   
                routes.push(uniqueRoutes[key]);
            }
        }
        
        var arr = [];
        
        var getRoute = function(){
            if (routes.length===0){
                renderRoutes(arr, shipments);
                return;
            }
            
            var route = routes.shift();
                        
            
            get("import/route?facility=" + route.fei + "&portOfEntry=" + route.port + "&method=" + route.method, {
                success: function(json){                    
                    if (json.features.length>0){                    
                        route.path = json.features;
                        arr.push(route);                    
                    }
                    else{
                        if (route.method==="land"){
                            route.method = "sea";
                            routes.push(route);
                        }
                        else if (route.method==="sea"){
                            route.method = "air";
                            routes.push(route);
                        }
                    }
                    
                    getRoute();
                },
                failure: function(){                    
                    getRoute();
                }
            });              
        };
        getRoute();
    };
    
    
  //**************************************************************************
  //** renderRoutes
  //**************************************************************************
    var renderRoutes = function(routes, shipments){
        map.waitmask.hide();


        var key = "lines";
        var maxVal = 0;
        shipments.forEach((shipment)=>{
            var val = parseFloat(shipment[key]);
            if (!isNaN(val)) maxVal+=val;
        });
       
        
        routes.forEach((route)=>{            
            var fei = route.fei;
            var port = route.port;
            var method = route.method;
            route.path.forEach((path)=>{  
                var feature = path.geometry;
                //var properties = path.properties;
                

                if (feature.type.toLowerCase()==="linestring"){
                    
                    var coords = [];
                    var isFirstXPositive = feature.coordinates[0][0]>=0;
                    var crossesDateLine=null;
                    for (var i=0; i<feature.coordinates.length; i++){
                        var coord = feature.coordinates[i];
                        var x = coord[0];
                        if (x<0 && isFirstXPositive){

                            if (i>0 && crossesDateLine===null){
                                crossesDateLine = feature.coordinates[i-1][0]>90;
                            }

                            if (crossesDateLine){
                                coord[0] = 180 + (180+x);
                            }
                        }

                        if (x>0 && !isFirstXPositive){

                            if (i>0 && crossesDateLine===null){
                                crossesDateLine = feature.coordinates[i-1][0]<-90;
                            }

                            if (crossesDateLine){
                                coord[0] = -180 - (180-x);
                            }
                        }
                        coords.push(coord);
                    }
                    
                    

                    var total = 0;
                    shipments.forEach((shipment)=>{
                        if (shipment.port===port){
                            var val = parseFloat(shipment[key]);
                            if (!isNaN(val)) total+=val;
                        }
                    });
                    var d = total/maxVal;

                    
                    var geom = new ol.geom.LineString(coords);
                    geom.transform('EPSG:4326', 'EPSG:3857');  
                    layer.routes.addFeature(new ol.Feature({
                        geometry: geom,
                        style: new ol.style.Style({
                            stroke: new ol.style.Stroke({
                                width: 3*d,
                                //color: "#3399cc", //blue
                                color: "#FF3C38" //red
                            })
                        })
                    }));
                }

            });
        });
        
        updateExtents(layer.routes);
        
        
        
        
      //Get coords for all the facilities
        var points = [];
        var easternFacilities = 0;
        var westernFacilities = 0;
        establishment.establishments.forEach((d, i)=>{
            var address = d.address;
            var lat = parseFloat(address.lat);
            var lon = parseFloat(address.lon);

            if (!isNaN(lat) && !isNaN(lon)){

                if (lon>90){
                    easternFacilities++;
                }
                else{
                    if (lon>0){
                        westernFacilities++;
                    }
                }

                points.push([lon, lat]);
            }                
        }); 


      //Set map extents to include all the facilities and the center of the US
        points.push([-100, 40]);
        var geom = new ol.geom.LineString(points);
        geom.transform('EPSG:4326', 'EPSG:3857');
        var extent = geom.getExtent(); 
        map.setExtent(extent);  


      //Adjust center point as needed
        if (easternFacilities>0){
            if (westernFacilities==0){
                map.setCenter(30,179);
            }
        }
    };


  //**************************************************************************
  //** removeChild
  //**************************************************************************
  /** Used to remove the first child from a carousel panel
   */
    var removeChild = function(el){
        if (el.childNodes.length>0){

          //Remove child
            var div = el.removeChild(el.childNodes[0]);

          //Update charts
            if (div.childNodes.length>0){
                var desc = div.getAttribute("desc");
                for (var j=0; j<charts.length; j++){
                    var chart = charts[j];
                    if (chart.div.getAttribute("desc")==desc){
                        chart.div = div;
                        break;
                    }
                }
            }
        }
    };
    
    
  //**************************************************************************
  //** reparent
  //**************************************************************************
  /** Used to replace panel content with a given element
   */
    var reparent = function(el, panel){
        if (!panel) return;
        var parent = el.parentNode;
        parent.removeChild(el);
        panel.innerHTML = "";
        panel.appendChild(el);        
    };
    
    
  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var isDirty = javaxt.dhtml.utils.isDirty;
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;
    var getBasemap = bluewave.utils.getBasemap;
    var updateExtents = bluewave.utils.updateExtents;
    var get = bluewave.utils.get;
    var parseCSV = bluewave.utils.parseCSV;
    var formatNumber = bluewave.utils.formatNumber;

    init();
};