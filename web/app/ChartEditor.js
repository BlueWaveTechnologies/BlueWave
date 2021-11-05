if(!bluewave) var bluewave={};

//******************************************************************************
//**  ChartEditor
//******************************************************************************
/**
 *   Panel used to edit charts/graphs
 *
 ******************************************************************************/

bluewave.ChartEditor = function(parent, config) {
    var me = this;
    var currentNode;
    var panel;
    var inputData = [];
    var svg;
    var previewArea;
    var lineChart, barChart;
    var optionsDiv;
    var plotInputs = {
        xAxis:null,
        yAxis:null,
        xAxis2:null,
        yAxis2:null,
        group:null
    };
    var chartConfig = {};
    var styleEditor, colorPicker;


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
            if (chartConfig) editStyle(chartConfig.chartType);
        };


      //Initialize chart area when ready
        onRender(previewArea, function(){
            initializeChartSpace();
        });
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(nodeType, config, inputs, node){
        me.clear();
        currentNode = node;
        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if (input!=null) inputs[i] = d3.csvParse(input);
        }
        inputData = inputs;


        if (config) chartConfig = config;

        if (chartConfig.chartTitle){
            panel.title.innerHTML = chartConfig.chartTitle;
        }

        chartConfig.chartType = nodeType;
        createForm(optionsDiv);
        createOptions();
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        inputData = [];
        chartConfig = {};
        panel.title.innerHTML = "Untitled";
        optionsDiv.innerHTML = "";

        if (lineChart) lineChart.clear();
        if (barChart) barChart.clear();

        if (colorPicker) colorPicker.hide();
        if (styleEditor) styleEditor.hide();
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
  /** Initializes Options for Dropdowns.
   */
    var createOptions = function() {
        var data = inputData[0];
        var data2 = inputData[1];

        let dataOptions = Object.keys(data[0]);
        let dataOptions2 = data2?Object.keys(data2[0]):null;
        switch(chartConfig.chartType){
            case 'barChart':
                plotInputs.group.add("", "");
                dataOptions.forEach((val)=>{
                    plotInputs.xAxis.add(val,val);
                    plotInputs.yAxis.add(val,val);
                    plotInputs.group.add(val, val);
                });
                plotInputs.xAxis.setValue(chartConfig.xAxis, true);
                plotInputs.yAxis.setValue(chartConfig.yAxis, true);
                if (chartConfig.group){
                    plotInputs.group.setValue(chartConfig.group, true);
                }

                //Add dropdown values for each data set
                for (let i=1; i<inputData.length; i++){
                    let xAxisN = `xAxis${i+1}`;
                    let yAxisN = `yAxis${i+1}`;
                    let groupN = `group${i+1}`;
                    // let labelN = `label${i+1}`;

                    plotInputs[groupN].add("", "");

                    let multiLineDataOptions = Object.keys(inputData[i][0]);
                    multiLineDataOptions.forEach((val)=>{
                        plotInputs[xAxisN].add(val, val);
                        plotInputs[yAxisN].add(val, val);
                        plotInputs[groupN].add(val, val);
                    });

                    plotInputs[xAxisN].setValue(chartConfig[xAxisN], true);
                    plotInputs[yAxisN].setValue(chartConfig[yAxisN], true);

                    if (chartConfig[groupN]){
                        plotInputs[groupN].setValue(chartConfig[groupN], true);
                    }

                }

                createBarPreview();

                break;
            case 'lineChart':
                plotInputs.group.add("", "");
                dataOptions.forEach((val)=>{
                    plotInputs.xAxis.add(val,val);
                    plotInputs.yAxis.add(val,val);
                    plotInputs.group.add(val,val);
                });
                plotInputs.xAxis.setValue(chartConfig.xAxis, true);
                plotInputs.yAxis.setValue(chartConfig.yAxis, true);
                if (chartConfig.group){
                    plotInputs.group.setValue(chartConfig.group, false); //<--firing the onChange event is a hack to show/hide labels
                }
                else{
                    var label = chartConfig.label;
                    if (!label) label = "Series 1";
                    plotInputs.label.setValue(label, true);
                }

              //Add dropdown values for each data set
                for (let i=1; i<inputData.length; i++){
                    let xAxisN = `xAxis${i+1}`;
                    let yAxisN = `yAxis${i+1}`;
                    let groupN = `group${i+1}`;
                    let labelN = `label${i+1}`;

                    plotInputs[groupN].add("", "");

                    let multiLineDataOptions = Object.keys(inputData[i][0]);
                    multiLineDataOptions.forEach((val)=>{
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

                break;
            default:
                break;
        }
    };


  //**************************************************************************
  //** createForm
  //**************************************************************************
    var createForm = function(parent){

        switch(chartConfig.chartType){
            case "barChart":
                createBarChartOptions(parent);
                break;
            case "lineChart":
                createLineChartOptions(parent);
                break;
            default:
                break;
        }
    };


  //**************************************************************************
  //** createBarChartOptions
  //**************************************************************************
    var createBarChartOptions = function(parent){

        var items = [];
        items.push(
            {
                group: "Series 1",
                items: [
                    createLabel("X-Axis"),
                    createDropdown("xAxis", plotInputs),

                    createLabel("Y-Axis"),
                    createDropdown("yAxis", plotInputs),

                    createLabel("Separate By"),
                    createDropdown("group", plotInputs)
                ]
            }
        );

        for (var i=1; i<inputData.length; i++){
            items.push(
                {
                    group: "Series " + (i+1),
                    items: [
                        createLabel("X-Axis"),
                        createDropdown(`xAxis${i+1}`, plotInputs),

                        createLabel("Y-Axis"),
                        createDropdown(`yAxis${i+1}`, plotInputs),

                        createLabel("Separate By"),
                        createDropdown(`group${i+1}`, plotInputs),
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

        form.onChange = function(input, value){
            var key = input.name;
            chartConfig[key] = value;
            createBarPreview();
        };
    };


  //**************************************************************************
  //** createLineChartOptions
  //**************************************************************************
    var createLineChartOptions = function(parent){

        var items = [];
        items.push(
            {
                group: "Series 1",
                items: [
                    createLabel("X-Axis"),
                    createDropdown("xAxis", plotInputs),

                    createLabel("Y-Axis"),
                    createDropdown("yAxis", plotInputs),

                    createLabel("Separate By"),
                    createDropdown("group", plotInputs),

                    createLabel("Label", "label"),
                    { name: "label", label: "", type: "text" }

                ]
            }
        );

        for (var i=1; i<inputData.length; i++){
            items.push(
                {
                    group: "Series " + (i+1),
                    items: [
                        createLabel("X-Axis"),
                        createDropdown(`xAxis${i+1}`, plotInputs),

                        createLabel("Y-Axis"),
                        createDropdown(`yAxis${i+1}`, plotInputs),

                        createLabel("Separate By"),
                        createDropdown(`group${i+1}`, plotInputs),

                        createLabel("Label"),
                        { name: (`label${i+1}`), label: "", type: "text" }

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
  //** createInput
  //**************************************************************************
    var createInput = function(parent,chartConfigRef,displayName,callBack,input,inputType){

        var row = document.createElement("div");
        parent.appendChild(row);


        var label = document.createElement("label");
        label.innerText = displayName + ":";
        row.appendChild(label);

        input[inputType] = new javaxt.dhtml.ComboBox(row, {
            style: config.style.combobox,
            readOnly: true
        });
        input[inputType].onChange = function(name,value){
            chartConfig[chartConfigRef] = value;
            callBack();
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
            editStyle("line", datasetID);
        };

        barChart = new bluewave.charts.BarChart(svg, {});
        barChart.onClick = function(bar, barID){
            // chartConfig.barColor = d3.select(bar).attr("fill");
            editStyle("bar", barID);

        };
    };



  //**************************************************************************
  //** createLinePreview
  //**************************************************************************
    var createLinePreview = function(){
        onRender(previewArea, function(){
            lineChart.update(chartConfig, inputData);
        });
    };


  //**************************************************************************
  //** createBarPreview
  //**************************************************************************
    var createBarPreview = function(){
        onRender(previewArea, function(){
            barChart.update(chartConfig, inputData);
        });
    };


  //**************************************************************************
  //** editStyle
  //**************************************************************************
    var editStyle = function(chartType, datasetID){

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


      //Update form
        var body = styleEditor.getBody();
        body.innerHTML = "";
        var form;
        if (chartType==="lineChart"){

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

            form = new javaxt.dhtml.Form(body, {
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


                chartConfig.scaleOption = settings.scaleOptions;
                chartConfig.xGrid = settings.xGrid;
                chartConfig.yGrid = settings.yGrid;
                chartConfig.xLabel = settings.xLabel;
                chartConfig.yLabel = settings.yLabel;
                chartConfig.endTags = settings.endTags;
                createLinePreview();
            };


        }
        else if (chartType==="line"){


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



          //Add style options
            form = new javaxt.dhtml.Form(body, {
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
                        group: "Smoothing Options",
                        items: [

                            {
                                name: "spline",
                                label: "Spline",
                                type: "checkbox",
                                options: [
                                    {
                                        label: "",
                                        value: true,
                                    }

                                ]
                            },
                            {
                                name: "kde",
                                label: "Kernel Density Estimation",
                                type: "checkbox",
                                options: [
                                    {
                                        label: "",
                                        value: true,
                                    }

                                ]
                            },
                            {
                                name: "bandwith",
                                label: "Bandwith",
                                type: "text"
                            },
                            {
                                name: "movingAverage",
                                label: "Moving Average",
                                type: "checkbox",
                                options: [
                                    {
                                        label: "",
                                        value: true,
                                    }

                                ]
                            },
                            {
                                name: "numberOfSamples",
                                label: "Number of Samples",
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

            createSlider("pointRadius", form, "px", 0, 10, 1);
            var pointRadius = chartConfig.pointRadius;
            if (isNaN(pointRadius)) pointRadius = 0;
            chartConfig.pointRadius = pointRadius;
            form.findField("pointRadius").setValue(pointRadius);

            // var splineField = form.findField("spline");
            // var spline = chartConfig.spline;
            // splineField.setValue(spline===true ? true : false);

            // var kdeField = form.findField("kde");
            // var kde = chartConfig.kde;
            // kdeField.setValue(kde===true ? true : false);

            // var movingAverageField = form.findField("movingAverage");
            // var movingAverage = chartConfig.movingAverage;
            // movingAverageField.setValue(movingAverage===true ? true : false);

            //Slider for bandwith
            createSlider("bandwith", form, "", 1, 10, 1);
            var bandwith = chartConfig.bandwidth;
            if (isNaN(bandwith)) bandwith = 1;
            chartConfig.bandwith = bandwith;
            form.findField("bandwith").setValue(bandwith);

            //Slider for moving average samples
            createSlider("numberOfSamples", form, "", 1, 14, 1);
            var numSamples = chartConfig.numSamples;
            if (isNaN(numSamples)) numSamples = 1;
            chartConfig.numSamples = numSamples;
            form.findField("numberOfSamples").setValue(numSamples);



            //Single line edit case
            if(datasetID !== null && datasetID !== undefined){

                let n = `${datasetID}`;

                if( !chartConfig["lineColor" + n] ) chartConfig["lineColor" + n] = "#6699CC";
                if( !chartConfig["pointColor" + n] ) chartConfig["pointColor" + n] = chartConfig["lineColor" + n];
                if( !chartConfig["lineStyle" + n] ) chartConfig["lineStyle" + n] = "solid";
                if( isNaN(chartConfig["lineWidth" + n]) ) chartConfig["lineWidth" + n] = 1;
                if( isNaN(chartConfig["opacity" + n]) ) chartConfig["opacity" + n] = 1;
                if( isNaN(chartConfig["startOpacity" + n]) ) chartConfig["startOpacity" + n] = 0;
                if( isNaN(chartConfig["endOpacity" + n]) ) chartConfig["endOpacity" + n] = 0;
                if( isNaN(chartConfig["pointRadius" + n]) ) chartConfig["pointRadius" + n] = 0;
                if( isNaN(chartConfig["bandwith" + n]) ) chartConfig["bandwith" + n] = 1;
                if( isNaN(chartConfig["numSamples" + n]) ) chartConfig["numSamples" + n] = 1;
                if(chartConfig["spline" + n] == null) chartConfig["spline" + n] = false;
                if(chartConfig["kde" + n] == null) chartConfig["kde" + n] = false;
                if(chartConfig["movingAverage" + n] == null) chartConfig["movingAverage" + n] = false;

                form.findField("lineColor").setValue(chartConfig["lineColor" + n]);
                form.findField("pointColor").setValue(chartConfig["pointColor" + n]);
                form.findField("lineStyle").setValue(chartConfig["lineStyle" + n]);
                form.findField("lineThickness").setValue(chartConfig["lineWidth" + n]);
                form.findField("lineOpacity").setValue(chartConfig["opacity" + n]*100);
                form.findField("startOpacity").setValue(chartConfig["startOpacity" + n]*100);
                form.findField("endOpacity").setValue(chartConfig["endOpacity" + n]*100);
                form.findField("pointRadius").setValue(chartConfig["pointRadius" + n]);
                form.findField("bandwith").setValue(chartConfig["bandwith" + n]);
                form.findField("numberOfSamples").setValue(chartConfig["numSamples" + n]);

                form.findField("spline").setValue(  (chartConfig["spline" + n]==="true") ? true : false);
                form.findField("kde").setValue(  (chartConfig["kde" + n]==="true") ? true : false);
                form.findField("movingAverage").setValue(  (chartConfig["movingAverage" + n]==="true") ? true : false);

                form.onChange = function(){
                    let settings = form.getData();

                    if (settings.spline === "true") settings.spline = true;
                    else settings.spline = false;

                    if (settings.kde === "true") settings.kde = true;
                    else settings.kde = false;

                    if (settings.movingAverage === "true") settings.movingAverage = true;
                    else settings.movingAverage = false;

                    chartConfig["lineColor" + n] = settings.lineColor;
                    chartConfig["lineStyle" + n] = settings.lineStyle;
                    chartConfig["lineWidth" + n] = settings.lineThickness;
                    chartConfig["opacity" + n] = settings.lineOpacity/100;
                    chartConfig["startOpacity" + n] = settings.startOpacity/100;
                    chartConfig["endOpacity" + n] = settings.endOpacity/100;
                    chartConfig["pointColor" + n] = settings.pointColor;
                    chartConfig["pointRadius" + n] = settings.pointRadius;
                    chartConfig["bandwith" + n] = settings.bandwith;
                    chartConfig["numSamples" + n] = settings.numberOfSamples;
                    chartConfig["spline" + n] = settings.spline;
                    chartConfig["kde" + n] = settings.kde;
                    chartConfig["movingAverage" + n] = settings.movingAverage;
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



        }
        else if(chartType==="barChart"){

          //Create color dropdown
            var chartLayout = new javaxt.dhtml.ComboBox(
                document.createElement("div"),
                {
                    style: config.style.combobox
                }
            );
            chartLayout.add("Vertical", "vertical");
            chartLayout.add("Horizontal", "horizontal");
            chartLayout.setValue("vertical");



            form = new javaxt.dhtml.Form(body, {
                style: config.style.form,
                items: [
                    {
                        group: "General",
                        items: [

                            {
                                name: "layout",
                                label: "Chart Layout",
                                type: chartLayout
                            },
                            {
                                name: "legend",
                                label: "Display Legend",
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


            //Set form value for bar layout
            // form.findField("layout").setValue(chartConfig.layout);
            var layoutField = form.findField("layout");
            var layout = chartConfig.barLayout;
            layoutField.setValue(layout==="horizontal" ? "horizontal" : "vertical");

           //Set initial value for X-gridline
            var xGridField = form.findField("xGrid");
            var xGrid = chartConfig.xGrid;
            xGridField.setValue(xGrid===true ? true : false);

           //Set initial value for Y-gridline
            var yGridField = form.findField("yGrid");
            var yGrid = chartConfig.yGrid;
            yGridField.setValue(yGrid===true ? true : false);

            //Set intial value for legend display
            var legendField = form.findField("legend");
            var legend = chartConfig.barLegend;
            legendField.setValue(legend===true ? true : false);

            //Set intial value for xLabel
            var xLabelField = form.findField("xLabel");
            var xLabel = chartConfig.xLabel;
            xLabelField.setValue(xLabel===true ? true : false);

            //Set intial value for yLabel
            var yLabelField = form.findField("yLabel");
            var yLabel = chartConfig.yLabel;
            yLabelField.setValue(yLabel===true ? true : false);


          //Process onChange events
            form.onChange = function(){
                var settings = form.getData();


                if (settings.xGrid==="true") settings.xGrid = true;
                else settings.xGrid = false;

                if (settings.yGrid==="true") settings.yGrid = true;
                else settings.yGrid = false;

                if (settings.legend==="true") settings.legend = true;
                else settings.legend = false;

                if (settings.xLabel==="true") settings.xLabel = true;
                else settings.xLabel = false;

                if (settings.yLabel==="true") settings.yLabel = true;
                else settings.yLabel = false;


                chartConfig.barLayout = settings.layout;
                chartConfig.barLegend = settings.legend;
                chartConfig.xGrid = settings.xGrid;
                chartConfig.yGrid = settings.yGrid;
                chartConfig.xLabel = settings.xLabel;
                chartConfig.yLabel = settings.yLabel;
                createBarPreview();
            };
        }
        else if (chartType==="bar"){

          //Add style options
            form = new javaxt.dhtml.Form(body, {
                style: config.style.form,
                items: [
                    {
                        group: "Fill Style",
                        items: [
                            {
                                name: "barColor",
                                label: "Color",
                                type: new javaxt.dhtml.ComboBox(
                                    document.createElement("div"),
                                    {
                                        style: config.style.combobox
                                    }
                                )
                            },
                            {
                                name: "fillOpacity",
                                label: "Opacity",
                                type: "text"
                            }
                        ]
                    }
                ]
            });


            createColorOptions("barColor", form);
            createSlider("fillOpacity", form, "%");


            // form.findField("barColor").setValue(chartConfig.barColor);
            form.findField("fillOpacity").setValue(0);

            if(datasetID !== null && datasetID !== undefined){

                let n = `${datasetID}`;

                if( !chartConfig["barColor" + n] ) chartConfig["barColor" + n] = "#6699CC";

                form.findField("barColor").setValue(chartConfig["barColor" + n]);

                form.onChange = function(){
                    let settings = form.getData();
                    chartConfig["barColor" + n] = settings.barColor;

                    createBarPreview();
                };

            }
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

    init();
};