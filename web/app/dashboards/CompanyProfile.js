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
    var title = "Company Profile";
    var mainPanel, map;
    var layer = {};
    var grid;
    var establishment = {};
    

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Create main table
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
        createBody(td);


      //Create grid
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createGrid(td);


        parent.appendChild(table);
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
        mainPanel.clear();
        grid.clear();  
        if (map) map.clear();
    };
    

  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(establishmentName, establishmentIDs, establishmentType){
        me.clear();
        
        
        establishment = {
            name: establishmentName,
            fei: establishmentIDs,
            type: establishmentType,
            establishments: []
        };

        
        
        grid.update();
        
        
        var arr = [];
        establishmentIDs.forEach((fei)=>{
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
        map.removeLayer(layer.basemap);
        layer.localCache.show();
    };


  //**************************************************************************
  //** afterScreenshot
  //**************************************************************************
    this.afterScreenshot = function(){
        map.addLayer(layer.basemap, 0);
        layer.localCache.hide();
    };


  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(){
        if (map) map.resize();
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){
        
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
            var title = document.createElement("div");   
            title.className = "company-profile-title";
            var type = establishment.type;
            title.innerText = type.substring(0,1).toUpperCase() + type.substring(1) + ": " + establishment.name;
            mainPanel.appendChild(title);
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
        

        grid = new javaxt.dhtml.DataGrid(innerDiv, {
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
                        
                        callback.apply(grid, [{
                           status: 200,
                           rows: data
                        }]);
                    },
                    failure: function(request){
                        callback.apply(grid, [request]);
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
        
        
        grid.update = function(){
            grid.clear();
            grid.load();
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
            
            getShipments(facilities);
            
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
        map.waitmask.show();
        
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
        
        

    };


  //**************************************************************************
  //** numberWithCommas
  //**************************************************************************
    const formatNumber = (x) => {
        if (x==null) return "";
        if (typeof x !== "string") x+="";
        var parts = x.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    };    
    

  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;
    var getBasemap = bluewave.utils.getBasemap;
    var updateExtents = bluewave.utils.updateExtents;
    var get = bluewave.utils.get;
    var parseCSV = bluewave.utils.parseCSV;

    init();
};