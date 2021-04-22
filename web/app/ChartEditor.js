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
    var inputData = [];
    var svg;
    var previewArea;
    var pieArea;
    var plotArea;
    var mapArea;
    var mapLayer;
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
    var mapInputs = {
        projection:null,
        mapType:null
    };
    var mapProjection;
    var politicalBoundries;
    var projectionOptions;
    var chartConfig = {
        pieKey:null,
        pieValue:null,
        xAxis:null,
        yAxis:null,
        chartType:null,
        chartTitle:null,
        nodeId:null,
        mapProjectionName:null,
        mapProjectionValue:null,
        mapType:null
    };
    var xAxis, yAxis;
    var axisWidth, axisHeight;
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
        td.style.width = "100%";
        td.style.height = "100%";
        td.style.padding = "10px";
        tr.appendChild(td);
        var panel = createDashboardItem(td,{
            width: "100%",
            height: "100%",
            title: "Untitled",
            settings: true
        });
        previewArea = panel.innerDiv;
        panel.el.className = "";


      //Allow users to change the title associated with the chart
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
                    chartConfig.chartTitle = this.value;
                }
            };
            this.appendChild(input);
        };
        document.body.addEventListener('click', function(e) {
            var input = panel.title.childNodes[0];
            var className = e.target.className;
            if(input.nodeType === 1 && className != "form-input") {
                panel.title.innerHTML = input.value;
                chartConfig.chartTitle = input.value;
            };
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
    this.update = function(nodeType, config, inputs){
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
        Object.keys(chartConfig).forEach(v=>chartConfig[v] = null);
        optionsDiv.innerHTML = "";
        try{
            pieArea.selectAll("*").remove();
            plotArea.selectAll("*").remove();
            d3.select(xAxis).remove();
            d3.select(yAxis).remove();
            mapArea.selectAll("*").remove();
            mapLayer.selectAll("circle").remove();
        }
        catch(e){}
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
            case 'map':
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
            case "map":
                createMapDropDown(tbody);
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
  //** initializeChartSpace
  //**************************************************************************
    var initializeChartSpace = function(){

        var width = previewArea.offsetWidth;
        var height = previewArea.offsetHeight;

        var plotHeight = height - margin.top - margin.bottom;
        var plotWidth = width - margin.left - margin.right;

        axisHeight = height - margin.top - margin.bottom;
        axisWidth = width - margin.left - margin.right;



        svg = d3.select(previewArea).append("svg");
        svg.attr("width", width);
        svg.attr("height", height);


        plotArea = svg.append("g");
        plotArea
            .attr("width", plotWidth)
            .attr("height", plotHeight)
            .attr(
                "transform",
                "translate(" + margin.left + "," + (margin.top) + ")"
            );



        pieArea = svg.append("g");
        mapArea = svg.append("g");
        mapLayer = svg.append("g");
    };


  //**************************************************************************
  //** createPiePreview
  //**************************************************************************
    var createPiePreview = function(){
        if (pieArea) pieArea.selectAll("*").remove();
        if(chartConfig.pieKey===null || chartConfig.pieValue===null){
            return;
        }

        var data = inputData[0];
        let pieData = data.reduce((acc,curVal)=>{
            acc[curVal[chartConfig.pieKey]] = curVal[chartConfig.pieValue];
            return acc;
        },{});


        var pie = d3.pie().value(function (d) {
            return d.value;
        });
        pieData = pie(d3.entries(pieData));


        var width = previewArea.offsetWidth;
        var height = previewArea.offsetHeight;
        var radius =
            Math.min(width, height) / 2 -
            margin.left -
            margin.right;

        radius = radius*1.2;


        var cutout = chartConfig.pieCutout;
        if (cutout==null) cutout = 0.65;
        var innerRadius = radius*cutout;

        pieArea
            .attr("width", width)
            .attr("height", height)
            .attr(
                "transform",
                "translate(" + width/2 + "," + height/2 + ")"
            );

        pieArea
            .selectAll("whatever")
            .data(pieData)
            .enter()
            .append("path")
            .attr(
                "d",
                d3
                .arc()
                .innerRadius(innerRadius)
                .outerRadius(radius)
            )
            .attr("fill", function (d) {
                return getColor(d.data.key);
            })
            .attr("stroke", "#777")
            .style("stroke-width", "1px")
            .style("opacity", 0.7);
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
  //** createLinePreview
  //**************************************************************************
    var createLinePreview = function(){
         // Setup:
        // Check that axis exist and are populated
        let xKey;
        let yKey;
        let xKey2;
        let yKey2;
        let group;

        if(chartConfig.xAxis===null || chartConfig.yAxis===null){
            return;
        }else{
            xKey = chartConfig.xAxis;
            yKey = chartConfig.yAxis;
            group = chartConfig.group;
        }

        if(chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
            xKey2 = chartConfig.xAxis2;
            yKey2 = chartConfig.yAxis2;
        }

        var data = inputData[0];
        var data2 = inputData[1];
        var data1 = data;

        if(data2!==null && data2!==undefined && xKey2 && yKey2){
            data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
        }


        // Remove previous data from chart
        if (plotArea) plotArea.selectAll("*").remove();
        let x;
        let y;

        if(group!==null&&group!==undefined){
            let groupData = d3.nest()
                    .key(function(d){return d[group];})
                    .entries(data);
            displayAxis(xKey,yKey,data);
            x = this.x;
            y = this.y;

            plotArea
                .selectAll(".line")
                .data(groupData)
                .enter()
                .append("path")
                .attr("fill", "none")
                .attr("stroke", "steelblue")
                .attr("stroke-width", 1.5)
                .attr(
                    "d",function(d){
                    return d3
                        .line()
                        .x(function (d) {
                            return x(d[xKey]);
                        })
                        .y(function (d) {
                            return y(parseFloat(d[yKey]));
                        })(d.values);
                    }
                );

        }else{
            let xType = typeOfAxisValue();

            var sumData = d3.nest()
                .key(function(d){return d[xKey];})
                .rollup(function(d){
                    return d3.sum(d,function(g){
                        return g[yKey];
                    })
            }).entries(data);

            displayAxis("key","value",sumData);
            x = this.x;
            y = this.y;
            let keyType = typeOfAxisValue(sumData[0].key);

            plotArea
                .append("path")
                .datum(sumData)
                .attr("fill", "none")
                .attr("stroke", "steelblue")
                .attr("stroke-width", 1.5)
                .attr(
                    "d",d3.line()
                    .x(function(d){
                        if(keyType==="date"){
                            return x(new Date(d.key));
                        }else{
                            return x(d.key);
                        }
                    })
                    .y(function(d){
                        return y(d["value"]);
                        })
                );
        }
    };


  //**************************************************************************
  //** createBarPreview
  //**************************************************************************
    var createBarPreview = function(){
        let xKey;
        let yKey;
        let xKey2;
        let yKey2;
        if(chartConfig.xAxis===null || chartConfig.yAxis===null){
            return;
        }else{
            xKey = chartConfig.xAxis;
            yKey = chartConfig.yAxis;
        }

        if(chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
            xKey2 = chartConfig.xAxis2;
            yKey2 = chartConfig.yAxis2;
        }

        var data = inputData[0];
        var data2 = inputData[1];
        var data1 = data;

        if(data2!==null && data2!==undefined && xKey2 && yKey2){
            data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
        }

        var sumData = d3.nest()
            .key(function(d){return d[xKey];})
            .rollup(function(d){
                return d3.sum(d,function(g){
                    return g[yKey];
                });
        }).entries(data);

        plotArea.selectAll("*").remove();

        let height = parseInt(plotArea.attr("height"));
        let width = parseInt(plotArea.attr("width"));

        displayAxis("key","value",sumData);
        let x = this.x;
        let y = this.y;

        if (y.bandwidth || x.bandwidth) {
            plotArea
                .selectAll("mybar")
                .data(sumData)
                .enter()
                .append("rect")
                .attr("x", function (d) {
                    return x.bandwidth ? x(d["key"]) : 0;
                })
                .attr("y", function (d) {
                    return y(d["value"]);
                })
                .attr("height", function (d) {


                    return y.bandwidth
                        ? y.bandwidth()
                        : height - y(d["value"]);
                })
                .attr("width", function (d) {
                    return x.bandwidth ? x.bandwidth() : x(d["key"]);
                })
                .attr("fill", "#69b3a2");
        } else {
            if (this.timeAxis === "x") {
                plotArea
                    .selectAll("mybar")
                    .data(sumData)
                    .enter()
                    .append("rect")
                    .attr("x", function (d) {
                        return x(d["key"]) - width/data.length / 2;
//                        return x(d[xKey]) - width/data.length / 2;
                    })
                    .attr("y", function (d) {
                        return y(d["value"]);
//                        return y(d[yKey]);
                    })
                    .attr("height", function (d) {
                        return height - y(d["value"]);
//                        return height - y(d[yKey]);
                    })
                    .attr("width", function (d) {
                        return width/sumData.length-5;
                    })
                    .attr("fill", "#69b3a2");
            } else if (this.timeAxis === "y") {
                plotArea
                    .selectAll("mybar")
                    .data(data)
                    .enter()
                    .append("rect")
                    .attr("x", function (d) {
                        return 0;
                    })
                    .attr("y", function (d) {
                        return y(d[yKey]) - height/data.length / 2;
                    })
                    .attr("height", function (d) {
                        return height/data.length-5;
                    })
                    .attr("width", function (d) {
                        return x(d[xKey]);
                    })
                    .attr("fill", "#69b3a2");
            }
        }
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
            labelField.setValue(false);

          //Process onChange events
            form.onChange = function(){
                var settings = form.getData();
                console.log(settings);
                chartConfig.pieCutout = settings.cutout/100;
                createPiePreview();
            };
        }



        styleEditor.showAt(108,57);
        form.resize();
    };


  //**************************************************************************
  //** createSlider
  //**************************************************************************
  /** Creates a custom form input using a text field
   */
    var createSlider = function(inputName, form){

      //Add row under the given input
        var input = form.findField(inputName);
        var row = input.row.cloneNode(true);
        var cols = row.childNodes;
        for (var i=0; i<cols.length; i++){
            cols[i].innerHTML = "";
        }
        input.row.parentNode.insertBefore(row, input.row.nextSibling);


      //Add slider to the last column of the new row
        var slider = document.createElement("input");
        cols[2].appendChild(slider);
        slider.type = "range";
        slider.className = "dashboard-slider";
        slider.setAttribute("min", 1);
        slider.setAttribute("max", 20);
        slider.onchange = function(){
            var val = (this.value-1)*5;
            input.setValue(val);
        };


        var setValue = input.setValue;
        input.setValue = function(val){
            val = parseFloat(val);
            setValue(val + "%");
            slider.value = round(val/5)+1;
        };

        var getValue = input.getValue;
        input.getValue = function(){
            var val = parseFloat(getValue());
            if (isNumber(val)) return round(val, 0);
            else return 0;
        };

        input.row.getElementsByTagName("input")[0].addEventListener('input', function(e) {
            var val = parseFloat(this.value);
            if (isNumber(val)){
                if (val<0 || val>95){
                    if (val<0) val = 0;
                    else val = 95;
                }
                input.setValue(val);
            }
        });
    };


  //**************************************************************************
  //** displayAxis
  //**************************************************************************
    var displayAxis = function(xKey,yKey,chartData){
        let axisTemp = createAxisScale(xKey,'x',chartData);
        this.x = axisTemp.scale;
        this.xBand = axisTemp.band;

        axisTemp = createAxisScale(yKey,'y',chartData);
        this.y = axisTemp.scale;
        this.yBand = axisTemp.band;

        d3.select(xAxis).remove();
        xAxis = svg
            .append("g")
            .attr("id", "xAxis")
            .attr(
                "transform",
                "translate(" +
                    margin.left +
                    "," +
                    (axisHeight + margin.top) +
                    ")"
            )
            .call(d3.axisBottom(this.x))
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        d3.select(yAxis).remove();
        yAxis = svg
            .append("g")
            .attr("id", "yAxis")
            .attr(
                "transform",
                "translate(" + margin.left + "," + margin.top + ")"
            )
            .call(d3.axisLeft(this.y));
    };


  //**************************************************************************
  //** typeOfAxisValue
  //**************************************************************************
     var typeOfAxisValue = function(value) {
        let dataType;

        const validNumberRegex = /^[\+\-]?\d*\.?\d+(?:[Ee][\+\-]?\d+)?$/;
        switch (typeof value) {
            case "string":
                if(value.match(validNumberRegex)){
                    dataType =  "number";
                }else if (Date.parse(value)){
                    dataType =  "date";
                }else{
                    dataType = "string";
                }
                break;
            case "number":
                dataType = "number";
                break;
            case "object":
                dataType = "date";
                break;
            default:
                break;
        }
        return dataType;
    };


  //**************************************************************************
  //** createAxisScale
  //**************************************************************************
    var createAxisScale = function(key,axisName,chartData){
        let scale;
        let band;
        let type = typeOfAxisValue(chartData[0][key]);
        let max = 0;
        let timeRange;
        let axisRange;
        let axisRangePadded;
        if(axisName === "x"){
            axisRange = [0,axisWidth];
            axisRangePadded = [10,axisWidth-10];
        }else{
            axisRange = [axisHeight,0];
            axisRangePadded = [axisHeight-10,10];
        }

        switch (type) {
            case "string":
                scale = d3
                .scaleBand()
                .domain(
                    chartData.map(function (d) {
                        return d[key];
                    })
                )
                .range(axisRange)
                .padding(0.2);
                break;
            case "date":

                timeRange = [new Date(chartData[0][key]),new Date(chartData[chartData.length-1][key])];
                chartData.map((val) => {
                    val[key] = new Date(val[key]);
                    return val;
                });

                scale = d3
                    .scaleTime()
                    .domain(timeRange)
                    .rangeRound(axisRangePadded);

                band = d3
                    .scaleBand()
                    .domain(d3.timeDay.range(...scale.domain()))
                    .rangeRound(axisRangePadded)
                    .padding(0.2);

                this.timeAxis = axisName;
                break;
            default:

                chartData.forEach((val) => {
                    let curVal = parseFloat(val[key]);
                    if (curVal > max) {
                        max = curVal;
                    }
                });

                scale = d3
                    .scaleLinear()
                    .domain([0, max])
                    .range(axisRange);
                break;
        }
        return {
            scale,
            band
        };
    };


  //**************************************************************************
  //** mergeToAxis
  //**************************************************************************
    const mergeToAxis = (data1,data2,xKey1,xKey2,newXKey,yKey1,yKey2,newYKey)=>{
        let mergedArray = [];
        data1.forEach(val=>{
          let updatedVal = {...val,[newXKey]:val[xKey1],[newYKey]:val[yKey1]};
          mergedArray.push(updatedVal);
        });
        if(data2===null || data2 === undefined){
          return mergedArray;
        }
        data2.forEach(val=>{
          let updatedVal = {...val,[newXKey]:val[xKey2],[newYKey]:val[yKey2]}
          mergedArray.push(updatedVal);
        });
        return mergedArray;
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
  //** Utils
  //**************************************************************************
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var isNumber = javaxt.dhtml.utils.isNumber;
    var round = javaxt.dhtml.utils.round;
    var getData = bluewave.utils.getData;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());

    init();
};