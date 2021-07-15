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
    var mapArea;
    var inputData = [];
    var mapInputs = {
        projection:null,
        mapType:null,
        lat:null,
        long:null,
        mapValue:null,
        mapLevel:null,
        colorScale:null
    };
    var mapProjection;


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
        createDropDown(div);

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


        onRender(previewArea, function(){
            initializeChartSpace();
        });
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(mapConfig, inputs){
        me.clear();
        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if (input!=null) inputs[i] = d3.csvParse(input);
        }
        if(mapConfig !== null && mapConfig !== undefined){
            Object.keys(mapConfig).forEach(val=>{
                chartConfig[val] = mapConfig[val]? mapConfig[val]:null;
            });
            panel.title.innerHTML = mapConfig.chartTitle;
        }
        inputData = inputs;
        createOptions();
    };


  //**************************************************************************
  //** createDropDown
  //**************************************************************************
    var createDropDown = function(parent){

        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);
        createMapDropDown(tbody);
    };


  //**************************************************************************
  //** createMapDropDown
  //**************************************************************************
    var createMapDropDown = function(tbody){
        dropdownItem(tbody,"mapType","Map Type",showHideDropDowns,mapInputs,"mapType");
        dropdownItem(tbody,"mapLevel","Map Level",createMapPreview,mapInputs,"mapLevel");
        dropdownItem(tbody,"colorScale","Color Scale",createMapPreview,mapInputs,"colorScale");
        dropdownItem(tbody,"latitude","Latitude",createMapPreview,mapInputs,"lat");
        dropdownItem(tbody,"longitude","Longitude",createMapPreview,mapInputs,"long");
        dropdownItem(tbody,"mapValue","Value",createMapPreview,mapInputs,"mapValue");

        var tr, tr2, td;

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        td.innerHTML= "Projection:";

        addShowHide(tr);

        tr2 = document.createElement("tr");
        tbody.appendChild(tr2);
        td = document.createElement("td");
        tr2.appendChild(td);

        mapProjection = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        mapProjection.clear();
        mapProjection.row = tr;
        mapProjection.onChange = function(name,value){
            chartConfig.mapProjectionName = name;
            createMapPreview();
        };

        mapProjection.hide();
        mapProjection.row.hide();
        mapInputs.lat.hide();
        mapInputs.lat.row.hide();
        mapInputs.long.hide();
        mapInputs.long.row.hide();
        mapInputs.mapValue.hide();
        mapInputs.mapValue.row.hide();

    };


  //**************************************************************************
  //** dropdownItem
  //**************************************************************************
    var dropdownItem = function(tbody,chartConfigRef,displayName,callBack,input,inputType){
        var tr, tr2, td;

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        td.innerHTML= displayName+":";

        addShowHide(tr);

        tr2 = document.createElement("tr");
        tbody.appendChild(tr2);
        td = document.createElement("td");
        tr2.appendChild(td);

        input[inputType] = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        input[inputType].row = tr;
        input[inputType].clear();
        input[inputType].onChange = function(name,value){
            chartConfig[chartConfigRef] = value;
            callBack();
        };
    };


  //**************************************************************************
  //** showHideDropDowns
  //**************************************************************************
    var showHideDropDowns = function(){
        if(chartConfig.mapType==="Point"){

            //We clear out the values from the chartConfig
            if(chartConfig.latitude !== null) chartConfig.latitude = null;
            if(chartConfig.longitude !== null) chartConfig.longitude = null;
            if(chartConfig.mapValue !== null) chartConfig.mapValue = null;
            if(chartConfig.mapLevel !== null) chartConfig.mapLevel = null;

            //Show the combox box inputs
            mapInputs.lat.show();
            mapInputs.long.show();
            mapInputs.mapValue.show();

            //Show the table row objects
            mapInputs.lat.row.show();
            mapInputs.long.row.show();
            mapInputs.mapValue.row.show();
        };
        if(chartConfig.mapType==="Area"){

            if(chartConfig.latitude !== null) chartConfig.latitude = null;
            if(chartConfig.longitude !== null) chartConfig.longitude = null;
            if(chartConfig.mapValue !== null) chartConfig.mapValue = null;
            if(chartConfig.mapLevel !== null) chartConfig.mapLevel = null;

            mapInputs.lat.hide();
            mapInputs.long.hide();
            mapInputs.mapValue.show();

            mapInputs.lat.row.hide();
            mapInputs.long.row.hide();
            mapInputs.mapValue.row.show();
        }
    };


  //**************************************************************************
  //** createMapPreview
  //**************************************************************************
    var createMapPreview = function(){
        if(chartConfig.mapType===null){
            return;
        }
        if(chartConfig.mapType=="Point" && (chartConfig.latitude===null ||
            chartConfig.longitude===null || chartConfig.mapValue===null ||
            chartConfig.mapLevel===null || chartConfig.colorScale===null)){
            return;
        }
        if(chartConfig.mapType=="Area" && (chartConfig.mapValue===null ||
            chartConfig.mapLevel===null ||chartConfig.colorScale===null)){
            return;
        }
        onRender(previewArea, function() {
            var data = inputData[0];
            mapArea.update(chartConfig, data);
        });
    };
    

  //**************************************************************************
  //** createOptions
  //**************************************************************************
  /** Initializes Options for Dropdowns.
   */
    var createOptions = function() {
        var data = inputData[0];
        let dataOptions = Object.keys(data[0]);
        if(mapInputs){
            mapInputs.lat.clear();
            mapInputs.long.clear();
            mapInputs.mapValue.clear();
            mapInputs.mapType.clear();
            mapInputs.mapLevel.clear();
            mapInputs.colorScale.clear();
        }
        dataOptions.forEach((val)=>{
            mapInputs.lat.add(val, val);
            mapInputs.long.add(val, val);
            mapInputs.mapValue.add(val, val);
        });
        const mapOptions = [
            "Point",
            "Area"
            ];
        mapOptions.forEach((val)=>{
            mapInputs.mapType.add(val,val);
        });
        const mapLevel = [
            "counties",
            "states",
            "countries"
        ];
        mapLevel.forEach((val)=>{
            mapInputs.mapLevel.add(val, val);
        });
        const colorScale = [
            "red",
            "blue"
        ];
        colorScale.forEach((val)=>{
            mapInputs.colorScale.add(val, val);
        });


        mapInputs.mapType.setValue(chartConfig.mapType, true);
        mapInputs.mapValue.setValue(chartConfig.mapValue, true);
        mapInputs.lat.setValue(chartConfig.latitude, true);
        mapInputs.long.setValue(chartConfig.longitude, true);
        mapInputs.mapLevel.setValue(chartConfig.mapLevel, true);
        mapInputs.colorScale.setValue(chartConfig.colorScale, true);
        createMapPreview();
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        //mapInputs = {};
        inputData = [];
        chartConfig = {};
        panel.title.innerHTML = "Untitled";
        //options.innerHTML = "";

       //if (mapArea) mapArea.selectAll("*").remove();
       //if (mapLayer) mapLayer.selectAll("circle").remove();
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

        mapArea = new bluewave.charts.MapChart(svg, {
            margin: margin
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
  //** Utils
  //**************************************************************************
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var isNumber = javaxt.dhtml.utils.isNumber;
    var round = javaxt.dhtml.utils.round;
    var getData = bluewave.utils.getData;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var merge = javaxt.dhtml.utils.merge;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var addTextEditor = bluewave.utils.addTextEditor;
    var warn = bluewave.utils.warn;

    init();
 };