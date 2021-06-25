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
        nodes: {
            input: {
                icon: "fas fa-sign-out-alt",
                label: "Input"
            },
            output: {
                icon: "fas fa-sign-in-alt",
                label: "Output"
            },
            distributor: {
                icon: "fas fa-random",
                label: "Distributor"
            }
        },
        sankey: {
            style: {
                links: {
                    color: "#ccc",
                    opacity: 0.3
                }
            }
        }
    };

    var editPanel, previewPanel, waitmask; //primary components
    var dashboardItem;
    var toolbar, tooltip, tooltipTimer, lastToolTipEvent;
    var titleDiv;
    var button = {};
    var nodes = {};
    var quantities = {};
    var drawflow, currModule;
    var button = {};
    var nodeEditor;
    var sankeyChart;
    var toggleButton;
    var styleEditor;


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
                    drawflow.zoom_out();
                }
                else{
                    drawflow.zoom_in();
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
  //** clear
  //**************************************************************************
    this.clear = function(){
        drawflow.clear();
        drawflow.removeModule(currModule);
        setTitle("Untitled", true);
        sankeyChart.clear();
        nodes = {};
        quantities = {};
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(sankeyConfig){
        me.clear();

        if (!sankeyConfig) sankeyConfig = {};


      //Clone the config so we don't modify the original config object
        sankeyConfig = JSON.parse(JSON.stringify(sankeyConfig));


      //Update title
        setTitle(sankeyConfig.chartTitle, true);


      //Update style
        if (!sankeyConfig.style) sankeyConfig.style = {};
        config.sankey.style = merge(sankeyConfig.style, defaultConfig.sankey.style);



      //Update toggle button
        toggleButton.setValue("Edit");


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


      //Update paths and quantities
        var connections = editPanel.getElementsByTagName("svg");
        for (var i=0; i<connections.length; i++){
            var connection = connections[i];
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

            var key = inputID + "->" + outputID;
            var link = sankeyConfig.links[key];


          //Update quantities
            quantities[key] = link.quantity;


          //Update svg paths (drawflow doesn't import correctly)
            connection.getElementsByTagName("path")[0].setAttribute("d", link.path);
            auditLinkages();
        }
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
            layout: drawflow.export().drawflow[currModule].data,
            nodes: {},
            links: {},
            chartTitle: getTitle(),
            style: config.sankey.style
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
            var path = connection.getElementsByTagName("path")[0];
            if (path) path = path.getAttribute("d");
            var key = inputID + "->" + outputID;

            sankeyConfig.links[key] = {
                path: path,
                quantity: quantities[key]
            };
        }


        return sankeyConfig;
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        if (!previewPanel.isVisible()) toggleButton.setValue("Preview");
        return previewPanel;
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
        createButton("input", config.nodes.input.icon, config.nodes.input.label);
        createButton("distributor", config.nodes.distributor.icon, config.nodes.distributor.label);
        createButton("output", config.nodes.output.icon, config.nodes.output.label);


      //Enable addData button
        button.input.enable();
        button.distributor.enable();
        button.output.enable();
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
        if(quantity == 0){
            quantity = 1;
        }
        return quantity
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
            for(i = 0; i < outputs.length; i++) {
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
            //console.log("Connected " + outputID + " to " + inputID);

          //Update nodes
            var node = nodes[inputID];
            node.inputs[outputID] = nodes[outputID];
            var value = getPreviousNodeValue(outputID);

          //Update quantities
            quantities[outputID + "->" + inputID] = value;
            auditNodes();

            me.onChange();
        });


      //Watch for link removals
        drawflow.on('connectionRemoved', function(info){
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            //console.log("Removed connection " + outputID + " to " + inputID);
            delete quantities[outputID + "->" + inputID];
            auditNodes();
            me.onChange();
        });


      //Watch for node removals
        drawflow.on('nodeRemoved', function(nodeID) {
            delete nodes[nodeID+""];
            auditNodes();
            me.onChange();
        });


      //Process link click events
        drawflow.on('connectionSelected', function(info){
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            var currVal = quantities[outputID + "->" + inputID];
            //console.log("Clicked link between " + outputID + " and " + inputID);

            var div = document.createElement("div");
            div.style.minWidth = "50px";
            div.style.textAlign = "center";
            div.innerHTML = currVal;
            div.onclick = function(e){
                if (this.childNodes[0].nodeType===1) return;
                e.stopPropagation();
                this.innerHTML = "";
                var input = document.createElement("input");
                input.className = "form-input";
                input.type = "text";
                input.value = currVal;
                input.onkeydown = function(event){
                    var key = event.keyCode;
                    if (key === 13) {
                        var val = parseFloat(this.value);
                        div.innerHTML = val;
                        quantities[outputID + "->" + inputID] = val;
                        auditNodes();
                    }
                };
                this.appendChild(input);
                input.focus();
            };

            tooltip.getInnerDiv().innerHTML = "";
            tooltip.getInnerDiv().appendChild(div);
            tooltip.showAt(x, y, "right", "center");
        });
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
                console.log(node.name, node.type);
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


        var numInputs = 0;
        var numOutputs = 0;

        switch (nodeType) {
            case "input":
                numOutputs = 1;
                break;
            case "output":
                numInputs = 1;
                break;
            default:
                numInputs = 1;
                numOutputs = 1;
                break;
        }


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
  //** createNode
  //**************************************************************************
    var createNode = function(node){

      //Create content div for a drawflow node
        var nodeID = new Date().getTime();
        var div = document.createElement("div");
        div.id = "drawflow_node_"+nodeID;
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
  //** createButton
  //**************************************************************************
    var createButton = function(nodeType, icon, title){


      //Create button
        var btn = new javaxt.dhtml.Button(toolbar, {
            display: "table",
            disabled: true,
            style: {
                button: "drawflow-toolbar-button",
                select: "drawflow-toolbar-button-selected",
                hover: "drawflow-toolbar-button-hover",
                label: "drawflow-toolbar-button-label",
                icon: "drawflow-toolbar-button-icon " + icon
            }
        });


      //Add drawflow specific properties
        btn.el.dataset["node"] = nodeType;
        btn.el.dataset["icon"] = icon;
        btn.el.dataset["title"] = title;
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


        button[nodeType] = btn;
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
                        //console.log(k + "->" + key, );

                        data.links.push({
                            source: n.name,
                            target: name,
                            value: v
                        });
                    }
                }
            }
        }


        sankeyChart.update(config.sankey.style, data);
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