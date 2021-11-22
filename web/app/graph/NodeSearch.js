if(!bluewave) var bluewave={};
if(!bluewave.graph) bluewave.graph={};

//******************************************************************************
//**  NodeSearch
//******************************************************************************
/**
 *   Panel used to execute queries and view results in a grid
 *
 ******************************************************************************/

bluewave.graph.NodeSearch = function(parent, config) {

    var me = this;
    var waitmask;
    var searchBar, navBar, nodeList, nodeView, gridPanel; //panels
    var carousel, sliding;
    var horizontalResizeHandle;
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
        onRender(td, function(el){
          //lock in height after render - critical for the horizontal resizer
            el.style.height = el.offsetHeight + "px";
        });


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



      //Add horizontal resizer between row 2 and 3
        horizontalResizeHandle = addHorizontalResizer(td, target);
        addShowHide(horizontalResizeHandle);


      //Create grid panel
        td.style.paddingTop = "10px";
        createGridPanel(td);


      //Append table to parent
        parent.appendChild(table);
        me.el = table;


      //Add resize listener
        addResizeListener(table, function(){
            nodeList.resize();
            carousel.resize();
        });
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        searchBar.clear();
        nodeList.disable();
        nodeView.clear();
        gridPanel.clear();
        gridPanel.hide();
        navBar.hide();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();
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
                findNodes(q);
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
            me.clear();
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
        td.style.height = "100%";
        tr.appendChild(td);
        createNodeList(td);


      //Right column
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.width = "100%";
        tr.appendChild(td);
        var div = addVerticalResizer(td, nodeList.el);
        div.className = "node-search-main-panel";
        createMainPanel(div);
    };


  //**************************************************************************
  //** createMainPanel
  //**************************************************************************
    var createMainPanel = function(parent){

        var mainPanel = document.createElement("div");
        mainPanel.style.position = "realtive";
        mainPanel.style.height = "100%";
        parent.appendChild(mainPanel);

        var ul = document.createElement("ul");
        ul.className = "node-search-nav";
        mainPanel.appendChild(ul);
        addShowHide(ul);
        navBar = ul;


        var createMenuItem = function(label){
            var li = document.createElement("li");
            li.innerText = label;
            li.tabIndex = -1; //allows the element to have focus
            li.select = function(){
                if (sliding){
                    //this.blur();
                    return;
                }
                this.focus();


              //Find the selected menu item
                var idx = 0;
                var currSelection = -1;
                for (var i=0; i<ul.childNodes.length; i++){
                    var li = ul.childNodes[i];
                    if (li==this) idx = i;

                    if (li.selected){
                        currSelection = i;

                        if (li!==this){
                            li.selected = false;
                            li.className = "";
                        }
                    }
                }


              //Update selected item and the carousel
                if (idx!=currSelection){

                  //Update selection
                    this.selected = true;
                    this.className = "selected";


                  //If nothing was selected, then no need to continue
                    if (currSelection==-1) return;





                  //Update panels
                    if (currSelection<idx){

                        //console.log("slide right");
                        carousel.back();
                    }
                    else if (currSelection>idx){

                        //console.log("slide left");
                        carousel.next();
                    }
                }
            };
            li.onclick = function(){
                this.select();
            };
            ul.appendChild(li);
        };

        createMenuItem("Nodes");
        createMenuItem("Fields");
        createMenuItem("Query");


        var div = document.createElement("div");
        div.style.height = "100%";
        mainPanel.appendChild(div);


      //Create carousel
        carousel = new javaxt.dhtml.Carousel(div, {
            drag: false, //should be true if touchscreen
            loop: false,
            animate: true,
            animationSteps: 600,
            transitionEffect: "easeInOutCubic",
            fx: config.fx
        });


      //Add panels to the carousel
        var panel = document.createElement('div');
        panel.style.height = "100%";
        carousel.add(panel);
        createNodeView(panel);


        panel = panel.cloneNode(false);
        carousel.add(panel);

        panel = panel.cloneNode(false);
        carousel.add(panel);


      //Add event handlers
        carousel.beforeChange = function(){
            //parent.className = "blur";
            sliding = true;
        };
        carousel.onChange = function(currPanel){
            //parent.className = "";
            sliding = false;

//            for (var i=0; i<charts.length; i++){
//                if (charts[i].isSelected()){
//                    charts[i].update(currPanel);
//                    break;
//                }
//            }
        };



    };


  //**************************************************************************
  //** createNodeList
  //**************************************************************************
  /** Creates a panel used to render a list of nodes in the database
   */
    var createNodeList = function(parent){

      //Create panel
        var div = document.createElement("div");
        div.style.position = "relative";
        div.className = "node-search-list";
        div.style.height = "100%";
        div.style.width = "210px";
        parent.appendChild(div);


      //Add overflow to the panel
        var overflow = addOverflow(div, {
            style:{
                iscroll: config.style.table.iscroll
            }
        });
        var innerDiv = overflow.innerDiv;


      //Create nodeList
        var className = "node-search-list-item noselect";
        nodeList = {
            el: div,
            nodes: [],
            resize: function(){
                overflow.update();
            },
            clear: function(){
                innerDiv.innerHTML = "";
                this.nodes = [];
                nodeList.resize();
            },
            disable: function(){
                innerDiv.childNodes.forEach(function(div){
                    div.className = className;
                    div.disable();
                });
            },
            highlight: function(div){
                innerDiv.childNodes.forEach(function(d){
                    d.className = className;
                    if (d===div){
                        d.className += " highlight";
                    }
                });
                div.enable();
                div.focus();
            },
            addNode: function(n){
                var div = document.createElement("div");
                div.className = className;
                div.innerText = n.name;
                div.tabIndex = -1;
                div.node = n;
                div.onclick = function(){
                    if (this.className.indexOf("highlight")>-1) return;
                    var opacity = parseFloat(this.style.opacity);
                    if (isNaN(opacity)){

                      //Show navbar
                        navBar.show();


                      //Highlight current node
                        var div = this;
                        nodeList.highlight(div);



                        var q = searchBar.getValue();
                        if (q){


                        }
                        else{
                            findRelatedNodes(div.node);
                        }

                      //Show grid panel
                        gridPanel.show(function(){
                            div.blur();
                            div.focus();
                        });

                    }
                    else{


                        var q = searchBar.getValue();
                        if (q){

                            gridPanel.hide();
                            navBar.hide();
                        }
                        else{

                          //Show navbar
                            navBar.show();


                          //Highlight current node
                            var div = this;
                            nodeList.disable();
                            nodeList.highlight(div);


                          //Find related nodes
                            findRelatedNodes(div.node);


                          //Show grid panel
                            gridPanel.show(function(){
                                div.blur();
                                div.focus();
                            });
                        }

                    }

                    nodeList.resize();
                };
                div.disable = function(){
                    this.innerHTML = "";
                    this.innerText = this.node.name;
                    this.style.opacity = 0.45;
                    this.node.ids = [];
                };
                div.enable = function(nodeIDs){
                    var arr = [];
                    var numNodes = 0;
                    if (isArray(nodeIDs)){
                        arr = nodeIDs;
                        numNodes = arr.length;
                    }
                    else{
                        if (!isNaN(nodeIDs)) numNodes = nodeIDs;
                    }

                    if (numNodes){
                        this.innerHTML = "";

                        var wrapper = document.createElement("div");
                        wrapper.style.position = "relative";
                        wrapper.style.display = "inline-block";
                        this.appendChild(wrapper);

                        var nodeLabel = document.createElement("span");
                        nodeLabel.innerText = this.node.name;
                        wrapper.appendChild(nodeLabel);

                        var nodeCount = document.createElement("div");
                        nodeCount.className = "node-search-list-item-count";
                        nodeCount.innerText = numNodes;
                        wrapper.appendChild(nodeCount);
                        nodeCount.style.right = -(nodeCount.offsetWidth+2);

                    }


                        this.style.opacity = "";
                        this.node.ids = arr;
                };
                div.disable();
                innerDiv.appendChild(div);

                n.div = div;
                this.nodes.push(n);
                return n;
            },
            selectNode: function(node){
                innerDiv.childNodes.forEach(function(div){
                    if (div.node.name===node.name) div.onclick();
                });
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


      //Create svg element
        var svg = d3.select(div)
        .append("svg")
          .attr("width", "100%")
          .attr("height", "100%");

        var container = svg.append("g");


      //Add panning and zooming to the svg element
        svg.call(d3.zoom().on("zoom", function() {
            container.attr("transform", d3.event.transform);
        }));


      //Define style for arrows
        svg.append("svg:defs").selectAll("marker")
            .data(["end"])
          .enter().append("svg:marker")
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", -1.5)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
          .append("svg:path")
            .attr("d", "M0,-5L10,0L0,5");



      //Function used to clear the search results
        var clear = function(){
            container.node().innerHTML = "";
        };


      //Function used to render search results
        var update = function(nodes, links){
            clear();
            var g = container.append("g");


            var cx = div.offsetWidth/2;
            var cy = div.offsetHeight/2;

          //Create graph
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
              .style("stroke", "#aaa")
              .attr("marker-end", "url(#end)");



          //Add nodes
            var node = g.append("g")
            .selectAll("circle")
            .data(nodes)
            .enter()
            .append("circle")
                .attr("transform", function(d) {
                    return "translate(" + cx + "," + cy + ")";
                })
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
                    else if (node.type==="related"){
                        return "#d89df8";
                    }
                    else{
                        return "#dcdcdc";
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
                    else if (node.type==="related"){
                        return "#b886d3";
                    }
                    else{
                        return "#777";
                    }
                })
                .on("click", function(node){
                    selectNode(node, this);
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
                })
                .on("click", function(node){
                    selectNode(node, this);
                });


          //Calculate label sizes and add custom attributes to the corresponding nodes
            label.each(function(n) {
                var box = d3.select(this).node().getBBox();
                n.labelWidth = box.width;
                n.labelHeight = box.height;
            });


          //Create a lookup table to find nodes by node name
            var nodeMap = {};
            node.each(function(n) {
                n.r = parseFloat(d3.select(this).attr("r"));
                nodeMap[n.name] = n;
            });



          //Update position of elements while the graph is being updated
            graph
              .nodes(nodes)
              .on("tick", function() {

                //Update links. Note that for each of the attr functions we can
                //simply return the node.x or node.y coordinate but instead we
                //return a coordinate just outside of the node so we can render
                //arrows. Reference: https://math.stackexchange.com/a/1630886/
                  link
                    .attr("x1", function(link) {
                        var node = nodeMap[link.source];
                        var x0 = node.x;
                        var y0 = node.y;
                        var x1 = nodeMap[link.target].x;
                        var y1 = nodeMap[link.target].y;
                        var r = node.r;
                        var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                        var t = r/d;
                        return (1-t)*x0+t*x1;
                    })
                    .attr("y1", function(link) {
                        var node = nodeMap[link.source];
                        var x0 = node.x;
                        var y0 = node.y;
                        var x1 = nodeMap[link.target].x;
                        var y1 = nodeMap[link.target].y;
                        var r = node.r;
                        var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                        var t = r/d;
                        return (1-t)*y0+t*y1;
                    })
                    .attr("x2", function(link) {
                        var node = nodeMap[link.target];
                        var x0 = node.x;
                        var y0 = node.y;
                        var x1 = nodeMap[link.source].x;
                        var y1 = nodeMap[link.source].y;
                        var r = node.r;
                        var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                        var t = r/d;
                        return (1-t)*x0+t*x1;
                    })
                    .attr("y2", function(link) {
                        var node = nodeMap[link.target];
                        var x0 = node.x;
                        var y0 = node.y;
                        var x1 = nodeMap[link.source].x;
                        var y1 = nodeMap[link.source].y;
                        var r = node.r;
                        var d = Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
                        var t = r/d;
                        return (1-t)*y0+t*y1;
                    });


                //Update nodes
                  node
                    .attr("transform", function(d) {
                        return "translate(" + d.x + "," + d.y + ")";
                    });


                //Update labels
                  label
                    .attr("transform", function(node) {
                        var x = node.x;
                        var y = node.y;
                        var r = node.r;
                        var w = node.labelWidth;
                        var h = node.labelHeight;


                        if (node.type==="search"){

                          //place text inside node
                            var xOffset = x-(w/2);
                            var yOffset = y+4;
                            return "translate(" + xOffset + "," + yOffset + ")";
                        }
                        else{

                          //Place text outside of node
                            var xOffset;
                            if (x>cx){
                                xOffset = x+r;
                            }
                            else{
                                xOffset = x-(w+r);
                            }

                            return "translate(" + xOffset + "," + (y-(h/2)) + ")";
                        }
                    });
                }
            );


          //Recursive function used to find all nodes realted to a given nodeName
            var findRelatedNodes = function(nodeName, relatedNodes){
                links.forEach(function(l){
                    if (l.source===nodeName){
                        var targetNode = l.target;
                        if (!relatedNodes[targetNode]){
                            findRelatedNodes(targetNode, relatedNodes);

                            if (!relatedNodes[targetNode]){
                                var idx = 0;
                                for (var key in relatedNodes) {
                                    if (relatedNodes.hasOwnProperty(key)){
                                        idx++;
                                    }
                                }
                                var alias = "n"+idx;
                                relatedNodes[targetNode] = {
                                    alias: alias,
                                    source: nodeName,
                                    join:"-[:" + l.relationship + "]->"
                                };

                            }
                        }
                    }
                });
            };


          //Function used to manage node select events
            var selectNode = function(n, el){

              //Find related nodes
                var nodeName = n.name;
                var relatedNodes = {};
                findRelatedNodes(nodeName, relatedNodes);


              //Update node styles
                node.each(function() {
                    d3.select(this).style("opacity", function (n) {
                        if (n.name===nodeName) return 1;
                        return relatedNodes[n.name] ? 1 : 0.15;
                    });
                });


              //Update link styles
                link.each(function() {
                    d3.select(this).style("opacity", function (l) {
                        if (nodeMap[l.source].name===nodeName) return 1;
                        return relatedNodes[nodeMap[l.source].name] ? 1 : 0.15;
                    });
                });


              //Update link styles
                label.each(function() {
                    d3.select(this).style("opacity", function (n) {
                        if (n.type==="search"){

                        }
                        else{
                            if (n.name===nodeName) return 1;
                            return relatedNodes[n.name] ? 1 : 0.35;
                        }
                    });
                });




                //selectColumns(nodeName, relatedNodes);
                if (n.type==="match"){
                    nodeList.selectNode(n);
                }
                else{
                    gridPanel.hide();
                }
            };

        };


      //Return nodeView object
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



        gridPanel.show = function(callback){
            if (horizontalResizeHandle) horizontalResizeHandle.show();

            if (parseFloat(this.style.height)>0){
                callback();
            }
            else{

            }


            this.style.height = height + "px";
            this.style.opacity = 1;
            setTimeout(function(){ //focus again after the gridPanel animation
                nodeList.resize();
            },800);
        };


        gridPanel.hide = function(){
            if (horizontalResizeHandle) horizontalResizeHandle.hide();
            var h = this.offsetHeight;
            if (h>50) height = h;
            this.style.height = "0px";
            this.style.opacity = 0;
            setTimeout(function(){ //focus again after the gridPanel animation
                nodeList.resize();
            },800);
        };


        gridPanel.clear = function(){
            overflowDiv.innerHTML = "";
        };

    };


  //**************************************************************************
  //** findRelatedNodes
  //**************************************************************************
    var findRelatedNodes = function(node){


      //Cancel current query (if running)
        cancel();



      //Clear last query
        gridPanel.hide();
        nodeView.clear();


        var nodes = [];
        var links = [];
        nodes.push({
           name: node.name,
           type: "match"
        });


        var getRelatedNodesQuery = function(nodeName, where){
            if (!where) where = "";
            where+="\n";

            return "MATCH (a:" + nodeName + ")\n" +
            "OPTIONAL MATCH (a)-[r]-(b)\n" +
            where +
            "return\n" +
            "labels(startNode(r)) as source,\n" +
            "type(r) as relationship,\n" +
            "labels(endNode(r)) as target,\n" +
            "count(endNode(r)) as count";
        };

        var getLabel = function(str){
            if (str.indexOf("[")===0 && str.indexOf("]"===str.length)){
                str = str.substring(1,str.length-1);
            }
            return str;
        };

        var addNode = function(nodeName, nodeType, nodeCount){
            for (var i=0; i<nodes.length; i++){
                if (nodes[i].name===nodeName){
                    if (isNaN(nodes[i].count)) nodes[i].count = nodeCount;
                    return false;
                }
            }
            var node = {
               name: nodeName,
               type: nodeType,
               count: nodeCount
            };
            nodes.push(node);
            return node;
        };

        var addLink = function(source, target, relationship){
            for (var i=0; i<links.length; i++){
                var link = links[i];
                if (link.source===source &&
                    link.target===target &&
                    link.relationship===relationship)
                return false;
            }
            var link = {
                source: source,
                target: target,
                relationship: relationship
            };
            links.push(link);
            return link;
        };

        var parseRelatedNodes = function(csv, nodeName){
            var relationships = [];
            var rows = d3.csvParse(csv);
            if (rows.length>0){


                rows.forEach(function(row){

                    var source = getLabel(row.source);
                    var target = getLabel(row.target);
                    var relationship = row.relationship;
                    var count = parseInt(row.count);

                    if (count>0){


                        if (source===nodeName){
                            addNode(target, "related", count);
                        }
                        else{
                            addNode(source, "related", count);
                        }

                        var r = addLink(source, target, relationship);
                        if (r) relationships.push(r);

                    }
                });
            }

            return relationships;
        };

        var onReady = function(){
            waitmask.hide();
            //TODO: save the query results?

          //Updae nodeView
            nodeView.update(nodes, links);

          //Update nodeList
            nodeList.disable();
            nodes.forEach(function(n){
                var nodeName = n.name;
                nodeList.nodes.every(function(node){
                    if (node.name===nodeName){
                        node.div.enable(n.count);
                        return false;
                    }
                    return true;
                });
            });
        };


        var queries = [];
        var getRelatedNodes = function(){
            var item = queries.pop();
            getCSV(item.query, function(csv){

                var relationships = parseRelatedNodes(csv, item.node);
                relationships.forEach(function(r){
                    var query;

                  //Find nodes related to the source
                    query =
                    "MATCH (a:" + r.source + ")-[r:" + r.relationship + "]-(b:" + r.target + ")\n" +
                    "WITH COLLECT(ID(a)) as nodeIDs\n" +
                    "CALL {\n" +
                    "with nodeIDs\n" +
                    getRelatedNodesQuery(r.source, "WHERE ID(a) in nodeIDs") + "\n" +
                    "}\n" +
                    "RETURN source, relationship, target, count";

                    queries.push({
                        query: query,
                        node: r.source
                    });

//if (true) return;

                  //Find nodes related to the target. This initiates deep dive.
                  //The node ID constraint is not guaranteed to match the original
                  //node passed into the findRelatedNodes() method. As a result,
                  //we might see more relationships than are actually there
                  //resulting in empty fields/column values
                    query =
                    "MATCH (a:" + r.source + ")-[r:" + r.relationship + "]-(b:" + r.target + ")\n" +
                    "WITH COLLECT(ID(b)) as nodeIDs\n" +
                    "CALL {\n" +
                    "with nodeIDs\n" +
                    getRelatedNodesQuery(r.target, "WHERE ID(a) in nodeIDs") + "\n" +
                    "}\n" +
                    "RETURN source, relationship, target, count";

                    queries.push({
                        query: query,
                        node: r.target
                    });

                });


                if (queries.length>0){
                    getRelatedNodes();
                }
                else{
                    onReady();
                }
            });
        };




      //Get related nodes
        waitmask.show(500);
        queries.push({
            query: getRelatedNodesQuery(node.name),
            node: node.name
        });
        getRelatedNodes();


    };



  //**************************************************************************
  //** findNodes
  //**************************************************************************
  /** Used to find nodes that contain a given keyword and update the node
   *  views (e.g. nodeList and nodeView)
   */
    var findNodes = function(q){

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

        var relatedNodes = {};



        var arr = [];
        nodeList.nodes.forEach(function(n){
            var query = "MATCH (p:" + n.name + ")\n" +
            "WHERE any(key in keys(p) WHERE toLower(p[key]) CONTAINS toLower('" + q +"') )\n" +
            "OPTIONAL MATCH (p)-[r]-(n) \n"+
            "RETURN ID(p) as id,\n" +
            "type(r) as relationship,\n" +
            "ID(n) as relatedNodeID,\n" +
            "labels(n) as relatedNodeLabels,\n" +
            "ID(startNode(r)) as startNode";
            arr.push({
                node: n.name,
                query: query,
                div: n.div
            });
        });


        var onReady = function(){
            updateRelatedNodes();
            nodeView.update(nodes, links);
        };



        if (arr.length>0){
            waitmask.show(500);
            var getNodes = function(){
                var item = arr.pop();
                getCSV(item.query, function(csv){
                    var item = this;

                    var rows = d3.csvParse(csv);
                    if (rows.length>0){


                        var matchingNodes = {};
                        var relationships = {};
                        rows.forEach(function(row){
                            var nodeID = row.id;

                            if (!matchingNodes[nodeID]){
                                matchingNodes[nodeID] = [];
                            }


                            if (row.relationship){

                                var dir;
                                if (row.startNode===nodeID){
                                    dir = "->";
                                }
                                else{
                                    dir = "<-";
                                }


                                var relatedNode;
                                if (!row.relatedNodeLabels){
                                    relatedNode = "";
                                }
                                else{
                                    relatedNode = row.relatedNodeLabels;
                                    if (relatedNode.indexOf("[")===0 && relatedNode.lastIndexOf("]")===relatedNode.length-1){
                                        relatedNode = relatedNode.substring(1, relatedNode.length-1);
                                    }
                                    if (relatedNode.indexOf(",")>-1){
                                        relatedNode = relatedNode.split(",")[0].trim();
                                    }
                                }

                                var key = relatedNode + "|" + row.relationship + "|" + dir;
                                if (!relationships[key]) relationships[key] = [];
                                relationships[key].push(row.relatedNodeID);
                            }

                        });



                        var nodeIDs = [];
                        for (var key in matchingNodes) {
                            nodeIDs.push(parseInt(key));
                        }



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


                        for (var key in relationships) {

                            var relatedNodeIDs = relationships[key];
                            var attr = key.split("|");
                            var relatedNode = attr[0];
                            var relationship = attr[1];
                            var dir = attr[2];


                            if (!relatedNodes[nodeName]) relatedNodes[nodeName] = [];
                            relatedNodes[nodeName].push({
                                name: relatedNode,
                                type: "related",
                                nodes: relatedNodeIDs,
                                relationship: relationship,
                                dir: dir
                            });

                        }
                    }

                    if (arr.length===0){
                        waitmask.hide();
                        onReady();
                    }
                    else{
                        getNodes();
                    }
                }, item);
            };
            getNodes();
        }


        var updateRelatedNodes = function(){
            for (var key in relatedNodes) {
                var nodeName = key;
                var relationships = relatedNodes[key];
                relationships.forEach(function(r){

                    var relatedNode = r.name;
                    var addNode = true;
                    for (var i=0; i<nodes.length; i++){
                        if (nodes[i].name===relatedNode){
                            addNode = false;
                            break;
                        }
                    }

                    if (addNode){
                        nodes.push({
                            name: relatedNode,
                            type: "related",
                            nodes: r.relatedNodeIDs
                        });
                    }


                    if (r.dir==="->"){
                        links.push({
                            source: nodeName,
                            target: relatedNode,
                            relationship: r.relationship
                        });
                    }
                    else{
                        links.push({
                            source: relatedNode,
                            target: nodeName,
                            relationship: r.relationship
                        });
                    }

                });
            }
        };

    };


  //**************************************************************************
  //** selectColumns
  //**************************************************************************
    var selectColumns = function(selectedNode, relatedNodes){

      //Find selectedNode
        if (typeof selectedNode === "string"){
            nodeList.nodes.every(function(node){
                if (node.name===selectedNode){
                    selectedNode = node;
                    return false;
                }
                return true;
            });
        }



      //Update related nodes
        if (!relatedNodes) relatedNodes = {};
        for (var key in relatedNodes) {
            if (relatedNodes.hasOwnProperty(key)){

              //Add list of available properties
                nodeList.nodes.every(function(node){
                    if (node.name===key){
                        relatedNodes[key].properties = node.properties;
                        return false;
                    }
                    return true;
                });


              //Update join
                if (relatedNodes[key].join){
                    var source = relatedNodes[key].source;
                    if (source===selectedNode) source = "n";
                    else source = relatedNodes[source].alias + ":" + source;
                    var join =
                    "(" + source + ")" +
                    relatedNodes[key].join +
                    "(" + relatedNodes[key].alias + ":" + key + ")";
                    relatedNodes[key].join = join;
                }
            }
        }


      //TODO: Present users with an option to select nodes and properties
        console.log(selectedNode, relatedNodes);

        gridPanel.show(function(){

        });


//                        gridPanel.show(div.node);
//                        setTimeout(function(){ //focus again after the gridPanel animation
//                            div.blur();
//                            div.focus();
//                        },800);


    };


  //**************************************************************************
  //** updateGrid
  //**************************************************************************
    var updateGrid = function(node){

        var limit = 50;
        var offset = 0;
        var page = 1;


      //Function used to generate query for the grid
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


      //Function used to execute a query
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


      //Function used to set up column definitions, specifically widths, for the grid
        var getColumns = function(columns, records){

          //Compute widths
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


      //Function used to create the grid
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
                },
                update: function(row, record){
                    var highlight = false;
                    var q = searchBar.getValue();
                    if (q) q.toLowerCase();

                 //Set column values and check whether the row contains the search term
                    for (var i=0; i<record.length; i++){
                        var str = record[i];
                        if (q && str){
                            if (str.toLowerCase().indexOf(q)>-1) highlight = true;
                        }
                        row.set(i, str);
                    }

                  //Highlight search term in the row as needed
                    if (highlight){
                        var instance = new Mark(row);
                        instance.mark(q, {
                            accuracy: "complementary",
                            separateWordSearch: false
                            //className: "keyword"
                        });
                    }
                }
            });

            return grid;
        };



      //Execute query and render results in the grid
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
  //** addHorizontalResizer
  //**************************************************************************
  /** Inserts a resize handle into the parent. Assumes target is above the
   *  parent.
   */
    var addHorizontalResizer = function(parent, target){
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


              //Custom stuff
                if (gridPanel) gridPanel.style.height = "100%";
                nodeList.resize();

            },
            onDragEnd: function(){
            }
        });

        return div;
    };


  //**************************************************************************
  //** addVerticalResizer
  //**************************************************************************
  /** Inserts a resize handle into the parent. Assumes target is to the left
   *  of the parent.
   */
    var addVerticalResizer = function(parent, target){

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
    var addOverflow = bluewave.utils.addOverflow;
    var post = javaxt.dhtml.utils.post;
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var addResizeListener = javaxt.dhtml.utils.addResizeListener;
    var isArray = javaxt.dhtml.utils.isArray;

    init();
};