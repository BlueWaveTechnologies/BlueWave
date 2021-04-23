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
    var connections = {};
    var drawflow;
    var waitmask;
    var button = {};
    var nodeEditor;
    var preview;


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
        addShowHide(previewPanel);
        createPreview(previewPanel);
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

          //Update connections
            connections[outputID + "->" + inputID] = 1;
        });


      //Watch for link removals
        drawflow.on('connectionRemoved', function(info){
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            //console.log("Removed connection " + outputID + " to " + inputID);
            delete connections[outputID + "->" + inputID];
        });


      //Watch for node removals
        drawflow.on('nodeRemoved', function(nodeID) {
            delete nodes[nodeID+""];
        });


      //Process link click events
        drawflow.on('connectionSelected', function(info){
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            var currVal = connections[outputID + "->" + inputID];
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
                    if(key == 13) {
                        div.innerHTML = this.value;
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

        var icon = btn.el.dataset["icon"];
        var title = btn.el.dataset["title"];
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
            name: title,
            type: nodeType,
            icon: icon,
            content: i,
            position: [pos_x, pos_y],
            inputs: numInputs,
            outputs: numOutputs
        });

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


        nodeEditor.update(node.data);
        nodeEditor.onClose = function(){
            var data = nodeEditor.getData();
            node.data = data;
            if (data.name){
                data.name = data.name.trim();
                if (data.name.length>0){
                    node.childNodes[0].getElementsByTagName("span")[0].innerHTML = data.name;
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
  //** createPreview
  //**************************************************************************
    var createPreview = function(parent){
        preview = d3.select(parent).append("svg");
        preview.update = function(){
            preview.selectAll("*").remove();
            var width = parent.offsetWidth;
            var height = parent.offsetHeight;
            preview.attr("width", width);
            preview.attr("height", height);
            console.log(preview);
        };
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
                    preview.update();
                }
            }
        });
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var isDirty = javaxt.dhtml.utils.isDirty;
    var setStyle = javaxt.dhtml.utils.setStyle;
    var resizeCanvas = bluewave.utils.resizeCanvas;

    init();
};