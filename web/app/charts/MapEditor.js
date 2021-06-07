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
        mapType:null
    };
    var mapProjection;
    var politicalBoundries;
    var projectionOptions;


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

        config = merge(config, defaultConfig);
        if(!config.style) config.style = javaxt.dhtml.style.default;
        if(!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);

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
        div.className = "map-editor-options";
        td.appendChild(div);
        optionsDiv = div;

        td = document.createElement("td");
        td.className = "map-editor-preview";
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
        var tr, td;

        tr = document.createElement("tr");
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

        dropdownItem(tr,"mapType","Map Type",createMapPreview,mapInputs,"mapType");
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
  //** createMapPreview
  //**************************************************************************
    var createMapPreview = function(){
        if(!politicalBoundries){
            getData("worldGeoJson", function(data) {
                politicalBoundries = data;
                displayMap();
            });
        }else{
            displayMap();
        }
    };

  //**************************************************************************
  //** displayMap
  //**************************************************************************
    var displayMap = function(){
        // TODO:
        // Add option to center
        // Add scaling to defaults
        if(chartConfig.mapProjectionValue === null){
            return;
        }
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
        var data2 = inputData[1];

        let dataOptions = Object.keys(data[0]);
        let dataOptions2 = data2?Object.keys(data2[0]):null;
        mapProjection.clear();
        projectionOptions.forEach((val)=>{
            mapProjection.add(val.name,val.projection);
        });

        mapProjection.setValue(chartConfig.mapProjectionName,chartConfig.mapProjectionValue);
        mapInputs.mapType.clear();
        const mapOptions = [
            "circles",
            "choropleth"
            ];
        mapOptions.forEach((val)=>{
            mapInputs.mapType.add(val,val);
        });
        mapInputs.mapType.setValue(chartConfig.mapType,chartConfig.mapType);
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

        if (mapArea) mapArea.selectAll("*").remove();
        if (mapLayer) mapLayer.selectAll("circle").remove();
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
        mapArea = svg.append("g");
        mapLayer = svg.append("g");
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