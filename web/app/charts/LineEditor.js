if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  LineEditor
//******************************************************************************
/**
 *   Panel used to edit line charts
 *
 ******************************************************************************/

bluewave.charts.LineEditor = function(parent, config) {
    var me = this;
    var panel;
    var inputData = [];
    var previewArea;
    var lineChart, barChart;
    var optionsDiv;
    var plotInputs = {};
    var chartConfig = {
        layers: []
    };
    var lineMap = []; //used to map lines in the chart to a layer in the config
    var colorPicker;


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


      //Create chart options
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        var outerDiv = document.createElement("div");
        outerDiv.className = "chart-editor-options";
        outerDiv.style.height = "100%";
        outerDiv.style.position = "relative";
        outerDiv.style.overflow = "hidden";
        outerDiv.style.overflowY = "auto";
        td.appendChild(outerDiv);
        optionsDiv = document.createElement("div");
        optionsDiv.style.position = "absolute";
        outerDiv.appendChild(optionsDiv);


      //Create chart preview
        td = document.createElement("td");
        td.className = "chart-editor-preview";
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);

        var outerDiv = document.createElement("div");
        outerDiv.style.height = "100%";
        outerDiv.style.position = "relative";
        outerDiv.style.overflow = "hidden";
        td.appendChild(outerDiv);

        panel = createDashboardItem(outerDiv,{
            width: "100%",
            height: "100%",
            title: "Untitled",
            settings: true
        });
        previewArea = panel.innerDiv;
        panel.el.className = "";
        panel.el.style.position = "absolute";


      //Allow users to change the title associated with the chart
        addTextEditor(panel.title, function(title){
            panel.title.innerHTML = title;
            chartConfig.chartTitle = title;
        });


      //Watch for settings
        panel.settings.onclick = function(){
            editChart();
        };


      //Initialize chart
        lineChart = new bluewave.charts.LineChart(previewArea, {});
        lineChart.onClick = function(el, lineID){
            var line = lineChart.getLayers()[lineID].line;
            var layer = lineMap[lineID].layer;
            editLine(line, lineID);
        };
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(config, inputs){
        me.clear();

        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if (input!=null) inputs[i] = d3.csvParse(input);
        }
        inputData = inputs;


        if (config) chartConfig = config;

        var addLayer = function(){
            chartConfig.layers.push({
                line: {fill:{}, point:{}}
            });
        };

        if (!chartConfig.layers){
            chartConfig.layers = [];
            for (var i=0; i<inputs.length; i++){
                addLayer();
            }
        }
        else{
            if (chartConfig.layers.length<inputs.length){
                var start = inputs.length-chartConfig.layers.length;
                for (var i=start; i<inputs.length; i++){
                    addLayer();
                }
            }
        }


        if (chartConfig.chartTitle){
            panel.title.innerHTML = chartConfig.chartTitle;
        }


        createForm(optionsDiv);
        createOptions();
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        inputData = [];
        lineMap = [];
        chartConfig = {};
        plotInputs = {};
        panel.title.innerHTML = "Untitled";
        optionsDiv.innerHTML = "";

        if (lineChart) lineChart.clear();
        if (barChart) barChart.clear();

        if (colorPicker) colorPicker.hide();
        //if (styleEditor) styleEditor.hide();
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
  /** Returns chart configuration
   */
    this.getConfig = function(){
        return chartConfig;
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return previewArea;
    };


  //**************************************************************************
  //** createOptions
  //**************************************************************************
    var createOptions = function() {

        for (let i=0; i<inputData.length; i++){
            var n = i>0 ? (i+1) : "";
            let xAxisN = `xAxis${n}`;
            let yAxisN = `yAxis${n}`;
            let groupN = `group${n}`;
            let labelN = `label${n}`;

            plotInputs[groupN].add("", "");

            let dataOptions = Object.keys(inputData[i][0]);
            dataOptions.forEach((val)=>{
                plotInputs[xAxisN].add(val, val);
                plotInputs[yAxisN].add(val, val);
                plotInputs[groupN].add(val, val);
            });


            plotInputs[xAxisN].setValue(chartConfig.layers[i].xAxis, true);
            plotInputs[yAxisN].setValue(chartConfig.layers[i].yAxis, true);

            if (chartConfig.layers[i].group){

              //Trigger onChange event to show/hide labels
                plotInputs[groupN].setValue(chartConfig.layers[i].group, false);
            }
            else{

              //Set default label
                var label = chartConfig.layers[i].line.label;
                if (!label) label = "Series " + (i+1);
                plotInputs[labelN].setValue(label, true);
            }
        }

        createLinePreview();
    };


  //**************************************************************************
  //** createForm
  //**************************************************************************
    var createForm = function(parent){

        var items = [];
        for (var i=0; i<inputData.length; i++){
            var n = i>0 ? (i+1) : "";
            items.push(
                {
                    group: "Series " + (i+1),
                    items: [
                        createLabel("X-Axis"),
                        createDropdown(`xAxis${n}`, plotInputs),

                        createLabel("Y-Axis"),
                        createDropdown(`yAxis${n}`, plotInputs),

                        createLabel("Separate By"),
                        createDropdown(`group${n}`, plotInputs),

                        createLabel("Name"),
                        { name: (`label${n}`), label: "", type: "text" }

                    ]
                }
            );
        }


        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.zIndex = 1;
        parent.appendChild(div);


        var form = new javaxt.dhtml.Form(div, {
            style: config.style.form,
            items: items
        });

        var formGroups = form.getGroups();


      //Update plotInputs with label field(s)
        for (var i=0; i<inputData.length; i++){
            var id = i>0 ? (i+1) : "";
            var fieldName = "label"+id;
            plotInputs[fieldName] = form.findField(fieldName);
        }


      //Watch for form change events
        form.onChange = function(input, value){

          //Get dataset ID associated with the input
            var datasetID;
            var foundGroup = false;
            formGroups.every(function(group){
                group.getRows().every(function(row){
                    if (row===input.row){
                        foundGroup = true;
                        var groupName = group.name;
                        var groupID = parseInt(groupName.substring(groupName.lastIndexOf(" ")));
                        datasetID = groupID-1;
                    }
                    return !foundGroup;
                });
                return !foundGroup;
            });


          //Get layer associated with the dataset ID
            var layer = chartConfig.layers[datasetID];
            var key = input.name;
            ["xAxis","yAxis","group","label"].forEach(function(label){
                var idx = key.indexOf(label);

                if (key.includes(label)){
                    if (label=="label"){
                        layer.line.label = value;
                    }
                    else{
                        layer[label] = value;
                    }
                }
            });




          //Special case for "Separate By" option. Show/Hide the label field.
            var key = input.name;
            var idx = key.indexOf("group");
            if (idx>-1){
                var id = key.substring("group".length);
                var labelField = form.findField("label"+id);
                var labelText = labelField.row.previousSibling;
                if (!labelField.hide){
                    addShowHide(labelField.row);
                    addShowHide(labelText);
                }


                if (value){
                    labelField.row.hide();
                    labelText.hide();
                }
                else{
                    labelField.row.show();
                    labelText.show();
                }

                form.resize();
            }


            createLinePreview();
        };
    };


  //**************************************************************************
  //** createLabel
  //**************************************************************************
    var createLabel = function(label){
        var row = document.createElement("div");
        row.className = "form-label";
        row.innerText = label + ":";
        return {
            name: "",
            label: "",
            type: {
                getValue: function(){},
                setValue: function(){},
                el: row
            }
        };
    };


  //**************************************************************************
  //** createDropdown
  //**************************************************************************
    var createDropdown = function(inputType,input){
        input[inputType] = new javaxt.dhtml.ComboBox(document.createElement("div"), {
            style: config.style.combobox,
            readOnly: true
        });
        return {
            name: inputType,
            label: "",
            type: input[inputType]
        };
    };


  //**************************************************************************
  //** createLinePreview
  //**************************************************************************
    var createLinePreview = function(){

        lineChart.clear();
        lineChart.setConfig(chartConfig);


        var colors = bluewave.utils.getColorPalette(true);
        var addLine = function(line, data, xAxis, yAxis, layerID){
            lineChart.addLine(line, data, xAxis, yAxis);
            lineMap.push({
                layer: layerID
            });
        };



      //Add lines
        var layers = chartConfig.layers;
        inputData.forEach(function (data, i){

            let layer = layers[i];
            if (layer.xAxis && layer.yAxis){


                if (layer.group){


                    let groupData = d3.nest()
                    .key(function(d){return d[layer.group];})
                    .entries(data);

                    var subgroups = groupData.map(function(d) { return d["key"]; });


                    groupData.forEach(function(g, j){
                        var d = g.values;
                        let line = new bluewave.chart.Line();
                        line.setColor(colors[j % colors.length]);
                        line.setLabel(subgroups[j]);
                        addLine(line, d, layer.xAxis, layer.yAxis, i);
                    });

                }
                else{


                    if (!layer.line) layer.line = {};

                    var lineColor = layer.line.color;
                    if (!lineColor){
                        lineColor = colors[i % colors.length];
                        layer.line.color = lineColor;
                    }

                    let line = new bluewave.chart.Line(layer.line);
                    addLine(line, data, layer.xAxis, layer.yAxis, i);
                }


            }
        });

        lineChart.update();
    };


  //**************************************************************************
  //** editChart
  //**************************************************************************
    var editChart = function(){



      //Update form
        var styleEditor = getStyleEditor(config);
        var body = styleEditor.getBody();
        body.innerHTML = "";


        //Create scaling dropdown
        var scaleDropdown = new javaxt.dhtml.ComboBox(
            document.createElement("div"),
            {
                style: config.style.combobox,
                readOnly: true

            }
        );
        scaleDropdown.add("Linear", "linear");
        scaleDropdown.add("Logarithmic", "logarithmic");
        scaleDropdown.setValue("linear");

        var form = new javaxt.dhtml.Form(body, {
            style: config.style.form,
            items: [
                {
                    group: "General",
                    items: [

                        {
                            name: "scaleOptions",
                            label: "Scaling Options",
                            type: scaleDropdown
                        },
                        {
                            name: "endTags",
                            label: "Display End Tags",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: true
                                }

                            ]
                        },
                        {
                            name: "accumulate",
                            label: "Accumulate Values",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: false
                                }

                            ]
                        },
                        {
                            name: "stack",
                            label: "Stack Lines",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: false
                                }

                            ]
                        }


                    ]
                },
                {
                    group: "X-Axis",
                    items: [

                        {
                            name: "xLabel",
                            label: "Show Labels",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        },
                        {
                            name: "xGrid",
                            label: "Show Grid Lines",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        },
                        {
                            name: "xTicks",
                            label: "Ticks",
                            type: "text"
                        }
                    ]
                },

                {
                    group: "Y-Axis",
                    items: [
                        {
                            name: "yLabel",
                            label: "Show Labels",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        },
                        {
                            name: "yGrid",
                            label: "Show Grid Lines",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        }
                    ]
                }


            ]
        });


       //Set initial value for X-gridline
        var xGridField = form.findField("xGrid");
        var xGrid = chartConfig.xGrid;
        xGridField.setValue(xGrid===true ? true : false);

       //Set initial value for Y-gridline
        var yGridField = form.findField("yGrid");
        var yGrid = chartConfig.yGrid;
        yGridField.setValue(yGrid===true ? true : false);

      //Set intial value for xLabel
        var xLabelField = form.findField("xLabel");
        var xLabel = chartConfig.xLabel;
        xLabelField.setValue(xLabel ? true : false);

      //Set intial value for yLabel
        var yLabelField = form.findField("yLabel");
        var yLabel = chartConfig.yLabel;
        yLabelField.setValue(yLabel ? true : false);

        var tagField = form.findField("endTags");
        var endTags = chartConfig.endTags;
        tagField.setValue(endTags===true ? true : false);

        var stackField = form.findField("stack");
        var stack = chartConfig.stackValues;
        stackField.setValue(stack===true ? true : false);

        var accumulateField = form.findField("accumulate");
        var accumulate = chartConfig.accumulateValues;
        accumulateField.setValue(accumulate===true ? true : false);

        var scalingField = form.findField("scaleOptions");
        var scale = chartConfig.scaling;
        scalingField.setValue(scale==="logarithmic" ? "logarithmic" : "linear");

        createSlider("xTicks", form, "", 0, 50, 1);
        var xTicks = chartConfig.xTicks;
        if (isNaN(xTicks)) xTicks = 10;
        form.findField("xTicks").setValue(xTicks);


      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();

            if (settings.xGrid==="true") settings.xGrid = true;
            else settings.xGrid = false;

            if (settings.yGrid==="true") settings.yGrid = true;
            else settings.yGrid = false;

            if (settings.xLabel) settings.xLabel = true;
            else settings.xLabel = false;

            if (settings.yLabel) settings.yLabel = true;
            else settings.yLabel = false;

            if (settings.endTags==="true") settings.endTags = true;
            else settings.endTags = false;

            if (settings.stack==="true") settings.stack = true;
            else settings.stack = false;

            if (settings.accumulate==="true") settings.accumulate = true;
            else settings.accumulate = false;

            chartConfig.scaling = settings.scaleOptions;
            chartConfig.xGrid = settings.xGrid;
            chartConfig.yGrid = settings.yGrid;
            chartConfig.xLabel = settings.xLabel;
            chartConfig.yLabel = settings.yLabel;
            chartConfig.endTags = settings.endTags;
            chartConfig.stackValues = settings.stack;
            chartConfig.accumulateValues = settings.accumulate;
            if (chartConfig.xLabel) chartConfig.xLabel = chartConfig.layers[0].xAxis;
            if (chartConfig.yLabel) chartConfig.yLabel = chartConfig.layers[0].yAxis;
            chartConfig.xTicks = settings.xTicks;
            createLinePreview();
        };


      //Render the styleEditor popup and resize the form
        styleEditor.showAt(108,57);
        form.resize();

    };


  //**************************************************************************
  //** editLine
  //**************************************************************************
    var editLine = function(line, layerID){

      //Update form
        var styleEditor = getStyleEditor(config);
        var body = styleEditor.getBody();
        body.innerHTML = "";


      //Create dropdown for line style
        var lineDropdown = new javaxt.dhtml.ComboBox(
            document.createElement("div"),
            {
                style: config.style.combobox,
                readOnly: true

            }
        );
        lineDropdown.add("Solid", "solid");
        lineDropdown.add("Dashed", "dashed");
        lineDropdown.add("Dotted", "dotted");
        lineDropdown.setValue("solid");


      //Create dropdown for smoothing options
        var smoothingDropdown = new javaxt.dhtml.ComboBox(
            document.createElement("div"),
            {
                style: config.style.combobox,
                readOnly: true

            }
        );
        smoothingDropdown.add("None", "none");
        smoothingDropdown.add("Simple Spline", "spline");
        smoothingDropdown.add("Moving Average", "movingAverage");
        smoothingDropdown.add("Kernel Density Estimation", "kde");
        smoothingDropdown.setValue("none");


      //Add style options
        var form = new javaxt.dhtml.Form(body, {
            style: config.style.form,
            items: [
                {
                    group: "Stroke",
                    items: [
                        {
                            name: "lineStyle",
                            label: "Type",
                            type: lineDropdown
                        },
                        {
                            name: "lineColor",
                            label: "Color",
                            type: new javaxt.dhtml.ComboBox(
                                document.createElement("div"),
                                {
                                    style: config.style.combobox
                                }
                            )
                        },
                        {
                            name: "lineThickness",
                            label: "Thickness",
                            type: "text"
                        },
                        {
                            name: "lineOpacity",
                            label: "Opacity",
                            type: "text"
                        }
                    ]
                },
                {
                    group: "Points",
                    items: [
                        {
                            name: "pointColor",
                            label: "Color",
                            type: new javaxt.dhtml.ComboBox(
                                document.createElement("div"),
                                {
                                    style: config.style.combobox
                                }
                            )
                        },
                        {
                            name: "pointRadius",
                            label: "Radius",
                            type: "text"
                        }

                    ]
                },
                {
                    group: "Fill",
                    items: [

                        {
                            name: "startOpacity",
                            label: "Start Opacity",
                            type: "text"
                        },
                        {
                            name: "endOpacity",
                            label: "End Opacity",
                            type: "text"
                        }
                    ]
                },
                {
                    group: "Smoothing",
                    items: [
                        {
                            name: "smoothingType",
                            label: "Type",
                            type: smoothingDropdown
                        },
                        {
                            name: "smoothingValue",
                            label: "Factor",
                            type: "text"
                        }
                    ]
                }
            ]
        });



      //Update color field (add colorPicker) and set initial value
        createColorOptions("lineColor", form);
        createColorOptions("pointColor", form);


      //Get line config
        var lineConfig = line.getConfig();


      //Update lineWidth field (add slider) and set initial value
        createSlider("lineThickness", form, "px", 1, 10, 1);
        var thickness = lineConfig.width;
        if (isNaN(thickness)) thickness = 1;
        form.findField("lineThickness").setValue(thickness);


      //Add opacity sliders
        createSlider("lineOpacity", form, "%");
        var opacity = lineConfig.opacity;
        if (isNaN(opacity)) opacity = 1;
        form.findField("lineOpacity").setValue(opacity*100);


        createSlider("startOpacity", form, "%");
        var startOpacity = lineConfig.fill.startOpacity;
        if (isNaN(startOpacity)) startOpacity = 0;
        form.findField("startOpacity").setValue(startOpacity*100);


        createSlider("endOpacity", form, "%");
        var endOpacity = lineConfig.fill.endOpacity;
        if (isNaN(endOpacity)) endOpacity = 0;
        form.findField("endOpacity").setValue(endOpacity*100);


      //Add radius slider
        createSlider("pointRadius", form, "px", 0, 10, 1);
        var pointRadius = lineConfig.point.radius;
        if (isNaN(pointRadius)) pointRadius = 0;
        form.findField("pointRadius").setValue(pointRadius);


      //Add smoothing slider
        var smoothingField = form.findField("smoothingValue");
        var smoothingSlider = createSlider("smoothingValue", form, "", 0, 100, 1);
        var smoothingValue = lineConfig.smoothingValue;
        if (isNaN(smoothingValue)) smoothingValue = 0;
        smoothingField.setValue(smoothingValue);


        form.findField("lineColor").setValue(lineConfig.color);
        form.findField("pointColor").setValue(lineConfig.point.color);
        form.findField("pointRadius").setValue(lineConfig.point.radius);
        form.findField("lineStyle").setValue(lineConfig.style);
        form.findField("lineThickness").setValue(lineConfig.width);
        form.findField("lineOpacity").setValue(lineConfig.opacity*100);
        form.findField("startOpacity").setValue(lineConfig.fill.startOpacity*100);
        form.findField("endOpacity").setValue(lineConfig.fill.endOpacity*100);



        var smoothingType = lineConfig.smoothing;
        if (smoothingType){
            form.findField("smoothingType").setValue(smoothingType);
            var smoothingValue = lineConfig.smoothingValue;
            if (isNaN(smoothingValue)) smoothingValue = 0;
            smoothingField.setValue(smoothingValue);
        }
        else{
            smoothingField.setValue(0);
            form.disableField("smoothingValue");
            smoothingSlider.disabled = true;
        }


        form.onChange = function(){
            let settings = form.getData();

            lineConfig.color = settings.lineColor;
            lineConfig.style = settings.lineStyle;
            lineConfig.width = settings.lineThickness;
            lineConfig.opacity = settings.lineOpacity/100;

            lineConfig.fill.color = settings.lineColor;
            lineConfig.fill.startOpacity = settings.startOpacity/100;
            lineConfig.fill.endOpacity = settings.endOpacity/100;

            lineConfig.point.color = settings.pointColor;
            lineConfig.point.radius = settings.pointRadius;

            var smoothingType = settings.smoothingType;
            if (smoothingType==="none"){
                lineConfig.smoothing = "none";
                lineConfig.smoothingValue = 0;
                form.disableField("smoothingValue");
                smoothingSlider.disabled = true;
            }
            else if (smoothingType==="spline"){
                lineConfig.smoothing = smoothingType;
                lineConfig.smoothingValue = 0;
                form.disableField("smoothingValue");
                smoothingSlider.disabled = true;
            }
            else {
                lineConfig.smoothing = smoothingType;
                lineConfig.smoothingValue = settings.smoothingValue;
                form.enableField("smoothingValue");
                smoothingSlider.disabled = false;
            }
            smoothingSlider.focus();


          //Update line chart
            line.setConfig(lineConfig);
            lineChart.update();


          //Update chart config
            var layer = chartConfig.layers[layerID];
            if (layer.group){
                //TODO: Persist styles for individual lines in a group
            }
            else{
                chartConfig.layers[layerID].line = line.getConfig();
            }
        };



      //Render the styleEditor popup and resize the form
        styleEditor.showAt(108,57);
        form.resize();
    };


  //**************************************************************************
  //** createColorOptions
  //**************************************************************************
  /** Creates a custom form input using a combobox
   */
    var createColorOptions = function(inputName, form){
        bluewave.utils.createColorOptions(inputName, form, function(colorField){
            if (!colorPicker) colorPicker = bluewave.utils.createColorPickerCallout(config);
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
  //** Utils
  //**************************************************************************
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;
    var getStyleEditor = bluewave.chart.utils.getStyleEditor;

    init();
};