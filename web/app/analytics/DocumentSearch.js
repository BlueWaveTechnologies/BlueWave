if(!bluewave) var bluewave={};
if(!bluewave.analytics) bluewave.analytics={};

//******************************************************************************
//**  DocumentSearch
//******************************************************************************
/**
 *   Panel used to search for documents
 *
 ******************************************************************************/

bluewave.analytics.DocumentSearch = function(parent, config) {

    var me = this;
    var defaultConfig = {
        dateFormat: "M/D/YYYY h:mm A",
        showCheckboxes: false
    };
    var waitmask;
    var searchBar;
    var grid;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);


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
        tr.appendChild(td);
        createHeader(td);


        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);

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

        grid.update();
    };


  //**************************************************************************
  //** getDataGrid
  //**************************************************************************
    this.getDataGrid = function(){
        return grid;
    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){

        createSearchBar(parent);

    };


  //**************************************************************************
  //** createSearchBar
  //**************************************************************************
    var createSearchBar = function(parent){
        searchBar = bluewave.utils.createSearchBar(parent);
        searchBar.onChange = function(q){
            //console.log(q);
        };
        searchBar.onSearch = function(q){
            grid.update(q);
        };
        searchBar.onClear = function(){
            grid.update();
        };
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

        var table = createTable();
        var tbody = table.firstChild;
        parent.appendChild(table);
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;

        td = document.createElement("td");
        tr.appendChild(td);
        createFacetPanel(td);


        td = document.createElement("td");
        td.style.width = "100%";
        tr.appendChild(td);
        createDocumentPanel(td);
    };


  //**************************************************************************
  //** createFacetPanel
  //**************************************************************************
    var createFacetPanel = function(parent){



    };


  //**************************************************************************
  //** createDocumentPanel
  //**************************************************************************
    var createDocumentPanel = function(parent){

        createGrid(parent);

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
            url: "/documents",
            params: params,
            parseResponse: function(request){
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
                if (config.showCheckboxes===true) row.set("x", record.id);
                row.set("Name", record.name);

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
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************

    var get = bluewave.utils.get;
    var parseCSV = bluewave.utils.parseCSV;
    var formatNumber = bluewave.utils.formatNumber;
    var getDateFormat = bluewave.chart.utils.getDateFormat;

    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;

    init();
};