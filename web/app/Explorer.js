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
    var arrow;
    var tooltip, tooltipTimer, lastToolTipEvent; //tooltip
    var drawflow, nodes = {}; //drawflow
    var dbView, lineEditor, barEditor, sankeyEditor, layoutEditor, nameEditor,
    histogramEditor, supplyChainEditor, pieEditor, scatterEditor, mapEditor, calendarEditor, treeMapEditor, userManager,
    fileViewer, docComparer; //popup dialogs
    var windows = [];
    var zoom = 0;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        if (!config.fx) config.fx = new javaxt.dhtml.Effects();
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


      //Create dashboard panel
        dashboardPanel = createDashboard(innerDiv);
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
        editPanel.tabIndex = -1;
        createEditPanel(editPanel);
        addShowHide(editPanel);
        innerDiv.appendChild(editPanel);



        parent.appendChild(div);
        me.el = div;
        addShowHide(me);
        addResizeListener(div, updateLayout);
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
        dashboardPanel.clear();

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


      //Set mouse focus
        editPanel.focus();


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
        var thumbnails = [];
        var connectionNodes = [];
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


              //Special case for older maps
                if (node.type==="map") node.type = "mapChart";


              //Update title
                if (props.config.chartTitle) updateTitle(node, props.config.chartTitle);


              //Check if there's a thumbnail/preview. If so, we'll render it later
                if (props.preview) thumbnails.push({
                    node: node,
                    thumbnail: props.preview
                });



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
                            connectionNodes.push(inputID);
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
            setTimeout(function(){
                if (me.getView()!=="Dashboard"){

                  //Update connections
                    for (var i=0; i<connectionNodes.length; i++){
                        var inputID = connectionNodes[i];
                        drawflow.updateConnectionNodes("node-"+inputID);
                    }

                  //Update thumbnails
                    for (var i=0; i<thumbnails.length; i++){
                        (function (t) {
                            var el = t.node.childNodes[1];
                            onRender(el, function(){
                                createThumbnail(t.node, t.thumbnail);
                            });
                        })(thumbnails[i]);
                    }

                    setZoom(dashboard.info.zoom);
                }

                mask.hide();
                editPanel.focus();

            },500); //slight delay for drawflow
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
                        onReady();
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
                }
            };
            timer = setTimeout(checkMask, 100);
        }
        else{
            onReady();
        }
    };


  //**************************************************************************
  //** updateButtons
  //**************************************************************************
    var updateButtons = function(){
        arrow.hide();

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


              //Enable map and pieChart buttons as needed
                var numNodes = 0;
                for (var key in nodes) {
                    if (nodes.hasOwnProperty(key)){
                        var node = nodes[key];
                        if (node.type==="supplyChain" || node.type==="sankeyChart"){
                            button.pieChart.enable();
                        }
                        if (node.type==="supplyChain"){
                            button.mapChart.enable();
                        }
                        if (node.type==="pdf"){
                            button.compareDocs.enable();
                        }
                        numNodes++;
                    }
                }

                if (numNodes===0) arrow.show();

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
        return name ? name : "Untitled";
    };


  //**************************************************************************
  //** setView
  //**************************************************************************
  /** */
    this.setView = function(name){
        if (!name) name = "Edit";
        if (name==="Edit"){

            if (me.getView()==="Dashboard"){
                var dashboard = getDashboard(name);
                me.update(dashboard, false, "Edit");
            }
            else{
                toggleButton.setValue("Edit");
                toggleButton.show();
            }
        }
        else if (name==="Preview"){
            toggleButton.show();
            toggleButton.setValue("Preview");
        }
        else if (name==="Dashboard"){
            toggleButton.show();


            if (getLayoutNode()){
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
        return (drawflow.editor_mode==="view");
    };


  //**************************************************************************
  //** save
  //**************************************************************************
    this.save = function(callback){
        if (me.isReadOnly()){
            if (callback) callback();
            return;
        }


        waitmask.show(500);
        getName(function(formInputs){
            name = formInputs.name;


            var dashboard = getDashboard(name);


            post("dashboard", JSON.stringify(dashboard),{
                success: function(text) {
                    me.onUpdate();
                    id = parseInt(text);
                    updateButtons();
                    if (thumbnail){
                        saveThumbnail(id, function(request){
                            waitmask.hide();
                            if (callback) callback();
                            if (request.status===200){

                            }
                            else{
                                alert(request);
                            }
                        });
                    }
                    else{
                        waitmask.hide();
                        if (callback) callback();
                    }
                },
                failure: function(request){
                    alert(request);
                    waitmask.hide();
                    if (callback) callback();
                }
            });
        });
    };


  //**************************************************************************
  //** saveThumbnail
  //**************************************************************************
    var saveThumbnail = function(id, callback){
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
  //** getDashboard
  //**************************************************************************
    var getDashboard = function(name){
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
        return dashboard;
    };


  //**************************************************************************
  //** getLayoutNode
  //**************************************************************************
  /** Returns the first layout node
   */
    var getLayoutNode = function(){
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                if (node.type==="layout"){
                    return node;
                }
            }
        }
        return null;
    };


  //**************************************************************************
  //** getFileNodes
  //**************************************************************************
  /** Returns an array of nodes associated with a file
   */
    var getFileNodes = function(){
        var fileNodes = [];
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                if (node.type==="pdf" || node.type==="csv"){
                    fileNodes.push(node);
                }
            }
        }
        return fileNodes;
    };


  //**************************************************************************
  //** createEditPanel
  //**************************************************************************
    var createEditPanel = function(parent){

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
        div.addEventListener('dragover', onDragOver, false);
        div.addEventListener('drop', onDrop, false);
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



            var acceptConnection = function(){
                node.inputs[outputID] = inputNode;
                node.ondblclick();
            };

            var removeConnection = function(){
                drawflow.removeSingleConnection(info.output_id, info.input_id, info.output_class, info.input_class);
            };


            if (node.type === "mapChart"){
                if (inputNode.type == "addData" || inputNode.type == "supplyChain"){
                    acceptConnection();
                }
                else{
                   removeConnection();
                }
            }
            else if (node.type === "pieChart"){
                if (inputNode.type == "addData" || inputNode.type == "sankeyChart" || inputNode.type == "supplyChain"){
                    acceptConnection();
                }
                else{
                   removeConnection();
                }
            }
            else if (node.type === "sankeyChart"){
                if (inputNode.type == "supplyChain"){
                    acceptConnection();
                }
                else{
                   removeConnection();
                }
            }
            else if (node.type === "compareDocs"){
                if (inputNode.type === "pdf"){
                    acceptConnection();
                }
                else{
                   removeConnection();
                }
            }
            else{

              //For all other nodes, ensure that charts can't be connected to other charts
                if (node.type.indexOf("Chart")>0){
                    if (inputNode.type.indexOf("Chart")>0){
                        removeConnection();
                        return;
                    }
                }

              //If we're still here, accept the connection
                acceptConnection();
            }

        });
        drawflow.on('nodeRemoved', function(nodeID) {
            removeInputs(nodes, nodeID);
            var nodeType = nodes[nodeID+""].type;
            delete nodes[nodeID+""];
            if (nodeType==="layout" && !getLayoutNode()) toggleButton.hide();
            updateButtons();
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


      //Create toolbar
        var menubar = document.createElement("div");
        menubar.className = "drawflow-toolbar";
        div.appendChild(menubar);
        createMenuButton("addData", "fas fa-database", "Data", menubar);
        createMenuButton("pieChart", "fas fa-chart-pie", "Pie Chart", menubar);
        createMenuButton("barChart", "fas fa-chart-bar", "Bar Chart", menubar);
        createMenuButton("lineChart", "fas fa-chart-line", "Line Chart", menubar);
        createMenuButton("histogramChart", "fas fa-chart-area", "Histogram Chart", menubar);
        createMenuButton("scatterChart", "fas fa-braille", "Scatter Chart" , menubar);
        createMenuButton("mapChart", "fas fa-globe-americas", "Map", menubar);
        createMenuButton("treeMapChart", "fas fa-border-all", "Treemap Chart", menubar);
        createMenuButton("calendarChart", "fas fa-calendar-alt", "Calendar Chart", menubar);
        createMenuButton("sankeyChart", "fas fa-random", "Sankey", menubar);
        createMenuButton("supplyChain", "fas fa-link", "Supply Chain", menubar);
        createMenuButton("compareDocs", "fas fa-not-equal", "Document Analysis", menubar);
        createMenuButton("layout", "far fa-object-ungroup", "Layout", menubar);


      //Create little arrow/hint for the toolbar
        arrow = document.createElement("div");
        arrow.className = "drawflow-toolbar-hint noselect";
        arrow.style.display = "none";
        menubar.appendChild(arrow);
        arrow.show = function(){
            config.fx.fadeIn(this,"easeIn",500);
        };
        arrow.hide = function(){
            config.fx.fadeOut(this,"easeIn",100);
        };
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
  //** onDragOver
  //**************************************************************************
  /** Called when the client drags something over the canvas (e.g. file)
   */
    var onDragOver = function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy
    };


  //**************************************************************************
  //** onDrop
  //**************************************************************************
  /** Called when the client drops something onto the canvas (e.g. file or icon)
   */
    var onDrop = function(e) {

        e.stopPropagation();
        e.preventDefault();

        arrow.hide();

        if (e.type === "touchend") {
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

            var x = e.clientX;
            var y = e.clientY;

            var files = e.dataTransfer.files;
            if (files.length>0){
                waitmask.show(500);


              //Generate list of exsiting files in the canvas
                var existingFiles = {};
                var fileNodes = getFileNodes();
                for (var i=0; i<fileNodes.length; i++){
                    var fileNode = fileNodes[i];
                    var fileName = fileNode.config.fileName;
                    existingFiles[fileName.toLowerCase()] = fileNode;
                }


              //Generate list of files to upload
                var arr = [];
                for (var i=0; i<files.length; i++) {
                    var file = files[i];
                    var fileName = file.name.toLowerCase();
                    var ext = fileName.substring(fileName.lastIndexOf(".")+1);
                    if (ext==="csv" || ext==="pdf"){
                        if (existingFiles[fileName]){
                            //notify user?
                        }
                        else{
                            arr.push(file);
                        }
                    }
                }


              //Upload files to the server
                var uploads = 0;
                var failures = [];
                var upload = function(){

                    if (arr.length===0){
                        waitmask.hide();
                        if (failures.length>0){
                            alert("Failed to upload " + failures);
                        }
                        return;
                    }

                    var file = arr.shift();
                    var formData = new FormData();
                    formData.append(file.name, file);
                    post("document", formData, {
                        success: function(text){
                            var results = JSON.parse(text);
                            if (results[0].result==="error"){
                                failures.push(file.name);
                            }
                            else{

                                if (uploads>0){
                                    x+=35;
                                    y+=85;
                                }
                                uploads++;

                                addNodeToDrawFlow(ext, x, y, file);
                            }

                            upload();
                        },
                        failure: function(request){
                            failures.push(file.name);
                            upload();
                        }
                    });
                };
                upload();


            }
            else{
                let nodeType = e.dataTransfer.getData("node");
                addNodeToDrawFlow(nodeType, x, y);
            }
        }
    };


  //**************************************************************************
  //** addNodeToDrawFlow
  //**************************************************************************
    var addNodeToDrawFlow = function (nodeType, pos_x, pos_y, file) {

      //Don't add node if the view is "fixed"
        if (drawflow.editor_mode === "fixed")  return false;


      //Update x/y position
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



      //Set icon and title for the node
        var icon, title;
        var btn = button[nodeType];
        if (btn){
            icon = btn.el.dataset["icon"];
            title = btn.el.dataset["title"];
        }
        else{
            if (nodeType==="csv"){
                title = "CSV Data";
                icon = "fas fa-file-csv";
            }
            else if (nodeType==="pdf"){
                title = "PDF Document";
                icon = "fas fa-file-pdf";
            }
            else{
                console.log("Unsupported Node Type: " + nodeType);
                return;
            }
        }



      //Create icon
        var i = document.createElement("i");
        i.className = icon;


      //Update buttons
        button["save"].enable();
        if (id){
            button["edit"].enable();
            button["delete"].enable();
        }


      //Create node
        switch (nodeType) {

          //Nodes with output only
            case "addData":
            case "csv":
            case "pdf":

                if (file){
                    var content = document.createElement("div");
                    content.style.position = "relative";
                    content.style.overflow = "hidden";
                    var label = document.createElement("div");
                    label.className = "filename noselect";
                    label.innerText = file.name;
                    content.appendChild(label);
                    content.appendChild(i);
                    i = content;
                }

                var node = createNode({
                    name: title,
                    type: nodeType,
                    icon: icon,
                    content: i,
                    position: [pos_x, pos_y],
                    inputs: 0,
                    outputs: 1
                });

                if (file){
                    node.config.fileName = file.name;
                }

                addEventListeners(node);

                if (nodeType==="pdf"){
                    button["compareDocs"].enable();
                }
                else{
                    node.ondblclick();
                }

                break;

          //Nodes with input only
            case "layout":
            case "compareDocs":

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

          //Nodes with both inputs and outputs
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
        switch (node.type) {
            case "addData":

                node.ondblclick = function(){
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

            case "sankeyChart":

                node.ondblclick = function(){
                    editSankey(this);
                };

                break;
            case "scatterChart" :

                node.ondblclick = function(){

                    if (!scatterEditor){
                        scatterEditor = createNodeEditor({
                            title: "Edit Scatter Chart",
                            width: 1060,
                            height: 600,
                            editor: bluewave.charts.ScatterEditor
                        });
                    }

                    editChart(this, scatterEditor);
                };
                break;
            case "lineChart" :

                node.ondblclick = function(){

                    if (!lineEditor){
                        lineEditor = createNodeEditor({
                            title: "Edit Line Chart",
                            width: 1060,
                            height: 600,
                            resizable: true,
                            editor: bluewave.charts.LineEditor
                        });
                    }

                    editChart(this, lineEditor);
                };
                break;
            case "barChart" :

                node.ondblclick = function(){

                    if (!barEditor){
                        barEditor = createNodeEditor({
                            title: "Edit Bar Chart",
                            width: 1060,
                            height: 600,
                            resizable: true,
                            editor: bluewave.charts.BarEditor
                        });
                    }

                    editChart(this, barEditor);
                };
                break;
            case "calendarChart" :
                node.ondblclick = function(){

                    if (!calendarEditor){
                        calendarEditor = createNodeEditor({
                            title: "Edit Calendar Chart",
                            width: 1060,
                            height: 600,
                            resizable: true,
                            editor: bluewave.charts.CalendarEditor
                        });
                    }

                    editChart(this, calendarEditor);
                };
                break;
            case "treeMapChart" :
                node.ondblclick = function(){
                    if (!treeMapEditor){
                        treeMapEditor = createNodeEditor({
                            title: "Edit Tree Map Chart",
                            width: 1060,
                            height: 600,
                            resizable: true,
                            editor: bluewave.charts.TreeMapEditor
                        });
                    }
                    editChart(this, treeMapEditor);
                };
                break;

            case "histogramChart":
                node.ondblclick = function(){
                    if (!histogramEditor){
                        histogramEditor = createNodeEditor({
                            title: "Edit Histogram",
                            width: 1060,
                            height: 600,
                            resizable: true,
                            editor: bluewave.charts.HistogramEditor
                        });
                    }
                    editChart(this, histogramEditor);
                };
                break;

            case "pieChart" :

                node.ondblclick = function(){
                    editPie(this);
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
            case "mapChart":

                node.ondblclick = function(){
                    editMap(this);
                };

                break;

            case "pdf":

                node.ondblclick = function(){
                    renderFile(this);
                };

                break;


            case "compareDocs":

                node.ondblclick = function(){

                    var numInputs = 0;
                    var inputs = this.inputs;
                    for (var key in inputs) {
                        if (inputs.hasOwnProperty(key)){
                            numInputs++;
                        }
                    }

                    if (numInputs>1){
                        compareDocs(this);
                    }
                };

                break;

            default:

                break;
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
        if (!dbView){

            var win = createNodeEditor({
                title: "Query",
                width: 1020,
                height: 600,
                resizable: true,
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
                    get("graph/properties", {
                        success: function(nodes){
                            waitmask.hide();

                          //Parse response
                            var arr = [];
                            for (var i=0; i<nodes.length; i++){
                                var nodeName = nodes[i].node;
                                if (nodeName){
                                    arr.push({
                                        name: nodes[i].node,
                                        properties: nodes[i].properties
                                    });
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
                onTreeClick: function(item){
                    var cql = "MATCH (n:" + item.name + ")\n";
                    var properties = item.node.properties;
                    if (properties && properties.length>0){
                        cql += "RETURN\n";
                        //cql += "   ID(n) as node_id,\n";
                        for (var i=0; i<properties.length; i++){
                            if (i>0) cql +=",\n";
                            cql += "   n." + properties[i] + " as " + properties[i];
                        }
                    }
                    else{
                        cql += "RETURN ID(n) as id, properties(n) as " + item.name + " limit 10"
                    }
                    this.getComponents().editor.setValue(cql);
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
    var editChart = function(node, editor){

        editor.getNode = function(){
            return node;
        };


      //Get data
        var data = [];
        for (var key in node.inputs) {
            if (node.inputs.hasOwnProperty(key)){
                var csv = node.inputs[key].csv;
                data.push(csv);
            }
        }


      //Get config
        var chartConfig = {};
        merge(chartConfig, node.config);

        chartConfig.chartType = node.type; //is this used for anything?
        editor.update(chartConfig, data);
        editor.show();
    };


  //**************************************************************************
  //** editMap
  //**************************************************************************
    var editMap = function(node, hide){
        if (!mapEditor){
            mapEditor = createNodeEditor({
                title: "Edit Map",
                width: 1180,
                height: 700,
                resizable: true,
                editor: bluewave.charts.MapEditor
            });
        };
        mapEditor.getNode = function(){
            return node;
        };


      //Clone the node config
        var mapConfig = {};
        merge(mapConfig, node.config);


      //Update and render mapEditor
        mapEditor.update(mapConfig, mapEditor.getMapData(node));

        if (hide===true) return;


      //Show mapEditor when we are in editor view
        mapEditor.show();
    };


  //**************************************************************************
  //** editSankey
  //**************************************************************************
    var editSankey = function(node, hide){
        if (!sankeyEditor){
            sankeyEditor = createNodeEditor({
                title: "Edit Sankey",
                width: 1680,
                height: 920,
                resizable: true,
                editor: bluewave.charts.SankeyEditor
            });
        }
        sankeyEditor.getNode = function(){
            return node;
        };


      //Get config
        var chartConfig = {};
        merge(chartConfig, node.config);


      //Update and render sankeyEditor
        sankeyEditor.update(chartConfig, getSupplyChainInputs(node));

        if (hide===true) return;

      //Show sankeyEditor when we are in the editor view
        sankeyEditor.show();
    };


  //**************************************************************************
  //** editPie
  //**************************************************************************
    var editPie = function(node){
        if (!pieEditor){
            pieEditor = createNodeEditor({
                title: "Edit Pie Chart",
                width: 1060,
                height: 600,
                resizable: true,
                editor: bluewave.charts.PieEditor
            });
        }
        pieEditor.getNode = function(){
            return node;
        };


      //Get config
        var chartConfig = {};
        merge(chartConfig, node.config);


      //Get data
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

        pieEditor.update(chartConfig, data);
        pieEditor.show();
    };


  //**************************************************************************
  //** editSupplyChain
  //**************************************************************************
    var editSupplyChain = function(node){
        if (!supplyChainEditor){
            supplyChainEditor = createNodeEditor({
                title: "Edit Supply Chain",
                width: 1680,
                height: 920,
                resizable: true,
                editor: bluewave.charts.SupplyChainEditor
            });

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


      //Get config
        var chartConfig = {};
        merge(chartConfig, node.config);


        supplyChainEditor.update(chartConfig);
        me.save(function(){
            supplyChainEditor.show();
        });
    };


  //**************************************************************************
  //** editLayout
  //**************************************************************************
    var editLayout = function(node){

      //Create layoutEditor as needed
        if (!layoutEditor){

            layoutEditor = createNodeEditor({
                title: "Edit Layout",
                width: 1425, //Up to 4 dashboard items at 250px width
                height: 839,
                resizable: true,
                editor: bluewave.charts.Layout
            });
            layoutEditor.el.style.borderRadius = "0 0 5px 5px";
        }


      //Add custom getNode() method to the layoutEditor to return current node
        layoutEditor.getNode = function(){
            return node;
        };


      //Get data
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


      //Get config
        var chartConfig = {};
        merge(chartConfig, node.config);


      //Update and show layoutEditor
        layoutEditor.update(inputs, chartConfig);
        layoutEditor.show();
        toggleButton.show();
    };


  //**************************************************************************
  //** compareDocs
  //**************************************************************************
    var compareDocs = function(node){

        if (!docComparer){
            var title = "Document Analysis";
            docComparer = createNodeEditor({
                title: title,
                width: 965,
                height: 600,
                editor: bluewave.analytics.DocumentComparison
            });
            docComparer.getConfig = function(){
                return {
                    chartTitle: title,
                    similarities: docComparer.getSimilarities()
                };
            };
            docComparer.getChart = function(){
                return docComparer.getSummaryPanel();
            };
        }
        docComparer.getNode = function(){
            return node;
        };


      //Get input files
        var inputs = [];
        for (var inputID in node.inputs) {
            if (node.inputs.hasOwnProperty(inputID)){
                var inputNode = node.inputs[inputID];
                inputs.push(inputNode.config.fileName);
            }
        }


      //Get config
        var chartConfig = {};
        merge(chartConfig, node.config);


      //Update and show docComparer
        docComparer.update(inputs, chartConfig.similarities);
        docComparer.show();
    };


  //**************************************************************************
  //** createNodeEditor
  //**************************************************************************
    var createNodeEditor = function(conf){

        var editor = conf.editor;
        delete conf.editor;

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
                        if (conf.beforeClose){
                            conf.beforeClose.apply(me, [win]);
                        }
                        else{
                            //win.close();
                            var chartConfig = editor.getConfig();
                            var node = editor.getNode();
                            var orgConfig = node.config;
                            if (!orgConfig) orgConfig = {};
                            if (isDirty(chartConfig, orgConfig)){
                                node.config = chartConfig;
                                updateTitle(node, node.config.chartTitle);
                                waitmask.show();
                                var el = editor.getChart();
                                if (el.show) el.show();
                                setTimeout(function(){
                                    createPreview(el, function(canvas){
                                        if (canvas && canvas.toDataURL){
                                            node.preview = canvas.toDataURL("image/png");
                                            createThumbnail(node, canvas);
                                        }
                                        win.close();
                                        waitmask.hide();
                                    }, this);
                                },800);
                            }
                            else{
                                updateTitle(node, node.config.chartTitle);
                                win.close();
                            }
                            button.layout.enable();
                        }
                    };
                    buttonDiv.appendChild(btn);
                }
            }
        });


        if (editor){
            editor = new editor(win.getBody(), config);

            editor.show = function(){
                win.show();
            };

            editor.hide = function(){
                win.hide();
            };

            win.onResize = function(){
                if (editor.resize) editor.resize();
            };

            return editor;
        }
        else{ //Special case for dbView
            return win;
        }
    };


  //**************************************************************************
  //** updateTitle
  //**************************************************************************
  /** Updates the title of a drawflow node
   */
    var updateTitle = function(node, title) {
        if (title) {
            node.childNodes[0].getElementsByTagName("span")[0].innerHTML = title;
        }
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
  //** renderFile
  //**************************************************************************
    var renderFile = function(node){
        if (!fileViewer){
            fileViewer = createWindow({
                title: "File Preview",
                width: 800,
                height: 600,
                resizable: true,
                beforeClose: null,
                modal: true,
                style: config.style.window
            });
        }

        var fileName = node.config.fileName;

        var body = fileViewer.getBody();
        body.innerHTML = "";
        var iframe = document.createElement("iframe");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0 none";
        iframe.src = "document?fileName=" + fileName;
        body.appendChild(iframe);

        fileViewer.setTitle(fileName);
        fileViewer.show();
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

            if (width===0 || height===0) return;
            resizeCanvas(canvas, width, height, true);
            var base64image = canvas.toDataURL("image/png");

            var img = document.createElement('img');
            img.className = "noselect";
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

        if (!query || query.length===0){
            callback.apply(scope, []);
            return;
        }

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
                callback.apply(scope, []);
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
  //** updateLayout
  //**************************************************************************
  /** Used to update the size and position of all the dashboard items in the
   *  layout.
   */
    var updateLayout = function(){
        if (me.getView()!=="Edit"){
            dashboardPanel.resize();
            var dashboardItems = dashboardPanel.getDashboardItems();
            for (var i=0; i<dashboardItems.length; i++){
                var dashboardItem = dashboardItems[i];
                updateSVG(dashboardItem);
            }
        }
    };


  //**************************************************************************
  //** updateSVG
  //**************************************************************************
  /** Used to update the size and position of an individual dashboard item
   *  in s layout.
   */
    var updateSVG = function(dashboardItem){
        var svgs = dashboardItem.getElementsByTagName("svg");
        if (svgs.length>0){
            var svg = svgs[0];
            var chartContainer = svg.parentNode;
            var rect = javaxt.dhtml.utils.getRect(chartContainer.parentNode);


          //Update dimensions of the svg
            d3.select(svg)
            .attr("width",rect.width)
            .attr("height",rect.height);


          //Get attributes of the second "g" element in the svg. Assumes that
          //the first "g" element is reserved exclusively for us to manipulate
          //in this class. All chart types should have a outer "g" like this.
            var g = svg.getElementsByTagName("g")[0]; //reserved for explorer
            var g2 = g.getElementsByTagName("g")[0]; //used by individual charts
            var box = g2.getBBox();
            var width = box.width;
            var height = box.height;
            var scaleX = 1;
            var scaleY = 1;
            var translateX = 0;
            var translateY = 0;
            var transformList = g2.transform.baseVal;
            for (var i=0; i<transformList.numberOfItems; i++){
                var transform = transformList.getItem(i);
                var m = transform.matrix;
                switch (transform.type){
                  case 2:
                    translateX = m.e;
                    translateY = m.f;
                    break;
                  case 3:
                    scaleX = m.a;
                    scaleY = m.d;
                    break;
                }
            }



          //Compute scale
            var scale;
            var scaledWidth = (width)*scaleX;
            var scaledHeight = (height)*scaleY;
            if (width>=height){
                scale = rect.width/scaledWidth;
                var h = scaledHeight*scale;
                if (h>rect.height){
                    scale = rect.height/scaledHeight;
                }
            }
            else{
                scale = rect.height/scaledHeight;
                var w = scaledWidth*scale;
                if (w>rect.width){
                    scale = rect.width/scaledWidth;
                }
            }



          //Compute x/y offset
            var x = 0;
            var y = 0;
            if (translateX===0){ //center the chart
                x = (rect.width/2)-((scaledWidth*scale)/2);
            }
            else{
                //TODO: center chart using translateX
            }

            if (translateY===0){ //center the chart
                y = (rect.height/2)-((scaledHeight*scale)/2);
            }
            else{
                //TODO: center chart using translateY
            }


          //Apply transform to the first g
            d3.select(g).attr("transform",
                "translate(" + x + "," + y + ") " +
                "scale(" + scale + ")"
            );

        }
    };


  //**************************************************************************
  //** createDashboard
  //**************************************************************************
  /** Creates a panel used to render dashboard items
   */
    var createDashboard = function(parent){
        var outerDiv = document.createElement("div");
        outerDiv.style.height = "100%";
        outerDiv.style.textAlign = "center";
        parent.appendChild(outerDiv);
        addShowHide(outerDiv);


        var paddedDiv = document.createElement("div");
        paddedDiv.style.height = "100%";
        paddedDiv.style.position = "relative";
        paddedDiv.style.padding = "10px";
        paddedDiv.style.boxSizing = "border-box";
        paddedDiv.style.display = "inline-block";
        outerDiv.appendChild(paddedDiv);

        var innerDiv = document.createElement("div");
        innerDiv.style.position = "relative";
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        paddedDiv.appendChild(innerDiv);



        var childNodes = [];
        var maxWidth = 0;
        var maxHeight = 0;
        outerDiv.add = function(el){
            innerDiv.appendChild(el);
            childNodes.push(el);
            maxWidth = Math.max(maxWidth, parseFloat(el.style.width)+parseFloat(el.style.left))/100;
            maxHeight = Math.max(maxHeight, parseFloat(el.style.height)+parseFloat(el.style.top))/100;
        };
        outerDiv.clear = function(){
            innerDiv.innerHTML = "";
            childNodes = [];
            maxWidth = 0;
            maxHeight = 0;
        };
        outerDiv.getDashboardItems = function(){
            return childNodes;
        };
        outerDiv.resize = function(){

            var width = outerDiv.offsetWidth;
            var height = outerDiv.offsetHeight;

            if (maxWidth===0 || maxHeight===0) return;

            var w, h;
            if (maxWidth>=maxHeight){
                w = width;
                h = w;

                if (height<h*maxHeight){
                    var d = height/(h*maxHeight);
                    w = w*d;
                    h = w;
                }
            }
            else{
                h = height;
                w = h;

                if (width<w*maxWidth){
                    var d = width/(w*maxWidth);
                    h = h*d;
                    w = h;
                }
            }

            paddedDiv.style.width = w + "px";
            paddedDiv.style.height = h + "px";
        };

        return outerDiv;
    };


  //**************************************************************************
  //** updateDashboard
  //**************************************************************************
    var updateDashboard = function(){

      //Find layout node
        var layoutNode = getLayoutNode();
        if (!layoutNode) return;


      //TODO: Check if layout is dirty
        var isDirty = true;
        if (!isDirty) return;


      //Clear and resize the dashboardPanel
        dashboardPanel.clear();



      //Render dashboard items
        for (var key in layoutNode.config) {
            if (layoutNode.config.hasOwnProperty(key)){


                var layout = layoutNode.config[key];
                var node = nodes[key];
                var connected = checkConnection(layoutNode, node);
                if (!connected) continue;
                if (!node) continue;
                var chartConfig = node.config;
                if (!chartConfig) chartConfig = {};
                var title = chartConfig.chartTitle;


              //Create absolute div for the dashboard item
                var outerDiv = document.createElement("div");
                outerDiv.style.position = "absolute";
                outerDiv.style.width = layout.width;
                outerDiv.style.height = layout.height;
                outerDiv.style.top = layout.top;
                outerDiv.style.left = layout.left;
                dashboardPanel.add(outerDiv);
                dashboardPanel.resize();


              //Create an inner div for padding purposes
                var innerDiv = document.createElement("div");
                innerDiv.style.width = "100%";
                innerDiv.style.height = "100%";
                innerDiv.style.padding = "10px";
                innerDiv.style.boxSizing = "border-box";
                outerDiv.appendChild(innerDiv);


              //Create dashboard item
                var dashboardItem = createDashboardItem(innerDiv,{
                    title: title,
                    subtitle: "",
                    width: "100%",
                    height: "100%"
                });


              //Update default style. Remove padding and margin because the
              //inner div handles that.
                var div = dashboardItem.el;
                div.style.padding = "0px";
                div.style.margin = "0px";


              //Function used to create a overflow container for charts
                var createChartContainer = function(){
                    var innerDiv = dashboardItem.innerDiv;
                    var chartContainer = document.createElement("div");
                    chartContainer.style.position = "absolute";
                    chartContainer.style.top = 0;
                    innerDiv.style.overflow = "hidden";
                    chartContainer.style.width = layout.imageWidth + "px";
                    chartContainer.style.height = layout.imageHeight + "px";
                    innerDiv.appendChild(chartContainer);
                    return chartContainer;
                };


                onRender(dashboardItem.innerDiv, function(){
                    if (node.type==="addData"){

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

                      //Instantiate sankeyEditor as needed
                        if (!sankeyEditor) editSankey(node, true);

                      //Get sankey config and data
                        sankeyEditor.update(node.config, getSupplyChainInputs(node));
                        var sankeyConfig = sankeyEditor.getConfig();
                        var data = sankeyEditor.getSankeyData();

                      //Render sankeyChart
                        var sankeyChart = new bluewave.charts.SankeyChart(createChartContainer(),config);
                        sankeyChart.update(sankeyConfig.style,data);

                        if (node.type === "pieChart") {
                            if (!pieEditor) editPie(node);
                            pieEditor.update(node.config, getSupplyChainInputs(node));

                            var pieConfig = pieEditor.getConfig();
                            var data = pieEditor.getSankeyData();

                            var pieChart = new bluewave.charts.PieChart(dashboardItem.innerDiv, config);
                            pieChart.update(pieConfig.style, data);
                       }

                    }
                    else{
                        var data = [];
                        for (var key in node.inputs) {
                            if (node.inputs.hasOwnProperty(key)){
                                var csv = node.inputs[key].csv;
                                if (csv){
                                    data.push(d3.csvParse(csv));
                                }
                            }
                        }
                        if (node.type==="pieChart"){
                            var pieChart = new bluewave.charts.PieChart(createChartContainer(),{});
                            pieChart.update(chartConfig, data);
                        }
                        else if (node.type==="barChart"){
                            var barChart = new bluewave.charts.BarChart(createChartContainer(),{});
                            barChart.update(chartConfig, data);
                        }
                        else if (node.type==="lineChart"){
                            var lineChart = new bluewave.charts.LineChart(createChartContainer(),{});
                            lineChart.update(chartConfig, data);
                        }
                        else if (node.type==="scatterChart"){
                            var scatterChart = new bluewave.charts.ScatterChart(createChartContainer(),{});
                            scatterChart.update(chartConfig, data);
                        }
                        else if (node.type==="calendarChart"){
                            var calendarChart = new bluewave.charts.CalendarChart(createChartContainer(),{});
                            calendarChart.update(chartConfig, data);
                        }
                        else if (node.type==="treeMapChart"){
                            var treeMapChart = new bluewave.charts.TreeMapChart(createChartContainer(),{});
                            treeMapChart.update(chartConfig, data);
                        }
                        else if (node.type==="mapChart"){

                          //Instantiate mapEditor as needed
                            if (!mapEditor) editMap(node, true);

                          //Get map config and data
                            mapEditor.update(node.config, mapEditor.getMapData(node));

                          //Render mapChart
                            var mapChart = new bluewave.charts.MapChart(createChartContainer(),config);
                            mapChart.update(mapEditor.getConfig(),mapEditor.getMapData(node)[0]);
                        }
                        else{
                            console.log(node.type + " preview not implemented!");
                        }
                    }

                    updateSVG(div);

                });
            }
        }


      //Some charts take a little longer to render so update again just in case
        setTimeout(updateLayout,800);
    };


  //**************************************************************************
  //** getSupplyChainInputs
  //**************************************************************************
  /** Used to convert supplyChain data into inputs for MapChart & Sankey
   */
   var getSupplyChainInputs = function(node){
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
        return inputs;
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
                    editPanel.focus();
                }
                else{
                    editPanel.hide();
                    dashboardPanel.show();
                    updateDashboard();
                }
            }
        });
        addShowHide(toggleButton);
        toggleButton._show = toggleButton.show;
        toggleButton.show = function(){
            if (getLayoutNode()) this._show();
            else this.hide();
        };
    };


  //**************************************************************************
  //** createMask
  //**************************************************************************
    var createMask = function(parent){
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
    var destroy = javaxt.dhtml.utils.destroy;
    var addResizeListener = javaxt.dhtml.utils.addResizeListener;


    init();
};