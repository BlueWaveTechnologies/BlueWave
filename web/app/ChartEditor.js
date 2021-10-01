if(!bluewave) var bluewave={};

//******************************************************************************
//**  ChartEditor
//******************************************************************************
/**
 *   Panel used to edit charts/graphs
 *
 ******************************************************************************/
/**
 *   Data Flow:
 *   init - stubs out chart areas
 *   initializeChartSpace - stubs out chart spaces
 *   Update - chart information and config is passed in.
 *   createForm - initializes chart Type specific dropdowns
 *   createOptions - adds chart input options from updated Data
 *      pie, bar,line, map chart creation.
 ******************************************************************************/

bluewave.ChartEditor = function(parent, config) {
    var me = this;
    var currentNode;
    var panel;
    var inputData = [];
    var svg;
    var previewArea;
    var pieChart, lineChart, barChart;
    var optionsDiv;
    var linePaths;
    var pieInputs={
        key:"",
        value:""
    };
    var plotInputs = {
        xAxis:null,
        yAxis:null,
        xAxis2:null,
        yAxis2:null,
        group:null
    };
    var chartConfig = {
        pieKey:null,
        pieValue:null,
        xAxis:null,
        yAxis:null,
        chartType:null,
        chartTitle:null,
        nodeId:null,
        lineColor:null,
        lineWidth:null,
        opacity:null,
        startOpacity:null,
        endOpacity:null,
        xGrid:null,
        yGrid:null,
        barLayout: null,
        barLegend:null,
        barColor:null,
        xLabel:null,
        yLabel:null,
        endTags: null
    };
    var margin = {
        top: 15,
        right: 75,
        bottom: 65,
        left: 82
    };
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

        td = document.createElement("td");
        tr.appendChild(td);
        let div = document.createElement("div");
        div.className = "chart-editor-options";
        td.appendChild(div);
        optionsDiv = div;


      //Create chart preview
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
        previewArea = panel.innerDiv;
        panel.el.className = "";


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
  //** getNode
  //**************************************************************************
    this.getNode = function() {
        return currentNode;
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
        if(config !== null && config !== undefined){
            Object.keys(config).forEach(val=>{
                chartConfig[val] = config[val]? config[val]:null;
            });
            panel.title.innerHTML = config.chartTitle;
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

        if (pieChart) pieChart.clear();
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
            case 'pieChart':
                pieInputs.value.clear();
                pieInputs.key.clear();
                dataOptions.forEach((val)=>{
                    if(!isNaN(data[0][val])){
                        pieInputs.value.add(val,val);
                    }else{
                        pieInputs.key.add(val,val);
                    }
                });
                pieInputs.key.setValue(chartConfig.pieKey,chartConfig.pieKey);
                pieInputs.value.setValue(chartConfig.pieValue,chartConfig.pieValue);
                break;
            case 'barChart':
                plotInputs.xAxis.clear();
                plotInputs.yAxis.clear();
                dataOptions.forEach((val)=>{
                    plotInputs.xAxis.add(val,val);
                    plotInputs.yAxis.add(val,val);
                });
                plotInputs.xAxis.setValue(chartConfig.xAxis,chartConfig.xAxis);
                plotInputs.yAxis.setValue(chartConfig.yAxis,chartConfig.yAxis);
                if(dataOptions2){
                    dataOptions2.forEach(val=>{
                        plotInputs.xAxis2.add(val,val);
                        plotInputs.yAxis2.add(val,val);
                    });
                }
                break;
            case 'lineChart':
                plotInputs.xAxis.clear();
                plotInputs.yAxis.clear();
                plotInputs.group.clear();
                dataOptions.forEach((val)=>{
                    plotInputs.xAxis.add(val,val);
                    plotInputs.yAxis.add(val,val);
                    plotInputs.group.add(val,val);
                });
                plotInputs.xAxis.setValue(chartConfig.xAxis,chartConfig.xAxis);
                plotInputs.yAxis.setValue(chartConfig.yAxis,chartConfig.yAxis);
                plotInputs.group.setValue(chartConfig.group,chartConfig.group);

                // Add dropdown values for each data set
                for (let i=1; i<inputData.length; i++){
                    let multiLineDataOptions = Object.keys(inputData[i][0]);

                    multiLineDataOptions.forEach((val)=>{
                        let xAxisN = `xAxis${i+1}`;
                        let yAxisN = `yAxis${i+1}`;

                        plotInputs[xAxisN].add(val, val);
                        plotInputs[yAxisN].add(val, val);

                        plotInputs[xAxisN].setValue(chartConfig[xAxisN], chartConfig[xAxisN]);
                        plotInputs[yAxisN].setValue(chartConfig[yAxisN], chartConfig[yAxisN]);
                    });

                }
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
            case "pieChart":
                createPieChartOptions(parent);
                break;
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
  //** createPieChartOptions
  //**************************************************************************
    var createPieChartOptions = function(parent){
        createInput(parent,"pieKey","Key",createPiePreview,pieInputs,"key");
        createInput(parent,"pieValue","Value",createPiePreview,pieInputs,"value");
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
                    createDropdown("yAxis", plotInputs)
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
                        createDropdown(`yAxis${i+1}`, plotInputs)
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

                    createLabel("Group By"),
                    createDropdown("group", plotInputs),

                    createLabel("Label", "label0"),
                    { name: "label0", label: "", type: "text" }

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

                        createLabel("Label"),
                        { name: ("label"+i), label: "", type: "text" }

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
            createLinePreview();
        };
    };


  //**************************************************************************
  //** createLabel
  //**************************************************************************
    var createLabel = function(label, className){
        var row = document.createElement("div");
        row.className = "form-label";
        row.classList.add(className);
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


        pieChart = new bluewave.charts.PieChart(svg, {
            margin: margin
        });

        lineChart = new bluewave.charts.LineChart(svg, {
            margin: margin
        });
        lineChart.onClick = function(line){
            var datasetID = d3.select(line).attr("dataset");
            editStyle("line", datasetID);
        };

        barChart = new bluewave.charts.BarChart(svg, {
            margin: margin
        });
        barChart.onDblClick = function(bar, bars){
            chartConfig.barColor = d3.select(bar).attr("fill");
            editStyle("bar");

            /*
            getColorPicker(currColor).onChange = function(c){
                for (var i=0; i<bars.length; i++){
                    var bar = d3.select(bars[i]);
                    bar.attr("fill", c.hexString);
                    chartConfig.barColor = c.hexString;
                }
            };
            */
        };
    };


  //**************************************************************************
  //** createPiePreview
  //**************************************************************************
    var createPiePreview = function(){
        if (chartConfig.pieKey===null || chartConfig.pieValue===null) return;
        onRender(previewArea, function(){
            var data = inputData[0];
            pieChart.update(chartConfig, data);
        });
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
        if (chartType==="pieChart"){
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
                                name: "cutout",
                                label: "Cutout",
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
            createSlider("cutout", form, "%");
            var cutout = chartConfig.pieCutout;
            if (cutout==null) cutout = 0.65;
            chartConfig.pieCutout = cutout;
            form.findField("cutout").setValue(cutout*100);


          //Tweak height of the label field and set initial value
            var labelField = form.findField("labels");
            labelField.row.style.height = "68px";
            var labels = chartConfig.pieLabels;
            labelField.setValue(labels===true ? true : false);


          //Process onChange events
            form.onChange = function(){
                var settings = form.getData();
                chartConfig.pieCutout = settings.cutout/100;
                if (settings.labels==="true") settings.labels = true;
                else if (settings.labels==="false") settings.labels = false;
                chartConfig.pieLabels = settings.labels;
                createPiePreview();
            };
        }
        else if (chartType==="lineChart"){


            form = new javaxt.dhtml.Form(body, {
                style: config.style.form,
                items: [
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
                    },
                    
                    {
                        group: "General",
                        items: [

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

                        ]
                    },
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


          //Process onChange events
            form.onChange = function(){
                var settings = form.getData();


                if (settings.xGrid==="true") settings.xGrid = true;
                else if (settings.xGrid==="false") settings.xGrid = false;

                if (settings.yGrid==="true") settings.yGrid = true;
                else if (settings.yGrid==="false") settings.yGrid = false;

                if (settings.xLabel==="true") settings.xLabel = true;
                else if (settings.xLabel==="false") settings.xLabel = false;

                if (settings.yLabel==="true") settings.yLabel = true;
                else if (settings.yLabel==="false") settings.yLabel = false;

                if (settings.endTags==="true") settings.endTags = true;
                else if (settings.endTags==="false") settings.endTags = false;


                chartConfig.xGrid = settings.xGrid;
                chartConfig.yGrid = settings.yGrid;
                chartConfig.xLabel = settings.xLabel;
                chartConfig.yLabel = settings.yLabel;
                chartConfig.endTags = settings.endTags;
                createLinePreview();
            };


        }
        else if (chartType==="line"){

            var dataSetTitle = (datasetID)=>{if(datasetID){return `Data Set ${datasetID + 1}` }};
          //Add style options
            form = new javaxt.dhtml.Form(body, {
                style: config.style.form,
                items: [
                    {
                        group: "Line Style",
                        items: [
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
                        group: "Fill Style",
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
                    }
                ]
            });



          //Global update fields for all lines

          //Update color field (add colorPicker) and set initial value
            createColorOptions("lineColor", form);
            form.findField("lineColor").setValue(chartConfig.lineColor || "#6699CC");


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

            //Single line edit case
            if(datasetID){

               let n = `${datasetID}`;

               if( !chartConfig["lineColor" + n] ) chartConfig["lineColor" + n] = "#6699CC";
               if( isNaN(chartConfig["lineWidth" + n]) ) chartConfig["lineWidth" + n] = 1;
               if( isNaN(chartConfig["opacity" + n]) ) chartConfig["opacity" + n] = 1;
               if( isNaN(chartConfig["startOpacity" + n]) ) chartConfig["startOpacity" + n] = 0;
               if( isNaN(chartConfig["endOpacity" + n]) ) chartConfig["endOpacity" + n] = 0;

                form.findField("lineColor").setValue(chartConfig["lineColor" + n]);
                form.findField("lineThickness").setValue(chartConfig["lineWidth" + n]);
                form.findField("lineOpacity").setValue(chartConfig["opacity" + n]*100);
                form.findField("startOpacity").setValue(chartConfig["startOpacity" + n]*100);
                form.findField("endOpacity").setValue(chartConfig["endOpacity" + n]*100);

                form.onChange = function(){
                let settings = form.getData();
                chartConfig["lineColor" + n] = settings.lineColor;
                chartConfig["lineWidth" + n] = settings.lineThickness;
                chartConfig["opacity" + n] = settings.lineOpacity/100;
                chartConfig["startOpacity" + n] = settings.startOpacity/100;
                chartConfig["endOpacity" + n] = settings.endOpacity/100;
                createLinePreview();
                }

            }else{

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
                else if (settings.xGrid==="false") settings.xGrid = false;

                if (settings.yGrid==="true") settings.yGrid = true;
                else if (settings.yGrid==="false") settings.yGrid = false;

                if (settings.legend==="true") settings.legend = true;
                else if (settings.legend==="false") settings.legend = false;

                if (settings.xLabel==="true") settings.xLabel = true;
                else if (settings.xLabel==="false") settings.xLabel = false;

                if (settings.yLabel==="true") settings.yLabel = true;
                else if (settings.yLabel==="false") settings.yLabel = false;


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
                                name: "fillColor",
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


            createColorOptions("fillColor", form);
            createSlider("fillOpacity", form, "%");


            form.findField("fillColor").setValue(chartConfig.barColor);
            form.findField("fillOpacity").setValue(0);

          //Process onChange events
            form.onChange = function(){
                var settings = form.getData();

                chartConfig.barColor = settings.fillColor;

                createBarPreview();
            };
        }


      //Render the styleEditor popup and resize the form
        styleEditor.showAt(108,57);
        form.resize();



      //Form resize doesn't seem to be working correctly for the linechart.
      //It might have something to do with the custom sliders. Probably a
      //timing issue. The following is a workaround.
        if (chartType==="line"){

            setTimeout(function(){
                var arr = body.getElementsByClassName("form-groupbox");
                for (var i=0; i<arr.length; i++){
                    var el = arr[i];
                    var h = parseFloat(el.style.height);
                    el.style.height = h+30 + "px";
                }
            }, 100);
        }

      //Workaround for bar chart legend until editor is split up
        // if(chartType !== "barChart"){
        //     let legendContainer = document.querySelector(".bar-legend");
        //     if(legendContainer) legendContainer.remove();
        // }
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
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;

    init();
};