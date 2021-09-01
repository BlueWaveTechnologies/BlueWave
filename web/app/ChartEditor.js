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
 *   createDropDown - initializes chart Type specific dropdowns
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
        fillArea:null,
        gridLines:null,
        xGrid:null,
        yGrid:null,
        barLayout: null,
        barLegend:null,
        xLabel:null,
        yLabel:null
    };
    var margin = {
        top: 15,
        right: 5,
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
        createDropDown(optionsDiv);
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
                if(dataOptions2){
                    dataOptions2.forEach(val=>{
                        plotInputs.xAxis2.add(val,val);
                        plotInputs.yAxis2.add(val,val);
                    });
                }
                break;
            default:
                break;
        }
    };


  //**************************************************************************
  //** createDropDown
  //**************************************************************************
    var createDropDown = function(parent){

        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);

        switch(chartConfig.chartType){
            case "pieChart":
                createPieDropdown(tbody);
                break;
            case "barChart":
                createBarDropDown(tbody);
                break;
            case "lineChart":
                createLineDropDown(tbody);
                break;
            default:
                break;
        }
    };


  //**************************************************************************
  //** createPieDropdown
  //**************************************************************************
    var createPieDropdown = function(tbody){
        dropdownItem(tbody,"pieKey","Key",createPiePreview,pieInputs,"key");
        dropdownItem(tbody,"pieValue","Value",createPiePreview,pieInputs,"value");
    };


  //**************************************************************************
  //** createBarDropDown
  //**************************************************************************
    var createBarDropDown = function(tbody){
        dropdownItem(tbody,"xAxis","X-Axis",createBarPreview,plotInputs,"xAxis");
        dropdownItem(tbody,"yAxis","Y-Axis",createBarPreview,plotInputs,"yAxis");
        if (inputData.length>1){
            dropdownItem(tbody,"xAxis2","X-Axis2",createBarPreview,plotInputs,"xAxis2");
            dropdownItem(tbody,"yAxis2","Y-Axis2",createBarPreview,plotInputs,"yAxis2");
        }
    };


  //**************************************************************************
  //** createLineDropDown
  //**************************************************************************
    var createLineDropDown = function(tbody){
        dropdownItem(tbody,"xAxis","X-Axis",createLinePreview,plotInputs,"xAxis");
        dropdownItem(tbody,"yAxis","Y-Axis",createLinePreview,plotInputs,"yAxis");
        dropdownItem(tbody,"group","Group By",createLinePreview,plotInputs,"group");
        if (inputData.length>1){
            dropdownItem(tbody,"xAxis2","X-Axis2",createLinePreview,plotInputs,"xAxis2");
            dropdownItem(tbody,"yAxis2","Y-Axis2",createLinePreview,plotInputs,"yAxis2");
        }
    };

  //**************************************************************************
  //** dropdownItem
  //**************************************************************************
    var dropdownItem = function(tbody,chartConfigRef,displayName,callBack,input,inputType){
        var tr, td;

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        td.innerHTML= displayName+":";

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);


        input[inputType] = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        input[inputType].clear();
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

        barChart = new bluewave.charts.BarChart(svg, {
            margin: margin
        });
        barChart.onDblClick = function(bar, bars){

            var cp = getColorPicker();
            cp.onChange = function(c){
                for (var i=0; i<bars.length; i++){
                    var bar = d3.select(bars[i]);
                    bar.attr("fill", c.hexString);
                }
            };
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
    var editStyle = function(chartType){

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

          //Create color dropdown
            var colorField = new javaxt.dhtml.ComboBox(
                document.createElement("div"),
                {
                    style: config.style.combobox
                }
            );

          //Add all colors to dropdown
            var colorPalette = getColorPalette();

            colorPalette.forEach((c)=>{
                colorField.add(c, c);
            });

          //Add style options
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
                                name: "lineThickness",
                                label: "Line Thickness",
                                type: "text"
                            },
                            {
                                name: "opacity",
                                label: "Opacity",
                                type: "text"
                            },
                            {
                                name: "area",
                                label: "Area Chart",
                                type: "radio",
                                alignment: "horizontal",
                                options: [
                                    {
                                        label: "true",
                                        value: true
                                    },
                                    {
                                        label: "false",
                                        value: false
                                    },
                                    
                                    
                                ]
                            },
                            {
                                name: "gridLines",
                                label: "Grid Lines",
                                type: "radio",
                                alignment: "horizontal",
                                options: [
                                    {
                                        label: "true",
                                        value: true
                                    },
                                    {
                                        label: "false",
                                        value: false
                                    },
                                    
                                    
                                ]
                            }
                        ]
                    }
                ]
            });

          //Set default dropdown value
            form.findField("color").setValue(chartConfig.lineColor || "#6699CC");
            var colorOption = form.findField("color").row.querySelectorAll(".form-input-menu-item");

          //Change background color for each item in color dropdown
            colorOption.forEach((item)=>{
                item.style.backgroundColor = item.textContent;
                item.onmouseover = () => item.style.opacity = .8;
                item.onmouseout = () => item.style.opacity = 1;
            });

          //Update lineWidth field (add slider) and set initial value
            createSlider("lineThickness", form);
            var thickness = chartConfig.lineWidth;
            if (thickness==null) thickness = 1.5;
            chartConfig.lineWidth = thickness;
            form.findField("lineThickness").setValue(thickness*10);

          //Add opacity slider
            createSlider("opacity", form, "%");
            var opacity = chartConfig.opacity;
            if (opacity==null) opacity = .95;
            chartConfig.opacity = opacity;
            form.findField("opacity").setValue(opacity*100);
            

          //Set initial value of the area field
            var areaField = form.findField("area");
            var fillArea = chartConfig.fillArea;
            areaField.setValue(fillArea===true ? true : false);

          //Set initial value of the gridline field 
            var gridLineField = form.findField("gridLines");
            var gridlines = chartConfig.gridLines;
            gridLineField.setValue(gridlines===true ? true : false);


          //Process onChange events
            form.onChange = function(){
                var settings = form.getData();
                
                if (settings.area==="true") settings.area = true;
                else if (settings.area==="false") settings.area = false;

                if (settings.gridLines==="true") settings.gridLines = true;
                else if (settings.gridLines==="false") settings.gridLines = false;

                //update config values
                chartConfig.lineColor = settings.color;
                chartConfig.lineWidth = settings.lineThickness/10;
                chartConfig.opacity = settings.opacity/100;
                chartConfig.fillArea = settings.area;
                chartConfig.gridLines = settings.gridLines;
                createLinePreview();
            };


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

            //Set initial value for layout
            var layoutField = form.findField("layout");
            var layout = chartConfig.barLayout;
            layoutField.setValue(layout===true ? true : false);

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
                
                
                // if (settings.layout==="vertical") settings.layout = false;
                // else if (settings.layout==="horizontal") {settings.xGrid = false}

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

                //Disable gridlines parallel to bars
                if (settings.layout==="vertical") {settings.yGrid = false}
                else if (settings.layout==="horizontal") {settings.xGrid = false}

                
                chartConfig.barLayout = settings.layout;
                chartConfig.barLegend = settings.legend;
                chartConfig.xGrid = settings.xGrid;
                chartConfig.yGrid = settings.yGrid;
                chartConfig.xLabel = settings.xLabel;
                chartConfig.yLabel = settings.yLabel;
                console.log(chartConfig)
                createBarPreview();
            };
        }


      //Render the styleEditor popup and resize the form 
        styleEditor.showAt(108,57);
        form.resize();
        
        
        
      //Form resize doesn't seem to be working correctly for the linechart.
      //It might have something to do with the custom sliders. Probably a 
      //timing issue. The following is a workaround.
        if (chartType==="lineChart"){
            
            setTimeout(function(){
                var arr = body.getElementsByClassName("form-groupbox");
                for (var i=0; i<arr.length; i++){
                    var el = arr[i];
                    var h = parseFloat(el.style.height);
                    el.style.height = h+30 + "px";
                }
            }, 100);
        }

        // Workaround for bar chart legend until editor is split up
        if(chartType !== "barChart"){
            let legendContainer = document.querySelector(".bar-legend");
            if(legendContainer) legendContainer.remove();
        }
        
    };
    

  //**************************************************************************
  //** getColorPicker
  //**************************************************************************
    var getColorPicker = function(){
      if (!colorPicker){
          colorPicker = new javaxt.dhtml.Window(document.body, {
              title: "Edit Color",
              width: 340,
              modal: false,
              style: config.style.window
          });

          var cp = new iro.ColorPicker(colorPicker.getBody(), {
            width: 320,
            height: 320,
            anticlockwise: true,
            borderWidth: 1,
            borderColor: "#fff",
            css: {
              "#output": {
                "background-color": "$color"
              }
            }
          });

          cp.on("color:change", function(c){
              colorPicker.onChange(c);
          });

          colorPicker.onChange = function(c){};
      }
      colorPicker.show();
      return colorPicker;
  };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;
    var getColorPalette = bluewave.utils.getColorPalette;

    init();
};