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
    var optionsDiv;
    var mapArea;
    var currentNode;
    var mapLayer;
    var inputData = [];
    var mapInputs = {
        projection:null,
        mapType:null,
        lat:null,
        long:null,
        mapValue:null
    };
    var mapProjection;
    var projectionOptions;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        projectionOptions = [
            {name: "Ablers USA", projection: d3.geoAlbers()
                            .rotate([96, 0])
                            .center([-.6, 38.7])
                            .parallels([29.5, 45.5])
                            .scale(1000)
                            .precision(.1)
            },
            {name: "Ablers", projection: d3.geoAlbers().scale(this.width/1.3/Math.PI)}
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


        panel.title.onclick = function(e){
            if (this.childNodes[0].nodeType===1) return;
            e.stopPropagation();
            var currText = this.innerHTML;
            this.innerHTML = "";
            var input = document.createElement("input");
            input.className = "form-input";
            input.type = "text";
            input.value = currText;
            input.onkeydown = function(event){
                var key = event.keyCode;
                if(key == 13) {
                    panel.title.innerHTML = this.value;
                    defaultConfig.chartTitle = this.value;
                }
            };
            this.appendChild(input);
            input.focus();
        };
        document.body.addEventListener('click', function(e) {
            var input = panel.title.childNodes[0];
            var className = e.target.className;
            if(input.nodeType === 1 && className != "form-input") {
                panel.title.innerHTML = input.value;
                defaultConfig.chartTitle = input.value;
            };
        });

        onRender(previewArea, function(){
            initializeChartSpace();
        });
    }

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
        createDropDown(optionsDiv);
        createOptions();
    }

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
        dropdownItem(tbody,"latitude","Latitude",createMapPreview,mapInputs,"lat");
        dropdownItem(tbody,"longitude","Longitude",createMapPreview,mapInputs,"long");
        dropdownItem(tbody,"mapValue","Value",createMapPreview,mapInputs,"mapValue");

        var tr, td;

        tr = document.createElement("tr");
        tr.id="projection";
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        td.innerHTML= "Projection:";

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);

        mapProjection = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        mapProjection.clear();
        mapProjection.onChange = function(name,value){
            chartConfig.mapProjectionName = name;
            chartConfig.mapProjectionValue = value;
            createMapPreview();
        };

        document.getElementById("projection").style.visibility = "collapse";
        mapProjection.hide();
        document.getElementById("latitude").style.visibility = "collapse";
        mapInputs.lat.hide();
        document.getElementById("longitude").style.visibility = "collapse";
        mapInputs.long.hide();
        document.getElementById("mapValue").style.visibility = "collapse";
        mapInputs.mapValue.hide();

    };

  //**************************************************************************
  //** dropdownItem
  //**************************************************************************
    var dropdownItem = function(tbody,chartConfigRef,displayName,callBack,input,inputType){
        var tr, td;

        tr = document.createElement("tr");
        tr.id = chartConfigRef;
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
  //** showHideDropDowns
  //**************************************************************************
    var showHideDropDowns = function(){
        if(chartConfig.mapType==="Point"){

            //We clear out the values from the chartConfig
            if(chartConfig.latitude !== null) chartConfig.latitude = null;
            if(chartConfig.longitude !== null) chartConfig.longitude = null;
            if(chartConfig.mapValue !== null) chartConfig.mapValue = null;
            if(chartConfig.mapProjectionName !== null) chartConfig.mapProjectionName = null;
            if(chartConfig.mapProjectionValue !== null) chartConfig.mapProjectionValue = null;

            //Show the combox box inputs
            mapInputs.lat.show();
            mapInputs.long.show();
            mapInputs.mapValue.show();
            mapProjection.show();

            //Show the table row objects
            document.getElementById("projection").style.visibility = "visible";
            document.getElementById("latitude").style.visibility = "visible";
            document.getElementById("longitude").style.visibility = "visible";
            document.getElementById("mapValue").style.visibility = "visible";

        };
        if(chartConfig.mapType==="Area"){

            if(chartConfig.latitude !== null) chartConfig.latitude = null;
            if(chartConfig.longitude !== null) chartConfig.longitude = null;
            if(chartConfig.mapValue !== null) chartConfig.mapValue = null;
            if(chartConfig.mapProjectionName !== null) chartConfig.mapProjectionName = null;
            if(chartConfig.mapProjectionValue !== null) chartConfig.mapProjectionValue = null;

            mapInputs.lat.hide();
            mapInputs.long.hide();
            mapInputs.mapValue.show();
            mapProjection.show();

            document.getElementById("projection").style.visibility = "visible";
            document.getElementById("latitude").style.visibility = "collapse";
            document.getElementById("longitude").style.visibility = "collapse";
            document.getElementById("mapValue").style.visibility = "visible";
        }
    }


  //**************************************************************************
  //** createMapPreview
  //**************************************************************************
    var createMapPreview = function(){
        if(chartConfig.mapType===null){
            return;
        }
        if(chartConfig.mapType=="Point" && (chartConfig.latitude===null ||
            chartConfig.longitude===null || chartConfig.mapValue===null ||
            chartConfig.mapProjectionValue===null)){
            return;
        }
        if(chartConfig.mapType=="Area" && (chartConfig.mapValue===null ||
            chartConfig.mapProjectionValue===null)){
            return;
        }
        onRender(previewArea, function() {
            var data = inputData[0];
            mapArea.update(chartConfig, data);
        });
    };


  //**************************************************************************
  //** checkInputs
  //**************************************************************************
    var checkInputs = function(){
        var value = chartConfig.mapData;
        var counties = [];
        getData("counties", function(data) {
            var arr = data.objects.counties.geometries;
            for(var i=0; i<arr.length; i++){
                var county = arr[i];
                var varr = {
                    id: county.id,
                    name: county.properties.name
                }
                counties.push(varr);
            }
        });
        var states = [];
        getData("states", function(data) {
            var arr = data.objects.states.geometries;
            for (var i=0; i<arr.length; i++){
                var state = arr[i];
                states.push(state.properties);
            }
        });

        setTimeout(function() {
            var legalValue = true;
            var loopData = inputData[0];
            for(var i = 0; i < loopData.length; i++){
                var val = loopData[i];
                legalValue = counties.includes(val[value]);
                if(legalValue) {
                    legalValue = states.includes(val[value]);
                };
                if(!legalValue){
                    break;
                };
                createMapPreview
            }
            alert("Your chosen field is not Map Data");
        }, 500);
    };



  //**************************************************************************
  //** displayMap
  //**************************************************************************
    var displayMap = function(){
        // TODO:
        // Add option to center
        // Add scaling to defaults
        if(chartConfig.mapProjectionValue === null) return;
        if (mapArea) mapArea.selectAll("*").remove();
        var width = previewArea.offsetWidth;
        var height = previewArea.offsetHeight;

        var projection = chartConfig.mapProjectionValue
                .translate([width/2,height/2])

        var colorScale = d3.scaleThreshold()
                .domain([100000, 1000000, 10000000, 30000000, 100000000, 500000000])
                .range(d3.schemeBlues[7]);

        let tempData = d3.map();
        choroplethData.forEach(val=>{
          tempData.set(val.code,+val.pop)  ;
        });

        // Draw the map
        mapArea
            .selectAll("path")
            .data(politicalBoundries.features)
            .enter().append("path")
                .attr("fill", function(d){
                    if(chartConfig.mapType==="choropleth"){
                        d.total = tempData.get(d.id)||0;
                        return colorScale(d.total);
                    }else{
                        return colorScale(0);
                    }
                })
                .attr("d", d3.geoPath()
                    .projection(projection)
                )
                .style("stroke", "#fff");

        mapLayer.selectAll('circle').remove();

        if(chartConfig.mapType === "circles"){
            let filteredData = data.filter(val=>{
                let lat = parseFloat(val.lat);
                let lon = parseFloat(val.lon);
                let isValidProjection = projection([lat,lon])
                if(!isValidProjection[0] || !isValidProjection[1]){
                    return false
                }else{
                    return true
                }

            });
            //Draw Circle Points on the Map
            mapLayer.selectAll("circle")
                    .data(filteredData)
                    .enter()
                    .append("circle")
                    .attr("cx", function (d) {
                        let lat = parseFloat(d.lat);
                        let lon = parseFloat(d.lon);
                        return projection([lat,lon])[0];
                    })
                    .attr("cy", function (d) {
                        let lat = parseFloat(d.lat);
                        let lon = parseFloat(d.lon);
                        return projection([lat,lon])[1];
                    })
                    .attr("r", "2px")
                    .attr("fill", "red");
        }
    };


  //**************************************************************************
  //** createOptions
  //**************************************************************************
  /** Initializes Options for Dropdowns.
   */
    var createOptions = function() {
        var data = inputData[0];
        let dataOptions = Object.keys(data[0]);
        mapInputs.lat.clear();
        mapInputs.long.clear()
        mapInputs.mapValue.clear();
        dataOptions.forEach((val)=>{
            mapInputs.lat.add(val, val);
            mapInputs.long.add(val, val);
            mapInputs.mapValue.add(val, val);
        });
        mapProjection.clear();
        projectionOptions.forEach((val)=>{
            mapProjection.add(val.name,val.projection);
        });

        mapProjection.setValue(chartConfig.mapProjectionName,chartConfig.mapProjectionValue);
        mapInputs.mapType.clear();
        const mapOptions = [
            "Point",
            "Area"
            ];
        mapOptions.forEach((val)=>{
            mapInputs.mapType.add(val,val);
        });
        mapInputs.mapType.setValue(chartConfig.mapType,chartConfig.mapType);
        mapInputs.mapValue.setValue(chartConfig.mapValue,chartConfig.mapValue);
        mapInputs.lat.setValue(chartConfig.latitude,chartConfig.latitude);
        mapInputs.long.setValue(chartConfig.longitude,chartConfig.longitude);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        mapInputs = {};
        inputData = [];
        defaultConfig = {};
        panel.title.innerHTML = "Untitled";
        //options.innerHTML = "";

       //if (mapArea) mapArea.selectAll("*").remove();
       //if (mapLayer) mapLayer.selectAll("circle").remove();
    }

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
  }

  //**************************************************************************
  //** getNode
  //**************************************************************************
    this.getNode = function() {
        return currentNode;
    };

  //**************************************************************************
  //** getConfig
  //**************************************************************************
  /** Return chart configuration file
   */
    this.getConfig = function(){
        let copy = Object.assign({},defaultConfig);
        return copy;
    };

  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return previewArea;
    };


  //**************************************************************************
  //** Fake Data for Testing
  //**************************************************************************
    let mapData = [
        {lat:-122.490402,long:37.786453,label:"work"},
        {lat:5.389809,long:37.72728,label:"home"}
    ];

    let choroplethData = [
        {name: "Togo", code: "TGO", pop: "6238572"},
        {name: "Sao Tome and Principe", code: "STP", pop: "152622"},
        {name: "Tunisia", code: "TUN", pop: "10104685"},
        {name: "Turkey", code: "TUR", pop: "72969723"},
        {name: "Tuvalu", code: "TUV", pop: "10441"},
        {name: "Turkmenistan", code: "TKM", pop: "4833266"},
        {name: "United Republic of Tanzania", code: "TZA", pop: "38477873"},
        {name: "Uganda", code: "UGA", pop: "28947181"},
        {name: "United Kingdom", code: "GBR", pop: "60244834"},
        {name: "Ukraine", code: "UKR", pop: "46917544"},
        {name: "United States", code: "USA", pop: "299846449"}
    ];
  //**************************************************************************
  //** extractColumn
  //**************************************************************************
    function extractColumn(arr, column) {
      return arr.map(x => x[column])
    }

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
    var warn = bluewave.utils.warn;

    init();
 };