if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  TreeMapEditor
//******************************************************************************
/**
 *   Panel used to edit treeMap chart
 *
 ******************************************************************************/

bluewave.charts.TreeMapEditor = function(parent, config) {
    var me = this;
    var defaultConfig = {
        panel: {

        },
    };

    var panel;
    var inputData = [];
    var previewArea;
    var treeMapChart;
    var optionsDiv;
    var treeMapInputs = {};
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
        treeMapChart = new bluewave.charts.TreeMapChart(previewArea, {});
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
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(treeMapConfig, inputs){
        me.clear();
        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if (typeof input !== 'object' && input!=null) {
                inputs[i] = d3.csvParse(input);
            }
        }
        inputData = inputs;




        chartConfig = merge(treeMapConfig, config.chart);


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

        if (treeMapChart) treeMapChart.clear();
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
        var fields = Object.keys(data[0]);


      //Analyze dataset
        var keyFields = [];
        var valueFields = [];
        var groupByFields = [];

        fields.forEach((field)=>{
            var values = [];
            data.forEach((d)=>{
                var val = d[field];
                values.push(val);
            });
            var type = getType(values);
            if (type=="string") keyFields.push(field);
            if (type=="number") valueFields.push(field);
            if (type=="string") groupByFields.push(field);

        });


      //Create form inputs
        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);
        createDropdown(tbody,"Key","key");
        createDropdown(tbody,"Value","value");
        createDropdown(tbody,"Group By","groupBy");


      //Populate key pulldown
        keyFields.forEach((field)=>{
            treeMapInputs.key.add(field,field);
        });


      //Populate value pulldown
        valueFields.forEach((field)=>{
            treeMapInputs.value.add(field,field);
        });

      //Populate groupBy pulldown
        groupByFields.forEach((field)=>{
            treeMapInputs.groupBy.add(field,field);
        });

      //Select default options
        if (chartConfig.key){
            treeMapInputs.key.setValue(chartConfig.key, false);
        }
        else{
            treeMapInputs.key.setValue(keyFields[0], false);
        }
        if (chartConfig.value){
            treeMapInputs.value.setValue(chartConfig.value, false);
        }
        else{
            treeMapInputs.value.setValue(valueFields[0], false);
        }
        if (chartConfig.groupBy){
            treeMapInputs.groupBy.setValue(chartConfig.groupBy, false);
        }
    };


  //**************************************************************************
  //** createDropdown
  //**************************************************************************
    var createDropdown = function(tbody,displayName,inputType){
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


        treeMapInputs[inputType] = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        treeMapInputs[inputType].clear();
        treeMapInputs[inputType].onChange = function(name, value){
            chartConfig[inputType] = value;
            createPreview();
        };
    };


  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(){
        if (chartConfig.key && chartConfig.value){
            var data = inputData[0];
            treeMapChart.update(chartConfig, data);
        }
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





        var form = new javaxt.dhtml.Form(body, {
            style: config.style.form,
            items: [

                {
                  group: "Labels",
                  items: [
                        {
                            name: "groupLabel",
                            label: "Show Group",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        },
                        {
                            name: "keyLabel",
                            label: "Show Key",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        },
                        {
                            name: "valueLabel",
                            label: "Show Value",
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

            ]
        });




      //Set initial value for Day label
        var groupLabelField = form.findField("groupLabel");
        var groupLabel = chartConfig.groupLabel;
        groupLabelField.setValue(groupLabel===true ? true : false);

      //Set initial value for key label
        var keyLabelField = form.findField("keyLabel");
        var keyLabel = chartConfig.keyLabel;
        keyLabelField.setValue(keyLabel===true ? true : false);
      
      //Set initial value for value label
        var valueLabelField = form.findField("valueLabel");
        var valueLabel = chartConfig.valueLabel;
        valueLabelField.setValue(valueLabel===true ? true : false);



      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();

            if (settings.groupLabel==="true") settings.groupLabel = true;
            else settings.groupLabel = false;

            if (settings.valueLabel==="true") settings.valueLabel = true;
            else settings.valueLabel = false;

            if (settings.keyLabel==="true") settings.keyLabel = true;
            else settings.keyLabel = false;

            chartConfig.groupLabel = settings.groupLabel;
            chartConfig.keyLabel = settings.keyLabel;
            chartConfig.valueLabel = settings.valueLabel;

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
    var getType = bluewave.chart.utils.getType;

    init();
};