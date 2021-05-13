if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  Sankey
//******************************************************************************
/**
 *   Panel used to create Sankey charts
 *
 ******************************************************************************/

bluewave.charts.Sankey = function(parent, config) {

    var me = this;
    var defaultConfig = {
        style: {

        }
    };

    var editPanel, previewPanel;
    var toolbar;
    var tooltip, tooltipTimer, lastToolTipEvent;
    var button = {};
    var nodes = {};
    var quantities = {};
    var drawflow;
    var waitmask;
    var button = {};
    var nodeEditor;
    var svg, sankey;
    var currNode; //drawflow node from Explorer


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create main panel
        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.position = "relative";
        createToggleButton(div);



      //Create preview panel
        previewPanel = document.createElement("div");
        previewPanel.style.height = "100%";
        div.appendChild(previewPanel);
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
        div.appendChild(editPanel);
        createDrawFlow(editPanel);
        createToolbar(editPanel);
        addShowHide(editPanel);



        parent.appendChild(div);
        me.el = div;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        drawflow.clear();
        svg.selectAll("*").remove();
        currNode = null;
        nodes = {};
        quantities = {};
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(sankeyConfig, node){
        me.clear();
        currNode = node;
        console.log(sankeyConfig);

        if (!sankeyConfig) sankeyConfig = {};


      //Import layout
        if (sankeyConfig.layout){
            drawflow.import({
                drawflow: {
                    Home: {
                        data: sankeyConfig.layout
                    }
                }
            });
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

    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){
        var sankeyConfig = {
            layout: drawflow.export().drawflow.Home.data,
            nodes: {},
            quantities: {}
        };


        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                sankeyConfig.nodes[key] = {
                    name: node.name,
                    notes: node.notes
                };
            }
        };


        for (var key in quantities) {
            if (quantities.hasOwnProperty(key)){
                var quantity = quantities[key];
                sankeyConfig.quantities[key] = quantity;
            }
        };


        return sankeyConfig;
    };


  //**************************************************************************
  //** getNode
  //**************************************************************************
    this.getNode = function(){
        return currNode;
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return previewPanel;
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
        createButton("factory", "fas fa-industry", "Factory");
        createButton("distributor", "fas fa-store-alt", "Distributor");
        createButton("hospital", "fas fa-hospital-user", "Hospital");


      //Enable addData button
        button.factory.enable();
        button.distributor.enable();
        button.hospital.enable();
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
    }

  //**************************************************************************
  //** auditNodes
  //**************************************************************************
    var auditNodes = function(){
        for (var key in nodes) {
             var node = nodes[key];
             var inputs = node.inputs;
             var outputs = node.outputs;
             var inputQuantity = 0;
             var outputQuantity = 0;
             for(var k in inputs) {
                if(inputs.hasOwnProperty(k)) {
                    var n = nodes[k];
                    var v = quantities[k + "->" + key];
                    inputQuantity = inputQuantity + v;
                }

            }
            for(var k in outputs) {
                if(outputs.hasOwnProperty(k)) {
                    var n = nodes[k];
                    var v = quantities[key + "->" + k];
                    outputQuantity = outputQuantity + v;
                }
            }
            if(node.type == "distributor" && inputQuantity != outputQuantity) {
                node.style.color = "red";
            } else {
                node.style.color = "black";
            }
        }
        auditLinkages();
    }

  //**************************************************************************
  //** auditLinkages
  //**************************************************************************
    var auditLinkages = function(){
        var linkages = document.getElementsByClassName("connection");
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
    }

  //**************************************************************************
  //** checkLinkage
  //**************************************************************************
    var checkLinkage = function(nodeList, path){
        nodeIn = nodes[nodeList[0].replace("node_in_node-", "")];
        nodeOut = nodes[nodeList[1].replace("node_out_node-", "")];
        if(nodeIn.style.color == "red" || nodeOut.style.color == "red"){
            path.style.stroke = "red";
        } else {
            path.style.stroke = "#4ea9ff";
        }
    }


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
            var nodeOut = nodes[outputID];
            nodeOut.outputs[inputID] = nodes[inputID];
            var value = getPreviousNodeValue(outputID);
          //Update quantities
            quantities[outputID + "->" + inputID] = value;
            auditNodes();
        });


      //Watch for link removals
        drawflow.on('connectionRemoved', function(info){
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            //console.log("Removed connection " + outputID + " to " + inputID);
            delete quantities[outputID + "->" + inputID];
            auditNodes();
        });


      //Watch for node removals
        drawflow.on('nodeRemoved', function(nodeID) {
            delete nodes[nodeID+""];
            auditNodes();
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
            case "factory":
                numOutputs = 1;
                break;
            case "hospital":
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
        var div = document.createElement("div");
        div.id = "_"+new Date().getTime();
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


        var nodeID = drawflow.addNode(
            node.type,
            node.inputs,
            node.outputs,
            node.position[0],
            node.position[1],
            "",
            {},
            div.outerHTML
        );

        div = document.getElementById(div.id);
        div.name = node.name;
        div.type = node.type;
        div.inputs = {};
        div.outputs = {};
        nodes[nodeID+""] = div;
        return div;
    };


  //**************************************************************************
  //** editNode
  //**************************************************************************
    var editNode = function(node){
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
                ]
            });

            nodeEditor.update = function(data){
                form.clear();
                if (!data) return;
                if (data.name) form.setValue("name", data.name);
                if (data.notes) form.setValue("notes", data.notes);
            };
            nodeEditor.getData = function(){
                return form.getData();
            };
        }


        nodeEditor.update({
            name: node.name,
            notes: node.notes
        });
        nodeEditor.onClose = function(){
            var data = nodeEditor.getData();
            node.name = data.name;
            node.notes = data.notes;
            if (node.name){
                node.name = node.name.trim();
                if (node.name.length>0){
                    node.childNodes[0].getElementsByTagName("span")[0].innerHTML = node.name;
                }
            }
        };


        nodeEditor.show();
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
        var width = 1000;
        var height = 642;
        var margin = { top: 10, right: 10, bottom: 10, left: 10 };


        var div = document.createElement("div");
        div.className = "dashboard-item";
        parent.appendChild(div);


        svg = d3
        .select(div)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


      //Update width and height for the sankey
        width = width - margin.left - margin.right,
        height = height - margin.top - margin.bottom;

        sankey = d3
          .sankey()
          .nodeId((d) => d.name)
          .nodeWidth(20)
          .nodePadding(20)
          .iterations([6])
          .size([width, height]);

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


        svg.selectAll("*").remove();

        let graph = sankey(data);
        var size = sankey.size();
        var width = size[0];

        var formatNumber = d3.format(",.0f"); // zero decimal places


      //Add the nodes
        var node = svg
          .append("g")
          .selectAll(".node")
          .data(graph.nodes)
          .enter()
          .append("g")
          .attr("class", "sankey-node");


      //Add the rectangles for the nodes
        node
          .append("rect")
          .attr("x", function (d) {
            return d.x0;
          })
          .attr("y", function (d) {
            return d.y0;
          })
          .attr("height", function (d) {
            return d.y1 - d.y0;
          })
          .attr("width", sankey.nodeWidth())
          .style("fill", function (d) {
            return (d.color = getColor(d.name.replace(/ .*/, "")));
          })
          .style("stroke", function (d) {
            return d3.rgb(d.color).darker(2);
          })
          .append("title")
          .text(function (d) {
            return d.name + "\n" + formatNumber(d.value);
          });




      //Add the links
        var link = svg
          .append("g")
          .selectAll(".link")
          .data(graph.links)
          .enter()
          .append("path")
          .attr("class", "sankey-link")
          .attr("d", d3.sankeyLinkHorizontal())
          .attr("stroke-width", function (d) {
            return d.width;
          })
          .style("stroke-opacity", function (d) {
            return (d.opacity=0.3);
          })
          .style("stroke", function (d) {
            return d.source.color;
          })
          .on('mouseover', function(d){
            d3.select(this).style("stroke-opacity", 0.6);
          })
          .on('mouseout', function(d){
            d3.select(this).style("stroke-opacity", d.opacity);
          });



      //Add link labels
        link.append("title").text(function (d) {
          return d.source.name + " → " + d.target.name + "\n" + formatNumber(d.value);
        });



      //Add node labels
        node
          .append("text")
          .attr("x", function (d) {
            return d.x0 - 6;
          })
          .attr("y", function (d) {
            return (d.y1 + d.y0) / 2;
          })
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .text(function (d) {
            return d.name;
          })
          .filter(function (d) {
            return d.x0 < width / 2;
          })
          .attr("x", function (d) {
            return d.x1 + 6;
          })
          .attr("text-anchor", "start");
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
        var toggle = bluewave.utils.createToggleButton(div, {
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
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var isDirty = javaxt.dhtml.utils.isDirty;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());

    init();
};