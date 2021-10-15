if(!bluewave) var bluewave={};

//******************************************************************************
//**  ScatterEditor
//******************************************************************************
/**
 *   Panel used to edit scatter chart
 *
 ******************************************************************************/
/**
 *   Data Flow:
 *   init - stubs out chart areas
 *   initializeChartSpace - stubs out chart spaces
 *   Update - chart information and config is passed in.
 *   createDropDown - initializes chart Type specific dropdowns
 *   createOptions - adds chart input options from updated Data
 *      scatter chart creation.
 ******************************************************************************/

bluewave.charts.ScatterEditor = function(parent, config) {
    var me = this;
    var panel;
    var inputData = [];
    var svg;
    var previewArea;
    var scatterChart;
    var optionsDiv;
    var plotInputs = {
        xAxis:null,
        yAxis:null,
        xAxis2:null,
        yAxis2:null,
        group:null
    };

    var chartConfig = {
        xAxis:null,
        yAxis:null,
        chartTitle:null,
        nodeId:null,
        showRegLine: null
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
            title: "Scatter Chart",
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
            editStyle();
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

        if(config !== null && config !== undefined){
            Object.keys(config).forEach(val=>{
                chartConfig[val] = config[val]? config[val]:null;
            });
            panel.title.innerHTML = config.chartTitle;
        }
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

        if (scatterChart) scatterChart.clear();
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
    };


  //**************************************************************************
  //** createDropDown
  //**************************************************************************
    var createDropDown = function(parent){

        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);
        createScatterDropDown(tbody);
    };

   //**************************************************************************
   //** createScatterDropDown
   //**************************************************************************
    var createScatterDropDown = function(tbody){
        dropdownItem(tbody,"xAxis","X-Axis",createScatterPreview,plotInputs,"xAxis");
        dropdownItem(tbody,"yAxis","Y-Axis",createScatterPreview,plotInputs,"yAxis");
        if (inputData.length>1){
          dropdownItem(tbody,"xAxis2","X-Axis2",createScatterPreview,plotInputs,"xAxis2");
          dropdownItem(tbody,"yAxis2","Y-Axis2",createScatterPreview,plotInputs,"yAxis2");
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



        scatterChart = new bluewave.charts.ScatterChart(svg, {
            margin: margin
        });

    };

  //**************************************************************************
  //** createScatterPreview
  //**************************************************************************
    var createScatterPreview = function(){
        onRender(previewArea, function(){
            scatterChart.update(chartConfig, inputData);
        });
    };


  //**************************************************************************
  //** editStyle
  //**************************************************************************
      var editStyle = function(){

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
          var form;
          var body = styleEditor.getBody();
          body.innerHTML = "";

          var checkbox = document.createElement('input');
          checkbox.type = "checkbox";
          checkbox.name = "regression";
          checkbox.value = "value";
          checkbox.id = "regression";
          checkbox.style.appearance = "auto";

          var label = document.createElement('label')
          label.htmlFor = "regression";
          label.appendChild(document.createTextNode('Enable Regression Line'));

          body.appendChild(checkbox);
          body.appendChild(label);



         checkbox.addEventListener('change', (event) => {
           if (event.currentTarget.checked) {
             chartConfig.showRegLine = true;
             scatterChart.update(chartConfig, inputData);
           } else {
             chartConfig.showRegLine = false;
             scatterChart.update(chartConfig, inputData);
           }
         });

//          checkbox.onChange = function(checked) {
//            if (checkbox.checked) {
//                chartConfig.showRegLine = true;
//                scatterChart.update(chartConfig, inputData);
//            }
//            else {
//                chartConfig.showRegLine = false;
//                scatterChart.update(chartConfig, inputData);
//            }
//          }


//
//              //Process onChange events
//                form.onChange = function(){
//                    var settings = form.getData();
//                    if (settings.labels==="true") settings.labels = true;
//                    else if (settings.labels==="false") settings.labels = false;
//                    createRegressionLine();
//                };
//
//
//

            styleEditor.showAt(108,57);
//            form.resize();
        };

  //**************************************************************************
  //** CreateRegressionLine
  //**************************************************************************

  var createRegressionLine = function() {

  }


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