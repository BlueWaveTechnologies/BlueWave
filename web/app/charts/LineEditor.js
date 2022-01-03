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
    var svg;
    var previewArea;
    var lineChart, barChart;
    var optionsDiv;
    var plotInputs = {};
    var chartConfig = {};
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


      //Initialize chart area when ready
        onRender(previewArea, function(){
            initializeChartSpace();
        });
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

            plotInputs[xAxisN].setValue(chartConfig[xAxisN], true);
            plotInputs[yAxisN].setValue(chartConfig[yAxisN], true);

            if (chartConfig[groupN]){
                plotInputs[groupN].setValue(chartConfig[groupN], false); //<--firing the onChange event is a hack to show/hide labels
            }
            else{
                var label = chartConfig[labelN];
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

                        createLabel("Label"),
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


      //Update plotInputs with label field(s)
        for (var i=0; i<inputData.length; i++){
            var id = i>0 ? (i+1) : "";
            var fieldName = "label"+id;
            plotInputs[fieldName] = form.findField(fieldName);
        }


        form.onChange = function(input, value){
            var key = input.name;

          //Special case for "Separate By" option. Show/Hide the label field.
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

            chartConfig[key] = value;
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
  //** initializeChartSpace
  //**************************************************************************
    var initializeChartSpace = function(){
        var width = previewArea.offsetWidth;
        var height = previewArea.offsetHeight;

        svg = d3.select(previewArea).append("svg");
        svg.attr("width", width);
        svg.attr("height", height);


        lineChart = new bluewave.charts.LineChart(svg, {});
        lineChart.onClick = function(line, datasetID){
            editLine(datasetID);
        };

    };


  //**************************************************************************
  //** createLinePreview
  //**************************************************************************
    var createLinePreview = function(){
        lineChart.clear();
        lineChart.setConfig(chartConfig);
        //TODO: Add lines
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
        xLabelField.setValue(xLabel===true ? true : false);

        //Set intial value for yLabel
        var yLabelField = form.findField("yLabel");
        var yLabel = chartConfig.yLabel;
        yLabelField.setValue(yLabel===true ? true : false);

        var tagField = form.findField("endTags");
        var endTags = chartConfig.endTags;
        tagField.setValue(endTags===true ? true : false);

        var stackField = form.findField("stack");
        var stack = chartConfig.stack;
        stackField.setValue(stack===true ? true : false);

        var scalingField = form.findField("scaleOptions");
        var scale = chartConfig.scaleOption;
        scalingField.setValue(scale==="logarithmic" ? "logarithmic" : "linear");


      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();

            if (settings.xGrid==="true") settings.xGrid = true;
            else settings.xGrid = false;

            if (settings.yGrid==="true") settings.yGrid = true;
            else settings.yGrid = false;

            if (settings.xLabel==="true") settings.xLabel = true;
            else settings.xLabel = false;

            if (settings.yLabel==="true") settings.yLabel = true;
            else settings.yLabel = false;

            if (settings.endTags==="true") settings.endTags = true;
            else settings.endTags = false;

            if (settings.stack==="true") settings.stack = true;
            else settings.stack = false;

            chartConfig.scaleOption = settings.scaleOptions;
            chartConfig.xGrid = settings.xGrid;
            chartConfig.yGrid = settings.yGrid;
            chartConfig.xLabel = settings.xLabel;
            chartConfig.yLabel = settings.yLabel;
            chartConfig.endTags = settings.endTags;
            chartConfig.stack = settings.stack;
            createLinePreview();
        };


      //Render the styleEditor popup and resize the form
        styleEditor.showAt(108,57);
        form.resize();

    };


  //**************************************************************************
  //** editLine
  //**************************************************************************
    var editLine = function(datasetID){

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
                },
            ]
        });



      //Update color field (add colorPicker) and set initial value
        createColorOptions("lineColor", form);
        createColorOptions("pointColor", form);


      //Update lineWidth field (add slider) and set initial value
        createSlider("lineThickness", form, "px", 1, 10, 1);
        var thickness = chartConfig.lineWidth;
        if (isNaN(thickness)) thickness = 1;
        chartConfig.lineWidth = thickness;
        form.findField("lineThickness").setValue(thickness);


      //Add opacity sliders
        createSlider("lineOpacity", form, "%");
        var opacity = chartConfig.opacity;
        if (isNaN(opacity)) opacity = 1;
        chartConfig.opacity = opacity;
        form.findField("lineOpacity").setValue(opacity*100);


        createSlider("startOpacity", form, "%");
        var startOpacity = chartConfig.startOpacity;
        if (isNaN(startOpacity)) startOpacity = 0;
        chartConfig.startOpacity = startOpacity;
        form.findField("startOpacity").setValue(startOpacity*100);


        createSlider("endOpacity", form, "%");
        var endOpacity = chartConfig.endOpacity;
        if (isNaN(endOpacity)) endOpacity = 0;
        chartConfig.endOpacity = endOpacity;
        form.findField("endOpacity").setValue(endOpacity*100);


      //Add radius slider
        createSlider("pointRadius", form, "px", 0, 10, 1);
        var pointRadius = chartConfig.pointRadius;
        if (isNaN(pointRadius)) pointRadius = 0;
        chartConfig.pointRadius = pointRadius;
        form.findField("pointRadius").setValue(pointRadius);


      //Add smoothing slider
        var smoothingField = form.findField("smoothingValue");
        var smoothingSlider = createSlider("smoothingValue", form, "", 0, 100, 1);
        var smoothingValue = chartConfig.smoothingValue;
        if (isNaN(smoothingValue)) smoothingValue = 0;
        smoothingField.setValue(smoothingValue);



        let n = parseInt(datasetID);
        if (!isNaN(n)){ //Single line edit case


            //for these I think I'm gonna need to do chartConfig.layers[i].line.setThing()
            var colors = bluewave.utils.getColorPalette(true);

            if( !chartConfig["lineColor" + n] ) chartConfig["lineColor" + n] = colors[n%colors.length];
            if( !chartConfig["pointColor" + n] ) chartConfig["pointColor" + n] = chartConfig["lineColor" + n];
            if( !chartConfig["lineStyle" + n] ) chartConfig["lineStyle" + n] = "solid";
            if( isNaN(chartConfig["lineWidth" + n]) ) chartConfig["lineWidth" + n] = 1;
            if( isNaN(chartConfig["opacity" + n]) ) chartConfig["opacity" + n] = 1;
            if( isNaN(chartConfig["startOpacity" + n]) ) chartConfig["startOpacity" + n] = 0;
            if( isNaN(chartConfig["endOpacity" + n]) ) chartConfig["endOpacity" + n] = 0;
            if( isNaN(chartConfig["pointRadius" + n]) ) chartConfig["pointRadius" + n] = 0;



            form.findField("lineColor").setValue(chartConfig["lineColor" + n]);
            form.findField("pointColor").setValue(chartConfig["pointColor" + n]);
            form.findField("lineStyle").setValue(chartConfig["lineStyle" + n]);
            form.findField("lineThickness").setValue(chartConfig["lineWidth" + n]);
            form.findField("lineOpacity").setValue(chartConfig["opacity" + n]*100);
            form.findField("startOpacity").setValue(chartConfig["startOpacity" + n]*100);
            form.findField("endOpacity").setValue(chartConfig["endOpacity" + n]*100);
            form.findField("pointRadius").setValue(chartConfig["pointRadius" + n]);


            var smoothingType = chartConfig["smoothingType" + n];
            if (smoothingType){
                form.findField("smoothingType").setValue(smoothingType);

                var smoothingValue = chartConfig["smoothingValue" + n];
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

                // chartConfig["lineColor" + n] = settings.lineColor;
                // chartConfig["lineStyle" + n] = settings.lineStyle;
                // chartConfig["lineWidth" + n] = settings.lineThickness;
                // chartConfig["opacity" + n] = settings.lineOpacity/100;

                // chartConfig["startOpacity" + n] = settings.startOpacity/100;
                // chartConfig["endOpacity" + n] = settings.endOpacity/100;

                // chartConfig["pointColor" + n] = settings.pointColor;
                // chartConfig["pointRadius" + n] = settings.pointRadius;

                chartConfig["lineColor" + n] = settings.lineColor;
                chartConfig["lineStyle" + n] = settings.lineStyle;
                chartConfig["lineWidth" + n] = settings.lineThickness;
                chartConfig["opacity" + n] = settings.lineOpacity/100;

                chartConfig["startOpacity" + n] = settings.startOpacity/100;
                chartConfig["endOpacity" + n] = settings.endOpacity/100;

                chartConfig["pointColor" + n] = settings.pointColor;
                chartConfig["pointRadius" + n] = settings.pointRadius;

                var smoothingType = settings.smoothingType;
                if (smoothingType==="none"){
                    delete chartConfig["smoothingType" + n];
                    delete chartConfig["smoothingValue" + n];
                    form.disableField("smoothingValue");
                    smoothingSlider.disabled = true;
                }
                else if (smoothingType==="spline"){
                    chartConfig["smoothingType" + n] = smoothingType;
                    delete chartConfig["smoothingValue" + n];
                    form.disableField("smoothingValue");
                    smoothingSlider.disabled = true;
                }
                else {
                    chartConfig["smoothingType" + n] = smoothingType;
                    chartConfig["smoothingValue" + n] = settings.smoothingValue;
                    form.enableField("smoothingValue");
                    smoothingSlider.disabled = false;
                }
                smoothingSlider.focus();


                createLinePreview();
            };

        }
        else{

          //Process onChange events
            form.onChange = function(){
                let settings = form.getData();
                chartConfig.lineColor = settings.lineColor;
                chartConfig.lineWidth = settings.lineThickness;
                chartConfig.opacity = settings.lineOpacity/100;
                chartConfig.startOpacity = settings.startOpacity/100;
                chartConfig.endOpacity = settings.endOpacity/100;
                createLinePreview();
            };
        }




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
    var onRender = javaxt.dhtml.utils.onRender;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;
    var getStyleEditor = bluewave.chart.utils.getStyleEditor;

    init();
};