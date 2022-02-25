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
  //** getDownloadButton
  //**************************************************************************
  //* left empty for rewrite by instantiator (documentAnalysis)
    this.getDownloadButton = function(){

    };


  //**************************************************************************
  //** getSelectedDocuments
  //**************************************************************************
  //* left empty for rewrite by instantiator (documentAnalysis)
    this.getSelectedDocuments = function(){

    };

  //**************************************************************************
  //** selectRow
  //**************************************************************************
  /** Selects or deselects the row from Document Search panel and adds it to the Selected Documents panel
   *  if function is called with mouseEvent true -> unselect row if selected and select the row if unselected
   *  if function is called with makeSelected true -> select row
   *  if function is called with makeSelected false -> unselect row
   */
   var selectRow = function(row, mouseEvent, makeSelected){

    var selectedDocuments = me.getSelectedDocuments();
    var downloadButton = me.getDownloadButton();



    var o = row.get("Name");

    if (!o.select){ // runs only once for each row - initialize row with selection capability if not already initialized
        var div = document.createElement("div");
        div.className = "document-analysis-selected-row";
        div.select = function(){
            div.style.left = "0px";
        };
        div.deselect = function(){
            div.style.left = "-34px";
        };
        div.deselect();

        var check = document.createElement("div");
        check.className = "fas fa-download";
        div.appendChild(check);

        var span = document.createElement("span");
        if ( //is element?
            typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
            o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
        ) span.appendChild(o);
        else span.innerText = o;
        div.appendChild(span);

        row.set("Name", div);
        o = div;
    }


    //Add or remove document from the selectedDocuments store
    var addDocument = true;
    var r = row.record;
    selectedDocuments.forEach((d, i)=>{
        if (d.id===r.id){
            addDocument = false;

            if (mouseEvent) {
                selectedDocuments.removeAt(i);
            }
            else {
                if (!makeSelected){
                    selectedDocuments.removeAt(i);
                };
            };
            return true;
        }
    });
    // mouse click events
        if (addDocument && mouseEvent){
            selectedDocuments.add(r);
            o.select();
        }
        else if (!addDocument && mouseEvent){
            o.deselect();
        }
    // selectAll events
        else if (!addDocument && !mouseEvent && makeSelected){
            o.select();
        }
        else if (!addDocument && !mouseEvent && !makeSelected){
            o.deselect();
        }
        else if (addDocument && !mouseEvent && !makeSelected){
            o.deselect();
        }
        else if (addDocument && !mouseEvent && makeSelected){
            selectedDocuments.add(r);
            o.select();
        };

    if (selectedDocuments.length < 1) downloadButton.disable()
    else downloadButton.enable();

    console.log("selected documents below are ");
    var s = [];
    selectedDocuments.forEach((d)=>{
        s.push(d.name);
    });
    console.log(s);
    }


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
          // callback for populating the elements of the grid
          if (config.showCheckboxes===true) row.set("x", record.id);

          var searchMetadata = record.info;
          if (searchMetadata && searchMetadata.highlightFragment){

              var recordDiv = document.createElement("div");
              var recordNameSpan = document.createElement("div");
              recordNameSpan.className = "document-search-result";
              recordNameSpan.innerHTML = record.name;
              recordDiv.appendChild(recordNameSpan);


              var metadataSpan = document.createElement("span");
              metadataSpan.className = "document-search-fragment";
              metadataSpan.innerHTML = searchMetadata.highlightFragment;
              recordDiv.appendChild(metadataSpan);

              row.set("Name", recordDiv);
          }
          else{
              row.set("Name", record.name);
          }

          var d = Date.parse(record.date);
          if (!isNaN(d)){
              var date = new Date(d);
              var label = df(date);
              if (label.indexOf("0")===0) label = label.substring(1);
              label = label.replaceAll("/0", "/");
              label = label.replaceAll(" 0", " ");
              row.set("Date", label);
          }

          var size = parseInt(record.size);
          if (size<1024) size = "1 KB";
          else{
              size = formatNumber(Math.round(size/1024)) + " KB";
          }
          row.set("Size", size);
      }
    });

      //Watch for row click events
    grid.onRowClick = function(row, e){
        if (e.detail === 2) { //double click
            grid.selectRow(row, true, false);
        };
    };

    grid.onBeforeLoad = function(){
        waitmask.show();
    };

    grid.onLoad = function(){
        waitmask.hide();
    };


    grid.update = function(q){
      if (q) params.q = q;
      else delete params.q;
      grid.clear();
      grid.load();
      grid.setSortIndicator(0, "DESC");
    };

    grid.selectRow = function(row, mouseEvent, makeSelected){
      selectRow(row, mouseEvent, makeSelected);
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
    var parseCSV = bluewave.utils.parseCSV;
    var formatNumber = bluewave.utils.formatNumber;


    init();
};