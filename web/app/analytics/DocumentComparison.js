if(!bluewave) var bluewave={};
if(!bluewave.analytics) bluewave.analytics={};

//******************************************************************************
//**  DocumentComparison
//******************************************************************************
/**
 *   Panel used to compare documents
 *
 ******************************************************************************/

bluewave.analytics.DocumentComparison = function(parent, config) {

    var me = this;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        parent.appendChild(table);
        me.el = table;
        var td;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(inputs, chartConfig){
        me.clear();

        var files = "";
        for (var i=0; i<inputs.length; i++){
            if (i>0) files+=",";
            files+= inputs[i];
        }

        get("document/similarity?files="+files,{
            success: function(json){
                console.log(json);
            },
            failure: function(request){
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){
        return {
            chartTitle: "Document Analysis"
        };
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return me.el;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var get = bluewave.utils.get;


    init();
};