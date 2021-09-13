if(!bluewave) var bluewave={};

//******************************************************************************
//**  NodeSearch
//******************************************************************************
/**
 *   Panel used to execute queries and view results in a grid
 *
 ******************************************************************************/

bluewave.NodeSearch = function(parent, config) {

    var me = this;
    var waitmask;
    var searchBar, nodeList, nodeView, gridPanel; //panels
    var queryService = "query";
    var jobID;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        if (!config) config = {};
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create table with 3 rows
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Row 1 (Search bar)
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createSearchBar(td);


      //Row 2 (Node view)
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);
        var target = td;


      //Row 3 (Grid view)
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createGridPanel(td);


      //Add vertical resizer between row 2 and 3
        addVerticalResizer(td, target);


      //Append table to parent
        parent.appendChild(table);
        me.el = table;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        searchBar.clear();
        nodeList.clear();
        nodeView.clear();
        gridPanel.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        waitmask.show(500);
        get("graph/properties", {
            success: function(nodes){
                waitmask.hide();
                nodes.sort(function(a, b){
                    return a.name.localeCompare(b.name);
                });
                nodes.forEach(function(n){
                    nodeList.addNode(n);
                });
            },
            failure: function(request){
                waitmask.hide();
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** createSearchBar
  //**************************************************************************
    var createSearchBar = function(parent){

        searchBar = {};

      //Create outer div
        var div = document.createElement("div");
        div.className = "node-search-bar";
        div.style.position = "relative";
        parent.appendChild(div);


      //Create search icon
        var searchIcon = document.createElement("div");
        searchIcon.className = "node-search-bar-icon noselect";
        searchIcon.innerHTML = '<i class="fas fa-search"></i>';
        searchIcon.show = function(){
            this.style.opacity = "";
            input.style.paddingLeft = "26px";
        };
        searchIcon.hide = function(){
            this.style.opacity = 0;
            input.style.paddingLeft = "8px";
        };
        div.appendChild(searchIcon);


      //Create input
        var input = document.createElement("input");
        input.type = "text";
        input.className = "node-search-bar-input";
        input.style.width = "100%";
        input.placeholder = "Search";
        div.appendChild(input);
        input.oninput = function(e){
            var q = searchBar.getValue();
            if (q){
                searchIcon.hide();
                cancelButton.show();
            }
            else{
                searchIcon.show();
                cancelButton.hide();
            }
        };
        input.onkeydown = function(event){
            var key = event.keyCode;
            if (key === 9 || key === 13) {
                input.oninput();
                input.blur();
                var q = searchBar.getValue();
                updateNodes(q);
            }
        };


      //Cancel button
        var cancelButton = document.createElement("div");
        cancelButton.className = "node-search-bar-cancel noselect";
        cancelButton.innerHTML = '<i class="fas fa-times"></i>';
        addShowHide(cancelButton);
        cancelButton.hide();
        div.appendChild(cancelButton);
        cancelButton.onclick = function(){
            searchBar.clear();
        };

        searchBar.clear = function(){
            input.value = "";
            cancelButton.hide();
            searchIcon.show();
        };

        searchBar.getValue = function(){
            var q = input.value;
            if (q){
                q = q.trim();
                if (q.length===0) q = null;
            }
            return q;
        };

        return div;
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

      //Create table with 2 columns
        var table = createTable();
        parent.appendChild(table);
        var tr = document.createElement("tr");
        table.firstChild.appendChild(tr);
        var td;


      //Left column
        td = document.createElement("td");
        setStyle(td, config.style.leftPanel);
        td.style.height = "100%";
        tr.appendChild(td);
        createNodeList(td);


      //Right column
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "100%";
        tr.appendChild(td);
        var hr = addHorizontalResizer(td, nodeList.el);
        createNodeView(hr);

    };


  //**************************************************************************
  //** createNodeList
  //**************************************************************************
  /** Creates a panel used to render a list of nodes in the database
   */
    var createNodeList = function(parent){

        var outerDiv = document.createElement("div");
        outerDiv.style.position = "relative";
        outerDiv.className = "node-search-list";
        outerDiv.style.height = "100%";
        outerDiv.style.width = "210px";
        outerDiv.style.overflow = "auto";
        parent.appendChild(outerDiv);

        var innerDiv = document.createElement('div');
        innerDiv.style.position = "absolute";
        innerDiv.style.width = "100%";
        outerDiv.appendChild(innerDiv);


        nodeList = {
            el: outerDiv,
            nodes: [],
            clear: function(){
                innerDiv.innerHTML = "";
                this.nodes = [];
            },
            addNode: function(n){
                var div = document.createElement("div");
                div.className = "node-search-list-item noselect";
                div.innerText = n.name;
                div.node = n;
                div.onclick = function(){
                    var opacity = parseFloat(this.style.opacity);
                    if (isNaN(opacity)){
                        gridPanel.show(this.node);
                    }
                    else{
                        gridPanel.hide();
                    }
                };
                div.disable = function(){
                    this.style.opacity = 0.45;
                    this.node.ids = [];
                };
                div.enable = function(nodeIDs){
                    this.style.opacity = "";
                    this.node.ids = nodeIDs;
                };
                div.disable();
                innerDiv.appendChild(div);

                n.div = div;
                this.nodes.push(n);
            }
        };
    };


  //**************************************************************************
  //** createNodeView
  //**************************************************************************
    var createNodeView = function(parent){
        var div = document.createElement("div");
        div.className = "node-search-graph";
        div.style.height = "100%";
        parent.appendChild(div);

        var svg = d3.select(div)
        .append("svg")
          .attr("width", "100%")
          .attr("height", "100%");

        var clear = function(){
            svg.node().innerHTML = "";
        };

        var update = function(q, nodes, links){
            clear();
            var g = svg.append("g");


            var cx = div.offsetWidth/2;
            var cy = div.offsetHeight/2;

            var graph = d3.forceSimulation(nodes)
            .force("link", d3.forceLink().id(function(d) { return d.name; }))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(cx, cy));


          //Add links
            var link = g.append("g")
            .selectAll("line")
            .data(links)
            .enter()
            .append("line")
              .style("stroke", "#aaa");



          //Add nodes
            var node = g.append("g")
            .selectAll("circle")
            .data(nodes)
            .enter()
            .append("circle")
              .attr("r", function(node){
                  if (node.type==="search"){
                      return 20;
                  }
                  else{
                      return 10;
                  }
              })
              .style("fill", function(node){
                  if (node.type==="search"){
                      return "#e66869";
                  }
                  else if (node.type==="match"){
                      return "#d07393";
                  }
                  else{
                      return "#d89df8";
                  }
              })
              .attr("stroke-width", 1.5)
              .attr("stroke", function(node){
                  if (node.type==="search"){
                      return "#dd3131";
                  }
                  else if (node.type==="match"){
                      return "#c0416b";
                  }
                  else{
                      return "#b987d4";
                  }
              });


          //Add labels
            var label = g.append("g")
            .selectAll("text")
            .data(nodes)
            .enter()
            .append("text")
              .text(function(node) {
                return node.name;
              })
              .attr("fill", function(node) {
                  if (node.type==="search"){
                      return "#fff";
                  }
                  else{
                    return "#000";
                  }
              });



            var labelHeight = 12;


          //Create a lookup table to find nodes by node name
            var nodeMap = {};
            nodes.forEach(function(node){
                nodeMap[node.name] = node;
            });


          //Update elements
            graph
              .nodes(nodes)
              .on("tick", function() {

                  link
                    .attr("x1", function(link) { return nodeMap[link.source].x; })
                    .attr("y1", function(link) { return nodeMap[link.source].y; })
                    .attr("x2", function(link) { return nodeMap[link.target].x; })
                    .attr("y2", function(link) { return nodeMap[link.target].y; });


                  node
                    .attr("transform", function(d) {
                        return "translate(" + d.x + "," + d.y + ")";
                    });

                  label
                    .attr("transform", function(node) {
                        var x = node.x;
                        var y = node.y;
                        if (node.type==="search"){ //place text inside node
                            var xOffset = x-(20-2); //radius - width of circle outline
                            var yOffset = y+((labelHeight/2)-2); //- width of circle outline
                            return "translate(" + xOffset + "," + yOffset + ")";
                        }
                        else{
                            return "translate(" + (x+10) + "," + (y-(labelHeight/2)) + ")";
                        }
                    });
                }
            );

        };



        nodeView = {
            clear: clear,
            update: update
        };
    };


  //**************************************************************************
  //** createGridPanel
  //**************************************************************************
    var createGridPanel = function(parent){
        var height = 250;
        var currNode = null;
        var currIDs = [];


        gridPanel = document.createElement("div");
        gridPanel.className = "node-search-grid";
        gridPanel.style.position = "relative";



        var outerDiv = document.createElement("div");
        outerDiv.style.height = "100%";
        outerDiv.style.position = "relative";
        gridPanel.appendChild(outerDiv);

        var innerDiv = document.createElement("div");
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        innerDiv.style.position = "absolute";
        innerDiv.style.overflow = "hidden";
        innerDiv.style.overflowX = "auto";
        outerDiv.appendChild(innerDiv);


        var overflowDiv = document.createElement("div");
        overflowDiv.style.width = "100%";
        overflowDiv.style.height = "100%";
        overflowDiv.style.position = "absolute";
        innerDiv.appendChild(overflowDiv);


        gridPanel.innerDiv = innerDiv;
        gridPanel.overflowDiv = overflowDiv;
        parent.appendChild(gridPanel);



        gridPanel.show = function(node){
            this.style.height = height + "px";

            if (node.name === currNode && node.ids.length === currIDs.length){

                var numMatches = 0;
                node.ids.forEach(function(id){
                    currIDs.every(function(i){
                        if (i===id){
                            numMatches++;
                            return false;
                        }
                        return true;
                    });
                });

                if (numMatches===currIDs.length) return;
            }

            this.clear();
            updateGrid(node);
        };


        gridPanel.hide = function(){
            var h = this.offsetHeight;
            if (h>50) height = h;
            this.style.height = "0px";
        };


        gridPanel.clear = function(){
            currNode = null;
            currIDs = [];
            overflowDiv.innerHTML = "";
        };

    };


  //**************************************************************************
  //** updateNodes
  //**************************************************************************
  /** Used to find nodes that contain a given keyword and update the view
   */
    var updateNodes = function(q){

      //Cancel current query (if running)
        cancel();



      //Clear last query
        gridPanel.hide();
        nodeView.clear();
        nodeList.nodes.forEach(function(node){
           node.div.disable();
        });


        if (!q) return;


        var nodes = [];
        var links = [];
        nodes.push({
           name: q,
           type: "search"
        });


        var arr = [];
        nodeList.nodes.forEach(function(n){
            var query = "MATCH (p:" + n.name + ")\n" +
            "WHERE any(key in keys(p) WHERE toLower(p[key]) CONTAINS toLower('" + q +"') )\n" +
            "RETURN ID(p) as id";
            arr.push({
                node: n.name,
                query: query,
                div: n.div
            });
        });


        var onReady = function(){
            nodeView.update(q, nodes, links);
        };

        if (arr.length>0){
            waitmask.show(500);
            var updateNodes = function(){
                var item = arr.pop();
                getCSV(item.query, function(csv){

                    var rows = d3.csvParse(csv);
                    if (rows.length>0){

                        var nodeIDs = [];
                        rows.forEach(function(row){
                            nodeIDs.push(parseInt(row.id));
                        });

                        var item = this;
                        var nodeName = item.node;
                        item.div.enable(nodeIDs);
                        nodes.push({
                            name: nodeName,
                            type: "match",
                            nodes: nodeIDs
                        });
                        links.push({
                            source: q,
                            target: nodeName
                        });
                    }

                    if (arr.length===0){
                        waitmask.hide();
                        onReady();
                    }
                    else{
                        updateNodes();
                    }
                }, item);
            };
            updateNodes();
        }

    };


  //**************************************************************************
  //** updateGrid
  //**************************************************************************
    var updateGrid = function(node){

        var limit = 50;
        var offset = 0;
        var page = 1;



        var getQuery = function(){

            var query = "MATCH (n:" + node.name + ")\n";
            query += "WHERE ID(n) in [" + node.ids.slice(offset, offset+limit).join() + "]\n";
            var properties = node.properties;
            if (properties && properties.length>0){
                query += "RETURN\n";
                for (var i=0; i<properties.length; i++){
                    if (i>0) query +=",\n";
                    query += "   n." + properties[i] + " as " + properties[i];
                }
            }

            return query;
        };


        var executeQuery = function(callback){
            waitmask.show(500);
            getResponse(
                queryService,
                JSON.stringify({
                    query: getQuery(),
                    limit: limit
                }),
                function(request){
                    var json = JSON.parse(request.responseText);
                    var data = parseResponse(json);

                    if (data.records.length<limit){
                        offset = null;
                    }
                    else{
                        offset += data.records.length;
                    }

                    waitmask.hide();

                    callback.apply(me, [data, request]);

                }
            );
        };



        var widths = [];
        var totalWidth = 0;
        var headerWidth = 0;
        var pixelsPerChar = 10;

        var getColumns = function(columns, records){
            if (columns.length>1){

                for (var i=0; i<columns.length; i++){
                    var len = 0;
                    var column = columns[i];
                    if (column!=null) len = (rec+"").length*pixelsPerChar;
                    widths.push(len);
                    headerWidth+=len;
                }
                for (var i=0; i<records.length; i++){
                    var record = records[i];
                    for (var j=0; j<record.length; j++){
                        var rec = record[j];
                        var len = 0;
                        if (rec!=null){
                            var str = rec+"";
                            var r = str.indexOf("\r");
                            var n = str.indexOf("\n");
                            if (r==-1){
                                if (n>-1) str = str.substring(n);
                            }
                            else{
                                if (n>-1){
                                    str = str.substring(Math.min(r,n));
                                }
                                else str = str.substring(r);
                            }

                            len = Math.min(str.length*pixelsPerChar, 150);
                        }
                        widths[j] = Math.max(widths[j], len);
                    }
                }
                for (var i=0; i<widths.length; i++){
                    totalWidth += widths[i];
                }
            }
            else{
                widths.push(1);
                totalWidth = 1;
            }



          //Convert list of column names into column definitions
            var arr = [];
            for (var i=0; i<columns.length; i++){
                var colWidth = ((widths[i]/totalWidth)*100)+"%";
                arr.push({
                   header: columns[i],
                   width: colWidth,
                   sortable: false
                });
            }

            return arr;
        };


        var createGrid = function(columns){
            gridPanel.overflowDiv.style.width = "100%";
            var rect = javaxt.dhtml.utils.getRect(gridPanel.innerDiv);
            if (rect.width<headerWidth){
                gridPanel.overflowDiv.style.width = headerWidth + "px";
            }

            var grid = new javaxt.dhtml.DataGrid(gridPanel.overflowDiv, {
                style: config.style.table,
                columns: columns,
                limit: limit,
                getResponse: function(url, payload, callback){
                    if (isNaN(offset)){

                    }
                    else{
                        executeQuery(function(data, request){
                            page++;
                            grid.load(data.records, page);
                        });
                    }
                }
            });

            return grid;
        };



      //Execute query and render results
        executeQuery(function(data, request){
            var columns = getColumns(data.columns, data.records);
            var grid = createGrid(columns);
            grid.load(data.records, page);
        });

    };


  //**************************************************************************
  //** cancel
  //**************************************************************************
  /** Used to cancel the current query
   */
    var cancel = function(callback){
        if (jobID){
            javaxt.dhtml.utils.delete(config.queryService + jobID,{
                success : function(){
                    //cancelButton.disable();
                    if (callback) callback.apply(null,[]);
                },
                failure: function(request){
                    //cancelButton.disable();
                    if (callback) callback.apply(null,[]);

                    if (request.status!==404){
                        showError(request);
                    }
                }
            });
        }
        else{
            if (callback) callback.apply(null,[]);
        }
        jobID = null;
    };


  //**************************************************************************
  //** showError
  //**************************************************************************
  /** Used to render error messages returned from the server
   */
    var showError = function(msg){
        //cancelButton.disable();

        if (msg.responseText){
            msg = (msg.responseText.length>0 ? msg.responseText : msg.statusText);
        }
        //gridPanel.innerHTML = msg;
        waitmask.hide();
    };


  //**************************************************************************
  //** getResponse
  //**************************************************************************
  /** Used to execute a query request and get a response. Note that queries
   *  are executed asynchronously. This method will poll the sql api until
   *  the query is complete.
   */
    var getResponse = function(url, payload, callback){
        var request = post(url, payload, {
            success : function(text){

                jobID = JSON.parse(text).job_id;
                //cancelButton.enable();


              //Periodically check job status
                var timer;
                var checkStatus = function(){
                    if (jobID){
                        var request = get(config.queryService + jobID, {
                            success : function(text){
                                if (text==="pending" || text==="running"){
                                    timer = setTimeout(checkStatus, 250);
                                }
                                else{
                                    clearTimeout(timer);
                                    callback.apply(me, [request]);
                                }
                            },
                            failure: function(response){
                                clearTimeout(timer);
                                showError(response);
                            }
                        });
                    }
                    else{
                        clearTimeout(timer);
                    }
                };

                if (jobID){
                    timer = setTimeout(checkStatus, 250);
                }
                else{
                    callback.apply(me, [request]);
                }

            },
            failure: function(response){
                //mainMask.hide();
                showError(response);
            }
        });
    };


  //**************************************************************************
  //** parseResponse
  //**************************************************************************
  /** Used to parse the query response from the sql api
   */
    var parseResponse = function(json){

      //Get rows
        var rows = json.rows;


      //Generate list of columns
        var record = rows[0];
        var columns = [];
        for (var key in record) {
            if (record.hasOwnProperty(key)) {
                columns.push(key);
            }
        }


      //Generate records
        var records = [];
        for (var i=0; i<rows.length; i++){
            var record = [];
            var row = rows[i];
            for (var j=0; j<columns.length; j++){
                var key = columns[j];
                var val = row[key];
                record.push(val);
            }
            records.push(record);
        }


        return {
            columns: columns,
            records: records
        };
    };



  //**************************************************************************
  //** getCSV
  //**************************************************************************
    var getCSV = function(query, callback, scope){

        var payload = {
            query: query,
            format: "csv",
            limit: -1
        };

        post(queryService, JSON.stringify(payload), {
            success : function(text){
                callback.apply(scope, [text]);
            },
            failure: function(response){
                alert(response);
            }
        });
    };


  //**************************************************************************
  //** addVerticalResizer
  //**************************************************************************
  /** Inserts a resize handle into the parent. Assumes target is above the
   *  parent.
   */
    var addVerticalResizer = function(parent, target){
        var div = document.createElement("div");
        div.style.position = "relative";

        var resizeHandle = document.createElement("div");
        resizeHandle.style.position = "absolute";
        resizeHandle.style.width = "100%";
        resizeHandle.style.height = "10px";
        resizeHandle.style.top = "-5px";
        resizeHandle.style.cursor = "ns-resize";
        resizeHandle.style.zIndex = 2;
        div.appendChild(resizeHandle);
        parent.appendChild(div);

        javaxt.dhtml.utils.initDrag(resizeHandle, {
            onDragStart: function(x,y){
                var div = this;
                div.yOffset = y;
                div.initialHeight = target.offsetHeight;
            },
            onDrag: function(x,y){
                var div = this;
                var top = (div.yOffset-y);
                var height = div.initialHeight-top;
                target.style.height = height + "px";
            },
            onDragEnd: function(){
            }
        });
    };


  //**************************************************************************
  //** addHorizontalResizer
  //**************************************************************************
  /** Inserts a resize handle into the parent. Assumes target is to the left
   *  of the parent parent.
   */
    var addHorizontalResizer = function(parent, target){

        var div = document.createElement("div");
        div.style.position = "relative";
        div.style.height = "100%";

        var resizeHandle = document.createElement("div");
        resizeHandle.style.position = "absolute";
        resizeHandle.style.height = "100%";
        resizeHandle.style.width = "10px";
        resizeHandle.style.left = "-5px";
        resizeHandle.style.cursor = "ew-resize";
        resizeHandle.style.zIndex = 2;

        div.appendChild(resizeHandle);
        parent.appendChild(div);

        javaxt.dhtml.utils.initDrag(resizeHandle, {
            onDragStart: function(x,y){
                var div = this;
                div.xOffset = x;
                div.initialWidth = target.offsetWidth;
            },
            onDrag: function(x,y){
                var div = this;
                var left = (div.xOffset-x);
                var width = div.initialWidth-left;
                target.style.width = width + "px";
            },
            onDragEnd: function(){
            }
        });

        return div;
    };


  //**************************************************************************
  //** Utilites
  //**************************************************************************
  /** Common functions found in Utils.js
   */
    var get = bluewave.utils.get;
    var post = javaxt.dhtml.utils.post;
    var onRender = javaxt.dhtml.utils.onRender;
    var setStyle = javaxt.dhtml.utils.setStyle;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};