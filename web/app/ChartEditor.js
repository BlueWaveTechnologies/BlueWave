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
    var projectionOptions;
    var chartConfig = {
        pieKey:null,
        pieValue:null,
        xAxis:null,
        yAxis:null,
        chartType:null,
        chartTitle:null,
        nodeId:null,
    };
    var margin = {
        top: 15,
        right: 5,
        bottom: 65,
        left: 82
    };
    var styleEditor;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        // Setup Map Projection Options
        // Set Scale here
        projectionOptions = [
//            {name: "Azimuthal Equal Area", projection: d3.geoAzimuthalEqualArea()},
//            {name: "Stereographic", projection: d3.geoStereographic()},
            {name: "Equal Earth", projection: d3.geoEqualEarth()},
            {name: "Ablers USA", projection: d3.geoAlbers()
                            .rotate([96, 0])
                            .center([-.6, 38.7])
                            .parallels([29.5, 45.5])
                            .scale(1000)
                            .precision(.1)
            },
            {name: "Ablers", projection: d3.geoAlbers().scale(this.width/1.3/Math.PI)},
            {name: "Mercator", projection: d3.geoMercator()
                        .scale(this.width/2/Math.PI)

            }
        ];
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
        if (chartType==="pieChart"){
            var form = new javaxt.dhtml.Form(body, {
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



        styleEditor.showAt(108,57);
        form.resize();
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var getData = bluewave.utils.getData;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;

    init();
};