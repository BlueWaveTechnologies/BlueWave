if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  BarEditor
//******************************************************************************
/**
 *   Panel used to edit bar charts
 *
 ******************************************************************************/

bluewave.charts.BarEditor = function(parent, config) {
    var me = this;
    var panel;
    var inputData = [];
    var previewArea;
    var barChart;
    var optionsDiv;
    var plotInputs = {};
    var chartConfig = {};
    var colorPicker;


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


      //Create chart options
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        var outerDiv = document.createElement("div");
        outerDiv.className = "chart-editor-options";
        outerDiv.style.height = "100%";
        outerDiv.style.position = "relative";
        outerDiv.style.overflow = "hidden";
        outerDiv.style.overflowY = "auto";
        td.appendChild(outerDiv);
        optionsDiv = document.createElement("div");
        optionsDiv.style.position = "absolute";
        outerDiv.appendChild(optionsDiv);


      //Create chart preview
        td = document.createElement("td");
        td.className = "chart-editor-preview";
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);

        var outerDiv = document.createElement("div");
        outerDiv.style.height = "100%";
        outerDiv.style.position = "relative";
        outerDiv.style.overflow = "hidden";
        td.appendChild(outerDiv);

        panel = createDashboardItem(outerDiv,{
            width: "100%",
            height: "100%",
            title: "Untitled",
            settings: true
        });
        previewArea = panel.innerDiv;
        panel.el.className = "";
        panel.el.style.position = "absolute";


      //Allow users to change the title associated with the chart
        addTextEditor(panel.title, function(title){
            panel.title.innerHTML = title;
            chartConfig.chartTitle = title;
        });


      //Watch for settings
        panel.settings.onclick = function(){
            editChart();
        };


      //Initialize chart
        barChart = new bluewave.charts.BarChart(previewArea, {});
        barChart.onClick = function(bar, barID){
            // chartConfig.barColor = d3.select(bar).attr("fill");
            editBar(barID);
        };
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


        if (config) chartConfig = config;

        if (chartConfig.chartTitle){
            panel.title.innerHTML = chartConfig.chartTitle;
        }


        createForm(optionsDiv);
        createOptions();
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        inputData = [];
        chartConfig = {};
        plotInputs = {};
        panel.title.innerHTML = "Untitled";
        optionsDiv.innerHTML = "";


        if (barChart) barChart.clear();

        if (colorPicker) colorPicker.hide();
        //if (styleEditor) styleEditor.hide();
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
    var createOptions = function() {

        for (let i=0; i<inputData.length; i++){
            var n = i>0 ? (i+1) : "";
            let xAxisN = `xAxis${n}`;
            let yAxisN = `yAxis${n}`;
            let groupN = `group${n}`;
            // let labelN = `label${n}`;

            plotInputs[groupN].add("", "");

            let dataOptions = Object.keys(inputData[i][0]);
            dataOptions.forEach((val)=>{
                plotInputs[xAxisN].add(val, val);
                plotInputs[yAxisN].add(val, val);
                plotInputs[groupN].add(val, val);
            });

            plotInputs[xAxisN].setValue(chartConfig[xAxisN], true);
            plotInputs[yAxisN].setValue(chartConfig[yAxisN], true);

            if (chartConfig[groupN]){
                plotInputs[groupN].setValue(chartConfig[groupN], true);
            }

        }

        createBarPreview();
    };


  //**************************************************************************
  //** createForm
  //**************************************************************************
    var createForm = function(parent){

        var items = [];
        for (var i=0; i<inputData.length; i++){
            var n = i>0 ? (i+1) : "";
            items.push(
                {
                    group: "Series " + (i>0 ? n : 1),
                    items: [
                        createLabel("X-Axis"),
                        createDropdown(`xAxis${n}`, plotInputs),

                        createLabel("Y-Axis"),
                        createDropdown(`yAxis${n}`, plotInputs),

                        createLabel("Separate By"),
                        createDropdown(`group${n}`, plotInputs)
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
  //** createLabel
  //**************************************************************************
    var createLabel = function(label){
        var row = document.createElement("div");
        row.className = "form-label";
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
    var editChart = function(){

      //Update form
        var styleEditor = getStyleEditor(config);
        var body = styleEditor.getBody();
        body.innerHTML = "";



      //Create layout dropdown
        var chartLayout = new javaxt.dhtml.ComboBox(
            document.createElement("div"),
            {
                style: config.style.combobox,
                readOnly: true
            }
        );
        chartLayout.add("Vertical", "vertical");
        chartLayout.add("Horizontal", "horizontal");
        chartLayout.setValue("vertical");


        var form = new javaxt.dhtml.Form(body, {
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
                            name: "stackValues",
                            label: "Stack Bars",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: false
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
        var layoutField = form.findField("layout");
        var layout = chartConfig.layout;
        layoutField.setValue(layout==="horizontal" ? "horizontal" : "vertical");

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


        var stackField = form.findField("stackValues");
        var stack = chartConfig.stackValues;
        stackField.setValue(stack===true ? true : false);


      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();

          //Update form data
            if (settings.xGrid==="true") settings.xGrid = true;
            else settings.xGrid = false;

            if (settings.yGrid==="true") settings.yGrid = true;
            else settings.yGrid = false;

            if (settings.xLabel==="true") settings.xLabel = true;
            else settings.xLabel = false;

            if (settings.yLabel==="true") settings.yLabel = true;
            else settings.yLabel = false;

            if (settings.stackValues==="true") settings.stackValues = true;
            else settings.stackValues = false;


          //Update chartConfig
            chartConfig.layout = settings.layout;
            chartConfig.xGrid = settings.xGrid;
            chartConfig.yGrid = settings.yGrid;
            chartConfig.xLabel = settings.xLabel;
            chartConfig.yLabel = settings.yLabel;
            chartConfig.stackValues = settings.stackValues;


          //Disable animation
            var animationSteps = chartConfig.animationSteps;
            chartConfig.animationSteps = 0;

          //Render preview
            createBarPreview();

          //Restore animation
            chartConfig.animationSteps = animationSteps;
        };


      //Render the styleEditor popup and resize the form
        styleEditor.showAt(108,57);
        form.resize();
    };


  //**************************************************************************
  //** editBar
  //**************************************************************************
    var editBar = function(datasetID){

      //Update form
        var styleEditor = getStyleEditor(config);
        var body = styleEditor.getBody();
        body.innerHTML = "";


      //Add style options
        var form = new javaxt.dhtml.Form(body, {
            style: config.style.form,
            items: [
                {
                    group: "Fill Style",
                    items: [
                        {
                            name: "barColor",
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


        createColorOptions("barColor", form);

        createSlider("fillOpacity", form, "%");
        var fillOpacity = chartConfig.fillOpacity;
        if (isNaN(fillOpacity)) fillOpacity = 1;
        chartConfig.fillOpacity = fillOpacity;
        form.findField("fillOpacity").setValue(fillOpacity*100);



        if(datasetID !== null && datasetID !== undefined){

            let n = `${datasetID}`;

            if( !chartConfig["barColor" + n] ) chartConfig["barColor" + n] = "#6699CC";
            if( isNaN(chartConfig["fillOpacity" + n]) ) chartConfig["fillOpacity" + n] = 1;


            form.findField("barColor").setValue(chartConfig["barColor" + n]);
            form.findField("fillOpacity").setValue(chartConfig["fillOpacity" + n]*100);


            form.onChange = function(){
                let settings = form.getData();
                chartConfig["barColor" + n] = settings.barColor;
                chartConfig["fillOpacity" + n] = settings.fillOpacity;
                createBarPreview();
            };
        }


      //Render the styleEditor popup and resize the form
        styleEditor.showAt(108,57);
        form.resize();
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
    var getStyleEditor = bluewave.chart.utils.getStyleEditor;

    init();
};