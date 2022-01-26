if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  PieEditor
//******************************************************************************
/**
 *   Panel used to edit pie chart
 *
 ******************************************************************************/

bluewave.charts.PieEditor = function(parent, config) {
    var me = this;
    var defaultConfig = {
        panel: {

        },
        colors: {
            blue: ["#6699cc","#f8f8f8"],
            orange: ["#FF8C42","#f8f8f8"],
            purple: ["#933ed5","#f8f8f8"],
            mixed: bluewave.utils.getColorPalette()
        },
        chart: {
            pieCutout: 0.65,
            piePadding: 0,
            maximumSlices: 8,
            labelOffset: 120,
            showOther: true
        }
    };

    var panel;
    var inputData = [];
    var linksAndQuantity = [];
    var previewArea;
    var pieChart;
    var optionsDiv;
    var pieInputs = {};
    var chartConfig = {};
    var styleEditor;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);
        chartConfig = config.chart;


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
            if (chartConfig) editStyle();
        };


      //Initialize chart
        pieChart = new bluewave.charts.PieChart(previewArea, {});
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(pieConfig, inputs){
        me.clear();

        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if (typeof input !== 'object' && input!=null) {
                inputs[i] = d3.csvParse(input);
            }
        }
        inputData = inputs;


        chartConfig = merge(pieConfig, config.chart);



        if (chartConfig.chartTitle){
            panel.title.innerHTML = chartConfig.chartTitle;
        }

        createOptions(optionsDiv);
        createPreview();
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
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
  /** Return chart configuration file
   */
    this.getConfig = function(){
        return chartConfig;
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
    var createOptions = function(parent) {
        var data = inputData[0];


        var hasLinks = data.hasOwnProperty("links");
        var dataOptions;


        if (hasLinks) {
            data = Object.values(inputData[0].links);

            var nodeTypeList = [];
            var nodeAndType = [];
            for (var node in inputData[0].nodes) {
                var nodeType =inputData[0].nodes[node].type;
                var nodeName = inputData[0].nodes[node].name;
                if (nodeTypeList.indexOf(nodeType) === -1) {
                nodeTypeList.push(nodeType);
                }
                var nodeAndTypeEntry = {};
                nodeAndTypeEntry.id = node;
                nodeAndTypeEntry.type = nodeType;
                nodeAndTypeEntry.name = nodeName;
                nodeAndType.push(nodeAndTypeEntry);
            }

            for (var link in inputData[0].links) {
                var linkStartType = "";
                var linkEndType = "";
                var linkStartName = "";
                var linkEndName = "";
                var linkQuantity = inputData[0].links[link].quantity;

                for (var entry of nodeAndType) {
                    if (link.startsWith(entry.id)) {
                        linkStartType = entry.type;
                        linkStartName = entry.name;
                    }
                    if (link.endsWith(entry.id)) {
                        linkEndType = entry.type;
                        linkEndName = entry.name;
                    }

                }

                var linkFullType = linkStartType + " to " + linkEndName;
                var linksAndQuantityEntry = {};
                linksAndQuantityEntry.key = linkFullType;
                linksAndQuantityEntry.value = linkQuantity;
                linksAndQuantityEntry.sendType = linkStartType;
                linksAndQuantityEntry.receiveType = linkEndType;

                var previousEntryIndex = linksAndQuantity.findIndex(entry => entry.key === linkFullType);

                if (previousEntryIndex !== -1) {
                    linksAndQuantity[previousEntryIndex].value = linksAndQuantity[previousEntryIndex].value + linkQuantity;
                } else {
                    linksAndQuantity.push(linksAndQuantityEntry);
                }
            }

            dataOptions = nodeTypeList;
        }
        else{
            dataOptions = Object.keys(data[0]);
        }



        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);


        if (hasLinks){
            createDropdown(tbody,"pieKey","Group By","key");
            createDropdown(tbody,"pieDirection","Direction","direction");
            dataOptions.forEach((val)=>{
                pieInputs.key.add(val, val);
            });
            chartConfig.pieValue = "quantity";
            pieInputs.direction.add("Inbound");
            pieInputs.direction.add("Outbound");
            pieInputs.direction.setValue(chartConfig.pieDirection, true);
        }
        else{
            createDropdown(tbody,"pieKey","Key","key");
            createDropdown(tbody,"pieValue","Value","value");
            dataOptions.forEach((val)=>{
                if (!isNaN(data[0][val])){
                    pieInputs.value.add(val,val);
                }
                else{
                   pieInputs.key.add(val,val);
                }
            });

            createDropdown(tbody,"pieSort","Sort By","sort");
            pieInputs.sort.add("");
            pieInputs.sort.add("Key");
            pieInputs.sort.add("Value");

            createDropdown(tbody,"pieSortDir","Sort Direction","sortDir");
        }


        pieInputs.key.setValue(chartConfig.pieKey, true);
        if(typeof pieInputs.value == "object") {
            pieInputs.value.setValue(chartConfig.pieValue, true);
        }
    };


  //**************************************************************************
  //** createDropdown
  //**************************************************************************
    var createDropdown = function(tbody,chartConfigRef,displayName,inputType){
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


        pieInputs[inputType] = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        pieInputs[inputType].clear();
        pieInputs[inputType].onChange = function(name, value){
            if (chartConfigRef==="pieSort"){
                if (value.length>0){
                    chartConfig[chartConfigRef] = value;

                    var dir = pieInputs.sortDir.getValue();
                    if (!dir) dir = "Ascending";

                    pieInputs.sortDir.clear();
                    pieInputs.sortDir.add("Ascending");
                    pieInputs.sortDir.add("Descending");

                    pieInputs.sortDir.setValue(dir); //this will call createPreview()
                }
                else{
                    delete chartConfig[chartConfigRef];
                    pieInputs.sortDir.clear();
                    createPreview();
                }
            }
            else{
                chartConfig[chartConfigRef] = value;
                createPreview();
            }
        };
    };


  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(){
        if (chartConfig.pieKey==null || chartConfig.pieValue==null) return;


        onRender(previewArea, function(){
            var data = inputData[0];


            if (data.hasOwnProperty("links")) {
                data = linksAndQuantity.slice();
                data = data.filter(entry => entry.key.includes(chartConfig.pieKey));

                if(chartConfig.pieDirection === "Inbound") {
                    data = data.filter(entry => entry.receiveType.endsWith(chartConfig.pieKey));
                }
                else {
                    data = data.filter(entry => entry.sendType.startsWith(chartConfig.pieKey));
                }
                let scData = [];
                data.forEach(function(entry, index) {
                    let scEntry = {};
                    if (entry.key.includes(chartConfig.pieKey)) {
                        scEntry[chartConfig.pieKey] = entry.key;
                        scEntry[chartConfig.pieValue] = entry.value;
                    }
                    scData.push(scEntry);
                });
                data = scData;
            }

            pieChart.update(chartConfig, data);
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
        var body = styleEditor.getBody();
        body.innerHTML = "";


        var colorField = new javaxt.dhtml.ComboBox(
            document.createElement("div"),
            {
                style: config.style.combobox
            }
        );



        var form = new javaxt.dhtml.Form(body, {
            style: config.style.form,
            items: [
                {
                    group: "General",
                    items: [
                        {
                            name: "color",
                            label: "Color",
                            type: colorField
                        },
                        {
                            name: "cutout",
                            label: "Cutout",
                            type: "text"
                        }
                    ]
                },
                {
                    group: "Slices",
                    items: [
                        {
                            name: "padding",
                            label: "Padding",
                            type: "text"
                        },
                        {
                            name: "maximumSlices",
                            label: "Max Slices",
                            type: "text"
                        },
                        {
                            name: "showOther",
                            label: "Show Other",
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
                    group: "Labels",
                    items: [
                        {
                            name: "labels",
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
                            name: "extendLines",
                            label: "Extend Lines",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        },
                        {
                            name: "labelOffset",
                            label: "Label Offset",
                            type: "text"
                        }
                    ]
                }
            ]
        });


      //Add color options
        for (var key in config.colors) {
            if (config.colors.hasOwnProperty(key)){
                colorField.add(key, key);
            }
        }
        //colorField.setValue(chartConfig.colors+"");


      //Update cutout field (add slider) and set initial value
        createSlider("cutout", form, "%");
        var cutout = Math.round(chartConfig.pieCutout*100.0);
        form.findField("cutout").setValue(cutout);


        var labelField = form.findField("labels");
        var labels = chartConfig.showLabels;
        labelField.setValue(labels===true ? true : false);


        var extendLinesField = form.findField("extendLines");
        var extendLines = chartConfig.extendLines;
        extendLinesField.setValue(extendLines===true ? true : false);


        createSlider("labelOffset", form, "%", 0, 120, 1);
        var labelOffset = chartConfig.labelOffset;
        form.findField("labelOffset").setValue(labelOffset);



      //Set initial value for padding and update
        createSlider("padding", form, "%", 0, 100, 1);
        var padding = chartConfig.piePadding;
        var maxPadding = 5;
        padding = Math.round((padding/maxPadding)*100.0);
        form.findField("padding").setValue(padding);


        var maxSliceOptField = form.findField("showOther");
        var showOther = chartConfig.showOther;
        maxSliceOptField.setValue(showOther===true ? true : false);

        var numSlices = inputData[0].length;
        createSlider("maximumSlices", form, "", 1, numSlices, 1);
        var maximumSlices = chartConfig.maximumSlices;
        form.findField("maximumSlices").setValue(maximumSlices);


      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();
            chartConfig.pieCutout = settings.cutout/100;


            chartConfig.piePadding = (settings.padding*maxPadding)/100;

            chartConfig.maximumSlices = settings.maximumSlices;

            if (settings.labels==="true") {
                settings.labels = true;
                form.enableField("labelOffset");
                form.enableField("extendLines");
            }
            else if (settings.labels==="false") {
                settings.labels = false;
                form.disableField("labelOffset");
                form.disableField("extendLines");
            }
            chartConfig.showLabels = settings.labels;
            chartConfig.extendLines = settings.extendLines==="true";

            chartConfig.labelOffset = settings.labelOffset;

            if (settings.showOther==="true") settings.showOther = true;
            else if (settings.showOther==="false") settings.showOther = false;
            chartConfig.showOther = settings.showOther;

            chartConfig.colors = config.colors[settings.color];
            if (settings.color==="mixed") chartConfig.colorScaling = "ordinal";
            else chartConfig.colorScaling = "linear";

            createPreview();
        };




        styleEditor.showAt(108,57);
        form.resize();
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;

    init();
};