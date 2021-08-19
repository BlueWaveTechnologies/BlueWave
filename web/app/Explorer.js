if(!bluewave) var bluewave={};

//******************************************************************************
//**  Explorer
//******************************************************************************
/**
 *   Panel used to explore data and create charts/graphs
 *
 ******************************************************************************/

bluewave.Explorer = function(parent, config) {

    var me = this;
    var dashboardPanel, editPanel, toggleButton, mask, waitmask; //primary components
    var id, name, thumbnail; //dashboard attributes
    var button = {};
    var tooltip, tooltipTimer, lastToolTipEvent; //tooltip
    var drawflow, nodes = {}; //drawflow
    var dbView, chartEditor, sankeyEditor, layoutEditor, nameEditor, supplyChainEditor, scatterEditor, mapEditor, userManager; //popup dialogs
    var windows = [];
    var zoom = 0;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create main panel
        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.position = "relative";
        //div.style.overflow = "hidden";


      //Add toggle button
        createToggleButton(div);


      //Add add mask
        createMask(div);


      //Create inner div for overflow purposes
        var innerDiv = document.createElement("div");
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        innerDiv.style.position = "absolute";
        div.appendChild(innerDiv);


      //Create preview panel
        dashboardPanel = document.createElement("div");
        dashboardPanel.style.height = "100%";
        innerDiv.appendChild(dashboardPanel);
        addShowHide(dashboardPanel);
        dashboardPanel.hide();


      //Create editor
        editPanel = document.createElement("div");
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
        createEditPanel(editPanel);
        addShowHide(editPanel);
        innerDiv.appendChild(editPanel);



        parent.appendChild(div);
        me.el = div;
        addShowHide(me);
    };


  //**************************************************************************
  //** getDashboardID
  //**************************************************************************
    this.getDashboardID = function(){
        return id;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

      //Clear dashboard panel
        dashboardPanel.innerHTML = "";

      //Reset class variables
        id = name = thumbnail = null;
        nodes = {};

      //Clear drawflow
        drawflow.clear();

      //Reset toolbar buttons
        for (var buttonName in button) {
            if (button.hasOwnProperty(buttonName)){
                button[buttonName].disable();
            }
        }

      //Hide any popup dialogs
        for (var i in windows){
            windows[i].hide();
        }

        zoom = 0;
    };


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to render a dashboard
   *  @param dashboard Json with dashboard info
   *  @param readOnly If true, prevent user from editing
   *  @param view Preferred view ("Edit", "Preview", or "Dashboard")
   */
    this.update = function(dashboard, readOnly, view){

      //Show mask
        mask.show();


      //Reset panels and class variables
        me.clear();


      //Ensure that the chartEditor is visible (albeit hidden by the mask).
      //Otherwise, the thumbnail previews might not generate correctly
        toggleButton.setValue("Edit");


      //Show/hide the toggleButton as needed
        if (view==="Dashboard"){
            toggleButton.hide();
        }
        else{
            toggleButton.show();
            mask.hide();
        }


      //Update class variables
        if (!dashboard) dashboard = {};
        id = dashboard.id;
        name = dashboard.name;
        thumbnail = dashboard.thumbnail;


      //Set view mode
        drawflow.editor_mode = readOnly ? "view" : "edit";


      //Update buttons
        updateButtons();


      //Return early if the dashboard is missing config info
        if (!dashboard.info) return;


      //Import layout
        drawflow.import({
            drawflow: {
                Home: {
                    data: dashboard.info.layout
                }
            }
        });




      //Update nodes
        var csvRequests = [];
        for (var nodeID in dashboard.info.nodes) {
            if (dashboard.info.nodes.hasOwnProperty(nodeID)){

              //Get node (dom object)
                var drawflowNode = drawflow.getNodeFromId(nodeID);
                var temp = document.createElement("div");
                temp.innerHTML = drawflowNode.html;
                var node = document.getElementById(temp.childNodes[0].id);


              //Add props to node
                var props = dashboard.info.nodes[nodeID];
                for (var key in props) {
                    if (props.hasOwnProperty(key)){
                        var val = props[key];
                        node[key] = val;
                    }
                }


              //Update title
                if (props.config.chartTitle) updateTitle(node, props.config.chartTitle);


              //Create thumbnail
                if (props.preview) createThumbnail(node, props.preview);



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


              //Special case for data nodes
                if (node.type==="addData"){


                  //Update node with csv data
                    node.csv = null;
                    csvRequests.push(node);



                  //Update buttons
                    if (!me.isReadOnly()){
                        for (var buttonName in button) {
                            if (button.hasOwnProperty(buttonName)){
                                button[buttonName].enable();
                            }
                        }
                    }
                }
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


        var onReady = function(){
            updateButtons();
            me.setView(view);
            mask.hide();
            setZoom(dashboard.info.zoom);
        };


        if (csvRequests.length>0){
            waitmask.show(500);
            var showMask = true;
            var updateNodes = function(){
                var node = csvRequests.pop();
                getCSV(node.config.query, function(csv){
                    this.csv = csv;
                    if (csvRequests.length===0){
                        showMask = false;
                        waitmask.hide();
                        onReady.apply(me, []);
                    }
                    else{
                        updateNodes();
                    }
                }, node);
            };
            updateNodes();


          //Something is causing the waitmask to hide early. This is a workaround
            var timer;
            var checkMask = function(){
                if (showMask){
                    waitmask.show();
                    timer = setTimeout(checkMask, 100);
                }
                else{
                    clearTimeout(timer);
                    onReady.apply(me, []);
                }
            };
            timer = setTimeout(checkMask, 100);
        }
        else{
            onReady.apply(me, []);
        }
    };


  //**************************************************************************
  //** updateButtons
  //**************************************************************************
    var updateButtons = function(){
        if (me.isReadOnly()){
            for (var key in button) {
                if (button.hasOwnProperty(key)){
                    button[key].disable();
                }
            }
        }
        else{

            var hasData = false;
            for (var key in nodes) {
                if (nodes.hasOwnProperty(key)){
                    var node = nodes[key];
                    if (node.type==="addData"){
                        if (node.csv){
                            hasData = true;
                            break;
                        }
                    }
                }
            }

            if (hasData){
                for (var key in button) {
                    if (button.hasOwnProperty(key)){
                        button[key].enable();
                    }
                }
            }
            else{
                button.addData.enable();
                button.sankeyChart.enable();
                button.supplyChain.enable();
                

              //Special case for SupplyChain nodes
                for (var key in nodes) {
                    if (nodes.hasOwnProperty(key)){
                        var node = nodes[key];
                        if (node.type==="supplyChain"){
                            button.map.enable();
                            break;
                        }
                    }
                }
            }


          //Update toolbar
            if (isNaN(id)){
                button["save"].disable();
                button["edit"].disable();
                button["delete"].disable();
                button["users"].disable();
            }
            else{
                button["save"].enable();
                button["edit"].enable();
                button["delete"].enable();
                button["users"].enable();
            }
        }
    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
    this.onUpdate = function(){};


  //**************************************************************************
  //** onDelete
  //**************************************************************************
    this.onDelete = function(){};


  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        // console.log("if this variable returns empty then we will set it as untitled: ",name)
        return name ? name : "Untitled";
    };


  //**************************************************************************
  //** setView
  //**************************************************************************
  /** */
    this.setView = function(name){
        // console.log("this set view called, editting name?")
        // console.log(`name editting is ${name}`)
        if (!name) name = "Edit";
        if (name==="Edit"){
            toggleButton.setValue("Edit");
            toggleButton.show();
        }
        else if (name==="Preview"){
            toggleButton.show();
            toggleButton.setValue("Preview");
        }
        else if (name==="Dashboard"){
            toggleButton.show();


            var hasLayout = false;
            for (var key in nodes) {
                if (nodes.hasOwnProperty(key)){
                    var node = nodes[key];
                    if (node.type==="layout"){
                        hasLayout = true;
                        break;
                    }
                }
            }

            if (hasLayout){
                toggleButton.hide();
                toggleButton.setValue("Preview");
            }
            else{
                toggleButton.setValue("Edit");
            }
        }
    };


  //**************************************************************************
  //** getView
  //**************************************************************************
    this.getView = function(){
        var name = toggleButton.getValue();
        if (name==="Preview"){
            if (!toggleButton.isVisible()) name = "Dashboard";
        }
        return name;
    };


  //**************************************************************************
  //** setReadOnly
  //**************************************************************************
    this.setReadOnly = function(readOnly){
        // console.log("this is setting something as readonly")
        if (readOnly===true){
            if (me.isReadOnly()) return;
            drawflow.editor_mode = "view";
        }
        else{
            if (!me.isReadOnly()) return;
            drawflow.editor_mode = "edit";
        }
        updateButtons();
    };


  //**************************************************************************
  //** isReadOnly
  //**************************************************************************
    this.isReadOnly = function(){
        // console.log("checking whether this is read only")
        // console.log(`the status is ${drawflow.editor_mode==="view"}`)
        return (drawflow.editor_mode==="view");
    };


  //**************************************************************************
  //** save
  //**************************************************************************
    this.save = function(){

        console.log("trying out this print.. save function was called on an object, printing object in json array for organization",{
            printedobj:me,
        })

        // if this is in readOnly mode, do not save
        if (me.isReadOnly()) return;

      

        waitmask.show(500);
        getName(function(formInputs){
            name = formInputs.name;


            var dashboard = {
                id: id,
                name: name,
                className: name,
                //thumbnail: thumbnail,
                info: {
                    layout: drawflow.export().drawflow.Home.data,
                    nodes: {},
                    zoom: zoom
                }
            };


            for (var key in nodes) {
                if (nodes.hasOwnProperty(key)){
                    var node = nodes[key];
                    dashboard.info.nodes[key] = {
                        name: node.name,
                        type: node.type,
                        config: node.config,
                        preview: node.preview
                    };
                }
            };


            post("dashboard", JSON.stringify(dashboard),{
                success: function(text) {
                    me.onUpdate();
                    id = parseInt(text);
                    if (thumbnail){
                        saveThumbnail(id, function(request){
                            waitmask.hide();
                            if (request.status===200){

                            }
                            else{
                                alert(request);
                            }
                        });
                    }
                    else{
                        waitmask.hide();
                    }
                },
                failure: function(request){
                    alert(request);
                    waitmask.hide();
                }
            });
        });
    };


  //**************************************************************************
  //** saveThumbnail
  //**************************************************************************
    var saveThumbnail = function(id, callback){
        console.log("save thumbnail called (probably when the thing is closed)")

      //Convert base64 encoded string into a binary object
        var data = thumbnail;
        var type = data.substring(data.indexOf(":")+1, data.indexOf(";"));
        data = data.substring(("data:" + type + ";base64,").length);
        var blob = base64ToBlob(data, type);

      //Create form data
        var formData = new FormData();
        formData.append("image", blob);
        formData.set("id", id);

      //Send form data to the dashboard service to save thumbnail
        var request = new XMLHttpRequest();
        request.open('POST', 'dashboard/thumbnail', true);
        request.onreadystatechange = function(){
            if (request.readyState === 4) {
                if (callback) callback.apply(me, [request]);
            }
        };
        request.send(formData);
    };


  //**************************************************************************
  //** createEditPanel
  //**************************************************************************
    var createEditPanel = function(parent){
        console.log("create edit panel for this obj",{object_printed:parent})
        console.log(`lets try printing this another way`)
        console.log(parent)
        console.log("other way above")
      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Row 1
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "panel-toolbar";
        td.style.borderTop = "1px solid #cacaca";
        tr.appendChild(td);
        createToolbar(td);


      //Row 2
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);


      //Create drawflow
        createDrawFlow(td);



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



        parent.appendChild(table);
    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){
        var toolbar = document.createElement('div');

        var createButton = function(parent, btn){
            var defaultStyle = JSON.parse(JSON.stringify(config.style.toolbarButton));
            if (btn.style) btn.style = merge(btn.style, defaultStyle);
            else btn.style = defaultStyle;
            return bluewave.utils.createButton(parent, btn);
        };

      //Add button
        button["save"] = createButton(toolbar, {
            label: "Save",
            icon: "fas fa-check-square"
        });
        button["save"].onClick = me.save;


//      //Copy button
//        button["copy"] = createButton(toolbar, {
//            label: "Copy",
//            icon: "fas fa-copy",
//            disabled: true
//        });
//        button["copy"].onClick = function(){
//            alert("Not implemented");
//        };


      //Edit button
        button["edit"] = createButton(toolbar, {
            label: "Edit",
            icon: "fas fa-edit",
            disabled: true
        });
        button["edit"].onClick = function(){
            editName(name, function(inputs){
                name = inputs.name;
                me.save();
            });
        };



      //Delete button
        button["delete"] = createButton(toolbar, {
            label: "Delete",
            icon: "fas fa-trash"
        });
        button["delete"].onClick = function(){

            confirm("Are you sure you want to delete this dashboard?",{
                leftButton: {label: "Yes", value: true},
                rightButton: {label: "No", value: false},
                callback: function(yes){
                    if (yes){
                        waitmask.show();
                        del("dashboard/"+id, {
                            success: function(){
                                me.update();
                                me.onDelete();
                                waitmask.hide();
                            },
                            failure: function(request){
                                alert(request);
                                waitmask.hide();
                            }
                        });


                    }
                }
            });
        };


        createSpacer(toolbar);


      //Copy button
        button["users"] = createButton(toolbar, {
            label: "Manage Access",
            icon: "fas fa-user-cog"
        });
        button["users"].onClick = function(){
            editUsers();
        };


        parent.appendChild(toolbar);
    };



  //**************************************************************************
  //** createDrawFlow
  //**************************************************************************
    var createDrawFlow = function(parent){

        var div = document.createElement("div");
        div.className = "drawflow";
        div.ondrop = drop;
        div.ondragover = function(e){
            e.preventDefault();
        };
        parent.appendChild(div);


        drawflow = new Drawflow(div);
        drawflow.reroute = true;
        drawflow.start();
        drawflow.on('connectionCreated', function(info) {

          //Get input/output IDs
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            //console.log("Connected " + outputID + " to " + inputID);


          //Get target and input nodes
            var node = nodes[inputID];
            var inputNode = nodes[outputID];


          //Ensure that charts can't be connected to other charts
            if (node.type.indexOf("Chart")>0){
                if (inputNode.type.indexOf("Chart")>0){
                    drawflow.removeSingleConnection(info.output_id, info.input_id, info.output_class, info.input_class);
                    return;
                }
            }
            
            
          //Ensure that Map can only be connected by addData or supplyChain nodes
            if (node.type === "map"){
                // console.log("this map thingy diggy is called 795")
                if (inputNode.type != "addData" && inputNode.type != "supplyChain"){
                   drawflow.removeSingleConnection(info.output_id, info.input_id, info.output_class, info.input_class);
                   return;
                }
            }
            
            
          //Ensure that Sankey can only be connected by a supplyChain node
            if (node.type === "sankeyChart"){
                if (inputNode.type != "supplyChain"){
                   drawflow.removeSingleConnection(info.output_id, info.input_id, info.output_class, info.input_class);
                   return;
                }
            }
            

          //If we're still here, update node and open editor
            node.inputs[outputID] = inputNode;
            node.ondblclick();
        });
        drawflow.on('nodeRemoved', function(nodeID) {
            removeInputs(nodes, nodeID);
            delete nodes[nodeID+""];
        });
        drawflow.on('connectionRemoved', function(info) {
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            var node = nodes[inputID];
            delete node.inputs[outputID+""];
        });
        drawflow.on('contextmenu', function(e) {
            setTimeout(function(){
                for (var key in nodes) {
                    if (nodes.hasOwnProperty(key)){
                        var node = nodes[key];
                        var parentNode = node.parentNode.parentNode;
                        var deleteDiv = parentNode.getElementsByClassName("drawflow-delete")[0];
                        if (deleteDiv){
                            parentNode.removeChild(deleteDiv);
                            deleteDiv = document.createElement("div");
                            deleteDiv.className = "drawflow-delete2";
                            parentNode.appendChild(deleteDiv);
                            deleteDiv.innerHTML = "&#x2715";
                            deleteDiv.nodeID = parseInt(key);
                            deleteDiv.onclick = function(){
                                var div = this;
                                var nodeID = div.nodeID;
                                confirm("Are you sure you want to delete this node?",{
                                    leftButton: {label: "Yes", value: true},
                                    rightButton: {label: "No", value: false},
                                    callback: function(yes){
                                        if (yes){
                                            drawflow.removeNodeId("node-"+nodeID);
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


      //Create menubar
        var menubar = document.createElement("div");
        menubar.className = "drawflow-toolbar";
        div.appendChild(menubar);
        createMenuButton("addData", "fas fa-database", "Data", menubar);
        createMenuButton("pieChart", "fas fa-chart-pie", "Pie Chart", menubar);
        createMenuButton("barChart", "fas fa-chart-bar", "Bar Chart", menubar);
        createMenuButton("lineChart", "fas fa-chart-line", "Line Chart", menubar);
        createMenuButton("scatterChart", "fas fa-braille", "Scatter Chart" , menubar);
        createMenuButton("map", "fas fa-map-marked-alt", "Map", menubar);
        createMenuButton("sankeyChart", "fas fa-random", "Sankey", menubar);
        createMenuButton("supplyChain", "fas fa-link", "Supply Chain", menubar);
        createMenuButton("layout", "fas fa-border-all", "Layout", menubar);
    };


  //**************************************************************************
  //** setZoom
  //**************************************************************************
    var setZoom = function(z){
        // console.log("set zoom function called here ")
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
        // console.log(`zoom in function called, should be spammy.`)
        drawflow.zoom_in();
        zoom++;
    };


  //**************************************************************************
  //** zoomOut
  //**************************************************************************
    var zoomOut = function(){
        // console.log(`zoom out function called, should be spammy.`)
        drawflow.zoom_out();
        zoom--;
    };


  //**************************************************************************
  //** drag
  //**************************************************************************
    var drag = function(ev) {
        console.log(`drag function called with this obj`, {object_printed:ev})
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
        console.log(`drop fucntion called to place the node probably `,{ev_object:ev})
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
        console.log(`add drawflow node to canvas`)
      //Don't add node if the view is "fixed"
        if (drawflow.editor_mode === "fixed")  return false;


      //Update x/y position
      console.log(`retrieving x/y coordinates for this node to be placed`)
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

        console.log("the resulting variable values are", {x:pos_x,y:pos_y})

     //Get toolbar button associated with the nodeType
        var btn = button[nodeType];
        if (!btn){
            console.log("Unsupported Node Type: " + nodeType);
            return;
        }

      //Get button icon and title to decorate the node
        var icon = btn.el.dataset["icon"];
        var title = btn.el.dataset["title"];
        var i = document.createElement("i");
        i.className = icon;


        button["save"].enable();
        if (id){
            button["edit"].enable();
            button["delete"].enable();
        }


    // there are a few different forms of data that are used to generate a new chart and edit a new chart
      //Create node
        switch (nodeType) {
            case "addData":

                var node = createNode({
                    name: "Input Data",
                    type: nodeType,
                    icon: icon,
                    content: i,
                    position: [pos_x, pos_y],
                    inputs: 0,
                    outputs: 1
                });

                addEventListeners(node);
                node.ondblclick();

                break;
            case "transformData":

                var node = createNode({
                    name: "Transform Data",
                    type: nodeType,
                    icon: "fas fa-table",
                    content: "Db Click here",
                    position: [pos_x, pos_y],
                    inputs: 1,
                    outputs: 1
                });

                break;
            case "supplyChain":

                var node = createNode({
                    name: title,
                    type: nodeType,
                    icon: icon,
                    content: i,
                    position: [pos_x, pos_y],
                    inputs: 0,
                    outputs: 1
                });

                addEventListeners(node);

                break;
            case "layout":

                var node = createNode({
                    name: title,
                    type: nodeType,
                    icon: icon,
                    content: i,
                    position: [pos_x, pos_y],
                    inputs: 1,
                    outputs: 0
                });

                addEventListeners(node);

                break;

            default:

                var node = createNode({
                    name: title,
                    type: nodeType,
                    icon: icon,
                    content: i,
                    position: [pos_x, pos_y],
                    inputs: 1,
                    outputs: 1
                });

                addEventListeners(node);
        }
    };


  //**************************************************************************
  //** addEventListeners
  //**************************************************************************
    var addEventListeners = function(node){
        // console.log("add event listeners called")
        switch (node.type) {
            case "addData":
                console.log("addData case noted")
                node.ondblclick = function(){
                    console.log("addData node clicked- event listener")
                    showQuery(this.config.query, function(){
                        var grid = dbView.getComponents().grid;
                        var query = dbView.getQuery();
                        if (query.length==0){
                            //Ignore when query is empty
                            dbView.hide();
                        }
                        else{

                          //Update buttons
                            updateButtons();

                          //Update node
                            if (query!==this.config.query){

                              //Update config
                                this.config.query = query;
                                if (grid) this.config.columns = grid.getConfig().columns;


                              //Update csv
                                this.csv = null;
                                getCSV(query, function(csv){
                                    this.csv = csv;
                                    updateButtons();
                                }, this);


                              //Create thumbnail
                                if (grid){
                                    waitmask.show();
                                    createPreview(grid.el, function(canvas){
                                        if (typeof canvas === "string"){
                                            var error = canvas;
                                            console.log(error);
                                        }
                                        else{
                                            this.preview = canvas.toDataURL("image/png");
                                            createThumbnail(this, canvas);
                                        }
                                        dbView.hide();
                                        waitmask.hide();
                                    }, this);
                                }
                                else{
                                    dbView.hide();
                                }

                                //TODO: Find and notify nodes that rely on this node

                            }
                            else{

                                if (!this.csv){
                                    getCSV(query, function(csv){
                                        this.csv = csv;
                                        updateButtons();
                                    }, this);
                                };

                                dbView.hide();
                            }

                        }
                    }, this);
                };


                break;
            case "transformData":


                break;
            case "sankeyChart":
                node.ondblclick = function(){
                    editSankey(this);
                };

                break;
            case "scatterChart" :

                node.ondblclick = function(){
                    editScatter(this);
                };
                break;
            case "supplyChain":

                node.ondblclick = function(){
                    editSupplyChain(this);
                };

                break;
            case "layout":

                node.ondblclick = function(){
                    editLayout(this);
                };

                break;
            case "map":
                node.ondblclick = function(){
                    editMap(this);
                };

                break;
            default:

                node.ondblclick = function(){
                    var hasData = false;
                    var inputs = this.inputs;
                    for (var key in inputs) {
                        if (inputs.hasOwnProperty(key)){
                            if (inputs[key].csv){
                                hasData = true;
                                break;
                            }
                        }
                    }
                    if (hasData){
                        editChart(this);
                    }
                };
        }
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
        div.config = {};
        nodes[nodeID+""] = div;
        return div;
    };


  //**************************************************************************
  //** showQuery
  //**************************************************************************
    var showQuery = function(query, callback, scope){
        console.log("show query called")
        if (!dbView){

            var win = createNodeEditor({
                title: "Query",
                width: 1020,
                height: 600,
                beforeClose: function(){
                    dbView.onClose();
                }
            });


            var body = win.getBody();
            var div = document.createElement("div");
            div.style.height = "100%";
            div.style.overflow = "hidden";
            div.style.borderRadius = "0 0 5px 5px";
            body.appendChild(div);



            dbView = new javaxt.express.DBView(div, {
                waitmask: waitmask,
                queryLanguage: "cypher",
                queryService: "query/job/",
                getTables: function(tree){
                    waitmask.show();
                    get("graph/nodes", {
                        success: function(nodes){
                            waitmask.hide();

                          //Parse response
                            var arr = [];
                            for (var i=0; i<nodes.length; i++){
                                var nodeName = nodes[i].node;
                                if (nodeName){
                                    arr.push({name: nodes[i].node});
                                }
                            }
                            arr.sort(function(a, b){
                                return a.name.localeCompare(b.name);
                            });

                          //Add nodes to the tree
                            tree.addNodes(arr);
                        },
                        failure: function(request){
                            if (waitmask) waitmask.hide();
                            alert(request);
                        }
                    });
                },
                style:{
                    table: javaxt.dhtml.style.default.table,
                    toolbar: javaxt.dhtml.style.default.toolbar,
                    toolbarButton: javaxt.dhtml.style.default.toolbarButton,
                    toolbarIcons: {
                        run: "fas fa-play",
                        cancel: "fas fa-stop"
                    }
                }
            });

            dbView.show = function(){
                win.show();
            };

            dbView.hide = function(){
                win.hide();
            };
        }

        dbView.onClose = function(){
            if (callback) callback.apply(scope, []);
        };

        dbView.setQuery(query);
        dbView.show();
    };


  //**************************************************************************
  //** editChart
  //**************************************************************************
    var editChart = function(node){
        if (!chartEditor){

            var win = createNodeEditor({
                title: "Edit Chart",
                width: 1060,
                height: 600,
                beforeClose: function(){
                    var chartConfig = chartEditor.getConfig();
                    var node = chartEditor.getNode();
                    var orgConfig = node.config;
                    if (!orgConfig) orgConfig = {};
                    if (isDirty(chartConfig, orgConfig)){
                        node.config = chartConfig;
                        waitmask.show();
                        var el = chartEditor.getChart();
                        createPreview(el, function(canvas){
                            node.preview = canvas.toDataURL("image/png");
                            createThumbnail(node, canvas);
                            updateTitle(node, node.config.chartTitle);
                            win.close();
                            waitmask.hide();
                        }, this);
                    }
                    else{
                        win.close();
                    }
                }
            });

            chartEditor = new bluewave.ChartEditor(win.getBody(), config);

            chartEditor.show = function(){
                win.show();
            };

            chartEditor.hide = function(){
                win.hide();
            };
        }


        var data = [];
        for (var key in node.inputs) {
            if (node.inputs.hasOwnProperty(key)){
                var csv = node.inputs[key].csv;
                data.push(csv);
            }
        }
        chartEditor.update(node.type, node.config, data, node);

        chartEditor.show();
    };


  //**************************************************************************
  //** updateTitle
  //**************************************************************************
  /** Updates the title of a drawflow node
   */
    var updateTitle = function(node, title) {
        console.log("updating the title of drawflow node 1432")
        if (title) {
            node.childNodes[0].getElementsByTagName("span")[0].innerHTML = title;
        }
    };


  //**************************************************************************
  //** editMap
  //**************************************************************************
    var editMap = function(node){
        console.log('edit map called')
        if(!mapEditor){
            var win = createNodeEditor({
                title: "Edit Map",
                width: 1680,
                height: 920,
                resizable: true,
                beforeClose: function(){
                    var chartConfig = mapEditor.getConfig();
                    var node = mapEditor.getNode();
                    var orgConfig = node.config;
                    if(!orgConfig) orgConfig = {};
                    if(isDirty(chartConfig, orgConfig)){
                        node.config = chartConfig;
                        updateTitle(node, node.config.chartTitle);
                        waitmask.show();
                        var el = mapEditor.getChart();
                        if(el.show) el.show();
                        createPreview(el, function(canvas){
                            node.preview = canvas.toDataURL("image/png");
                            createThumbnail(node, canvas);
                            win.close();
                            waitmask.hide();
                        }, this);
                    }
                    else{
                        updateTitle(node, node.config.chartTitle);
                        win.close();
                    }
                    button.layout.enable();
                }
            });

            mapEditor = new bluewave.charts.MapEditor(win.getBody(), config);

            mapEditor.show = function(){
                win.show();
            };

            mapEditor.hide = function(){
                win.hide();
            };
        }


      //Add custom getNode() method to the mapEditor to return current node
        mapEditor.getNode = function(){
            return node;
        };


        var data = [];
        for (var key in node.inputs) {
            if (node.inputs.hasOwnProperty(key)){
                var csv = node.inputs[key].csv;
                if(csv === undefined){
                    var inputConfig = node.inputs[key].config;
                    data.push(inputConfig);
                }else {
                    data.push(csv);
                }
            }
        }
        mapEditor.update(node.config, data);
        mapEditor.show();
    };


  //**************************************************************************
  //** editSankey
  //**************************************************************************
    var editSankey = function(node){
        console.log("edit sankey called")
        if (!sankeyEditor){
            var win = createNodeEditor({
                title: "Edit Sankey",
                width: 1680,
                height: 920,
                resizable: true,
                beforeClose: function(){
                    var chartConfig = sankeyEditor.getConfig();
                    var node = sankeyEditor.getNode();
                    var orgConfig = node.config;
                    if (!orgConfig) orgConfig = {};
                    if (isDirty(chartConfig, orgConfig)){
                        node.config = chartConfig;
                        updateTitle(node, node.config.chartTitle);
                        waitmask.show();
                        var el = sankeyEditor.getChart();
                        if (el.show) el.show();
                        createPreview(el, function(canvas){
                            node.preview = canvas.toDataURL("image/png");
                            createThumbnail(node, canvas);
                            win.close();
                            waitmask.hide();
                        }, this);
                    }
                    else{
                        updateTitle(node, node.config.chartTitle);
                        win.close();
                    }
                    button.layout.enable();
                }
            });


            console.log("here a new sankey is getting rendered ")
            console.log(config)
            console.log("config ^")
            console.log(win.getBody())
            console.log("body above ")

            sankeyEditor = new bluewave.charts.SankeyEditor(win.getBody(), config);
            console.log("attempt to grab the sankeyEditor object")
            console.log(sankeyEditor)
            console.log()
            sankeyEditor.show = function(){
                console.log("show command called for sankey")
                win.show();
            };

            sankeyEditor.hide = function(){
                console.log("hide command called for sankey")

                win.hide();
            };
        }

      //Add custom getNode() method to the layoutEditor to return current node
        sankeyEditor.getNode = function(){
            return node;
        };


        
      //Special for supply chain inputs
        var inputs = [];
        for (var key in node.inputs) {
            if (node.inputs.hasOwnProperty(key)){
                var inputNode = node.inputs[key];
                if (inputNode.type==="supplyChain"){
                    var inputConfig = inputNode.config;
                    if (inputConfig) inputs.push(inputConfig);
                }

            }
        }
        


        sankeyEditor.update(node.config, inputs);
        sankeyEditor.show();
    };


  //**************************************************************************
  //** editScatter
  //**************************************************************************
    var editScatter = function(node){
        if (!scatterEditor){
            var win = createNodeEditor({
                 title: "Edit Scatter Chart",
                 width: 1060,
                 height: 600,
                 beforeClose: function(){
                     var scatterConfig = scatterEditor.getConfig();
                     var node = scatterEditor.getNode();
                     var orgConfig = node.config;
                     if (!orgConfig) orgConfig = {};
                     if (isDirty(scatterConfig, orgConfig)){
                         node.config = scatterConfig;
                         waitmask.show();
                         var el = scatterEditor.getChart();
                         createPreview(el, function(canvas){
                             node.preview = canvas.toDataURL("image/png");
                             createThumbnail(node, canvas);
                             updateTitle(node, node.config.chartTitle);
                             win.close();
                             waitmask.hide();
                         }, this);
                     }
                     else{
                         win.close();
                     }
                 }
            });

            scatterEditor = new bluewave.charts.ScatterEditor(win.getBody(), config);

            scatterEditor.show = function(){
              win.show();
            };

            scatterEditor.hide = function(){
              win.hide();
            };
        }


      //Add custom getNode() method to the scatterEditor to return current node
        scatterEditor.getNode = function(){
            return node;
        };


        var data = [];
        for (var key in node.inputs) {
            if (node.inputs.hasOwnProperty(key)){
                var csv = node.inputs[key].csv;
                data.push(csv);
            }
        }

        scatterEditor.update(node.config, data);
        scatterEditor.show();
    };


  //**************************************************************************
  //** removeInputs
  //**************************************************************************
    var removeInputs = function(nodes, nodeID){
        for(var key in nodes){
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                for(var inputID in node.inputs){
                    if(inputID === nodeID){
                        delete node.inputs[nodeID+""];
                    }
                }
            }
        }
    };


  //**************************************************************************
  //** editSupplyChain
  //**************************************************************************
    var editSupplyChain = function(node){
        if (!supplyChainEditor){
            var win = createNodeEditor({
                title: "Edit Supply Chain",
                width: 1680,
                height: 920,
                resizable: true,
                beforeClose: function(){
                    var chartConfig = supplyChainEditor.getConfig();
                    var node = supplyChainEditor.getNode();
                    var orgConfig = node.config;
                    if (!orgConfig) orgConfig = {};
                    if (isDirty(chartConfig, orgConfig)){
                        node.config = chartConfig;
                        updateTitle(node, node.config.chartTitle);
                        waitmask.show();
                        var el = supplyChainEditor.getChart();
                        if (el.show) el.show();
                        createPreview(el, function(canvas){
                            node.preview = canvas.toDataURL("image/png");
                            createThumbnail(node, canvas);
                            win.close();
                            waitmask.hide();
                            me.save();
                        }, this);
                    }
                    else{
                        updateTitle(node, node.config.chartTitle);
                        win.close();
                    }
                    button.layout.enable();
                }
            });


            supplyChainEditor = new bluewave.charts.SupplyChainEditor(win.getBody(), config);

            supplyChainEditor.show = function(){
                win.show();
            };

            supplyChainEditor.hide = function(){
                win.hide();
            };


            var save = function(){
                var chartConfig = supplyChainEditor.getConfig();
                var node = supplyChainEditor.getNode();
                node.config = chartConfig;
                me.save();

                //TODO: Update thumbnail?
            };


          //Automatically update dashboard whenever the graph is updated in the supplyChainEditor
            supplyChainEditor.onSave = function(){
                save();
            };

            supplyChainEditor.onChange = function(){
                save();
            };
        }

      //Add custom getNode() method to the layoutEditor to return current node
        supplyChainEditor.getNode = function(){
            return node;
        };

        supplyChainEditor.update(node.config);
        supplyChainEditor.show();
    };


  //**************************************************************************
  //** editLayout
  //**************************************************************************
    var editLayout = function(node){

      //Create layoutEditor as needed
        if (!layoutEditor){
            var win = createNodeEditor({
                title: "Edit Layout",
                width: 1425, //Up to 4 dashboard items at 250px width
                height: 839,
                resizable: true,
                beforeClose: function(){
                    var chartConfig = layoutEditor.getConfig();
                    var node = layoutEditor.getNode();
                    var orgConfig = node.config;
                    if (!orgConfig) orgConfig = {};
                    if (isDirty(chartConfig, orgConfig)){
                        node.config = chartConfig;
                        waitmask.show();
                        var el = layoutEditor.getChart();
                        if (el.show) el.show();
                        createPreview(el, function(canvas){
                            thumbnail = canvas.toDataURL("image/png");
                            node.preview = thumbnail;
                            createThumbnail(node, canvas);
                            win.close();
                            waitmask.hide();
                        }, this);
                    }
                    else{
                        win.close();
                    }
                }
            });


            layoutEditor = new bluewave.charts.Layout(win.getBody(), config);
            layoutEditor.el.style.borderRadius = "0 0 5px 5px";

            layoutEditor.show = function(){
                win.show();
            };

            layoutEditor.hide = function(){
                win.hide();
            };
        }


      //Add custom getNode() method to the layoutEditor to return current node
        layoutEditor.getNode = function(){
            return node;
        };


      //Generate list of inputs for the layoutEditor
        var inputs = {};
        for (var inputID in node.inputs) {
            if (node.inputs.hasOwnProperty(inputID)){
                var inputNode = node.inputs[inputID];
                inputs[inputID] = {
                    title: inputNode.config.chartTitle,
                    image: inputNode.preview,
                    type: inputNode.type
                };
            }
        }


      //Update and show layoutEditor
        layoutEditor.update(inputs, node.config);
        layoutEditor.show();
    };


  //**************************************************************************
  //** createNodeEditor
  //**************************************************************************
    var createNodeEditor = function(conf){


        merge(conf, {
            title: "Edit Chart",
            width: 1060,
            height: 600,
            resizable: false,
            beforeClose: null
        });


        var style = merge({
            body: {
                padding: "0px"
            },
            closeIcon: {
                //content: "&#10006;",
                content: "&#x2715;",
                lineHeight: "16px",
                textAlign: "center"
            }
        }, config.style.window);


        var win = createWindow({
            title: conf.title,
            width: conf.width,
            height: conf.height,
            //valign: "top",
            modal: true,
            resizable: conf.resizable,
            shrinkToFit: true,
            style: style,
            renderers: {

              //Create custom renderer for the close button. Basically, we
              //want to delay closing the window until after the thumbnail
              //is created
                headerButtons: function(buttonDiv){
                    var btn = document.createElement('div');
                    setStyle(btn, style.button);
                    var icon = document.createElement('div');
                    setStyle(icon, style.closeIcon);
                    btn.appendChild(icon);
                    btn.onclick = function(){
                        if (conf.beforeClose) conf.beforeClose.apply(me, [win]);
                        else win.close();
                    };
                    buttonDiv.appendChild(btn);
                }
            }
        });

        return win;
    };


  //**************************************************************************
  //** createWindow
  //**************************************************************************
    var createWindow = function(config){
        var win = new javaxt.dhtml.Window(document.body, config);
        windows.push(win);
        return win;
    };


  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(el, callback, scope){
        html2canvas(el)
        .then((canvas) => {
            if (callback) callback.apply(scope, [canvas]);
        })
        .catch(function(error){
            if (callback) callback.apply(scope, ["Preview Failed: " + error]);
        });
    };


  //**************************************************************************
  //** createThumbnail
  //**************************************************************************
  /** Inserts a PNG image into a node
   */
    var createThumbnail = function(node, obj){

        var el = node.childNodes[1];
        el.innerHTML = "";
        var rect = javaxt.dhtml.utils.getRect(el);
        var width = rect.width;
        var height = rect.height;

        var div = document.createElement('div');
        div.style.width = "100%";
        div.style.height = "100%";
        el.appendChild(div);
        var rect = javaxt.dhtml.utils.getRect(div);
        el.innerHTML = "";
        var padding = width-rect.width;
        var maxWidth = width-padding;
        var maxHeight = height-padding;
        var width = 0;
        var height = 0;

        var setWidth = function(){
            var ratio = maxWidth/width;
            width = width*ratio;
            height = height*ratio;
        };

        var setHeight = function(){
            var ratio = maxHeight/height;
            width = width*ratio;
            height = height*ratio;
        };

        var resize = function(canvas){
            console.log("resize window called")
            width = canvas.width;
            height = canvas.height;

            if (maxHeight<maxWidth){
                setHeight();
                if (width>maxWidth) setWidth();
            }
            else{
                setWidth();
                if (height>maxHeight) setHeight();
            }


            resizeCanvas(canvas, width, height, true);
            var base64image = canvas.toDataURL("image/png");

            var img = document.createElement('img');
            img.className = "noselect";
            img.style.width = "100%";
            img.onload = function() {
                el.appendChild(this);
            };
            img.src = base64image;
            img.ondragstart = function(e){
                e.preventDefault();
            };
        };


        if (typeof obj === "string"){ //base64 encoded image
            var img = document.createElement('img');
            img.onload = function() {
                var img = this;

                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resize(canvas);
            };
            img.src = obj;
        }
        else{ //HTMLCanvasElement
            resize(obj);
        }
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

        post("query", JSON.stringify(payload), {
            success : function(text){
                callback.apply(scope, [text]);
            },
            failure: function(response){
                alert(response);
            }
        });
    };


  //**************************************************************************
  //** createMenuButton
  //**************************************************************************
    var createMenuButton = function(nodeType, icon, title, parent){


      //Create button
        var btn = new javaxt.dhtml.Button(parent, {
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
  //** getName
  //**************************************************************************
    var getName = function(callback){
        if (!name){
            editName(null, callback);
        }
        else{
            checkName(name, function(isValid){
                if (!isValid){
                    editName(name, callback);
                }
                else{
                    callback.apply(me,[{
                        name: name
                    }]);
                }
            });
        }
    };


  //**************************************************************************
  //** checkName
  //**************************************************************************
    var checkName = function(name, callback){
        get("dashboards?fields=id,name",{
            success: function(dashboards) {
                var isValid = true;
                for (var i in dashboards){
                    var dashboard = dashboards[i];
                    if (dashboard.name.toLowerCase()===name.toLowerCase()){
                        if (dashboard.id!==id){
                            isValid = false;
                            break;
                        }
                    }
                }
                callback.apply(me,[isValid]);
            },
            failure: function(request){
                alert(request);
                callback.apply(me,[false]);
            }
        });
    };


  //**************************************************************************
  //** editName
  //**************************************************************************
    var editName = function(name, callback){
        if (!nameEditor){
            var win = createWindow({
                title: "Save Dashboard",
                width: 450,
                valign: "top",
                modal: true,
                style: config.style.window
            });

            var form = new javaxt.dhtml.Form(win.getBody(), {
                style: config.style.form,
                items: [
                    {
                        name: "name",
                        label: "Name",
                        type: "text"
                    },
                    {
                        name: "description",
                        label: "Description",
                        type: "textarea"
                    }
                ],
                buttons: [
                    {
                        name: "Cancel",
                        onclick: function(){
                            form.clear();
                            win.close();
                        }
                    },
                    {
                        name: "Submit",
                        onclick: function(){

                            var inputs = form.getData();
                            var name = inputs.name;
                            if (name) name = name.trim();
                            if (name==null || name==="") {
                                warn("Name is required", form.findField("name"));
                                return;
                            }

                            waitmask.show();
                            checkName(name, function(isValid){
                                waitmask.hide();
                                if (!isValid){
                                    warn("Name is not unique", form.findField("name"));
                                }
                                else{
                                    win.close();
                                    nameEditor.onSubmit(inputs);
                                }
                            });
                        }
                    }
                ]

            });

            nameEditor = form;
            nameEditor.show = function(){
                win.show();
            };
        }

        nameEditor.clear();
        var nameField = nameEditor.findField("name");
        if (nameField.resetColor) nameField.resetColor();
        if (name) nameEditor.setValue("name", name);

        nameEditor.onSubmit = function(inputs){
            if (callback) callback.apply(me,[inputs]);
        };

        waitmask.hide();
        nameEditor.show();
    };


  //**************************************************************************
  //** editUsers
  //**************************************************************************
    var editUsers = function(){
        if (!userManager){
            var win = createWindow({
                title: "Manage Access",
                width: 650,
                height: 500,
                valign: "top",
                modal: true,
                resizable: true,
                shrintToFit: true,
                style: merge({body: {padding:0}},config.style.window)
            });

            userManager = new bluewave.Permissions(win.getBody(),config);

            userManager.show = function(){
                win.show();
            };
        }

        userManager.update(id);
        userManager.show();
    };


  //**************************************************************************
  //** checkConnection
  //**************************************************************************
    var checkConnection = function(layoutNode, node){
        var connected = false;
        for (var inputID in layoutNode.inputs){
            var tempNode = nodes[inputID];
            if (tempNode === node){
                connected = true;
            }
        }
        return connected;
    };


  //**************************************************************************
  //** updateDashboard
  //**************************************************************************
    var updateDashboard = function(){
        console.log("update dashboard called")

      //Find layout node
        var layoutNode;
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                if (node.type==="layout"){
                    layoutNode = node;
                    break;
                }
            }
        };
        if (!layoutNode) return;


      //TODO: Check if layout is dirty
        var isDirty = true;
        if (!isDirty) return;
        dashboardPanel.innerHTML = "";


      //Render dashboard items
        for (var key in layoutNode.config) {
            if (layoutNode.config.hasOwnProperty(key)){
                var rect = layoutNode.config[key];
                var node = nodes[key];
                var connected = checkConnection(layoutNode, node);
                if (!connected) continue;
                if (!node) continue;
                var chartConfig = node.config;
                if (!chartConfig) chartConfig = {};
                var title = chartConfig.chartTitle;

                var dashboardItem = createDashboardItem(dashboardPanel,{
                    width: rect.w,
                    height: rect.h,
                    title: title,
                    subtitle: ""
                });

                var div = dashboardItem.el;
                div.style.position = "absolute";
                div.style.top = rect.y + "px";
                div.style.left = rect.x + "px";


                if (node.type==="addData"){
                    div.style.padding = "0px";

                    var grid = new javaxt.dhtml.DataGrid(dashboardItem.innerDiv, {
                        columns: chartConfig.columns,
                        style: config.style.table,
                        url: "query",
                        payload: JSON.stringify({
                            query: chartConfig.query,
                            format: "csv"
                        }),
                        limit: 50,
                        parseResponse: function(request){
                            var rows = parseCSV(request.responseText);
                            rows.shift(); //remove first row (csv header)
                            return rows;
                        }
                    });


                    if (node.csv){
                        var rows = parseCSV(node.csv);
                        rows.shift(); //remove first row (csv header)
                        grid.load(rows, 1);
                    }
                }
                else if (node.type==="sankeyChart" || node.type==="supplyChain"){
                    // console.log("detected that the node is sankey chart")
                    var data = {
                        nodes: [],
                        links: []
                    };
                    var nodetyper = node.type
                    var sankeyConfig = chartConfig;
                    for (var nodeID in sankeyConfig.nodes) {
                        if (sankeyConfig.nodes.hasOwnProperty(nodeID)){
                            var node = sankeyConfig.nodes[nodeID];
                            data.nodes.push({
                                name: node.name,
                                group: node.type
                            });
                        }
                    }
                    console.log({
                        nodes_requested:sankeyConfig.nodes,
                        nodes_rendered:data.nodes,
                        node_type:nodetyper,
                        chartconfig:chartConfig,
                        links:sankeyConfig.links,
                        



                    })
                    
                    for (var key in sankeyConfig.links) {
                        if (sankeyConfig.links.hasOwnProperty(key)){
                            var link = sankeyConfig.links[key];
                            var idx = key.indexOf("->");
                            var source = key.substring(0,idx);
                            var target = key.substring(idx+2);
                            data.links.push({
                                source: sankeyConfig.nodes[source].name,
                                target: sankeyConfig.nodes[target].name,
                                value: link.quantity
                            });
                        }
                    }
                    // console.log("got to 2350")
                    // console.log("current dashboard item is")
                    // console.log(dashboardItem)
                    // console.log("dashboard item above")
                    // console.log(dashboardItem.innerDiv)

                    var sankeyChart = new bluewave.charts.SankeyChart(dashboardItem.innerDiv,{});
                    // console.log("we created the sankey")
                    // console.log(sankeyChart);
                    // console.log("chart above")
                    // console.log(data);
                    // console.log("data above")

                    sankeyChart.update(data);
                    // console.log(dashboardItem.innerDiv)
                    // console.log("yeah - sankey")
                    // console.log("we would have updated the sankey")
                }
                else{

                    var data = [];
                    for (var key in node.inputs) {
                        if (node.inputs.hasOwnProperty(key)){
                            var csv = node.inputs[key].csv;
                            data.push(d3.csvParse(csv));
                        }
                    }

                    if (node.type==="pieChart"){
                        // console.log("logging the difference of piechart")
                        // console.log(dashboardItem)
                        // console.log("dashboard item above")
                        // var run1 = dashboardItem.innerDiv // "save " the current state of the dom to an object
                        // console.log(run1)
                        // return
                        var pieChart = new bluewave.charts.PieChart(dashboardItem.innerDiv,{});
                        pieChart.update(chartConfig, data);
                        // console.log("loggign the after the effects of piechart dashboard item")
                        // console.log(dashboardItem)
                        // console.log("new dashboard item above")
                        // var run2 = dashboardItem.innerDiv // "save " the current state of the dom to an object
                        // console.log(run2)
                        // console.log("yeah - piechart")
                    }
                    else if (node.type==="barChart"){
                        var barChart = new bluewave.charts.BarChart(dashboardItem.innerDiv,{});
                        barChart.update(chartConfig, data);
                    }
                    else if (node.type==="lineChart"){
                        var lineChart = new bluewave.charts.LineChart(dashboardItem.innerDiv,{});
                        lineChart.update(chartConfig, data);
                    }
                    else if (node.type==="scatterChart"){
                        var scatterChart = new bluewave.charts.ScatterChart(dashboardItem.innerDiv,{});
                        scatterChart.update(chartConfig, data);
                    }
                    else if (node.type==="map"){
                        var mapChart = new bluewave.charts.MapChart(dashboardItem.innerDiv,{});
                        mapChart.update(chartConfig,data);
                    }
                    else{
                        console.log(`map thing that is not being shown is (${node.type})<--- this here `)
                        console.log(node.type + " preview not implemented!");
                    }
                }
            }
        }

    };


  //**************************************************************************
  //** createToggleButton
  //**************************************************************************
    var createToggleButton = function(parent){

        var div = document.createElement("div");
        div.style.position = "absolute";
        div.style.top = "60px";
        div.style.right = "20px";
        div.style.zIndex = 2;
        parent.appendChild(div);


        var options = ["Edit","Preview"];
        toggleButton = bluewave.utils.createToggleButton(div, {
            options: options,
            defaultValue: options[0],
            onChange: function(val){
                if (val==="Edit"){
                    dashboardPanel.hide();
                    editPanel.show();
                }
                else{
                    editPanel.hide();
                    dashboardPanel.show();
                    updateDashboard();
                }
            }
        });
        addShowHide(toggleButton);
    };


  //**************************************************************************
  //** createMask
  //**************************************************************************
    var createMask = function(parent){
        // console.log("mask is being called ")
        var div = document.createElement("div");
        div.style.position = "absolute";
        div.style.zIndex = 3;
        div.style.top = "0px";
        div.style.width = "100%";
        div.style.height = "100%";
        div.style.backgroundColor = "#f5f5f5"; //maybe put this in main.css?
        addShowHide(div);
        div.hide();
        parent.appendChild(div);
        mask = div;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createSpacer = bluewave.utils.createSpacer;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var isDirty = javaxt.dhtml.utils.isDirty;
    var setStyle = javaxt.dhtml.utils.setStyle;
    var resizeCanvas = bluewave.utils.resizeCanvas;
    var base64ToBlob = bluewave.utils.base64ToBlob;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var parseCSV = bluewave.utils.parseCSV;
    var warn = bluewave.utils.warn;
    var post = javaxt.dhtml.utils.post;
    var del = javaxt.dhtml.utils.delete;
    var get = bluewave.utils.get;


    init();
};