if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  SankeyEditor
//******************************************************************************
/**
 *   Panel used to create Sankey charts
 *
 ******************************************************************************/

bluewave.charts.SankeyEditor = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin: { top: 10, right: 10, bottom: 10, left: 10 },
        nodes: [ //order is important!
            {
                icon: "fas fa-sign-out-alt",
                label: "Input"
            },
            {
                icon: "fas fa-random",
                label: "Distributor"
            },
            {
                icon: "fas fa-sign-in-alt",
                label: "Output"
            }
        ],
        sankey: {
            style: {
                links: {
                    color: "#ccc",
                    opacity: 0.3
                }
            }
        },
        hidePreview: false,
        renderers: {
            drawflowNodes: createDrawflowNode
        }
    };

    var editPanel, previewPanel, waitmask; //primary components
    var dashboardItem;
    var toolbar, tooltip, tooltipTimer, lastToolTipEvent;
    var titleDiv;
    var button = {};
    var nodes = {};
    var labels = {};
    var quantities = {};
    var drawflow, currModule;
    var button = {};
    var nodeEditor, linkEditor;
    var sankeyChart;
    var toggleButton;
    var styleEditor;
    var zoom = 0;

    var callout;
    var linkMenu;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Clone the config so we don't modify the original config object
        var clone = {};
        merge(clone, config);


      //Merge clone with default config
        merge(clone, defaultConfig);
        config = clone;


      //Update config as needed
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create main panel
        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.position = "relative";
        div.style.overflow = "hidden";


      //Add toggle button
        createToggleButton(div);


      //Create inner div for overflow purposes
        var innerDiv = document.createElement("div");
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        innerDiv.style.position = "absolute";
        div.appendChild(innerDiv);


      //Create preview panel
        previewPanel = document.createElement("div");
        previewPanel.style.height = "100%";
        previewPanel.style.textAlign = "center";
        innerDiv.appendChild(previewPanel);
        addShowHide(previewPanel);
        createSankey(previewPanel);
        previewPanel.hide();


      //Create editor
        editPanel = document.createElement("div");
        editPanel.className = "drawflow";
        editPanel.ondrop = drop;
        editPanel.ondragover = function(e){
            e.preventDefault();
        };
        editPanel.onwheel = function(e){
            e.preventDefault();
            if (drawflow){
                if (e.deltaY>0){
                    zoomOut();
                }
                else{
                    zoomIn();
                }
            }
        };
        innerDiv.appendChild(editPanel);
        createTitle(editPanel);
        createDrawFlow(editPanel);
        createToolbar(editPanel);
        addShowHide(editPanel);



        parent.appendChild(div);
        me.el = div;
        addShowHide(me);
    };


  //**************************************************************************
  //** onChange
  //**************************************************************************
    this.onChange = function(){};
    
    
  //**************************************************************************
  //** onContextMenu
  //**************************************************************************
    this.onContextMenu = function(node){};


  //**************************************************************************
  //** onNodeImport
  //**************************************************************************
    this.onNodeImport = function(node){};


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        drawflow.clear();
        drawflow.removeModule(currModule);
        currModule = null;
        setTitle("Untitled", true);
        sankeyChart.clear();
        nodes = {};
        quantities = {};
        zoom = 0;
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(sankeyConfig, inputs){
        me.clear();

        if (!sankeyConfig) sankeyConfig = {};

      //Clone the config so we don't modify the original config object
        sankeyConfig = JSON.parse(JSON.stringify(sankeyConfig));


      //Update title
        setTitle(sankeyConfig.chartTitle, true);


      //Update style
        if (!sankeyConfig.style) sankeyConfig.style = {};
        config.sankey.style = merge(sankeyConfig.style, defaultConfig.sankey.style);


      //Set view
        toggleButton.setValue("Edit");


      //Special case when inputs are present (e.g. from SupplyChain editor)
        if (inputs && inputs.length){
           
          //Hide the toggle button
            toggleButton.hide();
            
            
          //Generate data to mimic what we need to generate a sankey using drawflow 
            var input = inputs[0];
            for (var nodeID in input.nodes) {
                if (input.nodes.hasOwnProperty(nodeID)){
                    var node = input.nodes[nodeID];
                    node.inputs = {};
                    nodes[nodeID] = node;
                }
            }
            for (var linkID in input.links) {
                if (input.links.hasOwnProperty(linkID)){
                    var link = input.links[linkID];
                    quantities[linkID] = link.quantity;
                    
                    var arr = linkID.split("->");
                    var sourceID = arr[0];
                    var targetID = arr[1];
                    nodes[targetID].inputs[sourceID] = {};
                }
            }
            
            
            
          //Switch view and return early
            toggleButton.setValue("Preview");            
            return;
        }



      //Show/hide toggle button
        if (config.hidePreview===true) toggleButton.hide(); 
        else toggleButton.show();
        

      //Set module
        currModule = "sankey_" + new Date().getTime();
        drawflow.addModule(currModule);
        drawflow.changeModule(currModule);


      //Import layout
        if (sankeyConfig.layout){
            var data = {
                drawflow: {}
            };
            data.drawflow[currModule] = {
                data : sankeyConfig.layout
            };
            drawflow.import(data);
        }


      //Update nodes
        for (var nodeID in sankeyConfig.nodes) {
            if (sankeyConfig.nodes.hasOwnProperty(nodeID)){

              //Get node (dom object)
                var drawflowNode = drawflow.getNodeFromId(nodeID);
                var temp = document.createElement("div");
                temp.innerHTML = drawflowNode.html;
                var node = document.getElementById(temp.childNodes[0].id);
                
              //Add props to node
                var props = sankeyConfig.nodes[nodeID];
                for (var key in props) {
                    if (props.hasOwnProperty(key)){
                        var val = props[key];
                        node[key] = val;
                    }
                }

              //Add event listeners
                addEventListeners(node);

              //Add inputs
                node.inputs = {};
                for (var key in drawflowNode.inputs) {
                    if (drawflowNode.inputs.hasOwnProperty(key)){
                        var connections = drawflowNode.inputs[key].connections;
                        for (var i in connections){
                            var connection = connections[i];
                            var inputID = connection.node;
                            var inputNode = nodes[inputID];
                            node.inputs[inputID] = inputNode;
                        }
                    }
                }

              //Update nodes variable
                nodes[nodeID] = node;

              //Fire event
                me.onNodeImport(node,props);
            }
        }


      //Fill in any missing node inputs
        for (var nodeID in nodes){
            var node = nodes[nodeID];
            for (var inputID in node.inputs){
                var inputNode = node.inputs[inputID];
                if (!inputNode) node.inputs[inputID] = nodes[inputID];
            }
        }


      //Update paths, quantities, and labels
        var connections = editPanel.getElementsByTagName("svg");
        for (var i=0; i<connections.length; i++){
            var connection = connections[i];
            var arr = getInputOutputID(connection);
            var inputID = arr[0];
            var outputID = arr[1];

            var key = inputID + "->" + outputID;
            var link = sankeyConfig.links[key];


          //Update quantities
            quantities[key] = link.quantity;


          //Update svg paths (drawflow doesn't import correctly)
            var path = connection.getElementsByTagName("path")[0];
            path.setAttribute("d", link.path);



          //Add text
            onSVGRender(path, function(){
                addLabel(this);
            });




            auditLinkages();
        }

        setZoom(sankeyConfig.zoom);
    };


  //**************************************************************************
  //** addLabel
  //**************************************************************************
    var addLabel = function(path){

        var connection = path.parentNode;
        var arr = getInputOutputID(connection);
        var key = arr[0] + "->" + arr[1];
        var label = quantities[key];

        var l = path.getTotalLength();
        var p = path.getPointAtLength(l/2);

        var svg = d3.select(path.parentNode);
        var g = svg.append("g")
        .attr("transform", "translate(-9999,-9999)")
        .on("click", function() {
            var menu = getLinkMenu();
            menu.label = d3.select(this);
            me.showMenu(menu, this);
        });



        var temp = svg.append("text")
        .attr("text-anchor", "start")
        .text(label);
        var box = temp.node().getBBox();
        temp.remove();



        var w = Math.max(box.width+8, 60);
        var h = box.height;
        var a = h/2;

        var x = p.x+a;
        var y = p.y-a;


        var vertices = [
          [x, y], //ul
          [x+w, y], //ur
          [x+w, y+h], //1r
          [x, y+h], //ll
          [x-a,y+a] //arrow point
        ];


      //Add tag
        g.append("polygon")
        .attr("points", vertices.join(" "))
        .style("fill", "#459db7");


      //Add label
        var a = h/3;
        g.append("text")
        .attr("x", x+a)
        .attr("y", p.y+a)
        .attr("text-anchor", "start")
        .style("fill", "#fff")
        .text(label);

        labels[key] = g;
    };


  //**************************************************************************
  //** getNodes
  //**************************************************************************
    this.getNodes = function(){
        return nodes;
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){

      //Create basic config
        var sankeyConfig = {
            layout: currModule ? drawflow.export().drawflow[currModule].data : {},
            nodes: {},
            links: {},
            chartTitle: getTitle(),
            style: config.sankey.style,
            zoom: zoom
        };


      //Update layout (html in the layout is not synced with the dom)
        for (var key in sankeyConfig.layout) {
            if (sankeyConfig.layout.hasOwnProperty(key)){
                var node = sankeyConfig.layout[key];
                node.html = nodes[key].parentNode.innerHTML;
            }
        }


      //Update nodes
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                sankeyConfig.nodes[key] = {
                    name: node.name,
                    type: node.type,
                    notes: node.notes
                };

                for (var k in node) {
                    if (node.hasOwnProperty(k)){
                        var val = node[k];
                        var addVal = false;
                        if (typeof val === "string"){
                            addVal = true;
                        }
                        else {
                            //boolean or numeric value?
                            if (isNaN(val)){
                                if (val===true || val===false){
                                    addVal = true;
                                }
                            }
                            else{
                                addVal = true;
                            }
                        }

                        if (addVal){
                            sankeyConfig.nodes[key][k] = val;
                        }
                    }
                }

            }
        };


      //Update links
        var connections = editPanel.getElementsByTagName("svg");
        for (var i=0; i<connections.length; i++){
            var connection = connections[i];
            var arr = getInputOutputID(connection);
            var path = connection.getElementsByTagName("path")[0];
            if (path) path = path.getAttribute("d");
            var key = arr[0] + "->" + arr[1];

            sankeyConfig.links[key] = {
                path: path,
                quantity: quantities[key]
            };
        }


        return sankeyConfig;
    };


  //**************************************************************************
  //** getInputOutputID
  //**************************************************************************
    var getInputOutputID = function(connection){
        var classes = connection.className;
        if (classes.baseVal) classes = classes.baseVal;
        var inputID, outputID;
        var arr = classes.split(" ");
        for (var j=0; j<arr.length; j++){
            var str = arr[j].trim();
            var idx = str.indexOf("node_in_node");
            if (idx===0) outputID = str.substring("node_in_node".length+1);
            var idx = str.indexOf("node_out_node");
            if (idx===0) inputID = str.substring("node_out_node".length+1);
        }
        return [inputID, outputID];
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        if (!previewPanel.isVisible()) toggleButton.setValue("Preview");
        return previewPanel;
    };
    
    
  //**************************************************************************
  //** getEditor
  //**************************************************************************  
    this.getEditor = function(){
        if (previewPanel.isVisible()) toggleButton.setValue("Edit");
        return editPanel;
    };
    

  //**************************************************************************
  //** setTitle
  //**************************************************************************
    var setTitle = function(title, silent){
        if (!title) title = "Untitled";
        dashboardItem.title.innerHTML = title;
        titleDiv.innerHTML = title;
        if (silent===true) return;
        me.onChange();
    };


  //**************************************************************************
  //** getTitle
  //**************************************************************************
    var getTitle = function(){
        var title = dashboardItem.title.innerHTML;
        if (!title) return null;
        else return title;
    };


  //**************************************************************************
  //** createTitle
  //**************************************************************************
    var createTitle = function(parent){
        var div = document.createElement("div");
        div.style.position = "absolute";
        div.style.width = "100%";
        div.style.textAlign = "center";
        div.style.zIndex = 2; //same as toggle bar;
        parent.appendChild(div);

        titleDiv = document.createElement("div");
        titleDiv.className = "chart-title noselect";
        titleDiv.style.display = "inline-block";
        titleDiv.style.backgroundColor = "rgba(255,255,255,0.7)";
        titleDiv.style.padding = "5px 10px";
        div.appendChild(titleDiv);

        addTextEditor(titleDiv, function(title){
            setTitle(title);
        });
    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){
        toolbar = document.createElement("div");
        toolbar.className = "drawflow-toolbar";
        parent.appendChild(toolbar);


      //Create tooltip
        tooltip = new javaxt.dhtml.Callout(document.body,{
            style: {
                panel: "tooltip-panel",
                arrow: "tooltip-arrow"
            }
        });
        var _hideToolTip = tooltip.hide;
        tooltip.hide = function(){
            if (tooltipTimer) clearTimeout(tooltipTimer);
            _hideToolTip();
        };


      //Create buttons
        for (var i=0; i<config.nodes.length; i++){
            var n = config.nodes[i];
            createButton(n.icon, n.label);
        }
    };


  //**************************************************************************
  //** getPreviousNodeValue
  //**************************************************************************
    var getPreviousNodeValue = function(previousNodeId){
        var node = nodes[previousNodeId];
        var inputs = node.inputs;
        var quantity = 0;
        for(var k in inputs) {
            if(inputs.hasOwnProperty(k)) {
                var v = quantities[k + "->" + previousNodeId];
                quantity = quantity + v;
            }
        }
        if (quantity == 0){
            quantity = 1;
        }
        return quantity;
    };


  //**************************************************************************
  //** auditNodes
  //**************************************************************************
    var auditNodes = function(){
        for (var key in nodes) {
             var node = nodes[key];
             var inputs = node.inputs;
             var outputs = getOutputs(key);
             var inputQuantity = 0;
             var outputQuantity = 0;
             for(var k in inputs) {
                if(inputs.hasOwnProperty(k)) {
                    var n = nodes[k];
                    var v = quantities[k + "->" + key];
                    inputQuantity = inputQuantity + v;
                }

            }
            for (var i = 0; i < outputs.length; i++) {
                var k = outputs[i];
                var n = nodes[k];
                var v = quantities[key + "->" + k];
                outputQuantity = outputQuantity + v;
            }
            var data = drawflow.drawflow.drawflow[currModule].data;
            var value = data[key];
            if(checkInputsAndOutputs(value) && inputQuantity != outputQuantity) {
                node.style.color = "red";
            } else {
                node.style.color = "black";
            }
        }
        auditLinkages();
    };


  //**************************************************************************
  //** getOutputs
  //**************************************************************************
    var getOutputs = function(value) {
        var outputs = [];
        for (var key in nodes) {
            var n = nodes[key];
            var inputs = n.inputs;
            for(var k in inputs) {
                if(value === k) {
                    outputs.push(key);
                }
            }
        }
        return outputs;
    };


  //**************************************************************************
  //** checkInputsAndOutputs
  //**************************************************************************
    var checkInputsAndOutputs = function (data) {
            if(Object.keys(data.inputs).length === 0) {
                return false;
            }
            if(Object.keys(data.outputs).length === 0) {
                return false;
            }
        return true;
    };


  //**************************************************************************
  //** auditLinkages
  //**************************************************************************
    var auditLinkages = function(){
        var linkages = editPanel.getElementsByClassName("connection");
        for(var item of linkages) {
            var classNames = item.classList;
            var nodeList = [];
            for(var name of classNames) {
                if(name.includes("node")){
                    nodeList.push(name);
                }
            }
            var path = item.children[0];
            checkLinkage(nodeList, path);
        }
    };


  //**************************************************************************
  //** checkLinkage
  //**************************************************************************
    var checkLinkage = function(nodeList, path){
        var inputID = nodeList[0].substring("node_in_node".length+1);
        var outputID = nodeList[1].substring("node_out_node".length+1);
        var nodeIn = nodes[inputID];
        var nodeOut = nodes[outputID];
        if(typeof nodeIn !== 'undefined' || typeof nodeOut !== 'undefined'){
            if (nodeIn.style.color == "red" || nodeOut.style.color == "red"){
                path.style.stroke = "red";
            }
            else {
                path.style.stroke = "";
            }
        }
    };


  //**************************************************************************
  //** createDrawFlow
  //**************************************************************************
    var createDrawFlow = function(parent){

      //Create drawflow
        drawflow = new Drawflow(parent);
        drawflow.reroute = true;
        drawflow.start();


      //Watch for click events
        var x,y;
        drawflow.on('click', function(e){
            x = e.clientX;
            y = e.clientY;
        });


      //Watch for link creation
        drawflow.on('connectionCreated', function(info) {
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            var key = outputID + "->" + inputID;
            //console.log("Connected " + outputID + " to " + inputID);


          //Update nodes
            var node = nodes[inputID];
            node.inputs[outputID] = nodes[outputID];
            var value = getPreviousNodeValue(outputID);


          //Update quantities
            quantities[key] = value;


          //Add label
            var connections = editPanel.getElementsByTagName("svg");
            for (var i=0; i<connections.length; i++){
                var connection = connections[i];
                var arr = getInputOutputID(connection);
                if (arr[1]===inputID && arr[0]===outputID){
                    var path = connection.getElementsByTagName("path")[0];
                    addLabel(path);
                    break;
                }
            }


          //Audit nodes
            auditNodes();


          //Fire onChange event
            me.onChange();
        });


      //Watch for link removals. Fired when a user deletes a connection or a node.
        drawflow.on('connectionRemoved', function(info){
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            var key = outputID + "->" + inputID;
            //console.log("Removed connection " + outputID + " to " + inputID);

          //Update labels
            var label = labels[key];
            if (label) label.remove();
            delete labels[key];


          //Update quantities
            delete quantities[key];

            auditNodes();
            me.onChange();
        });


      //Watch for node removals
        drawflow.on('nodeRemoved', function(nodeID) {
            delete nodes[nodeID+""];
            auditNodes();
            me.onChange();
        });


      //Watch for node moves
        drawflow.on('nodeMoved', function(nodeID) {
            for (var key in labels) {
                if (labels.hasOwnProperty(key)){
                    var arr = key.split("->");
                    if (arr[0]===nodeID || arr[1]===nodeID){
                        var label = labels[key];
                        var path = label.node().previousSibling;
                        if (label) label.remove();
                        delete labels[key];
                        addLabel(path);
                    }
                }
            }
        });

        drawflow.on('contextmenu', function(e) {
            setTimeout(function(){
                for (var key in nodes) {
                    if (nodes.hasOwnProperty(key)){
                        var node = nodes[key];
                        var parentNode = node.parentNode.parentNode;
                        var deleteDiv = parentNode.getElementsByClassName("drawflow-delete")[0];
                        if (deleteDiv){
                            me.onContextMenu(node);
                            parentNode.removeChild(deleteDiv);
                            deleteDiv = document.createElement("div");
                            deleteDiv.className = "drawflow-delete2";
                            parentNode.appendChild(deleteDiv);
                            deleteDiv.innerHTML = "&#x2715";
                            deleteDiv.onclick = function(){
                                var div = this;
                                confirm("Are you sure you want to delete this node?",{
                                    leftButton: {label: "Yes", value: true},
                                    rightButton: {label: "No", value: false},
                                    callback: function(yes){
                                        if (yes){
                                            drawflow.removeNodeId(div.parentNode.id);
                                        }
                                        else{
                                            div.parentNode.removeChild(div);
                                        }
                                    }
                                });

                            };
                        }
                    }
                }
            },200);
        });
    };


  //**************************************************************************
  //** setZoom
  //**************************************************************************
    var setZoom = function(z){
        z = parseInt(z);
        if (isNaN(z) || z===zoom) return;
        var d = Math.abs(z, zoom);
        for (var i=0; i<d; i++){
            if (z<zoom){
                zoomOut();
            }
            else{
                zoomIn();
            }
        }
    };


  //**************************************************************************
  //** zoomIn
  //**************************************************************************
    var zoomIn = function(){
        drawflow.zoom_in();
        zoom++;
    };


  //**************************************************************************
  //** zoomOut
  //**************************************************************************
    var zoomOut = function(){
        drawflow.zoom_out();
        zoom--;
    };


  //**************************************************************************
  //** drag
  //**************************************************************************
    var drag = function(ev) {
        if (ev.type === "touchstart") {
            /*
            mobile_item_selec = ev.target
                .closest(".drag-drawflow")
                .getAttribute("data-node");
            */
        }
        else {
            ev.dataTransfer.setData(
                "node",
                ev.target.getAttribute("data-node")
            );
        }
    };


  //**************************************************************************
  //** drop
  //**************************************************************************
    var drop = function(ev) {
        if (ev.type === "touchend") {
            /*
            let parentdrawflow = document
                .elementFromPoint(
                    mobile_last_move.touches[0].clientX,
                    mobile_last_move.touches[0].clientY
                )
                .closest("#drawflow");
            if (parentdrawflow != null) {
                addNodeToDrawFlow(
                    mobile_item_selec,
                    mobile_last_move.touches[0].clientX,
                    mobile_last_move.touches[0].clientY
                );
            }
            mobile_item_selec = "";
            */
        }
        else {
            ev.preventDefault();
            let nodeType = ev.dataTransfer.getData("node");
            addNodeToDrawFlow(nodeType, ev.clientX, ev.clientY);
        }
    };


  //**************************************************************************
  //** addNodeToDrawFlow
  //**************************************************************************
    var addNodeToDrawFlow = function (nodeType, pos_x, pos_y) {
        if (drawflow.editor_mode === "fixed") {
            return false;
        }
        pos_x =
            pos_x *
                (drawflow.precanvas.clientWidth /
                    (drawflow.precanvas.clientWidth * drawflow.zoom)) -
            drawflow.precanvas.getBoundingClientRect().x *
                (drawflow.precanvas.clientWidth /
                    (drawflow.precanvas.clientWidth * drawflow.zoom));
        pos_y =
            pos_y *
                (drawflow.precanvas.clientHeight /
                    (drawflow.precanvas.clientHeight * drawflow.zoom)) -
            drawflow.precanvas.getBoundingClientRect().y *
                (drawflow.precanvas.clientHeight /
                    (drawflow.precanvas.clientHeight * drawflow.zoom));


        var btn = button[nodeType];
        if (!btn){
            console.log("Unsupported Node Type: " + nodeType);
            return;
        }


      //Set name
        var name = btn.el.dataset["title"];
        var id = 0;
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                var type = node.type;
                if (type===nodeType){
                    id++;
                }
            }
        }
        if (id>0) name += " " + (id+1);


      //Set icon
        var icon = btn.el.dataset["icon"];
        var i = document.createElement("i");
        i.className = icon;


      //Set input and outputs
        var numInputs = 0;
        var numOutputs = 0;
        for (var x=0; x<config.nodes.length; x++){
            var n = config.nodes[x];
            if (n.label===nodeType){


                if (x==0){ //is first node type (e.g. input)
                    numOutputs = 1;
                }
                else if (x==config.nodes.length-1){ //is last node type (e.g. output)
                    numInputs = 1;
                }
                else{ //middleman (e.g. distributor)
                    numInputs = 1;
                    numOutputs = 1;
                }

                break;
            }
        }


      //Create node
        var node = createNode({
            name: name,
            type: nodeType,
            icon: icon,
            content: i,
            position: [pos_x, pos_y],
            inputs: numInputs,
            outputs: numOutputs
        });

        addEventListeners(node);

        me.onChange();
    };


  //**************************************************************************
  //** addEventListeners
  //**************************************************************************
    var addEventListeners = function(node){
        node.ondblclick = function(){
            editNode(this);
        };
    };
    

  //**************************************************************************
  //** createDrawflowNode
  //**************************************************************************
    var createDrawflowNode = function(node){
        var div = document.createElement("div");
        
        var title = document.createElement("div");
        title.className = "drawflow-node-title";
        title.innerHTML = "<i class=\"" + node.icon + "\"></i><span>" + node.name + "</span>";
        div.appendChild(title);
        var body = document.createElement("div");
        body.className = "drawflow-node-body";
        var content = node.content;
        if (content){
            if (typeof content === "string"){
                body.innerHTML = content;
            }
            else{
                body.appendChild(content);
            }
        }
        div.appendChild(body);
        return div;
    };
    

  //**************************************************************************
  //** createNode
  //**************************************************************************
    var createNode = function(node){

      //Create content div for a drawflow node
        var div;
        if (config.renderers.drawflowNodes){
            div = config.renderers.drawflowNodes(node);
        }
        else{
            div = createDrawflowNode(node);
        }
        var nodeID = new Date().getTime();
        div.id = "drawflow_node_"+nodeID;



      //Create drawflow node
        var tempID = drawflow.addNode(
            node.type,
            node.inputs,
            node.outputs,
            node.position[0],
            node.position[1],
            "",
            {},
            div.outerHTML
        );


      //Get content div after it's been added to drawflow and add custom attributes
        div = document.getElementById(div.id);
        div.name = node.name;
        div.type = node.type;
        div.inputs = {};
        div.outputs = {};
        nodes[nodeID+""] = div;


      //Update node id in the drawflow data
        var data = drawflow.drawflow.drawflow[currModule].data;
        var info = data[tempID];
        info.id = nodeID;
        data[nodeID+""] = info;
        delete data[tempID];
        var contentNode = div.parentNode;
        var drawflowNode = contentNode.parentNode;
        drawflowNode.id = "node_"+nodeID;


      //Return content div
        return div;
    };


  //**************************************************************************
  //** getNodeEditor
  //**************************************************************************
    this.getNodeEditor = function(){
        if (!nodeEditor){

            nodeEditor = new javaxt.dhtml.Window(document.body, {
                title: "Edit Node",
                width: 400,
                valign: "top",
                modal: true,
                resizable: false,
                style: config.style.window
            });


            var form = new javaxt.dhtml.Form(nodeEditor.getBody(), {
                style: config.style.form,
                items: [
                    {
                        name: "name",
                        label: "Name",
                        type: "text"
                    },
                    {
                        name: "notes",
                        label: "Notes",
                        type: "textarea"
                    }
                ],
                buttons: [
                    {
                        name: "Cancel",
                        onclick: function(){
                            cancel();
                            nodeEditor.close();
                        }
                    },
                    {
                        name: "Submit",
                        onclick: function(){
                            var inputs = form.getData();
                            var name = inputs.name;
                            if (name) name = name.trim();
                            if (name==null || name==="") {
                                warn("Name is required", nameField);
                                return;
                            }
                            waitmask.show();
                            checkName(name, nodeEditor.node, function(isValid){
                                waitmask.hide();
                                if (!isValid){
                                    warn("Name is not unique", nameField);
                                }
                                else{
                                    submit();
                                }
                            });
                        }
                    }
                ]
            });

            var nameField = form.findField("name");


            var submit = function(){
                nodeEditor.close();
                var node = nodeEditor.node;
                if (!node) return;
                var data = form.getData();
                node.name = data.name;
                node.notes = data.notes;
                if (node.name){
                    node.name = node.name.trim();
                    if (node.name.length>0){
                        node.childNodes[0].getElementsByTagName("span")[0].innerHTML = node.name;
                    }
                }
            };


            var cancel = function(){
                var node = nodeEditor.node;
                if (node){
                    if (node.name) form.setValue("name", node.name);
                    if (node.notes) form.setValue("notes", node.notes);
                }
            };


            nodeEditor.update = function(node){
                form.clear();
                if (nameField.resetColor) nameField.resetColor();
                nodeEditor.node = node;
                if (node){
                    if (node.name) form.setValue("name", node.name);
                    if (node.notes) form.setValue("notes", node.notes);
                }
            };
        }
        return nodeEditor;
    };


  //**************************************************************************
  //** editNode
  //**************************************************************************
    var editNode = function(node){
        var editor = me.getNodeEditor();
        editor.update(node);
        editor.show();
    };


  //**************************************************************************
  //** checkName
  //**************************************************************************
    var checkName = function(name, currentNode, callback){
        var isValid = true;
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                var nodeName = node.name;
                if(node !== currentNode){
                    if(name.toLowerCase() === nodeName.toLowerCase()){
                        isValid = false;
                        break;
                    }
                }
            }
        }
        callback.apply(me, [isValid]);
    };


  //**************************************************************************
  //** getLinkEditor
  //**************************************************************************
    this.getLinkEditor = function(){
        if (!linkEditor){

            var link = {};

            linkEditor = new javaxt.dhtml.Window(document.body, {
                title: "Edit Link",
                width: 400,
                valign: "top",
                modal: true,
                resizable: false,
                style: config.style.window
            });


            var form = new javaxt.dhtml.Form(linkEditor.getBody(), {
                style: config.style.form,
                items: [
                    {
                        name: "quantity",
                        label: "Quantity",
                        type: "text"
                    }
                ],
                buttons: [
                    {
                        name: "Cancel",
                        onclick: function(){
                            linkEditor.close();
                        }
                    },
                    {
                        name: "Submit",
                        onclick: function(){
                            var inputs = form.getData();
                            var quantity = inputs.quantity;
                            if (quantity) quantity = parseFloat(quantity.trim());
                            if (isNaN(quantity)) {
                                warn("Quantity is required", quantityField);
                                return;
                            }

                            quantities[link.from + "->" + link.to] = quantity;
                            link.label.select("text").text(quantity);


                            linkEditor.close();
                            me.onChange();
                        }
                    }
                ]
            });

            var quantityField = form.findField("quantity");


            linkEditor.update = function(label){
                form.clear();
                if (quantityField.resetColor) quantityField.resetColor();

                var connection = label.node().parentNode;
                var arr = getInputOutputID(connection);

                link.from = arr[0];
                link.to = arr[1];
                link.label = label;

                var quantity = quantities[link.from + "->" + link.to];
                quantityField.setValue(quantity);


            };
        }
        return linkEditor;
    };


  //**************************************************************************
  //** editLink
  //**************************************************************************
    var editLink = function(label){
        var editor = me.getLinkEditor();
        editor.update(label);
        editor.show();
    };


  //**************************************************************************
  //** removeLink
  //**************************************************************************
    var removeLink = function(label){
        var connection = label.node().parentNode;
        var arr = getInputOutputID(connection);
        drawflow.removeSingleConnection(arr[0],arr[1],'output_1','input_1');
    };


  //**************************************************************************
  //** createButton
  //**************************************************************************
    var createButton = function(icon, label){


      //Create button
        var btn = new javaxt.dhtml.Button(toolbar, {
            display: "table",
            disabled: false,
            style: {
                button: "drawflow-toolbar-button",
                select: "drawflow-toolbar-button-selected",
                hover: "drawflow-toolbar-button-hover",
                label: "drawflow-toolbar-button-label",
                icon: "drawflow-toolbar-button-icon " + icon
            }
        });


      //Add drawflow specific properties
        btn.el.dataset["node"] = label;
        btn.el.dataset["icon"] = icon;
        btn.el.dataset["title"] = label;
        btn.el.draggable = true;
        btn.el.ondragstart = function(e){
            if (btn.isDisabled()){
                //e.preventDefault();
                return false;
            }
            drag(e);
        };



      //Add tooltip
        btn.el.onmouseover = function(e){
            var button = this;
            if (tooltipTimer) clearTimeout(tooltipTimer);
            if (btn.isEnabled()){

                var showToolTip = function(){
                    var nodeType = button.dataset["node"];
                    var title = button.dataset["title"];
                    var label = "Add " + (title==null ? nodeType : title);
                    tooltip.getInnerDiv().innerHTML = label;
                    var rect = javaxt.dhtml.utils.getRect(button);
                    var rect2 = javaxt.dhtml.utils.getRect(button.parentNode);
                    var x = rect2.x + rect2.width + 3;
                    var y = rect.y + Math.ceil(rect.height/2);
                    tooltip.showAt(x, y, "right", "center");
                    lastToolTipEvent = new Date().getTime();
                };

                var delay = false; //disable delay for now...
                if (lastToolTipEvent){
                    if (new Date().getTime()-lastToolTipEvent<3000) delay = false;
                }
                if (delay){
                    tooltipTimer = setTimeout(showToolTip, 1000);
                }
                else{
                    showToolTip();
                }
            }
        };
        btn.el.onmouseleave = function(){
            tooltip.hide();
        };
        btn.el.onmousedown=function(){
            tooltip.hide();
        };


        button[label] = btn;
        return btn;
    };


  //**************************************************************************
  //** createSankey
  //**************************************************************************
    var createSankey = function(parent){

        dashboardItem = createDashboardItem(parent,{
            width: "1000px",
            height: "644px",
            title: "Untitled",
            settings: true
        });
        var div = dashboardItem.el;
        div.className = "dashboard-item";
        div.style.float = "none";

        addTextEditor(dashboardItem.title, function(title){
            setTitle(title);
        });

        dashboardItem.settings.onclick = function(){
            editStyle();
        };

        sankeyChart = new bluewave.charts.SankeyChart(dashboardItem.innerDiv, config.sankey);
    };


  //**************************************************************************
  //** updateSankey
  //**************************************************************************
    var updateSankey = function(){
        var data = me.getSankeyData();
        sankeyChart.update(config.sankey.style, data);
    };


  //**************************************************************************
  //** getSankeyData
  //**************************************************************************  
    this.getSankeyData = function(){
        var data = {
            nodes: [],
            links: []
        };
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                var name = node.name;

                data.nodes.push({
                    name: name,
                    group: node.type
                });


                var inputs = node.inputs;
                for (var k in inputs) {
                    if (inputs.hasOwnProperty(k)){
                        var n = nodes[k];
                        var v = quantities[k + "->" + key];
                        data.links.push({
                            source: n.name,
                            target: name,
                            value: v
                        });
                    }
                }
            }
        }
        return data;
    };


  //**************************************************************************
  //** editStyle
  //**************************************************************************
    var editStyle = function(){

      //Create styleEditor as needed
        if (!styleEditor){
            var win = new javaxt.dhtml.Window(document.body, {
                title: "Edit Style",
                width: 400,
                valign: "top",
                modal: false,
                resizable: false,
                style: config.style.window
            });


            var linkColor = new javaxt.dhtml.ComboBox(document.createElement("div"),{
                style: config.style.combobox
            });
            linkColor.add("Solid color", "#ccc");
            linkColor.add("Source color", "source");


            var form = new javaxt.dhtml.Form(win.getBody(), {
                style: config.style.form,
                items: [
                    {
                        group: "Links",
                        items: [
                            {
                                name: "linkColor",
                                label: "Color",
                                type: linkColor
                            },
                            {
                                name: "linkOpacity",
                                label: "Opacity",
                                type: "text"
                            }
                        ]
                    }
                ]
            });


          //Update cutout field (add slider) and set initial value
            createSlider("linkOpacity", form, "%");


            styleEditor = form;
            styleEditor.show = function(){
                win.show();
                form.resize();
            };
        }

        var sankeyStyle = config.sankey.style;


        styleEditor.onChange = function(){};
        styleEditor.findField("linkColor").setValue(sankeyStyle.links.color);
        styleEditor.findField("linkOpacity").setValue(sankeyStyle.links.opacity*100);
        styleEditor.onChange = function(){
            var settings = styleEditor.getData();
            sankeyStyle.links.color = settings.linkColor;
            sankeyStyle.links.opacity = settings.linkOpacity/100;
            updateSankey();
        };

        styleEditor.show();
    };


  //**************************************************************************
  //** createToggleButton
  //**************************************************************************
    var createToggleButton = function(parent){

        var div = document.createElement("div");
        div.style.position = "absolute";
        div.style.top = "20px";
        div.style.right = "20px";
        div.style.zIndex = 2;
        parent.appendChild(div);


        var options = ["Edit","Preview"];
        toggleButton = bluewave.utils.createToggleButton(div, {
            options: options,
            defaultValue: options[0],
            onChange: function(val){
                if (val==="Edit"){
                    previewPanel.hide();
                    editPanel.show();
                }
                else{
                    editPanel.hide();
                    previewPanel.show();
                    updateSankey();
                }
            }
        });

        addShowHide(toggleButton);
    };


  //**************************************************************************
  //** showMenu
  //**************************************************************************
    this.showMenu = function(menu, target){

        var numVisibleItems = 0;
        for (var i=0; i<menu.childNodes.length; i++){
            var menuItem = menu.childNodes[i];
            if (menuItem.isVisible()) numVisibleItems++;
        }
        if (numVisibleItems===0){
            return;
        }

        var callout = me.getCallout();
        var innerDiv = callout.getInnerDiv();
        while (innerDiv.firstChild) {
            innerDiv.removeChild(innerDiv.lastChild);
        }
        innerDiv.appendChild(menu);

        var rect = javaxt.dhtml.utils.getRect(target);
        var x = rect.x + (rect.width/2);
        var y = rect.y + rect.height + 3;
        callout.showAt(x, y, "below", "right");
    };



  //**************************************************************************
  //** getLinkMenu
  //**************************************************************************
    var getLinkMenu = function(){
        if (!linkMenu){
            var div = document.createElement("div");
            div.className = "app-menu";
            div.appendChild(createMenuOption("Edit Quantity", "edit", function(){
                editLink(linkMenu.label);
            }));
            div.appendChild(createMenuOption("Delete Link", "times", function(){
                removeLink(linkMenu.label);
            }));
            linkMenu = div;
        }
        return linkMenu;
    };


  //**************************************************************************
  //** createMenuOption
  //**************************************************************************
    var createMenuOption = function(label, icon, onClick){
        var div = document.createElement("div");
        div.className = "app-menu-item noselect";
        if (icon && icon.length>0){
            div.innerHTML = '<i class="fas fa-' + icon + '"></i>' + label;
        }
        else{
            div.innerHTML = label;
        }
        div.label = label;
        div.onclick = function(){
            callout.hide();
            onClick.apply(this, [label]);
        };
        addShowHide(div);
        return div;
    };


  //**************************************************************************
  //** getCallout
  //**************************************************************************
    this.getCallout = function(){
        if (callout){
            var parent = callout.el.parentNode;
            if (!parent){
                callout.el.innerHTML = "";
                callout = null;
            }
        }
        if (!callout) callout = new javaxt.dhtml.Callout(document.body,{
            style: config.style.callout
        });
        return callout;
    };



  //**************************************************************************
  //** onSVGRender
  //**************************************************************************
    var onSVGRender = function(el, callback){

        var bbox = el.getBBox();
        var w = bbox.width;
        if (w===0 || isNaN(w)){
            var timer;

            var checkWidth = function(){
                var bbox = el.getBBox();
                var w = bbox.width;
                if (w===0 || isNaN(w)){
                    timer = setTimeout(checkWidth, 100);
                }
                else{
                    clearTimeout(timer);
                    if (callback) callback.apply(el, [bbox]);
                }
            };

            timer = setTimeout(checkWidth, 100);
        }
        else{
            if (callback) callback.apply(el, [bbox]);
        }
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var addTextEditor = bluewave.utils.addTextEditor;
    var createSlider = bluewave.utils.createSlider;
    var warn = bluewave.utils.warn;


    init();
};