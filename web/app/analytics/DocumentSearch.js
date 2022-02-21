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
    this.searchBar;
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
        td.className = "document-search-search-bar";
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
        me.searchBar = bluewave.utils.createSearchBar(parent);
        me.searchBar.onChange = function(q){
            // console.log(q);
        };

        me.searchBar.onSearch = function(q){

            if (typeof q === 'string'){

                var q = q.split(/"|'/);

                var ignoredSearches = new Set(["", " "]);
                q = q.filter((queryParam) => {
                    return !ignoredSearches.has(queryParam);
                });
                for (let value in q) q[value] = q[value].trim();

            }

            grid.update(q);
        };
        me.searchBar.onClear = function(){
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
  //** expandSearch
  //**************************************************************************
  //* left empty for rewrite by instantiator (documentAnalysis)
    this.expandSearch = function(){
    };

  //**************************************************************************
  //** createNoResultsPanel
  //**************************************************************************
    this.createNoResultsPanel = function(parent){

        var createButton = function(parent, label){
            var input = document.createElement('input');
            input.className = "form-button";
            input.type = "button";
            input.name = label;
            input.value = label;
            input.disabled = true;
            parent.appendChild(input);
            return input;
        };

        var createBody = function(parent){
            // create main container
            var div = document.createElement("div");
            div.className = "doc-no-results-panel";

            // add background
            var iconContainer = document.createElement("div");
            iconContainer.className = "doc-no-results-background";
            iconContainer.textAlign = "center";
            div.appendChild(iconContainer);
            iconContainer.innerHTML ='<i class="fas fa-search-minus"></i>';

            // add text
            var text = document.createElement("div");
            text.className = "doc-no-results-text";
            div.appendChild(text);
            text.innerText =  "No local results to show";

            // add button container
            var buttonContainer = document.createElement("div");
            buttonContainer.className = "doc-no-results-button";
            div.appendChild(buttonContainer);

            // add external-search button
            var button = createButton(buttonContainer,"Expand Search");
            button.style.display = "inline-block";
            button.style.width = "110px";
            button.enable = function(){
            this.disabled = false;
            };

            button.disable = function(){
            this.disabled = false;
            };

            button.enable();

            button.onclick = function(){
                me.expandSearch();
            };

            parent.appendChild(div);
        };
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

            // add noResults page body below search bar
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
                tr.appendChild(td);
                createBody(td);


            return {
                el: el
            };
    };

  //**************************************************************************
  //** createDocumentPanel
  //**************************************************************************
    var createDocumentPanel = function(parent){

        createGrid(parent);
    };

  //**************************************************************************
  //** onEmptyResults
  //**************************************************************************
  //* left empty for rewrite by instantiator (documentAnalysis)
    this.onEmptyResults = function(){
    };

  //**************************************************************************
  //** onPopulatedResults
  //**************************************************************************
  //* left empty for rewrite by instantiator (documentAnalysis)
    this.onPopulatedResults = function(){
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

        grid.onBeforeLoad = function(){
            waitmask.show();
        };

        grid.onLoad = function(){
            if (grid.el.getElementsByClassName("table-row").length < 1) me.onEmptyResults();
            else me.onPopulatedResults();
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