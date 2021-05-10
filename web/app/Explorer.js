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
    var dashboardPanel, editPanel;
    var id, name, thumbnail;
    var toolbar;
    var tooltip, tooltipTimer, lastToolTipEvent;
    var button = {};
    var nodes = {};
    var drawflow;
    var dbView;
    var chartEditor, sankeyEditor, layoutEditor, nameEditor;
    var waitmask;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;
        if (!config.queryService) config.queryService = "query/"


      //Create main panel
        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.position = "relative";
        createToggleButton(div);



      //Create preview panel
        dashboardPanel = document.createElement("div");
        dashboardPanel.style.height = "100%";
        div.appendChild(dashboardPanel);
        addShowHide(dashboardPanel);
        dashboardPanel.hide();


      //Create editor
        editPanel = document.createElement("div");
        editPanel.className = "drawflow";
        editPanel.ondrop = drop;
        editPanel.ondragover = function(e){
            e.preventDefault();
        };
        div.appendChild(editPanel);
        createDrawFlow(editPanel);
        addShowHide(editPanel);


      //Add toolbar
        createToolbar(editPanel);


      //Add save button
        var btn = document.createElement("div");
        btn.className = "drawflow-save noselect";
        editPanel.appendChild(btn);
        btn.onclick = me.save;


        parent.appendChild(div);
        me.el = div;
        addShowHide(me);
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
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(dashboard){
        me.clear();


      //Update class variables
        if (!dashboard) dashboard = {};
        id = dashboard.id;
        name = dashboard.name;
        thumbnail = dashboard.thumbnail;


      //Enable default buttons
        button.addData.enable();
        button.sankeyChart.enable();



      //Import layout
        drawflow.import({
            drawflow: {
                Home: {
                    data: dashboard.info.layout
                }
            }
        });


      //Update nodes
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
                    getCSV(node.config.query, function(csv){
                        this.csv = csv;
                    }, node);


                  //Update buttons
                    for (var buttonName in button) {
                        if (button.hasOwnProperty(buttonName)){
                            button[buttonName].enable();
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
    };


  //**************************************************************************
  //** save
  //**************************************************************************
    this.save = function(){

        getName(function(formInputs){
            name = formInputs.name;
            waitmask.show();

            var dashboard = {
                id: id,
                name: name,
                className: name,
                //thumbnail: thumbnail,
                info: {
                    layout: drawflow.export().drawflow.Home.data,
                    nodes: {}
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
        createButton("addData", "fas fa-database", "Data");
        createButton("pieChart", "fas fa-chart-pie", "Pie Chart");
        createButton("barChart", "fas fa-chart-bar", "Bar Chart");
        createButton("lineChart", "fas fa-chart-line", "Line Chart");
        createButton("map", "fas fa-map-marked-alt", "Map");
        createButton("sankeyChart", "fas fa-project-diagram", "Sankey");
        createButton("layout", "fas fa-border-all", "Layout");
    };


  //**************************************************************************
  //** createDrawFlow
  //**************************************************************************
    var createDrawFlow = function(parent){
        drawflow = new Drawflow(parent);
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

          //If we're still here, update node and open editor
            node.inputs[outputID] = inputNode;
            node.ondblclick();
        });
        drawflow.on('nodeRemoved', function(nodeID) {
            delete nodes[nodeID+""];
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
            case "sankeyChart":

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
        switch (node.type) {
            case "addData":

                node.ondblclick = function(){
                    showQuery(this.config.query, function(){
                        var grid = dbView.getComponents().grid;
                        var query = dbView.getQuery();
                        if (query.length==0){
                            //Ignore?
                        }
                        else{

                          //Update node
                            if (query!==this.config.query){

                              //Update config
                                this.config.query = query;
                                if (grid) this.config.columns = grid.getConfig().columns;


                              //Update csv
                                this.csv = null;
                                getCSV(query, function(csv){
                                    this.csv = csv;
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
                                    }, this);
                                };

                                dbView.hide();
                            }


                          //Enable/disable toolbar buttons
                            for (var key in button) {
                                if (button.hasOwnProperty(key) && key!==node.type){
                                    if (this.csv){
                                        button[key].enable();
                                    }
                                    else{
                                        button[key].disable();
                                    }
                                }
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
            case "layout":

                node.ondblclick = function(){
                    editLayout(this);
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
        if (!dbView){

            var win = createWindow({
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
                queryService: config.queryService + "job/",
                getTables: config.queryService + "nodes/",
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

            var win = createWindow({
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
        if (title) {
            node.childNodes[0].getElementsByTagName("span")[0].innerHTML = title;
        }
    };


  //**************************************************************************
  //** editSankey
  //**************************************************************************
    var editSankey = function(node){
        if (!sankeyEditor){
            var win = createWindow({
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
                        win.close();
                    }
                }
            });


            sankeyEditor = new bluewave.charts.Sankey(win.getBody(), config);

            sankeyEditor.show = function(){
                win.show();
            };

            sankeyEditor.hide = function(){
                win.hide();
            };
        }

        sankeyEditor.update(node.config, node);
        sankeyEditor.show();
    };


  //**************************************************************************
  //** editLayout
  //**************************************************************************
    var editLayout = function(node){

      //Create layoutEditor as needed
        if (!layoutEditor){
            var win = createWindow({
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
  //** createWindow
  //**************************************************************************
    var createWindow = function(conf){


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


        var win = new javaxt.dhtml.Window(document.body, {
            title: conf.title,
            width: conf.width,
            height: conf.height,
            //valign: "top",
            modal: true,
            resizable: conf.resizable,
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
                var canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(this, 0, 0);
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

        var url = config.queryService;
        var payload = {
            query: query,
            format: "csv"
        };

        post(url, JSON.stringify(payload), {
            success : function(text){
                callback.apply(scope, [text]);
            },
            failure: function(response){
                alert(response);
            }
        });
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
            var win = new javaxt.dhtml.Window(document.body, {
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
                    },
                    {
                        name: "private",
                        label: "Private",
                        type: "radio",
                        alignment: "vertical",
                        options: [
                            {
                                label: "True",
                                value: true
                            },
                            {
                                label: "False",
                                value: false
                            }
                        ]
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
                                    if (callback) callback.apply(me,[inputs]);
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
        if (name) nameEditor.setValue("name", name);
        nameEditor.setValue("private", true);


        nameEditor.show();
    };


  //**************************************************************************
  //** updateDashboard
  //**************************************************************************
    var updateDashboard = function(){


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
                        url: config.queryService,
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
                else{
                    console.log(title, node.inputs);
                    /*
                        name: node.name,
                        type: node.type,
                        config: node.config,
                        preview: node.preview
                    */
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
        div.style.top = "20px";
        div.style.right = "20px";
        div.style.zIndex = 2;
        parent.appendChild(div);


        var options = ["Edit","Preview"];
        bluewave.utils.createToggleButton(div, {
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
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var isDirty = javaxt.dhtml.utils.isDirty;
    var setStyle = javaxt.dhtml.utils.setStyle;
    var resizeCanvas = bluewave.utils.resizeCanvas;
    var base64ToBlob = bluewave.utils.base64ToBlob;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var parseCSV = bluewave.utils.parseCSV;
    var warn = bluewave.utils.warn;
    var post = javaxt.dhtml.utils.post;
    var get = bluewave.utils.get;


    init();
};