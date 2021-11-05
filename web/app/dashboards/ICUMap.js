if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  ICUMap
//******************************************************************************
/**
 *   Used to render US hospitals on a map
 *
 ******************************************************************************/

bluewave.dashboards.ICUMap = function(parent, config) {

    var me = this;
    var title = "ICU Utilization and Capacity";
    var map;
    var layer = {};
    var hospitals = {};
    var table;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td, div;


      //Create list
        td = document.createElement("td");
        tr.appendChild(td);
        var div = document.createElement("div");
        div.className = "icu-map-list";
        div.style.width = "400px";
        div.style.height = "100%";
        td.appendChild(div);
        createList(div);


      //Create map
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        var div = document.createElement("div");
        div.className = "icu-map-panel";
        div.style.height = "100%";
        div.style.position = "relative";
        td.appendChild(div);
        createMap(div);
        createLegend(div);

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
        hospitals = {};


        getData("Distinct_Weeks_In_Hospital_Capacity", function(data){
            var rows = data.split("\n");
            var week = rows[1];

            getData("ICU_Capacity_CurrWeek?week=" + week, function(data){
                var rows = parseCSV(data);
                var header = rows[0];
                for (var i=1; i<rows.length; i++){
                    var hospital = {};
                    var col = rows[i];
                    for (var j=0; j<header.length; j++){
                        hospital[header[j]] = col[j];
                    }
                    hospitals[hospital.hospital_pk] = hospital;
                }

                if (map) map.resize();
            });

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
  //** createList
  //**************************************************************************
    var createList = function(parent){
        table = new javaxt.dhtml.Table(parent, {
            style: javaxt.dhtml.style.default.table,
            columns: [
                //{header: 'ID', hidden:true},
                {header: 'Hospital', width:'100%'},
                {header: 'COVID Patients', width:'65', align:"center"},
                {header: 'Available ICU Beds', width:'65', align:"center"},
                {header: 'ICU Occupancy', width:'65', align:"center"}
            ]
        });
    };


  //**************************************************************************
  //** createMap
  //**************************************************************************
    var createMap = function(parent){
        map = new com.kartographia.Map(parent,{
            basemap: null,
            maxZoom: 10,
            coordinateFormat: "DD"
        });

        //map.setCenter(37, -98, 5); //most of us
        map.setCenter(39, -77, 11); //dc


        var baseURL;
        get("admin/settings/basemap", {
            success: function(arr){
               baseURL = arr[0].url;
            },
            failure: function(request){
                baseURL = 'http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
            }
        });

        if(!baseURL){
            baseURL = 'http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
        }

        layer.basemap = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: baseURL
            })
        });
        map.addLayer(layer.basemap);

        layer.localCache = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'map/tile?url=' + baseURL
            }),
            visible: false
        });
        map.addLayer(layer.localCache);


      //Get handle to the drawing layer
        var layers = map.getLayers();
        for (var i=0; i<layers.length; i++){
            if (layers[i].get('name')==='drawingLayer'){
                layer.drawing = layers[i];
                break;
            }
        }


        var icon = fa('map-marker');
        var markerStyle = function(feature){
            var size = feature.get('size');
            if (!isNumber(size)) size = 18;
            var color = feature.get('color');
            return [
                new ol.style.Style({
                    text: new ol.style.Text({
                        text: icon, //e.g. 'fa-play' or unicode '\uf04b'
                        font: '900 '+size+'px "Font Awesome 5 Free"', //font weight must be 900
                        fill: new ol.style.Fill({
                            color: color
                        })
                    })
                })
            ];
        };




      //Watch for extent change events
        var t = null;
        map.onExtentChange = function(){
            if (t!=null) clearTimeout(t);
            t = setTimeout(function(){

                //"#d8d8d8" //gray
                //

                table.clear();
                layer.drawing.clear();
                getHospitals(map.getExtent(), function(hospitals){
                    var rows = [];
                    for (var i=0; i<hospitals.length; i++){

                        var hospital = hospitals[i];
                        hospital.icu_beds_used = parseFloat(hospital.icu_beds_used);
                        hospital.total_icu_beds = parseFloat(hospital.total_icu_beds);
                        var icuOccupancy = hospital.icu_beds_used/hospital.total_icu_beds;
                        var color = "#F4E7AD";
                        if (icuOccupancy>0.75) color="#F9CE91";
                        if (icuOccupancy>0.80) color="#F9A870";
                        if (icuOccupancy>0.85) color="#F3744E";
                        if (icuOccupancy>0.90) color="#F04C48";
                        if (icuOccupancy>0.95) color="#B51F58";



                        if (color=="#F4E7AD"){
                            var geom = hospitals[i].geom;
                            var feature = new ol.Feature({
                                geometry: geom,
                                color: "#777",
                                size: 18
                            });
                            feature.setStyle(markerStyle);
                            layer.drawing.addFeature(feature);
                        }


                        var geom = hospitals[i].geom;
                        var feature = new ol.Feature({
                            geometry: geom,
                            color: color,
                            size: 16
                        });
                        feature.setStyle(markerStyle);
                        layer.drawing.addFeature(feature);

                        rows.push([
                            hospital.hospital_name,
                            hospital.suspected_cases,
                            round(hospital.total_icu_beds-hospital.icu_beds_used,1),
                            round(icuOccupancy*100,1)+"%"
                        ]);

                    }
                    table.addRows(rows);
                    updateExtents(layer.drawing);
                });

            }, 500);
        };


      //Resize map when ready
        onRender(parent, function(){

          //Check if there is any hospital data
            for (var key in hospitals) {
                if (hospitals.hasOwnProperty(key)){
                    map.resize();
                    break;
                }
            }

        });
    };


  //**************************************************************************
  //** getHospitals
  //**************************************************************************
    var getHospitals = function(extents, callback){
        get("map/hospitals?geom=" + encodeURI(extents), {
            success: function(text){
                var hospitalPoints = JSON.parse(text);

                var arr = [];
                for (var i in hospitalPoints){
                    var hospitalPoint = hospitalPoints[i];
                    var hospital = hospitals[hospitalPoint.id];
                    if (hospital){
                        if (!hospital.geom){
                            var geom = new ol.geom.Point([hospital.lon, hospital.lat]);
                            geom.transform('EPSG:4326', 'EPSG:3857');
                            hospital.geom = geom;
                        }
                        arr.push(hospital);
                    }
                }
                if (callback) callback.apply(me, [arr]);
            }
        });
    };


  //**************************************************************************
  //** createLegend
  //**************************************************************************
    var createLegend = function(parent){
        var div = document.createElement("div");
        div.className = "icu-map-legend";
        div.style.absolute = "relative";
        parent.appendChild(div);


        var legendTitle = document.createElement("div");
        legendTitle.className = "icu-map-legend-title";
        legendTitle.innerHTML = "Share of ICU Beds Occupied";
        div.appendChild(legendTitle);


        var table = createTable();
        table.style.height = "";
        var tbody = table.firstChild;
        var tr, td;

        tr = document.createElement("tr");
        tr.style.height = "15px";
        tbody.appendChild(tr);
        var colors = ["#F4E7AD", "#F9CE91", "#F9A870", "#F3744E", "#F04C48", "#B51F58"];
        for (var i=0; i<colors.length; i++){
            td = document.createElement("td");
            td.style.backgroundColor = colors[i];
            tr.appendChild(td);
        }

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        var p = 70;
        for (var i=0; i<colors.length; i++){
            td = document.createElement("td");
            tr.appendChild(td);
            if (Math.abs(i % 2) == 1){
                var d = document.createElement("div");
                d.style.position = "relative";
                var label = document.createElement("div");
                label.className = "icu-map-legend-label";
                label.innerHTML = p + "%";
                d.appendChild(label);
                td.appendChild(d);
            }
            p = p+5;
        }


        div.appendChild(table);
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;
    var isNumber = javaxt.dhtml.utils.isNumber;
    var round = javaxt.dhtml.utils.round;
    var get = javaxt.dhtml.utils.get;


    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;
    var updateExtents = bluewave.utils.updateExtents;

    init();
};