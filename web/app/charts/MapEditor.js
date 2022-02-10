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
        backgroundColor: "#fff",
        landColor: "#dedde0"
    };


    var chartConfig = {};

    var panel;
    var previewArea;
    var mapChart;
    var inputData = [];
    var mapInputs = {
        projection:null,
        mapType:null,
        pointData:null,
        lat:null,
        long:null,
        mapValue:null,
        mapLevel:null,
        colorScale:null
    };
    var changeMapLevel = false;
    var styleEditor, colorPicker;

    var countyData, countryData; //raw json
    var counties, states, countries; //topojson
    var options = []; //aggregation options
    var projection;
    var readOnly;



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
        createInput(div,"pointData", "Point Data",showHideDropDowns);
        createInput(div,"latitude","Latitude",createMapPreview,"lat");
        createInput(div,"longitude","Longitude",createMapPreview,"long");
        createInput(div,"mapLocation","Location Data",createMapPreview);
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
        mapChart = new bluewave.charts.MapChart(previewArea, {

        });
        mapChart.disablePan();


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
        changeMapLevel = false;

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


        if (mapConfig) chartConfig = mapConfig;
        merge(chartConfig, defaultConfig);

        if (chartConfig.chartTitle){
            panel.title.innerHTML = chartConfig.chartTitle;
        }
        chartConfig.mapLevel = getMapLevel(chartConfig);


      //Populate pulldowns
        var data = inputData[0];
        if(Array.isArray(data)){
            let dataOptions = Object.keys(data[0]);
            dataOptions.forEach((val)=>{
                mapInputs.lat.add(val, val);
                mapInputs.long.add(val, val);
                mapInputs.mapLocation.add(val, val);
                mapInputs.mapValue.add(val, val);
            });

            mapInputs.mapType.add("Point", "Point");
            mapInputs.mapType.add("Area", "Area");

            mapInputs.pointData.add("Geographic Coordinates", "geoCoords");
            mapInputs.pointData.add("Admin Area", "adminArea");

            mapInputs.mapLevel.add("States", "counties");
            mapInputs.mapLevel.add("Country", "states");
            mapInputs.mapLevel.add("World", "world");

        }
        else{ //input from supply chain editor

            chartConfig.mapType = "Links";
            chartConfig.mapValue = "quantity";
            chartConfig.mapLevel = "world";

            mapInputs.mapType.add("Links","Links");
            mapInputs.mapValue.add("quantity", "quantity");

            mapInputs.mapLevel.add("Country", "states");
            mapInputs.mapLevel.add("World", "world");
        }


      //Show default pulldowns
        mapInputs.mapType.show();
        mapInputs.mapLevel.show();
        mapInputs.mapValue.show();
        if (chartConfig.mapType==="Point"){
            mapInputs.pointData.show();
            if(chartConfig.pointData==="geoCoords"){
                if (chartConfig.latitude && chartConfig.longitude){
                    mapInputs.lat.show();
                    mapInputs.long.show();
                }
            }
        }


      //Set default values
        mapInputs.mapType.setValue(chartConfig.mapType, false);
        mapInputs.mapLevel.setValue(chartConfig.mapLevel, true);
        mapInputs.mapValue.setValue(chartConfig.mapValue, true);
        mapInputs.pointData.setValue(chartConfig.pointData, true);
        mapInputs.lat.setValue(chartConfig.latitude, true);
        mapInputs.long.setValue(chartConfig.longitude, true);


      //Render map
        createMapPreview();
    };


  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(){
        if (mapChart) mapChart.resize();
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
        if (inputType==="mapType"){

            if(value==="Point"){
              //Show the combox box inputs
                mapInputs.mapLocation.hide();
                mapInputs.mapValue.show();
                mapInputs.pointData.show();

            }
            else if(value==="Area"){
                mapInputs.lat.hide();
                mapInputs.long.hide();
                mapInputs.mapLocation.show();
                mapInputs.mapValue.show();
                mapInputs.pointData.hide();
            }
        }
        else if (inputType==="pointData"){

            if(value==="geoCoords"){
                mapInputs.lat.show();
                mapInputs.long.show();
                mapInputs.mapLocation.hide();

            }
            else if(value==="adminArea"){
                mapInputs.lat.hide();
                mapInputs.long.hide();
                mapInputs.mapLocation.show();

            }
        }
        else if (inputType==="mapLevel"){
            delete chartConfig.lon;
            delete chartConfig.lat;
            changeMapLevel = true;
            createMapPreview();
        }
    };


  //**************************************************************************
  //** createMapPreview
  //**************************************************************************
    var createMapPreview = function(){
        if (!chartConfig.mapType) return;
        if (!chartConfig.mapLevel) return;
        if(chartConfig.mapType==="Point" && chartConfig.pointData===null) return;
        if (chartConfig.mapType==="Point" && (chartConfig.pointData==="geoCoords" &&
            (chartConfig.latitude===null || chartConfig.longitude===null || chartConfig.mapValue===null))){
            return;
        }
        if (chartConfig.mapType==="Point" && (chartConfig.pointData==="adminArea" &&
            (chartConfig.mapLocation===null || chartConfig.mapValue===null))){
            return;
        }
        if(chartConfig.mapType==="Area" && (chartConfig.mapValue===null ||
            chartConfig.mapLocation===null)){
            return;
        }
        if(chartConfig.mapType==="Links" && (chartConfig.mapValue==null ||
            chartConfig.mapLocation===null)){
            return;
        }
        onRender(previewArea, function() {
            var data = inputData[0];
            console.log(chartConfig);
            console.log(data);

            getMapData(()=>{
                update(data, chartConfig);
            });



            /*
            mapChart.update(chartConfig, data);
            mapChart.onRecenter = function(lat, lon){
                if(!changeMapLevel){
                    chartConfig.lat = lat;
                    chartConfig.lon = lon;
                }else{
                    delete chartConfig.lat;
                    delete chartConfig.lon;
                    changeMapLevel = false;
                }
            };
            mapChart.onRedraw = function(){
                mapChart.update(chartConfig, data);
            }
            */
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


        var mapColors = {
            group: "Map Colors",
            items: [
                {
                    name: "backgroundColor",
                    label: "Background",
                    type: new javaxt.dhtml.ComboBox(
                        document.createElement("div"),
                        {
                            style: config.style.combobox
                        }
                    )
                },
                {
                    name: "landColor",
                    label: "Land",
                    type: new javaxt.dhtml.ComboBox(
                        document.createElement("div"),
                        {
                            style: config.style.combobox
                        }
                    )
                }
            ]
        };

        var mapCenter = {
            group: "Map Center",
            items: [
                {
                     name: "centerHorizontal",
                     label: "Longitude",
                     type: "text"
                },
                {
                     name: "centerVertical",
                     label: "Latitude",
                     type: "text"
                }
            ]
        };



        if (mapType==="Point"){

            var formItems = [
                {
                    group: "Point Style",
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
                            name: "opacity",
                            label: "Opacity",
                            type: "text"
                        },
                         {
                             name: "outlineWidth",
                             label: "Border Width",
                             type: "text"
                         },
                         {
                             name: "outlineColor",
                             label: "Border Color",
                             type: new javaxt.dhtml.ComboBox(
                                 document.createElement("div"),
                                 {
                                     style: config.style.combobox
                                 }
                             )
                         }
                    ]
                },
                mapColors
            ];

            if (mapLevel==="states" || mapLevel==="world"){
                //formItems.push(mapCenter);
            }

            form = new javaxt.dhtml.Form(body, {
                style: config.style.form,
                items: formItems
            });


          //Update color fields (add colorPicker) and set initial value
            createColorOptions("color", form);
            createColorOptions("backgroundColor", form);
            createColorOptions("landColor", form);
            var pointFill = chartConfig.pointColor || "#ff3c38"; //red default
            form.findField("color").setValue(pointFill);
            form.findField("backgroundColor").setValue(chartConfig.backgroundColor);
            form.findField("landColor").setValue(chartConfig.landColor);

          //Update color field (add colorPicker) and set initial value
            createColorOptions("outlineColor", form);
            form.findField("outlineColor").setValue(chartConfig.outlineColor || pointFill);

          //Update cutout field (add slider) and set initial value
            createSlider("radius", form, "px", 1, 20, 1);
            var radius = chartConfig.pointRadius;
            if (radius==null) radius = 3;
            chartConfig.pointRadius = radius;
            form.findField("radius").setValue(radius);

            //Create Slider for Opacity
            createSlider("opacity", form, "%");
            var opacity = chartConfig.opacity;
            if (opacity==null) opacity = 100;
            chartConfig.opacity = opacity;
            form.findField("opacity").setValue(opacity);

            //Create Slider for Outline Width
            createSlider("outlineWidth", form, "px", 0, 20, 1);
            var outlineWidth = chartConfig.outlineWidth;
            if (outlineWidth==null) outlineWidth = 0;
            chartConfig.outlineWidth = outlineWidth;
            form.findField("outlineWidth").setValue(outlineWidth);

          //Process onChange events
            if (mapLevel==="states" || mapLevel==="world"){

                var horizontalField = form.findField("centerHorizontal");
                if (horizontalField){
                    var horizontal = chartConfig.lon;
                    if(horizontal==null) {
                        if(mapLevel==="states"){
                            horizontal = 38.7
                        }else{
                            horizontal = 39.5;
                        }
                    }
                    chartConfig.lon = horizontal;
                    horizontalField.setValue(horizontal);
                }

                var verticalField = form.findField("centerVertical");
                if (verticalField){
                    var vertical = chartConfig.lat;
                    if(vertical==null){
                        if(mapLevel==="states"){
                            vertical = -0.6
                        }else{
                            vertical = -98.5;
                        }
                    }
                    chartConfig.lat = vertical;
                    verticalField.setValue(vertical);
                }

                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.pointColor = settings.color;
                    chartConfig.outlineColor = settings.outlineColor;
                    chartConfig.pointRadius = settings.radius;
                    chartConfig.opacity = settings.opacity;
                    chartConfig.outlineWidth = settings.outlineWidth;
                    chartConfig.landColor = settings.landColor;
                    chartConfig.backgroundColor = settings.backgroundColor;
                    chartConfig.lon = settings.centerHorizontal;
                    chartConfig.lat = settings.centerVertical;
                    createMapPreview();
                };
            }
            else {

                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.pointColor = settings.color;
                    chartConfig.outlineColor = settings.outlineColor;
                    chartConfig.landColor = settings.landColor;
                    chartConfig.backgroundColor = settings.backgroundColor;
                    chartConfig.pointRadius = settings.radius;
                    chartConfig.outlineWidth = settings.outlineWidth;
                    chartConfig.opacity = settings.opacity;
                    createMapPreview();
                };
            }
        }
        else if (mapType==="Area"){
            if (mapLevel==="states" || mapLevel==="world"){
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
                        },
                        mapColors
                        //mapCenter
                    ]
                });

                //Set up the Color Picker
                createColorOptions("backgroundColor", form);
                createColorOptions("landColor", form);
                form.findField("backgroundColor").setValue(chartConfig.backgroundColor);
                form.findField("landColor").setValue(chartConfig.landColor);

                var horizontalField = form.findField("centerHorizontal");
                if (horizontalField){
                    var horizontal = chartConfig.lon;
                    if(horizontal==null) {
                        if(mapLevel==="states"){
                            horizontal = 38.7;
                        }else{
                            horizontal = 39.5;
                        }
                    }
                    chartConfig.lon = horizontal;
                    horizontalField.setValue(horizontal);
                }


                var verticalField = form.findField("centerVertical");
                if (verticalField){
                    var vertical = chartConfig.lat;
                    if(vertical==null){
                        if(mapLevel==="states"){
                            vertical = -0.6;
                        }else{
                            vertical = -98.5;
                        }
                    }
                    chartConfig.lat = vertical;
                    verticalField.setValue(vertical);
                }


              //Process onChange events
                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.colorScale = settings.color;
                    chartConfig.landColor = settings.landColor;
                    chartConfig.backgroundColor = settings.backgroundColor;
                    chartConfig.lon = settings.centerHorizontal;
                    chartConfig.lat = settings.centerVertical;
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
                        },
                        mapColors
                    ]
                });

                //Set up the Color Picker
                createColorOptions("backgroundColor", form);
                createColorOptions("landColor", form);
                form.findField("backgroundColor").setValue(chartConfig.backgroundColor);
                form.findField("landColor").setValue(chartConfig.landColor);

                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.colorScale = settings.color;
                    chartConfig.landColor = settings.landColor;
                    chartConfig.backgroundColor = settings.backgroundColor;
                    createMapPreview();
                };
            }
        }
        else if (mapType==="Links"){
            if (mapLevel==="states" || mapLevel==="world"){
                form = new javaxt.dhtml.Form(body, {
                    style: config.style.form,
                    items: [
                        mapColors
                        //mapCenter
                    ]
                });

                //Set up the Color Picker
                createColorOptions("backgroundColor", form);
                createColorOptions("landColor", form);
                form.findField("backgroundColor").setValue(chartConfig.backgroundColor);
                form.findField("landColor").setValue(chartConfig.landColor);

                var horizontalField = form.findField("centerHorizontal");
                if (horizontalField){
                    var horizontal = chartConfig.lon;
                    if(horizontal==null) {
                        if(mapLevel==="states"){
                            horizontal = 38.7
                        }else{
                            horizontal = 39.5;
                        }
                    }
                    chartConfig.lon = horizontal;
                    horizontalField.setValue(horizontal);
                }

                var verticalField = form.findField("centerVertical");
                if (verticalField){
                    var vertical = chartConfig.lat;
                    if(vertical==null){
                        if(mapLevel==="states"){
                            vertical = -0.6
                        }else{
                            vertical = -98.5;
                        }
                    }
                    chartConfig.lat = vertical;
                    verticalField.setValue(vertical);
                }

                form.onChange = function(){
                    var settings = form.getData();
                    chartConfig.lon =  settings.centerHorizontal;
                    chartConfig.lat = settings.centerVertical;
                    chartConfig.landColor = settings.landColor;
                    chartConfig.backgroundColor = settings.backgroundColor;
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
        if (mapLevel.indexOf("census")>-1) return "states";
        if (mapLevel.indexOf("states")>-1) return "states";
        if (mapLevel.indexOf("counties")>-1) return "counties";
        if (mapLevel.indexOf("countries")>-1 || mapLevel.indexOf("world")>-1) return "world";
        return mapLevel;
    };


  //**************************************************************************
  //** createColorOptions
  //**************************************************************************
  /** Creates a custom form input using a combobox
   */
    var createColorOptions = function(inputName, form){
        bluewave.utils.createColorOptions(inputName, form, function(colorField){
            if (!colorPicker) colorPicker = bluewave.utils.createColorPickerCallout(config);

            if (inputName==="backgroundColor"){
                colorPicker.setColors([
                    "#fff", //white
                    "#e5ecf4" //blue
                ]);
            }
            else if (inputName==="landColor"){
                colorPicker.setColors([
                    "#f6f8f5", //gray
                    "#dedde0" //gray
                ]);
            }
            else{
                colorPicker.setColors(bluewave.utils.getColorPalette(true));
            }

            var rect = javaxt.dhtml.utils.getRect(colorField.row);
            var x = rect.x + rect.width + 15;
            var y = rect.y + (rect.height/2);
            colorPicker.showAt(x, y, "right", "middle");
            colorPicker.setColor(colorField.getValue());
            colorPicker.onChange = function(color){
                colorField.setValue(color);
            };
        });
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(data, chartConfig){

      //Set background color for the map (i.e. the color the 'water')
        var backgroundColor = chartConfig.backgroundColor;
        if (!backgroundColor) backgroundColor = "white";
        mapChart.setBackgroundColor(backgroundColor);


      //Set default color for land masses
        var landColor = chartConfig.landColor;
        if (!landColor) landColor = "lightgray";


      //Get min/max values
        var extent = d3.extent(data, function(d) { return parseFloat(d[chartConfig.mapValue]); });


      //Set color scale
        var colorScale = {
            "blue": d3.scaleQuantile(extent, d3.schemeBlues[7]),
            "red": d3.scaleQuantile(extent, d3.schemeReds[7])
        };
        if (!chartConfig.colorScale) chartConfig.colorScale = "red";



        var mapLevel = chartConfig.mapLevel;
        if (mapLevel === "counties"){

            //mapChart.setProjection("AlbersUsa");
            mapChart.setExtent([-130, 50.5], [-65, 25.8]);



            mapChart.addPolygons(counties.features, {
                name: "states",
                style: {
                    fill: landColor,
                    stroke: "white"
                }
            });



          //Render state boundaries
            var renderStates = function(renderPolygons){
                if (renderPolygons===true){
                    return countyMap.selectAll("whatever")
                    .data(states.features)
                    .enter()
                    .append("path")
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr('stroke', 'white');
                }
                else{
                    countyMap
                      .append("path")
                      .attr("fill", "none")
                      .attr("stroke", "white")
                      .attr("d", path(
                          topojson.mesh(
                            countyData,
                            countyData.objects.states,
                            function(a, b) {
                              return a !== b;
                            }
                          )
                        )
                      );
                }
            };


            chartConfig.mapType = null;

          //Render data
            if (chartConfig.mapType === "Point"){

              //Render counties
                var countyPolygons = renderCounties();
                countyPolygons.each(function() {
                    var path = d3.select(this);
                    path.attr('fill', function(d){
                        return landColor;
                    });
                });


              //Render states
                renderStates();


              //Get points
                var points = {};
                if (chartConfig.pointData==="geoCoords") {
                    points = getPoints(data, chartConfig, projection);
                }
                else if (chartConfig.pointData==="adminArea"){
                    points = getCentroids(data, states, chartConfig, path, projection);
                }


              //Render points
                renderPoints(points, chartConfig, extent);

            }
            else if(chartConfig.mapType === "Area"){

                var area = selectArea(data, chartConfig);
                if (area==="counties"){

                  //Render Counties
                    var countyPolygons = renderCounties();



                  //Map countyIDs to data values
                    var values = {};
                    data.forEach(function(d){
                        var countyID = d[chartConfig.mapLocation];
                        values[countyID] = d[chartConfig.mapValue];
                    });


                  //Update fill color of county polygons
                    countyPolygons.each(function() {
                        var path = d3.select(this);
                        var fillColor = path.attr('fill');
                        path.attr('fill', function(d){
                            var v = parseFloat(values[d.id]);
                            if (isNaN(v) || v<0) v = 0;
                            var fill = colorScale[chartConfig.colorScale](v);
                            if (!fill) return fillColor;
                            return fill;
                        });
                    });


                  //Render state boundaries
                    renderStates();
                }
                else if (area==="states"){ //render states
                    var statePolygons = renderStates(true);
                    updateStatePolygons(data, statePolygons, chartConfig, colorScale);
                }
                else if (area==="censusDivisions"){ //render census divisions
                    var statePolygons = renderStates(true);
                    updateCensusPolygons(data, statePolygons, chartConfig, colorScale);
                }
                else{
                    renderCounties();
                    renderStates();
                }
            }


        }
        else if (mapLevel === "states"){

            //mapChart.setProjection("Albers");
            mapChart.setExtent([-130, 50.5], [-65, 25.8]);


          //Render countries
            mapChart.addPolygons(countries.features, {
                name: "countries",
                style: {
                    fill: landColor,
                    stroke: "white"
                }
            });


          //Render data
            if (chartConfig.mapType === "Point"){

              //Render states
                mapChart.addPolygons(states.features, {
                    name: "states",
                    style: {
                        fill: landColor,
                        stroke: "white"
                    }
                });


              //Get points
                var points = {};
                if (chartConfig.pointData==="geoCoords"){
                    //points = getPoints(data, chartConfig, projection);
                }
                else if (chartConfig.pointData==="adminArea"){
                    //points = getCentroids(data, states, chartConfig, path, projection);
                }


              //Render points
                //renderPoints(points, chartConfig, extent);

            }
            else if(chartConfig.mapType === "Area"){


              //Render data using the most suitable geometry type
                var area = selectArea(data, chartConfig);
                if (area==="counties"){ //render counties

                    var values = {};
                    data.forEach(function(d){
                        var countyID = d[chartConfig.mapLocation];
                        values[countyID] = d[chartConfig.mapValue];
                    });

                    mapChart.addPolygons(states.features, {
                        name: "counties",
                        style: {
                            fill: function(county){
                                var v = parseFloat(values[county.id]);
                                if (isNaN(v) || v<0) v = 0;
                                var fill = colorScale[chartConfig.colorScale](v);
                                if (!fill) return 'none';
                                return fill;
                            }
                        }
                    });

                    mapChart.addPolygons(states.features, {
                        name: "states",
                        style: {
                            fill: "none",
                            stroke: "white"
                        }
                    });
                }
                else if (area==="states"){ //render states
                    //var statePolygons = renderStates();
                    //updateStatePolygons(data, statePolygons, chartConfig, colorScale);

                    var values = {};
                    data.forEach(function(d){
                        var state = d[chartConfig.mapLocation];
                        values[state] = d[chartConfig.mapValue];
                    });

                    mapChart.addPolygons(states.features, {
                        name: "states",
                        style: {
                            fill: function(state){
                                var v = parseFloat(values[state.properties.name]);
                                if (isNaN(v)) v = parseFloat(values[state.properties.code]);
                                if (isNaN(v) || v<0) v = 0;
                                var fill = colorScale[chartConfig.colorScale](v);
                                if (!fill) return 'none';
                                return fill;
                            },
                            stroke: "white"
                        }
                    });
                }
                else if (area==="censusDivisions"){ //render census divisions
                    //var statePolygons = renderStates();
                    //updateCensusPolygons(data, statePolygons, chartConfig, colorScale);
                }
                else{
                    mapChart.addPolygons(states.features, {
                        name: "states",
                        style: {
                            fill: "none",
                            stroke: "white"
                        }
                    });
                }

            }
            else if(chartConfig.mapType === "Links"){
                getData("PortsOfEntry", function(ports){
                    //renderLinks(data, countries, ports, path, projection, mapLevel);
                });
            }
        }
        else if(mapLevel === "world"){

            mapChart.setProjection("Mercator");
            mapChart.setExtent([-170, 76], [170, -76]);


            if (chartConfig.mapType === "Point"){

              //Get points
                var points = {};
                if (chartConfig.pointData==="geoCoords"){
                    points = getPoints(data, chartConfig, projection);
                }
                else if (chartConfig.pointData==="adminArea"){
                    points = getCentroids(data, countries, chartConfig, path, projection);
                }


              //Render countries
                mapChart.addPolygons(countries.features, {
                    name: "countries",
                    style: {
                        fill: landColor,
                        stroke: "white"
                    }
                });


              //Render points
                //renderPoints(points, chartConfig, extent);
            }
            else if(chartConfig.mapType === "Area"){
                var aggregateState = 0;
                data.forEach(function(d){
                    var state;
                    var country;
                    if(d.state) {
                        state = d.state;
                        aggregateState = aggregateState + parseFloat(d[chartConfig.mapValue]);
                    }
                   if(d.country) country = d.country;
                    for(var i = 0; i < countries.features.length; i++){
                        if(country == countries.features[i].properties.code){
                            countries.features[i].properties.inData = true;
                            countries.features[i].properties.mapValue = d[chartConfig.mapValue];
                        }else if(countries.features[i].properties.code == "US" &&
                                aggregateState > 0){
                            countries.features[i].properties.inData = true;
                            countries.features[i].properties.mapValue = aggregateState;
                        }
                    }
                });


              //Render countries
                mapChart.addPolygons(countries.features, {
                    name: "countries",
                    style: {
                        fill: function(d){
                            var inData = d.properties.inData;
                            if(inData){
                                return colorScale[chartConfig.colorScale](d.properties.mapValue);
                            }else{
                                return landColor;
                            }
                        },
                        stroke: "white"
                    }
                });

            }
            else if(chartConfig.mapType === "Links"){
                getData("PortsOfEntry", function(ports){
                    //renderLinks(data, countries, ports, path, projection, mapLevel);
                });
            }
        }


        mapChart.update();
        //me.onUpdate();
    };


  //**************************************************************************
  //** renderLinks
  //**************************************************************************
    var renderLinks = function(data, countries, ports, path, projection, mapLevel){
        var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette(true));
        var nodes = data.nodes;
        var links = data.links;
        var linkArray = []
        var connections = [];
        var coords = [];
        //Split Links up into the component parts.
        for (var link in links){
            if(links.hasOwnProperty(link)){
                var linkage = link.split('->');
                linkage.push(links[link].quantity);
                linkArray.push(linkage);
            }
        };
        if(mapLevel==="states"){
            linkArray.forEach(function(d){
                var connection = {};
                var stateCodeOne = nodes[d[0]].state;
                var stateCodeTwo = nodes[d[1]].state;
                var stateValue = d[2];
                connection.stateCodeOne = stateCodeOne;
                connection.stateCodeTwo = stateCodeTwo;
                connection.quantity = stateValue;
                connections.push(connection);
            });
            connections.forEach(function(d){
                var stateOne = d.stateCodeOne;
                var stateTwo = d.stateCodeTwo;
                var quantity = d.quantity;
                var coordOne = [];
                var coordTwo = [];
                var connectionPath = [];
                for (var i = 0; i < states.features.length; i++){
                    var stateCenter = states.features[i];
                    if (stateOne === stateCenter.properties.code){
                        var lat = stateCenter.properties.latitude;
                        var lon = stateCenter.properties.longitude;
                        coordOne.push(lat);
                        coordOne.push(lon);
                        connectionPath.push(coordOne);
                        break;
                    }
                }
                for(var i = 0; i < states.features.length; i++){
                    var stateCenter = states.features[i];
                    if(stateTwo === stateCenter.properties.code){
                        var lat = stateCenter.properties.latitude;
                        var lon = stateCenter.properties.longitude;
                        coordTwo.push(lat);
                        coordTwo.push(lon);
                        connectionPath.push(coordTwo);
                        connectionPath.push(quantity);
                        break;
                    }
                }
                coords.push(connectionPath);
            });
        }else if(mapLevel==="world"){
            linkArray.forEach(function(d){
                var connection = {};
                var countryCodeOne = nodes[d[0]].country;
                var countryCodeTwo = nodes[d[1]].country;
                var countryValue = d[2];
                if (countryCodeOne && countryCodeTwo){
                    connection.countryCodeOne = countryCodeOne;
                    connection.countryCodeTwo = countryCodeTwo;
                    connection.quantity = countryValue;
                    connections.push(connection);
                }
            });
            connections.forEach(function(d){
                var countryOne = d.countryCodeOne;
                var countryTwo = d.countryCodeTwo;
                var quantity = d.quantity;
                var coordOne = [];
                var coordTwo = [];
                var connectionPath = [];
                if(countryOne !== 'US' && countryTwo === 'US'){
                    for(var i = 0; i < ports.length; i++){
                        if(countryOne === ports[i].iso2){
                            coordOne.push(ports[i].exlatitude);
                            coordOne.push(ports[i].exlongitude);
                            coordTwo.push(ports[i].imlatitude);
                            coordTwo.push(ports[i].imlongitude);
                            connectionPath.push(coordOne);
                            connectionPath.push(coordTwo);
                            connectionPath.push(quantity);
                            coords.push(connectionPath);
                        }
                    }
                }else{
                    for (var i = 0; i < countries.features.length; i++){
                        var countryCenter = countries.features[i];
                        if (countryOne === countryCenter.properties.code){
                            var lat = countryCenter.properties.latitude;
                            var lon = countryCenter.properties.longitude;
                            coordOne.push(lat);
                            coordOne.push(lon);
                            connectionPath.push(coordOne);
                            break;
                        }
                    }
                    for(var i = 0; i < countries.features.length; i++){
                        var countryCenter = countries.features[i];
                        if(countryTwo === countryCenter.properties.code){
                            var lat = countryCenter.properties.latitude;
                            var lon = countryCenter.properties.longitude;
                            coordTwo.push(lat);
                            coordTwo.push(lon);
                            connectionPath.push(coordTwo);
                            connectionPath.push(quantity);
                            break;
                        }
                    }
                    coords.push(connectionPath);
                }
            });
        }
        var quantities = [];
        coords.forEach(function(d){
            quantities.push(d[2]);
        });
        var thicknessExtent = d3.extent(quantities);
        var thicknessScale = d3.scaleQuantile()
            .domain(thicknessExtent)
            .range([6 ,8, 10, 12, 14]);
        mapArea.selectAll("#connection-path").remove();
        mapArea.selectAll("#connection-path")
            .data(coords)
            .enter()
            .append("path")
            .attr("id", "#connection-path")
            .attr("d", function(d) {
                return path({
                    type: "LineString",
                    coordinates: [
                        [d[0][1], d[0][0]],
                        [d[1][1], d[1][0]]
                    ],
                });
            })
            .style("fill", "none")
            .style("stroke-opacity", 0.5)
            .style('stroke-width', (d) =>{
                return thicknessScale(d[2]);
            })
            .style('stroke', (d) =>{
                return getColor(d);
            })

        mapArea.selectAll("#connection-dot").remove();
        let dots = mapArea
            .append("g")
            .attr("id", "connection-dot")
            .selectAll("#connection-dot")
            .data(coords)
            .enter();

        dots.append("circle")
            .attr("cx", function(d){
                let lat = d[0][0];
                let lon = d[0][1];
                return projection([lon, lat])[0];
            })
            .attr("cy", function(d){
                let lat = d[0][0];
                let lon = d[0][1];
                return projection([lon, lat])[1];
            })
            .attr("r", 6)
            .attr("fill", (d) =>{
                return getColor(d);
            });

        dots.append("circle")
            .attr("cx", function(d){
                let lat = d[1][0];
                let lon = d[1][1];
                return projection([lon, lat])[0];
            })
            .attr("cy", function(d){
                let lat = d[1][0];
                let lon = d[1][1];
                return projection([lon, lat])[1];
            })
            .attr("r", 6)
            .attr("fill", (d) =>{
                return getColor(d[0]);
            });
    };


  //**************************************************************************
  //** getPoints
  //**************************************************************************
    var getPoints = function(data, chartConfig, projection){
        var coords = [];
        var hasValue = false;
        data.forEach(function(d){
            var lat = parseFloat(d[chartConfig.latitude]);
            var lon = parseFloat(d[chartConfig.longitude]);
            if (isNaN(lat) || isNaN(lon)) return;
            var coord = projection([lon, lat]);
            if (!coord) return;
            if (isNaN(coord[0]) || isNaN(coord[1])) return;
            var val = parseFloat(d[chartConfig.mapValue]);
            if (!isNaN(val)){
                coord.push(val);
                hasValue = true;
            }
            coords.push(coord);
        });
        return {
            coords: coords,
            hasValue: hasValue
        };
    };


  //**************************************************************************
  //** getCentroids
  //**************************************************************************
    var getCentroids = function(data, mapData, chartConfig, path, projection){
        var coords = [];
        var hasValue = false;
        data.forEach(function(d){
            var value = d[chartConfig.mapLocation];
            mapData.features.every(function(feature){
                var properties = feature.properties;
                if (value === properties.code){

                  //Get centroid
                    var centroid;
                    if (!isNaN(properties.latitude) && !isNaN(properties.longitude)){
                        centroid = projection([properties.longitude, properties.latitude]);
                    }
                    else{
                        centroid = path.centroid(feature);
                    }

                  //Update coords
                    if (centroid){
                        if (isNaN(centroid[0]) || isNaN(centroid[0])) centroid = null;
                        else coords.push(centroid);
                    }

                  //Set value
                    if (centroid && chartConfig.mapValue){
                        var val = parseFloat(d[chartConfig.mapValue]);
                        if (!isNaN(val)){
                            hasValue = true;
                            centroid.push(val);
                        }
                    }

                    return false;
                }
                return true;
            });
        });
        return {
            coords: coords,
            hasValue: hasValue
        };
    };


  //**************************************************************************
  //** renderPoints
  //**************************************************************************
    var renderPoints = function(points, chartConfig, extent){

        var opacity = chartConfig.opacity;
        if(!opacity){
            opacity = 1.0;
        }
        else {
            opacity = opacity/100;
        }


        var r = parseInt(chartConfig.pointRadius);
        if (isNaN(r)) r = 3;
        if (r<0) r = 1;

        var c = chartConfig.pointColor || "#ff3c38"; //red default

        var oc = chartConfig.outlineColor;
        if (!oc) oc = c;


        var outlineWidth = parseFloat(chartConfig.outlineWidth);
        if (isNaN(outlineWidth) || outlineWidth<0) outlineWidth = 0;
        if (outlineWidth>r) outlineWidth = r;



        mapArea.append("g")
        .selectAll("*")
        .data(points.coords)
        .enter()
        .append("circle")
        .attr("r",function(coord){
            if (points.hasValue){
                var val = coord[2];
                if (isNaN(val) || val<=0) return r;
                var p = val/extent[1];
                var maxSize = r;
                if (p > 0){
                    return maxSize*p;
                }
                else{
                    return maxSize*.25;
                }
            }
            return r;
        })
        .attr("transform", function(d) {
            return "translate(" + [d[0],d[1]] + ")";
        })
        .attr("fill-opacity", opacity)
        .style("fill", c)
        .style("stroke", oc)
        .style("stroke-width", outlineWidth + "px");
    };


  //**************************************************************************
  //** selectArea
  //**************************************************************************
  /** Returns most suitable map type based on the "mapLocation" config
   */
    var selectArea = function(data, chartConfig){

      //Analyze data
        var numStates = 0;
        var numCounties = 0;
        var numCensusDivisions = 0;
        data.forEach(function(d){
            var location = d[chartConfig.mapLocation];
            if (typeof location === 'undefined') return;
            var censusDivision = getCensusDivision(d[chartConfig.mapLocation]);


            counties.features.every(function(county){
                if (county.id===location){
                    numCounties++;
                    return false;
                }
                return true;
            });

            states.features.every(function(state){
                var foundMatch = false;

                if (state.properties.name===location || state.properties.code===location){
                    numStates++;
                    foundMatch = true;
                }

                if (!isNaN(censusDivision)){
                    if (state.properties.censusDivision===censusDivision){
                        numCensusDivisions++;
                        foundMatch = true;
                    }
                }

                return !foundMatch;
            });

        });


      //Render data using the most suitable geometry type
        var maxMatches = Math.max(numStates, numCounties, numCensusDivisions);
        if (maxMatches>0){
            if (maxMatches===numCounties){
                return "counties";
            }
            else if (maxMatches===numStates){
                return "states";
            }
            else if (maxMatches===numCensusDivisions){
                return "censusDivisions";
            }
        }
        return null;
    };


  //**************************************************************************
  //** updateStatePolygons
  //**************************************************************************
  /** Used to update the fill color for states using the "mapValue"
   */
    var updateStatePolygons = function(data, statePolygons, chartConfig, colorScale){
        var values = {};
        data.forEach(function(d){
            var location = d[chartConfig.mapLocation];
            if (typeof location === 'undefined') return;
            values[location] = d[chartConfig.mapValue];
        });

        statePolygons.each(function() {
            var path = d3.select(this);
            path.attr('fill', function(state){
                var v = parseFloat(values[state.properties.name]);
                if (isNaN(v)) v = parseFloat(values[state.properties.code]);
                if (isNaN(v) || v<0) v = 0;
                var fill = colorScale[chartConfig.colorScale](v);
                if (!fill) return 'none';
                return fill;
            });
        });
    };


  //**************************************************************************
  //** updateCensusPolygons
  //**************************************************************************
  /** Used to update the fill color for states by census division using "mapValue"
   */
    var updateCensusPolygons = function(data, statePolygons, chartConfig, colorScale){
        var values = {};
        data.forEach(function(d){
            var censusDivision = getCensusDivision(d[chartConfig.mapLocation]);
            if (!isNaN(censusDivision)){
                values[censusDivision+""] = d[chartConfig.mapValue];
            }
        });

        statePolygons.each(function() {
            var path = d3.select(this);
            path.attr('fill', function(state){
                var v = parseFloat(values[state.properties.censusDivision+""]);
                if (isNaN(v) || v<0) v = 0;
                var fill = colorScale[chartConfig.colorScale](v);
                if (!fill) return 'none';
                return fill;
            });
        });
    };


  //**************************************************************************
  //** getCensusDivision
  //**************************************************************************
  /** Used to parse a given string and returns an integer value (1-9)
   */
    var getCensusDivision = function(str){

        if (typeof str === 'undefined') return null;
        var censusDivision = parseInt(censusDivision);
        if (!isNaN(censusDivision)) return censusDivision;

        str = str.toLowerCase();
        if (str.indexOf("new england")>-1) return 1;
        if (str.indexOf("middle atlantic")>-1 || str.indexOf("mid atlantic")>-1) return 2;
        if (str.indexOf("east north central")>-1) return 3;
        if (str.indexOf("west north central")>-1) return 4;
        if (str.indexOf("south atlantic")>-1) return 5;
        if (str.indexOf("east south central")>-1) return 6;
        if (str.indexOf("west south central")>-1) return 7;
        if (str.indexOf("mountain")>-1) return 8;
        if (str.indexOf("pacific")>-1) return 9;

        return null;
    };


  //**************************************************************************
  //** getMapData
  //**************************************************************************
  /** Used to download and parse counties and countries and calls the callback
   *  when ready
   */
    var getMapData = function(callback){
        if (counties){
            if (countries) callback();
            else{
                getData("countries", function(countryData){
                    countries = topojson.feature(countryData, countryData.objects.countries);
                    callback();
                });
            }
        }
        else{
            getData("counties", function(json){
                countyData = json;
                counties = topojson.feature(countyData, countyData.objects.counties);
                states = topojson.feature(countyData, countyData.objects.states);
                if (countries) callback();
                else{
                    getData("countries", function(json){
                        countryData = json;
                        countries = topojson.feature(countryData, countryData.objects.countries);
                        callback();
                    });
                }
            });
        }
    };


  //**************************************************************************
  //** getData
  //**************************************************************************
    var getData = function(name, callback){
        if (!bluewave.data) bluewave.data = {};
        if (bluewave.data[name]){
            callback.apply(this, [bluewave.data[name]]);
        }
        else{
            bluewave.utils.getData(name, callback);
        }
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var addTextEditor = bluewave.utils.addTextEditor;
    var createSlider = bluewave.utils.createSlider;
    var warn = bluewave.utils.warn;

    init();
 };