if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  calendarEditor
//******************************************************************************
/**
 *   Panel used to edit calendar chart
 *
 ******************************************************************************/

bluewave.charts.CalendarEditor = function(parent, config) {
    // console.log("this calendarEditor initialized")
    var me = this;
    var defaultConfig = {
        panel: {

        },
        chart: {
            date: "date",
            value: "value"
        }
    };

    var panel;
    var inputData = [];
    var linksAndQuantity = [];
    var previewArea;
    var calendarChart;
    var optionsDiv;
    var dataOptions;
    var calendarInputs = {};
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


      //Initialize chart area when ready
        onRender(previewArea, function(){
            calendarChart = new bluewave.charts.CalendarChart(previewArea, {});
        });
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(calendarConfig, inputs){
        // this.setConfig()
        console.log("calendar config is")
        console.log(calendarConfig)
        
        calendarConfig.date = "date"
        calendarConfig.value = "num_lines_changed"

        console.log("calendar config is")
        console.log(calendarConfig)

        console.log("calendarEditor update called")
        // updateSelectedNodeProperties()
        me.clear();

        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if (typeof input !== 'object' && input!=null) {
                inputs[i] = d3.csvParse(input);
            }
        }
        inputData = inputs;




        chartConfig = merge(calendarConfig, config.chart);



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

        if (calendarChart) calendarChart.clear();
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
  //** setConfig
  //**************************************************************************
  /** updates chart configuration file for the selected properties of editor
   */
   this.setConfig = function(){
    console.log("current config is ")
    console.log(chartConfig)
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

        // console.log("creating options editor calendar")
        var data = inputData[0];


        var dataOptions;

        dataOptions = Object.keys(data[0]);




        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);



        createDropdown(tbody,"calendarDate","Date","date");
        createDropdown(tbody,"calendarValue","Value","value");
        dataOptions.forEach((val)=>{
            if (!isNaN(data[0][val])){
                calendarInputs.value.add(val,val);
            }
            else{
                calendarInputs.date.add(val,val);
            }
        });



        calendarInputs.date.setValue(chartConfig.calendarDate, true);
        if(typeof calendarInputs.value == "object") {
            calendarInputs.value.setValue(chartConfig.calendarValue, true);
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


        calendarInputs[inputType] = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        calendarInputs[inputType].clear();
        calendarInputs[inputType].onChange = function(name, value){
            if (chartConfigRef==="calendarSort"){
                if (value.length>0){
                    chartConfig[chartConfigRef] = value;

                    var dir = calendarInputs.sortDir.getValue();
                    if (!dir) dir = "Ascending";

                    calendarInputs.sortDir.clear();
                    calendarInputs.sortDir.add("Ascending");
                    calendarInputs.sortDir.add("Descending");

                    calendarInputs.sortDir.setValue(dir); //this will call createPreview()
                }
                else{
                    delete chartConfig[chartConfigRef];
                    calendarInputs.sortDir.clear();
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
        if (chartConfig.calendarKey===null || chartConfig.calendarValue===null) return;


        onRender(previewArea, function(){
            var data = inputData[0];


            if (data.hasOwnProperty("links")) {
                data = linksAndQuantity.slice();
                data = data.filter(entry => entry.key.includes(chartConfig.calendarKey));

                if(chartConfig.calendarDirection === "Inbound") {
                    data = data.filter(entry => entry.receiveType.endsWith(chartConfig.calendarKey));
                }
                else {
                    data = data.filter(entry => entry.sendType.startsWith(chartConfig.calendarKey));
                }
                let scData = [];
                data.forEach(function(entry, index) {
                    let scEntry = {};
                    if (entry.key.includes(chartConfig.calendarKey)) {
                        scEntry[chartConfig.calendarKey] = entry.key;
                        scEntry[chartConfig.calendarValue] = entry.value;
                    }
                    scData.push(scEntry);
                });
                data = scData;
                
            }

            calendarChart.update(chartConfig, data);
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
                // {
                //     group: "Slices",
                //     items: [
                //         {
                //             name: "padding",
                //             label: "Padding",
                //             type: "text"
                //         },
                //         {
                //             name: "maximumSlices",
                //             label: "Max Slices",
                //             type: "text"
                //         },
                //         {
                //             name: "showOther",
                //             label: "Show Other",
                //             type: "radio",
                //             alignment: "vertical",
                //             options: [
                //                 {
                //                     label: "True",
                //                     value: true
                //                 },
                //                 {
                //                     label: "False",
                //                     value: false
                //                 }
                //             ]
                //         }
                //     ]
                // },
                // {
                //     group: "Labels",
                //     items: [
                //         {
                //             name: "labels",
                //             label: "Show Labels",
                //             type: "radio",
                //             alignment: "vertical",
                //             options: [
                //                 {
                //                     label: "True",
                //                     value: true
                //                 },
                //                 {
                //                     label: "False",
                //                     value: false
                //                 }
                //             ]
                //         },
                //         {
                //             name: "labelOffset",
                //             label: "Label Offset",
                //             type: "text"
                //         }
                //     ]
                // }
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
        var cutout = Math.round(chartConfig.calendarCutout*100.0);
        form.findField("cutout").setValue(cutout);


        var labelField = form.findField("labels");
        var labels = chartConfig.showLabels;
        labelField.setValue(labels===true ? true : false);


        createSlider("labelOffset", form, "%", 0, 120, 1);
        var labelOffset = chartConfig.labelOffset;
        form.findField("labelOffset").setValue(labelOffset);



    //   //Set initial value for padding and update
    //     createSlider("padding", form, "%", 0, 100, 1);
    //     var padding = chartConfig.calendarPadding;
    //     var maxPadding = 5;
    //     padding = Math.round((padding/maxPadding)*100.0);
    //     form.findField("padding").setValue(padding);


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
            chartConfig.calendarCutout = settings.cutout/100;


            chartConfig.calendarPadding = (settings.padding*maxPadding)/100;

            chartConfig.maximumSlices = settings.maximumSlices;

            if (settings.labels==="true") {
                settings.labels = true;
                form.enableField("labelOffset");
            }
            else if (settings.labels==="false") {
                settings.labels = false;
                form.disableField("labelOffset");
            }
            chartConfig.showLabels = settings.labels;

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