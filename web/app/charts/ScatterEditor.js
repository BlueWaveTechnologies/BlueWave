if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  ScatterEditor
//******************************************************************************
/**
 *   Panel used to edit scatter chart
 *
 ******************************************************************************/
/**
 *   Data Flow:
 *   init - stubs out chart areas
 *   initializeChartSpace - stubs out chart spaces
 *   Update - chart information and config is passed in.
 *   createDropDown - initializes chart Type specific dropdowns
 *   createOptions - adds chart input options from updated Data
 *      scatter chart creation.
 ******************************************************************************/

bluewave.charts.ScatterEditor = function(parent, config) {
    var me = this;
    var panel;
    var inputData = [];
    var svg;
    var previewArea;
    var scatterChart;
    var optionsDiv;

    var plotInputs = {};
    var chartConfig = {};

    var margin = {
        top: 15,
        right: 5,
        bottom: 65,
        left: 82
    };

    var styleEditor;
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
        onRender(previewArea, function(){
            initializeChartSpace();
        });
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

        createDropDown(optionsDiv);
        createOptions();
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

        createScatterPreview();
    };


  //**************************************************************************
  //** createDropDown
  //**************************************************************************
    var createDropDown = function(parent){

        var table = createTable();
        var tbody = table.firstChild;
        table.style.height = "";
        parent.appendChild(table);
        createScatterDropDown(tbody);
    };

   //**************************************************************************
   //** createScatterDropDown
   //**************************************************************************
    var createScatterDropDown = function(tbody){
        dropdownItem(tbody,"xAxis","X-Axis",createScatterPreview,plotInputs,"xAxis");
        dropdownItem(tbody,"yAxis","Y-Axis",createScatterPreview,plotInputs,"yAxis");
        if (inputData.length>1){
          dropdownItem(tbody,"xAxis2","X-Axis2",createScatterPreview,plotInputs,"xAxis2");
          dropdownItem(tbody,"yAxis2","Y-Axis2",createScatterPreview,plotInputs,"yAxis2");
        }
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

        svg = d3.select(previewArea).append("svg");
        svg.attr("width", width);
        svg.attr("height", height);



        scatterChart = new bluewave.charts.ScatterChart(svg, {
            margin: margin
        });
        scatterChart.onClick = function(scatterPlot, datasetID){
          editScatterPlot(datasetID);
      };

    };

  //**************************************************************************
  //** createScatterPreview
  //**************************************************************************
    var createScatterPreview = function(){
        onRender(previewArea, function(){
            scatterChart.update(chartConfig, inputData);
        });
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

        //   var checkbox = document.createElement('input');
        //   checkbox.type = "checkbox";
        //   checkbox.name = "regression";
        //   checkbox.value = "value";
        //   checkbox.id = "regression";
        //   checkbox.style.appearance = "auto";

        //   var label = document.createElement('label')
        //   label.htmlFor = "regression";
        //   label.appendChild(document.createTextNode('Enable Regression Line'));

        //   body.appendChild(checkbox);
        //   body.appendChild(label);



        //  checkbox.addEventListener('change', (event) => {
        //    if (event.currentTarget.checked) {
        //      chartConfig.showRegLine = true;
        //      scatterChart.update(chartConfig, inputData);
        //    } else {
        //      chartConfig.showRegLine = false;
        //      scatterChart.update(chartConfig, inputData);
        //    }
        //  });

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
                    },


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
      xLabelField.setValue(xLabel===true ? true : false);

      //Set intial value for yLabel
      var yLabelField = form.findField("yLabel");
      var yLabel = chartConfig.yLabel;
      yLabelField.setValue(yLabel===true ? true : false);

      var tagField = form.findField("pointLabels");
      var pointLabels = chartConfig.pointLabels;
      tagField.setValue(pointLabels===true ? true : false);




    //Process onChange events
      form.onChange = function(){
          var settings = form.getData();

          if (settings.xGrid==="true") settings.xGrid = true;
          else settings.xGrid = false;

          if (settings.yGrid==="true") settings.yGrid = true;
          else settings.yGrid = false;

          if (settings.xLabel==="true") settings.xLabel = true;
          else settings.xLabel = false;

          if (settings.yLabel==="true") settings.yLabel = true;
          else settings.yLabel = false;

          if (settings.pointLabels==="true") settings.pointLabels = true;
          else settings.pointLabels = false;

          
          chartConfig.xGrid = settings.xGrid;
          chartConfig.yGrid = settings.yGrid;
          chartConfig.xLabel = settings.xLabel;
          chartConfig.yLabel = settings.yLabel;
          chartConfig.pointLabels = settings.pointLabels;
          createScatterPreview();
      };

//          checkbox.onChange = function(checked) {
//            if (checkbox.checked) {
//                chartConfig.showRegLine = true;
//                scatterChart.update(chartConfig, inputData);
//            }
//            else {
//                chartConfig.showRegLine = false;
//                scatterChart.update(chartConfig, inputData);
//            }
//          }


//
//              //Process onChange events
//                form.onChange = function(){
//                    var settings = form.getData();
//                    if (settings.labels==="true") settings.labels = true;
//                    else if (settings.labels==="false") settings.labels = false;
//                    createRegressionLine();
//                };
//
//
//

            styleEditor.showAt(108,57);
            form.resize();
        };

  //**************************************************************************
  //** editScatterPlot
  //**************************************************************************
  var editScatterPlot = function (datasetID) {

        //Update form
        var styleEditor = getStyleEditor(config);
        var body = styleEditor.getBody();
        body.innerHTML = "";


    //Add style options
      var form = new javaxt.dhtml.Form(body, {
          style: config.style.form,
          items: [
              
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
              
          ]
      });



    //Update color field (add colorPicker) and set initial value
      createColorOptions("pointColor", form);

    //Add radius slider
      createSlider("pointRadius", form, "px", 0, 20, 1);
      var pointRadius = chartConfig.pointRadius;
      if (isNaN(pointRadius)) pointRadius = 0;
      chartConfig.pointRadius = pointRadius;
      form.findField("pointRadius").setValue(pointRadius);


      createSlider("pointOpacity", form, "%");
      var pointOpacity = chartConfig.pointOpacity;
      if (isNaN(pointOpacity)) pointOpacity = 0.8;
      chartConfig.pointOpacity = pointOpacity;
      form.findField("pointOpacity").setValue(pointOpacity * 100);

 

      let n = parseInt(datasetID);
      if (!isNaN(n)){ //Single line edit case

          var colors = bluewave.utils.getColorPalette(true);

          if( !chartConfig["pointColor" + n] ) chartConfig["pointColor" + n] = colors[n%colors.length];
          if( isNaN(chartConfig["pointRadius" + n]) ) chartConfig["pointRadius" + n] = 7;
          if( isNaN(chartConfig["pointOpacity" + n]) ) chartConfig["pointOpacity" + n] = 0.8;
          if( chartConfig["showLineReg" + n] !== true) chartConfig["showLineReg" + n] = false;


          form.findField("pointColor").setValue(chartConfig["pointColor" + n]);
          form.findField("pointRadius").setValue(chartConfig["pointRadius" + n]);
          form.findField("pointOpacity").setValue(chartConfig["pointOpacity" + n]*100);
          form.findField("showRegLine").setValue(chartConfig["showRegLine" + n]);


          form.onChange = function(){
              let settings = form.getData();

              if (settings.showRegLine === "true") settings.showRegLine = true;
              else settings.showRegLine = false;

              chartConfig["pointColor" + n] = settings.pointColor;
              chartConfig["pointRadius" + n] = settings.pointRadius;
              chartConfig["pointOpacity" + n] = settings.pointOpacity/100;
              chartConfig["showRegLine" + n] = settings.showRegLine;

              createScatterPreview();
          };

      }
      else{

        //Process onChange events
          form.onChange = function(){
              let settings = form.getData();
              chartConfig.pointColor = settings.pointColor;
              chartConfig.pointOpacity = settings.pointOpacity/100;
              chartConfig.pointRadius = settings.pointRadius;
              createScatterPreview();
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
  //** CreateRegressionLine
  //**************************************************************************

  var createRegressionLine = function() {

  }


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var getData = bluewave.utils.getData;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createSlider = bluewave.utils.createSlider;
    var addTextEditor = bluewave.utils.addTextEditor;
    var getStyleEditor = bluewave.chart.utils.getStyleEditor;

    init();
};