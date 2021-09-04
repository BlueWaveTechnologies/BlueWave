if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  MapEditor
//******************************************************************************
/**
 *   Panel used to create Map charts
 *
 ******************************************************************************/

 bluewave.charts.MapEditor = function(parent, config) {

    var me = this;
    var defaultConfig = {
        style: {
        }
    };
    var margin = {
        top: 15,
        right: 5,
        bottom: 65,
        left: 82
    };
    var chartConfig = {};
    var svg;
    var panel;
    var previewArea;
    var mapChart;
    var inputData = [];
    var mapInputs = {
        projection:null,
        mapType:null,
        lat:null,
        long:null,
        mapValue:null,
        mapLevel:null,
        censusRegion:null,
        colorScale:null
    };
    var styleEditor;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        let table = createTable();
        let tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        parent.appendChild(table);
        me.el = table;
        var td;


      //Create left panel with map options
        td = document.createElement("td");
        tr.appendChild(td);
        let div = document.createElement("div");
        div.className = "chart-editor-options";
        td.appendChild(div);
        createInput(div,"mapType","Map Type",showHideDropDowns);
        createInput(div,"mapLevel","Map Level",showHideDropDowns);
        createInput(div,"latitude","Latitude",createMapPreview,"lat");
        createInput(div,"longitude","Longitude",createMapPreview,"long");
        createInput(div,"censusRegion","Census Location Field",createMapPreview);
        createInput(div,"mapValue","Value",createMapPreview);
        createInput(div,"mapProjectionName","Projection",createMapPreview);


      //Create main panel with map
        td = document.createElement("td");
        td.className = "chart-editor-preview";
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        panel = createDashboardItem(td,{
            width: "100%",
            height: "100%",
            title: "Untitled",
            settings: true
        });
        panel.el.className = "";
        previewArea = panel.innerDiv;
        onRender(previewArea, function(){
            var width = previewArea.offsetWidth;
            var height = previewArea.offsetHeight;

            svg = d3.select(previewArea).append("svg");
            svg.attr("width", width);
            svg.attr("height", height);

            mapChart = new bluewave.charts.MapChart(svg, {
                margin: margin
            });
        });


      //Allow users to change the title associated with the chart
        addTextEditor(panel.title, function(title){
            panel.title.innerHTML = title;
            chartConfig.chartTitle = title;
        });


      //Watch for settings
        panel.settings.onclick = function(){
            if (chartConfig) editStyle(chartConfig.mapType, chartConfig.mapLevel);
        };
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        inputData = [];
        chartConfig = {};
        panel.title.innerHTML = "Untitled";

      //Clear map inputs
        if (mapInputs){
            for (var key in mapInputs) {
                if (mapInputs.hasOwnProperty(key)){
                    var mapInput = mapInputs[key];
                    if (mapInput){
                        if (mapInput.clear) mapInput.clear();
                        if (mapInput.hide) mapInput.hide();
                    }
                }
            }
        }

      //Clear map preview
        if (mapChart) mapChart.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(mapConfig, inputs){
        me.clear();

      //Parse inputs
        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if(typeof input !== 'object' && input !== null){
                if (input!=null) inputs[i] = d3.csvParse(input);
            }
        }
        inputData = inputs;


      //Update config
        if(mapConfig !== null && mapConfig !== undefined){
            Object.keys(mapConfig).forEach(val=>{
                chartConfig[val] = mapConfig[val]? mapConfig[val]:null;
            });
            panel.title.innerHTML = mapConfig.chartTitle;
            chartConfig.mapLevel = getMapLevel(chartConfig);
        }


      //Populate pulldowns
        var data = inputData[0];
        if(Array.isArray(data)){
            let dataOptions = Object.keys(data[0]);
            dataOptions.forEach((val)=>{
                mapInputs.lat.add(val, val);
                mapInputs.long.add(val, val);
                mapInputs.censusRegion.add(val, val);
                mapInputs.mapValue.add(val, val);
            });

            mapInputs.mapType.add("Point","Point");
            mapInputs.mapType.add("Area","Area");


            mapInputs.mapLevel.add("US Counties", "counties");
            mapInputs.mapLevel.add("US States", "states");
            mapInputs.mapLevel.add("US Census Regions", "census");
            mapInputs.mapLevel.add("World", "world");

        }
        else{ //input from supply chain editor

            chartConfig.mapType = "Links";
            chartConfig.mapValue = "quantity";
            chartConfig.mapLevel = "world";

            mapInputs.mapType.add("Links","Links");
            mapInputs.mapValue.add("quantity", "quantity");

            mapInputs.mapLevel.add("World", "world");
        }


      //Show default pulldowns
        mapInputs.mapType.show();
        mapInputs.mapLevel.show();
        mapInputs.mapValue.show();


      //Set default values
        mapInputs.mapType.setValue(chartConfig.mapType, true);
        mapInputs.mapLevel.setValue(chartConfig.mapLevel, true);
        mapInputs.mapValue.setValue(chartConfig.mapValue, true);
        mapInputs.lat.setValue(chartConfig.latitude, true);
        mapInputs.long.setValue(chartConfig.longitude, true);
        mapInputs.censusRegion.setValue(chartConfig.censusRegion, true);


      //Render map
        createMapPreview();
    };


  //**************************************************************************
  //** createInput
  //**************************************************************************
    var createInput = function(parent,chartConfigRef,displayName,onChange,inputType){
        if (!inputType) inputType = chartConfigRef;

        var row = document.createElement("div");
        parent.appendChild(row);
        addShowHide(row);

        var label = document.createElement("label");
        label.innerText = displayName + ":";
        row.appendChild(label);

        var input = new javaxt.dhtml.ComboBox(row, {
            style: config.style.combobox,
            readOnly: true
        });
        input.onChange = function(name,value){
            chartConfig[chartConfigRef] = value;
            onChange.apply(input,[inputType, name, value]);
        };

        var show = input.show;
        input.show = function(){
            show();
            row.show();
        };

        var hide = input.hide;
        input.hide = function(){
            hide();
            row.hide();
        };

        input.hide();


        mapInputs[inputType] = input;
    };


  //**************************************************************************
  //** showHideDropDowns
  //**************************************************************************
    var showHideDropDowns = function(inputType, name, value){
        var input = this;
        if (inputType==="mapType"){

            if(value==="Point"){

                //We clear out the values from the chartConfig
                if(chartConfig.latitude !== null) chartConfig.latitude = null;
                if(chartConfig.longitude !== null) chartConfig.longitude = null;
                if(chartConfig.mapValue !== null) chartConfig.mapValue = null;
                if(chartConfig.mapLevel !== null) chartConfig.mapLevel = null;
                if(chartConfig.censusRegion !== null) chartConfig.censusRegion = null;

                //Show the combox box inputs
                mapInputs.lat.show();
                mapInputs.long.show();
                mapInputs.mapValue.show();
                mapInputs.censusRegion.hide();

            }
            else if(value==="Area"){

                if(chartConfig.latitude !== null) chartConfig.latitude = null;
                if(chartConfig.longitude !== null) chartConfig.longitude = null;
                if(chartConfig.mapValue !== null) chartConfig.mapValue = null;
                if(chartConfig.censusRegion !== null) chartConfig.censusRegion = null;

                if(chartConfig.mapLevel === "census") {
                    mapInputs.censusRegion.show();
                } else {
                    mapInputs.censusRegion.hide();
                }

                mapInputs.lat.hide();
                mapInputs.long.hide();
                mapInputs.mapValue.show();
            }

        }
        else if (inputType==="mapLevel"){

            if (chartConfig.mapType==="Area"){
                if(chartConfig.mapLevel === "states" && inputData[0].state == null){
                    warn("No State Data detected", mapInputs.mapLevel);
                }
            }
        }
    };


  //**************************************************************************
  //** createMapPreview
  //**************************************************************************
    var createMapPreview = function(){
        if(chartConfig.mapType===null){
            return;
        }
        if(chartConfig.mapType==="Point" && chartConfig.mapLevel===null){
            return;
        }
        if(chartConfig.mapType==="Area" && (chartConfig.mapValue===null ||
            chartConfig.mapLevel===null)){
            return;
        }
        if(chartConfig.mapType==="Links" && (chartConfig.mapValue==null ||
            chartConfig.mapLevel===null)){
            return;
        }
        onRender(previewArea, function() {
            var data = inputData[0];
            mapChart.update(chartConfig, data);
        });
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
  /** Return chart configuration file
   */
    this.getConfig = function(){
        let copy = Object.assign({},chartConfig);
        return copy;
    };

  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return previewArea;
    };

  //**************************************************************************
  //** getMapData
  //**************************************************************************
    this.getMapData = function(node){
        var data = [];
        for (var key in node.inputs) {
            if (node.inputs.hasOwnProperty(key)){
                var csv = node.inputs[key].csv;
                if(csv === undefined){
                    var inputConfig = node.inputs[key].config;
                    data.push(inputConfig);
                }else {
                    data.push(csv);
                }
            }
        }
        return data;
    };


  //**************************************************************************
  //** editStyle
  //**************************************************************************
    var editStyle = function(mapType, mapLevel){
      //Create styleEditor as needed
        if (!styleEditor){
            styleEditor = new javaxt.dhtml.Window(document.body, {
                title: "Edit Style",
                width: 400,
                valign: "top",
                modal: false,
                resizable: false,
                style: config.style.window
            });
        }

      //Create form
        var form;
        var body = styleEditor.getBody();
        body.innerHTML = "";
        if (mapType==="Point"){
            if (mapLevel==="states"){
                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "color",
                                    label: "Color",
                                    type: new javaxt.dhtml.ComboBox(
                                        document.createElement("div"),
                                        {
                                            style: config.style.combobox
                                        }
                                    )
                                },
                                {
                                    name: "radius",
                                    label: "Radius",
                                    type: "text"
                                },
                                {
                                    name: "labels",
                                    label: "Labels",
                                    type: "radio",
                                    alignment: "vertical",
                                    options: [
                                        {
                                            label: "True",
                                            value: true
                                        },
                                        {
                                            label: "False",
                                            value: false
                                        }
                                    ]
                                },
                                {
                                     name: "zoom",
                                     label: "Zoom",
                                     type: "text"
                                },
                                {
                                     name: "centerHorizontal",
                                     label: "Horizontal Center",
                                     type: "text"
                                },
                                {
                                     name: "centerVertical",
                                     label: "Vertical Center",
                                     type: "text"
                                }
                            ]
                        }
                    ]
                });

              //Update cutout field (add slider) and set initial value
                createSlider("radius", form, "%");
                var radius = chartConfig.pointRadius;
                if (radius==null) radius = 0.65;
                chartConfig.pointRadius = radius;
                form.findField("radius").setValue(radius*100);

              //Tweak height of the label field and set initial value
                var labelField = form.findField("labels");
                labelField.row.style.height = "68px";
                var labels = chartConfig.pieLabels;
                labelField.setValue(labels===true ? true : false);

                var zoomField = form.findField("zoom");
                var zoom = chartConfig.linkZoom;
                if (zoom==null) zoom = 800;
                chartConfig.linkZoom = zoom;
                zoomField.setValue(zoom);

                var horizontalField = form.findField("centerHorizontal");
                var horizontal = chartConfig.centerHorizontal;
                if(horizontal==null) horizontal = 500;
                chartConfig.centerHorizontal = horizontal;
                horizontalField.setValue(horizontal);

                var verticalField = form.findField("centerVertical");
                var vertical = chartConfig.centerVertical;
                if(vertical==null) vertical = 500;
                chartConfig.centerVertical = vertical;
                verticalField.setValue(vertical);

              //Process onChange events
                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.pointRadius = settings.radius/100;
                    if (settings.labels==="true") settings.labels = true;
                    else if (settings.labels==="false") settings.labels = false;
                    chartConfig.pointLabels = settings.labels;
                    chartConfig.linkZoom = settings.zoom;
                    chartConfig.centerHorizontal =  settings.centerHorizontal;
                    chartConfig.centerVertical = settings.centerVertical;
                    createMapPreview();
                };
            }
            else if (mapLevel==="world"){
                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "color",
                                    label: "Color",
                                    type: new javaxt.dhtml.ComboBox(
                                        document.createElement("div"),
                                        {
                                            style: config.style.combobox
                                        }
                                    )
                                },
                                {
                                    name: "radius",
                                    label: "Radius",
                                    type: "text"
                                },
                                {
                                    name: "labels",
                                    label: "Labels",
                                    type: "radio",
                                    alignment: "vertical",
                                    options: [
                                        {
                                            label: "True",
                                            value: true
                                        },
                                        {
                                            label: "False",
                                            value: false
                                        }
                                    ]
                                },
                                {
                                     name: "zoom",
                                     label: "Zoom",
                                     type: "text"
                                },
                                {
                                     name: "centerLongitude",
                                     label: "Longitudinal Center",
                                     type: "text"
                                },
                                {
                                     name: "centerLatitude",
                                     label: "Latitudinal Center",
                                     type: "text"
                                }
                            ]
                        }
                    ]
                });

              //Update cutout field (add slider) and set initial value
                createSlider("radius", form, "%");
                var radius = chartConfig.pointRadius;
                if (radius==null) radius = 0.65;
                chartConfig.pointRadius = radius;
                form.findField("radius").setValue(radius*100);

              //Tweak height of the label field and set initial value
                var labelField = form.findField("labels");
                labelField.row.style.height = "68px";
                var labels = chartConfig.pieLabels;
                labelField.setValue(labels===true ? true : false);

                var zoomField = form.findField("zoom");
                var zoom = chartConfig.linkZoom;
                if (zoom==null) zoom = 800;
                chartConfig.linkZoom = zoom;
                zoomField.setValue(zoom);

                var horizontalField = form.findField("centerLongitude");
                var horizontal = chartConfig.centerLongitude;
                if(horizontal==null) horizontal = 500;
                chartConfig.centerLongitude = horizontal;
                horizontalField.setValue(horizontal);

                var verticalField = form.findField("centerLatitude");
                var vertical = chartConfig.centerLatitude;
                if(vertical==null) vertical = 500;
                chartConfig.centerLatitude = vertical;
                verticalField.setValue(vertical);

              //Process onChange events
                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.pointRadius = settings.radius/100;
                    if (settings.labels==="true") settings.labels = true;
                    else if (settings.labels==="false") settings.labels = false;
                    chartConfig.pointLabels = settings.labels;
                    chartConfig.linkZoom = settings.zoom;
                    chartConfig.centerLongitude =  settings.centerLongitude;
                    chartConfig.centerLatitude = settings.centerLatitude;
                    createMapPreview();
                };
            }
            else if (mapLevel==="counties"){
                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "color",
                                    label: "Color",
                                    type: new javaxt.dhtml.ComboBox(
                                        document.createElement("div"),
                                        {
                                            style: config.style.combobox
                                        }
                                    )
                                },
                                {
                                    name: "radius",
                                    label: "Radius",
                                    type: "text"
                                },
                                {
                                    name: "labels",
                                    label: "Labels",
                                    type: "radio",
                                    alignment: "vertical",
                                    options: [
                                        {
                                            label: "True",
                                            value: true
                                        },
                                        {
                                            label: "False",
                                            value: false
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                });

                //Update cutout field (add slider) and set initial value
                createSlider("radius", form, "%");
                var radius = chartConfig.pointRadius;
                if (radius==null) radius = 0.65;
                chartConfig.pointRadius = radius;
                form.findField("radius").setValue(radius*100);

                //Tweak height of the label field and set initial value
                var labelField = form.findField("labels");
                labelField.row.style.height = "68px";
                var labels = chartConfig.pieLabels;
                labelField.setValue(labels===true ? true : false);

                //Process onChange events
                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.pointRadius = settings.radius/100;
                    if (settings.labels==="true") settings.labels = true;
                    else if (settings.labels==="false") settings.labels = false;
                    chartConfig.pointLabels = settings.labels;
                    createMapPreview();
                };
            }
        }
        else if (mapType==="Area"){
            if (mapLevel==="states"){
                var colorField = new javaxt.dhtml.ComboBox(
                    document.createElement("div"),
                    {
                        style: config.style.combobox
                    }
                );
                colorField.add("Red", "red");
                colorField.add("Blue", "blue");

                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "color",
                                    label: "Color",
                                    type: colorField
                                },
                                {
                                    name: "zoom",
                                    label: "Zoom",
                                    type: "text"
                                },
                                {
                                    name: "centerHorizontal",
                                    label: "Horizontal Center",
                                    type: "text"
                                },
                                {
                                    name: "centerVertical",
                                    label: "Vertical Center",
                                    type: "text"
                                }
                            ]
                        }
                    ]
                });

                var zoomField = form.findField("zoom");
                var zoom = chartConfig.linkZoom;
                if (zoom==null) zoom = 800;
                chartConfig.linkZoom = zoom;
                zoomField.setValue(zoom);

                var horizontalField = form.findField("centerHorizontal");
                var horizontal = chartConfig.centerHorizontal;
                if(horizontal==null) horizontal = 500;
                chartConfig.centerHorizontal = horizontal;
                horizontalField.setValue(horizontal);

                var verticalField = form.findField("centerVertical");
                var vertical = chartConfig.centerVertical;
                if(vertical==null) vertical = 500;
                chartConfig.centerVertical = vertical;
                verticalField.setValue(vertical);

              //Process onChange events
                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.colorScale = settings.color;
                    chartConfig.linkZoom = settings.zoom;
                    chartConfig.centerHorizontal =  settings.centerHorizontal;
                    chartConfig.centerVertical = settings.centerVertical;
                    createMapPreview();
                };
            }
            else if(mapLevel==="world"){

                var colorField = new javaxt.dhtml.ComboBox(
                    document.createElement("div"),
                    {
                        style: config.style.combobox
                    }
                );
                colorField.add("Red", "red");
                colorField.add("Blue", "blue");


                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "color",
                                    label: "Color",
                                    type: colorField
                                },
                                {
                                    name: "zoom",
                                    label: "Zoom",
                                    type: "text"
                                },
                                {
                                    name: "centerLongitude",
                                    label: "Longitudinal Center",
                                    type: "text"
                                },
                                {
                                    name: "centerLatitude",
                                    label: "Latitudinal Center",
                                    type: "text"
                                }
                            ]
                        }
                    ]
                });

                var zoomField = form.findField("zoom");
                var zoom = chartConfig.linkZoom;
                if (zoom==null) zoom = 800;
                chartConfig.linkZoom = zoom;
                zoomField.setValue(zoom);

                var horizontalField = form.findField("centerLongitude");
                var horizontal = chartConfig.centerLongitude;
                if(horizontal==null) horizontal = 500;
                chartConfig.centerLongitude = horizontal;
                horizontalField.setValue(horizontal);

                var verticalField = form.findField("centerLatitude");
                var vertical = chartConfig.centerLatitude;
                if(vertical==null) vertical = 500;
                chartConfig.centerLatitude = vertical;
                verticalField.setValue(vertical);


              //Process onChange events
                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.colorScale = settings.color;
                    chartConfig.linkZoom = settings.zoom;
                    chartConfig.centerLongitude =  settings.centerLongitude;
                    chartConfig.centerLatitude = settings.centerLatitude;
                    createMapPreview();
                };
            }
            else if (mapLevel==="counties"){
                var colorField = new javaxt.dhtml.ComboBox(
                    document.createElement("div"),
                    {
                        style: config.style.combobox
                    }
                );
                colorField.add("Red", "red");
                colorField.add("Blue", "blue");


                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "color",
                                    label: "Color",
                                    type: colorField
                                }
                            ]
                        }
                    ]
                });

                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.colorScale = settings.color;
                    createMapPreview();
                };
            }
        }
        else if (mapType==="Links"){
            if (mapLevel==="states"){
                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "zoom",
                                    label: "Zoom",
                                    type: "text"
                                },
                                {
                                    name: "centerHorizontal",
                                    label: "Horizontal Center",
                                    type: "text"
                                },
                                 {
                                     name: "centerVertical",
                                     label: "Vertical Center",
                                     type: "text"
                                 }
                            ]
                        }
                    ]
                });

                var zoomField = form.findField("zoom");
                var zoom = chartConfig.linkZoom;
                if (zoom==null) zoom = 800;
                chartConfig.linkZoom = zoom;
                zoomField.setValue(zoom);

                var horizontalField = form.findField("centerHorizontal");
                var horizontal = chartConfig.centerHorizontal;
                if(horizontal==null) horizontal = 500;
                chartConfig.centerHorizontal = horizontal;
                horizontalField.setValue(horizontal);

                var verticalField = form.findField("centerVertical");
                var vertical = chartConfig.centerVertical;
                if(vertical==null) vertical = 500;
                chartConfig.centerVertical = vertical;
                verticalField.setValue(vertical);

                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.linkZoom = settings.zoom;
                    chartConfig.centerHorizontal =  settings.centerHorizontal;
                    chartConfig.centerVertical = settings.centerVertical;
                    createMapPreview();
                };
            }
            else if (mapLevel==="world"){
                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        {
                            group: "Style",
                            items: [
                                {
                                    name: "zoom",
                                    label: "Zoom",
                                    type: "text"
                                },
                                {
                                    name: "centerLongitude",
                                    label: "Longitudinal Center",
                                    type: "text"
                                },
                                {
                                    name: "centerLatitude",
                                    label: "Latitudinal Center",
                                    type: "text"
                                }
                            ]
                        }
                    ]
                });

                var zoomField = form.findField("zoom");
                var zoom = chartConfig.linkZoom;
                if (zoom==null) zoom = 800;
                chartConfig.linkZoom = zoom;
                zoomField.setValue(zoom);

                var longField = form.findField("centerLongitude");
                var centerLongitude = chartConfig.centerLongitude;
                if(centerLongitude==null) centerLongitude = 110;
                chartConfig.centerLongitude = centerLongitude;
                longField.setValue(centerLongitude);

                var latField = form.findField("centerLatitude");
                var centerLatitude = chartConfig.centerLatitude;
                if(centerLatitude==null) centerLatitude = 20;
                chartConfig.centerLatitude = centerLatitude;
                latField.setValue(centerLatitude);


                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.linkZoom = settings.zoom;
                    chartConfig.centerLongitude = settings.centerLongitude;
                    chartConfig.centerLatitude = settings.centerLatitude;
                    createMapPreview();
                };
            }
        }


        if (form){
            styleEditor.showAt(108,57);
            form.resize();
        }
    };


  //**************************************************************************
  //** getMapLevel
  //**************************************************************************
  /** Used to normalize/standardize values for mapLevel
   */
    var getMapLevel = function(chartConfig){
        if (!chartConfig.mapLevel) return null;
        var mapLevel = chartConfig.mapLevel.toLowerCase();
        if (mapLevel.indexOf("census")>-1) return "census";
        if (mapLevel.indexOf("states")>-1) return "states";
        if (mapLevel.indexOf("counties")>-1) return "counties";
        if (mapLevel.indexOf("countries")>-1 || mapLevel.indexOf("world")>-1) return "world";
        return mapLevel;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var addTextEditor = bluewave.utils.addTextEditor;
    var createSlider = bluewave.utils.createSlider;
    var warn = bluewave.utils.warn;

    init();
 };