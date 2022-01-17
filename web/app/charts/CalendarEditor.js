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
        chart: {

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
        console.log("update function for chart called")
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


        var dataOptions;

        dataOptions = Object.keys(data[0]);




        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);



        createDropdown(tbody,"date","Date","date");
        createDropdown(tbody,"value","Value","value");
        dataOptions.forEach((val)=>{
            if (!isNaN(data[0][val])){
                calendarInputs.value.add(val,val);
            }
            else{
                calendarInputs.date.add(val,val);
            }
        });



        calendarInputs.date.setValue(chartConfig.date, true);
        if(typeof calendarInputs.value == "object") {
            calendarInputs.value.setValue(chartConfig.value, true);
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
            

            createPreview();
        };
    };


  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(){
        if (chartConfig.date===null || chartConfig.value===null) return;


        onRender(previewArea, function(){
            var data = inputData[0];


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
                // {
                //     group: "General",
                //     items: [
                //         {
                //             name: "color",
                //             label: "Color",
                //             type: colorField
                //         },
                //     ]
                // },
                
               
            ]
        });


      //Add color options
        // for (var key in config.colors) {
        //     if (config.colors.hasOwnProperty(key)){
        //         colorField.add(key, key);
        //     }
        // }
        //colorField.setValue(chartConfig.colors+"");



      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();



            // chartConfig.colors = config.colors[settings.color];
            // if (settings.color==="mixed") chartConfig.colorScaling = "ordinal";
            // else chartConfig.colorScaling = "linear";

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