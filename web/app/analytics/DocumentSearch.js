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
  //** createBody
  //**************************************************************************
    var createHeader = function(parent){



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

        var df = d3.timeFormat(getDateFormat("M/D/YYYY h:mm A"));

        grid = new javaxt.dhtml.DataGrid(parent, {
            style: config.style.table,
            localSort: true,
            columns: [
                {header: 'Name', width:'100%', sortable: true},
                {header: 'Date', width:'150', sortable: true, align:'right'},
                {header: 'Type', width:'140', sortable: true},
                {header: 'Size', width:'115', sortable: true, align:'right'}
            ],
            update: function(row, record){
                row.set("Name", record.name);

                var date = new Date(record.date);
                var label = df(date);
                if (label.indexOf("0")===0) label = label.substring(1);
                label = label.replaceAll("/0", "/");
                label = label.replaceAll(" 0", " ");
                row.set("Date", label);

                var size = parseInt(record.size);
                if (size<1024) size = "1 KB";
                else{
                    size = formatNumber(Math.round(size/1024)) + " KB";
                }
                row.set("Size", size);
            }
        });

        waitmask.show();
        grid.update = function(){

            get("/documents", {
                success: function(csv){
                    var rows = parseCSV(csv, ",");
                    var header = rows.shift();
                    var createRecord = function(row){
                        var r = {};
                        header.forEach((field, i)=>{
                            r[field] = row[i];
                        });
                        return r;
                    };

                    var data = [];
                    rows.forEach((row)=>{
                        data.push(createRecord(row));
                    });


                    waitmask.hide();


                    grid.load(data);
                    grid.setSortIndicator(0, "DESC");
                },
                failure: function(request){
                    alert(request);
                    waitmask.hide();
                }
            });


        };
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var get = bluewave.utils.get;
    var parseCSV = bluewave.utils.parseCSV;
    var formatNumber = bluewave.utils.formatNumber;
    var getDateFormat = bluewave.chart.utils.getDateFormat;

    init();
};