if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  EUAMap
//******************************************************************************
/**
 *   Used to render Emergency Use Authorization (EUA) Requests on a map
 *
 ******************************************************************************/

bluewave.dashboards.EUAMap = function(parent, config) {

    var me = this;
    var title = "N95 Emergency Use Authorization (EUA) Requests";
    var map, legend;
    var style = {};
    var layer = {};
    var table; //grid
    var data = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td, div;


      //Create map
        tr = document.createElement("tr");
        tbody.appendChild(tr);
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


      //Create grid
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        var div = document.createElement("div");
        //div.className = "icu-map-list";
        div.style.width = "100%";
        div.style.height = "250px";
        td.appendChild(div);
        createList(div);


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
  //** update
  //**************************************************************************
    this.update = function(){
        table.clear();

      //Clear data and map
        data = [];
        for (var key in layer) {
            if (layer.hasOwnProperty(key)){
                layer[key].clear();
            }
        }


      //Fetch new data and update map
        getData("EUAMap", function(_data){

          //Parse csv and create data array
            var rows = parseCSV(_data.csv, ",");
            for (var j=1; j<rows.length; j++){ //skip header
                var col = rows[j];
                var name = col[0];
                var address = col[1];
                var lat = parseFloat(col[2]);
                var lon = parseFloat(col[3]);
                var status = col[4];
                if (status){
                    status = status.toLowerCase();
                    if (status=="authorized") status = "approved";
                }
                else status = "pending";


                if (isNaN(lat) || isNaN(lon)) continue;


                var country = "";
                var idx = address.lastIndexOf(" - ");
                if (idx>-1){
                    country = address.substring(idx+3);
                    address = address.substring(0, idx).trim();
                    idx = address.lastIndexOf(" ");
                    if (idx>-1){
                        var str = address.substring(idx+1);
                        address = address.substring(0, idx).trim() + ", " + country;
                        country = str;
                    }
                }

                data.push({
                    name: name,
                    address: address,
                    country: country,
                    lat: lat,
                    lon: lon,
                    status: status
                });
            }


          //Render points on the map
            for (var i=0; i<data.length; i++){
                var entry = data[i];
                var lat = entry.lat;
                var lon = entry.lon;
                var status = entry.status;

                var geom = new ol.geom.Point([lon, lat]);
                geom.transform('EPSG:4326', 'EPSG:3857');


                var feature = new ol.Feature({
                    id: i,
                    geometry: geom
                });
                feature.setStyle(style[status]);
                layer[status].addFeature(feature);
            }


          //Update map extents
            for (var key in layer) {
                if (layer.hasOwnProperty(key)){
                    updateExtents(layer[key]);
                }
            }


          //Trigger extent change to update the grid
            map.onExtentChange();

        });
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
  //** createList
  //**************************************************************************
    var createList = function(parent){
        table = new javaxt.dhtml.Table(parent, {
            style: javaxt.dhtml.style.default.table,
            columns: [
                {header: 'Facility', width:'100%'},
                {header: 'Country', width:'65', align:"center"},
                {header: 'Status', width:'120', align:"center"}
            ]
        });
    };


  //**************************************************************************
  //** createMap
  //**************************************************************************
    var createMap = function(parent, basemap){


      //Create map
        map = new com.kartographia.Map(parent,{
            basemap: null,
            maxZoom: 10,
            coordinateFormat: "DD"
        });
        //map.setCenter(37, -98, 5); //most of us
        //map.setCenter(39, -77, 11); //dc
        map.setCenter(30, 1, 3); //atlantic ocean


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




      //Create legend
        createLegend(parent);



      //Create map layers and style
        var layers = ["approved", "denied", "pending"];
        for (var i in layers){
            var name = layers[i];
            layer[name] = map.createVectorLayer();

            var blue = "#007cba";
            var pink = "#FF8280";
            var orange = "#FFB586";

            var color, stroke, fill;
            if (name=="approved"){
                color = blue;
            }
            else if (name=="denied"){
                color = pink;
            }
            else if (name=="pending"){
                color = orange;
            }

            if (typeof color === "string"){
                color = ol.color.asArray(color);
            }


            stroke = new ol.style.Stroke({
                color: color,
                width: 1
            });


            fill = new ol.style.Fill({
                color: [color[0],color[1],color[2],0.1]
                //color: [255,255,255,0.2]
            });


            style[name] = new ol.style.Style({
                image: new ol.style.Circle({
                    fill: fill,
                    stroke: stroke,
                    radius: 5
                }),
                fill: fill,
                stroke: stroke
            });


            legend.addItem(name, color);
        }



      //Watch for extent change events
        var t = null;
        map.onExtentChange = function(){
            if (t!=null) clearTimeout(t);
            t = setTimeout(function(){

              //Clear table/grig control
                table.clear();
                var rows = [];

              //Get map extents
                var view = map.getMap().getView();
                var extent = view.calculateExtent(map.getMap().getSize());
                var center = view.getCenter();
                var x1 = center[0];
                var y1 = center[1];


              //Find visible features
                for (var i in layers){
                    var name = layers[i];
                    var features = layer[name].getFeatures();
                    for (var j in features) {
                        var feature = features[j];
                        var geom = feature.getGeometry();
                        if (ol.extent.containsExtent(extent, geom.getExtent())) {
                            var item = data[feature.get("id")];
                            var name = item.name;
                            name = item.address; //+ " (" + lat + ", " + lon + ")";

                            var pt = geom.getCoordinates();
                            var x2 = pt[0];
                            var y2 = pt[1];

                            var a = x1 - x2;
                            var b = y1 - y2;
                            var c = Math.sqrt( a*a + b*b ); //distance to center

                            rows.push([
                                name,
                                item.country,
                                item.status,
                                c
                            ]);
                        }
                    }
                }


              //Sort by distance
                rows.sort(function(a, b){
                    a = a[3];
                    b = b[3];
                    return a-b;
                });



              //Update grid
                if (rows.length>100) rows = rows.slice(0,100);
                table.addRows(rows);


            }, 500);
        };


      //Resize map when ready
        onRender(parent, function(){
            map.resize();
        });
    };



  //**************************************************************************
  //** createLegend
  //**************************************************************************
    var createLegend = function(parent){

        legend = document.createElement("div");
        legend.className = "map-legend";
        legend.style.width = "90px";
        parent.appendChild(legend);
        legend.addItem = function(name, backgroundColor, borderColor){
            var row = document.createElement("div");
            row.style.display = "inline-block";
            row.style.width = "100%"; //remove to have label aligned horizontally
            this.appendChild(row);


            var icon = document.createElement("div");
            icon.className = "map-legend-circle";
            icon.style.backgroundColor = isArray(backgroundColor) ? ("rgba(" + backgroundColor.join(",") + ")") : backgroundColor;
            if (borderColor){
                icon.className += "-outline";
                icon.style.borderColor = borderColor;
            }
            row.appendChild(icon);



            var label = document.createElement("div");
            label.className = "map-legend-label noselect";
            label.innerHTML = name;
            row.appendChild(label);
        };
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;
    var isArray = javaxt.dhtml.utils.isArray;

    var getBasemap = bluewave.utils.getBasemap;
    var updateExtents = bluewave.utils.updateExtents;
    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;

    init();
};