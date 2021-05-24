if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  SupplyChainEditor
//******************************************************************************
/**
 *   Panel used to create supply chain charts
 *
 ******************************************************************************/

bluewave.charts.SupplyChainEditor = function(parent, config) {

    var me = this;
    var defaultConfig = {
        nodes: {
            input: {
                icon: "fas fa-industry",
                label: "Factory"
            },
            output: {
                icon: "fas fa-hospital-user",
                label: "Hospital"
            },
            distributor: {
                icon: "fas fa-store-alt",
                label: "Distributor"
            }
        }
    };
    var sankeyEditor;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        config = merge(config, defaultConfig);
        sankeyEditor = new bluewave.charts.SankeyEditor(parent, config);
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(sankeyConfig){
        sankeyEditor.update(sankeyConfig);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        sankeyEditor.clear();
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){
        return sankeyEditor.getConfig();
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return sankeyEditor.getChart();
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var warn = bluewave.utils.warn;

    init();
};