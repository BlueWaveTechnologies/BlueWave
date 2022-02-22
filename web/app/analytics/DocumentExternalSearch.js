if(!bluewave) var bluewave={};
if(!bluewave.analytics) bluewave.analytics={};

//******************************************************************************
//**  DocumentExternalSearch
//******************************************************************************
/**
 *   Panel used to get/view external search results
 *
 ******************************************************************************/

bluewave.analytics.DocumentExternalSearch = function(parent, config) {

    var me = this;
    var waitmask;
    var grid;




  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        if (!config.fx) config.fx = new javaxt.dhtml.Effects();
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


        var table = createTable();
        var tbody = table.firstChild;

        parent.appendChild(table);
        me.el = table;
        var tr, td;


        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);


    };

  //**************************************************************************
  //** getDataGrid
  //**************************************************************************
    this.getDataGrid = function(){
      return grid;
    };



  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();
        update();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(){
      grid.update();
    };


  //**************************************************************************
  //** downloadFile
  //**************************************************************************
  //* left empty for rewrite by instantiator (documentAnalysis)
  this.downloadFile = function(){

  };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

      var table = createTable();
      var tbody = table.firstChild;
      parent.appendChild(table);
      var el = table;
      var tr, td;

      // add a place to insert search bar when this page is active
          tr = document.createElement("tr");
          tbody.appendChild(tr);
          td = document.createElement("td");
          td.className = "document-search-search-bar";


          tr.appendChild(td);

          td.style.height = "30px"; // temporary styling
          td.style.paddingTop ="2px"; // temporary styling
          td.style.paddingBottom ="2px"; // temporary styling
          td.style.paddingLeft ="4px"; // temporary styling
          td.style.paddingRight ="4px"; // temporary styling

      // add ExternalSearchResults page body below search bar
          tr = document.createElement("tr");
          tbody.appendChild(tr);
          td = document.createElement("td");
          tr.appendChild(td);
          table = createTable();
          tbody = table.firstChild;
          td.appendChild(table);

          tr = document.createElement("tr");
          tbody.appendChild(tr);
          td = document.createElement("td");
          td.style.height = "100%";
          td.style.verticalAlign = "top";
          td.style.padding = "20px 5px 0";
          tr.appendChild(td);
          createGrid(td);



        return {
            el: el,
            update: function(){
              console.log("update function called external results panel");
            }
        };
    };

  //**************************************************************************
  //** createGrid
  //**************************************************************************
  var createGrid = function(parent){
    var df = d3.timeFormat(getDateFormat(config.dateFormat));
    var columnConfig = [
        {header: 'Name', width:'100%', field: 'name', sortable: true},
        {header: 'Date', width:'150', field: 'date', sortable: true, align:'right'},
        {header: 'Type', width:'140', field: 'type', sortable: true},
        {header: 'Size', width:'115', field: 'size', sortable: true, align:'right'}
    ];
    if (config.showCheckboxes===true){
        columnConfig.unshift({header: 'x', field: 'id', width:30});
    }
    if (typeof IScroll !== 'undefined'){
        columnConfig.push({header: '', width: 8});
    }

    var params = {};
    grid = new javaxt.dhtml.DataGrid(parent, {
        columns: columnConfig,
        style: config.style.table,
        url: "/documents", // update this to reflect the Javaxt url for external searches
        params: params,
        parseResponse: function(request){ // maybe update this
            var csv = request.responseText;
            var rows = parseCSV(csv, ",");
            var header = rows.shift();
            var createRecord = function(row){
                var r = {};
                header.forEach((field, i)=>{
                    var v = row[i];
                    if (field=="id" || field=="size"){
                        v = parseFloat(v);
                    }
                    else if (field=="info"){
                        if (v) v = JSON.parse(decodeURIComponent(v));
                    }
                    r[field] = v;
                });
                return r;
            };

            var data = [];
            rows.forEach((row)=>{
                data.push(createRecord(row));
            });

            return data;
        },
        update: function(row, record){

        }
    });

    grid.onBeforeLoad = function(){
        waitmask.show();
    };

    grid.onLoad = function(){
        waitmask.hide();
    };


    grid.update = function(q){

    };
  };

  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    // var addShowHide = javaxt.dhtml.utils.addShowHide;
    var onRender = javaxt.dhtml.utils.onRender;
    // var isArray = javaxt.dhtml.utils.isArray;
    // var round = javaxt.dhtml.utils.round;
    // var get = bluewave.utils.get;
    var getDateFormat = bluewave.chart.utils.getDateFormat;


    init();
};