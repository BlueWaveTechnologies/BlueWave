if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  ScatterEditor
//******************************************************************************
/**
 *   Panel used to edit scatter chart
 *
 ******************************************************************************/

bluewave.charts.ScatterEditor = function(parent, config) {
    var me = this;
    var defaultConfig = {
        panel: {

        },
        chart: {
            pointColor: "#6699cc",
            pointRadius: 7,
            pointOpacity: 0.8,
            showRegLine: false
        }
    };

    var panel;
    var inputData = [];
    var previewArea;
    var scatterChart;
    var optionsDiv;

    var plotInputs = {};
    var chartConfig = {};


    var styleEditor;
    var colorPicker;


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
            title: "Scatter Chart",
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
            editChart();
        };


      //Initialize chart area when ready
        scatterChart = new bluewave.charts.ScatterChart(previewArea, {});
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(pieConfig, inputs){
        me.clear();
        for (var i=0; i<inputs.length; i++){
            var input = inputs[i];
            if (input!=null) inputs[i] = d3.csvParse(input);
        }
        inputData = inputs;


        chartConfig = merge(pieConfig, config.chart);

        if (chartConfig.chartTitle){
            panel.title.innerHTML = chartConfig.chartTitle;
        }


        createOptions(optionsDiv);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        inputData = [];
        chartConfig = {};
        panel.title.innerHTML = "Untitled";
        optionsDiv.innerHTML = "";

        if (scatterChart) scatterChart.clear();
        if (colorPicker) colorPicker.hide();
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

        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);
        createDropdown(tbody,"xAxis","X-Axis",createScatterPreview);
        createDropdown(tbody,"yAxis","Y-Axis",createScatterPreview);


        var data = inputData[0];
        let dataOptions = Object.keys(data[0]);

        dataOptions.forEach((val)=>{
            plotInputs.xAxis.add(val,val);
            plotInputs.yAxis.add(val,val);
        });
        plotInputs.xAxis.setValue(chartConfig.xAxis, false);
        plotInputs.yAxis.setValue(chartConfig.yAxis, false);
    };


  //**************************************************************************
  //** createDropdown
  //**************************************************************************
    var createDropdown = function(tbody,inputType,displayName,callBack){
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


        plotInputs[inputType] = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        plotInputs[inputType].onChange = function(name,value){
            chartConfig[inputType] = value;
            callBack();
        };
    };


  //**************************************************************************
  //** createScatterPreview
  //**************************************************************************
    var createScatterPreview = function(){
        console.log(chartConfig);
        scatterChart.update(chartConfig, inputData);
    };


  //**************************************************************************
  //** editChart
  //**************************************************************************
    var editChart = function(){


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
                  group: "General",
                  items: [

                      {
                          name: "pointLabels",
                          label: "Display Point Labels",
                          type: "checkbox",
                          options: [
                              {
                                  label: "",
                                  value: true,
                              }

                          ]
                    }


                  ]
                },
                {
                  group: "Analysis",
                  items: [

                      {
                          name: "showRegLine",
                          label: "Enable Regression Line",
                          type: "checkbox",
                          options: [
                              {
                                  label: "",
                                  value: true,
                              }

                          ]
                      },

                  ]
                },
                {
                  group: "Points",
                  items: [
                      {
                          name: "pointColor",
                          label: "Color",
                          type: new javaxt.dhtml.ComboBox(
                              document.createElement("div"),
                              {
                                  style: config.style.combobox
                              }
                          )
                      },
                      {
                          name: "pointOpacity",
                          label: "Point Opacity",
                          type: "text"
                      },
                      {
                          name: "pointRadius",
                          label: "Radius",
                          type: "text"
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
        xLabelField.setValue(xLabel ? true : false);

      //Set intial value for yLabel
        var yLabelField = form.findField("yLabel");
        var yLabel = chartConfig.yLabel;
        yLabelField.setValue(yLabel ? true : false);

        var tagField = form.findField("pointLabels");
        var pointLabels = chartConfig.showPointLabels;
        tagField.setValue(pointLabels===true ? true : false);



      //Update color field (add colorPicker) and set initial value
        createColorOptions("pointColor", form);
        form.findField("pointColor").setValue(chartConfig.pointColor);


      //Add radius slider
        createSlider("pointRadius", form, "px", 0, 20, 1);
        var pointRadius = parseInt(chartConfig.pointRadius);
        if (isNaN(pointRadius) || pointRadius<1){
            pointRadius = defaultConfig.chart.pointRadius;
        }
        form.findField("pointRadius").setValue(pointRadius);


        createSlider("pointOpacity", form, "%");
        var pointOpacity = parseFloat(chartConfig.pointOpacity);
        if (isNaN(pointOpacity) || pointOpacity<0 || pointOpacity>100){
            pointOpacity = defaultConfig.chart.pointOpacity;
        }
        form.findField("pointOpacity").setValue(round(pointOpacity * 100,0));





      //Process onChange events
        form.onChange = function(){
            var settings = form.getData();


            chartConfig.pointColor = settings.pointColor;
            chartConfig.pointOpacity = settings.pointOpacity/100;
            chartConfig.pointRadius = settings.pointRadius;


            if (settings.xGrid==="true") settings.xGrid = true;
            else settings.xGrid = false;

            if (settings.yGrid==="true") settings.yGrid = true;
            else settings.yGrid = false;

            if (settings.xLabel==="true") settings.xLabel = chartConfig.xAxis;
            else settings.xLabel = null;

            if (settings.yLabel==="true") settings.yLabel = chartConfig.yAxis;
            else settings.yLabel = null;

            if (settings.pointLabels==="true") settings.pointLabels = true;
            else settings.pointLabels = false;


            if (settings.showRegLine==="true") settings.showRegLine = true;
            else settings.showRegLine = false;


            chartConfig.xGrid = settings.xGrid;
            chartConfig.yGrid = settings.yGrid;
            chartConfig.xLabel = settings.xLabel;
            chartConfig.yLabel = settings.yLabel;
            chartConfig.pointLabels = settings.pointLabels;
            chartConfig.showRegLine = settings.showRegLine;


            createScatterPreview();
        };



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
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;
    var round = javaxt.dhtml.utils.round;

    init();
};