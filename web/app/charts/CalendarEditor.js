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
    var me = this;
    var defaultConfig = {
        panel: {

        },
        colors: {
            green: ["#fff","#ebf5dc","#cbe9a5","#2a671a"],
            blue: ["#fff","#aebfee","#587bdd","#1d3c90"],
            orange: ["#fff","#fbdc77","#f8c82c","#b78e06"]
        },
        chart: {
            cellSize: 13,
            showTooltip: true
        }
    };

    var panel;
    var inputData = [];
    var previewArea;
    var calendarChart;
    var optionsDiv;
    var calendarInputs = {};
    var chartConfig = {};
    var styleEditor;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        defaultConfig.chart.colors = defaultConfig.colors.blue;
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
        calendarChart = new bluewave.charts.CalendarChart(previewArea, {});
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
    this.update = function(calendarConfig, inputs){
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
        var dateFields = [];
        var valueFields = [];
        fields.forEach((field)=>{
            var values = [];
            data.forEach((d)=>{
                var val = d[field];
                values.push(val);
            });
            var type = getType(values);
            if (type=="date") dateFields.push(field);
            if (type=="number") valueFields.push(field);
        });


      //Create form inputs
        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);
        createDropdown(tbody,"Date","date");
        createDropdown(tbody,"Value","value");


      //Populate date pulldown
        dateFields.forEach((field)=>{
            calendarInputs.date.add(field,field);
        });


      //Populate value pulldown
        valueFields.forEach((field)=>{
            calendarInputs.value.add(field,field);
        });


      //Select default options
        if (chartConfig.date){
            calendarInputs.date.setValue(chartConfig.date, false);
        }
        else{
            calendarInputs.date.setValue(dateFields[0], false);
        }
        if (chartConfig.value){
            calendarInputs.value.setValue(chartConfig.value, false);
        }
        else{
            calendarInputs.value.setValue(valueFields[0], false);
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


        calendarInputs[inputType] = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        calendarInputs[inputType].clear();
        calendarInputs[inputType].onChange = function(name, value){
            chartConfig[inputType] = value;
            createPreview();
        };
    };


  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(){
        if (chartConfig.date && chartConfig.value){
            var data = inputData[0];
            calendarChart.update(chartConfig, data);
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
                      }
                  ]
                },
                {
                  group: "Labels",
                  items: [
                        {
                            name: "dayLabel",
                            label: "Show Day",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true
                                }

                            ]
                        },
                        {
                            name: "yearLabel",
                            label: "Show Year",
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
                  group: "Graph",
                  items: [
                        {
                            name: "cellSize",
                            label: "Cell Size",
                            type: "text"

                        }
                    ]
                }


            ]
        });

      //Add color options
        for (var key in config.colors) {
            if (config.colors.hasOwnProperty(key)){
                colorField.add(key, JSON.stringify(config.colors[key]));
            }
        }

      //Set initial value for the color
        if (chartConfig.colors){
            var color = chartConfig.colors;
            colorField.getOptions().every(function(d){
                var key = d.text;
                var val = d.value;
                if (color==key || JSON.stringify(color)==val){
                    colorField.setValue(key);
                    return false;
                }
                return true;
            });
        }
        else{
            colorField.setValue("blue");
        }


      //Set initial value for Day label
        var dayLabelField = form.findField("dayLabel");
        var dayLabel = chartConfig.dayLabel;
        dayLabelField.setValue(dayLabel===true ? true : false);

      //Set initial value for Year label
        var yearLabelField = form.findField("yearLabel");
        var yearLabel = chartConfig.yearLabel;
        yearLabelField.setValue(yearLabel===true ? true : false);

      //Set initial value for Cell Size
        var cellSizeField = form.findField("cellSize");
        var cellSizeValue = chartConfig.cellSize;
        if (isNaN(cellSizeValue) || cellSizeValue<1) cellSizeValue = 13;
        cellSizeField.setValue(cellSizeValue);



      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();

            if (settings.dayLabel==="true") settings.dayLabel = true;
            else settings.dayLabel = false;

            if (settings.yearLabel==="true") settings.yearLabel = true;
            else settings.yearLabel = false;

            chartConfig.dayLabel = settings.dayLabel;
            chartConfig.yearLabel = settings.yearLabel;

            var cellSize = settings.cellSize;
            if (isNaN(cellSize) || cellSize<1) cellSize = 13;
            chartConfig.cellSize = cellSize;

            chartConfig.colors = JSON.parse(settings.color);

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