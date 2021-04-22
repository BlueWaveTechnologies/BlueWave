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
    var defaultConfig = {
        style: {

        }
    };

    var toolbar;
    var tooltip, tooltipTimer, lastToolTipEvent;
    var button = {};
    var nodes = {};
    var drawflow;
    var dbView;
    var chartEditor;
    var waitmask;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
/*
      //Clone the config so we don't modify the original config object
        var clone = {};
        javaxt.dhtml.utils.merge(clone, config);


      //Merge clone with default config
        javaxt.dhtml.utils.merge(clone, defaultConfig);
        config = clone;
*/

        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;



        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.position = "relative";


      //Create Drawflow
        var mainPanel = document.createElement("div");
        mainPanel.className = "drawflow";
        mainPanel.ondrop = drop;
        mainPanel.ondragover = function(e){
            e.preventDefault();
        };
        div.appendChild(mainPanel);
        createDrawFlow(mainPanel);

      //Add toolbar
        createToolbar(mainPanel);


        parent.appendChild(div);
        me.el = div;
        addShowHide(me);
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){

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
        createButton("addData", "fas fa-plus-circle", "Data");
        createButton("pieChart", "fas fa-chart-pie", "Pie Chart");
        createButton("barChart", "fas fa-chart-bar", "Bar Chart");
        createButton("lineChart", "fas fa-chart-line", "Line Chart");
        createButton("map", "fas fa-map-marked-alt", "Map");

      //Enable addData button
        button.addData.enable();
    };


  //**************************************************************************
  //** createDrawFlow
  //**************************************************************************
    var createDrawFlow = function(parent){
        drawflow = new Drawflow(parent);
        drawflow.reroute = true;
        drawflow.start();
        drawflow.on('connectionCreated', function(info) {
            var outputID = info.output_id+"";
            var inputID = info.input_id+"";
            console.log("Connected " + outputID + " to " + inputID);

            var node = nodes[inputID];
            node.inputs[outputID] = nodes[outputID];

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

        switch (nodeType) {
            case "addData":

                var node = createNode({
                    name: "Table Selection",
                    type: nodeType,
                    icon: "fas fa-table",
                    content: "Db Click here",
                    position: [pos_x, pos_y],
                    inputs: 0,
                    outputs: 1
                });


                node.ondblclick = function(){
                    showQuery(this.query, function(){
                        var grid = dbView.getComponents().grid;
                        var query = dbView.getQuery();
                        if (query.length==0){
                            //Ignore?
                        }
                        else{

                          //Update node
                            if (query!==this.query){
                                this.query = query;
                                if (grid){
                                    waitmask.show();
                                    this.csv = createCSV(grid);
                                    createPreview(grid.el, function(canvas){
                                        createThumbnail(this, canvas);
                                        dbView.hide();
                                        waitmask.hide();
                                    }, this);
                                }
                                else{
                                    this.csv = null;
                                    dbView.hide();
                                }

                                //TODO: Find and notify nodes that rely on this node

                            }
                            else{
                                dbView.hide();
                            }


                          //Enable/disable toolbar buttons
                            for (var key in button) {
                                if (button.hasOwnProperty(key) && key!==nodeType){
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

            default:
                var btn = button[nodeType];
                if (!btn){
                    console.log("Unsupported Node Type: " + nodeType);
                    return;
                }

                var icon = btn.el.dataset["icon"];
                var title = btn.el.dataset["title"];
                var i = document.createElement("i");
                i.className = icon;

                var node = createNode({
                    name: title,
                    type: nodeType,
                    icon: icon,
                    content: i,
                    position: [pos_x, pos_y],
                    inputs: 1,
                    outputs: 0
                });

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
        div.outputs = {};
        nodes[nodeID+""] = div;
        return div;
    };


  //**************************************************************************
  //** showQuery
  //**************************************************************************
    var showQuery = function(query, callback, scope){
        if (!dbView){

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
                title: "Query",
                width: 1020,
                height: 600,
                valign: "top",
                modal: true,
                resizable: true,
                style: style,
                renderers: { //custom renderer for the close button
                    headerButtons: function(buttonDiv){
                        var btn = document.createElement('div');
                        setStyle(btn, style.button);
                        var icon = document.createElement('div');
                        setStyle(icon, style.closeIcon);
                        btn.appendChild(icon);
                        btn.onclick = function(){
                            dbView.onClose();
                        };
                        buttonDiv.appendChild(btn);
                    }
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
                getTables: "query/tables/",
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
                title: "Edit Chart",
                width: 1060,
                height: 600,
                valign: "top",
                modal: true,
                resizable: false,
                style: style,
                renderers: {

                  //Create custom renderer for the close button. Basically, we
                  //want to delay closing the window until after the tumbnail
                  //is created
                    headerButtons: function(buttonDiv){
                        var btn = document.createElement('div');
                        setStyle(btn, style.button);
                        var icon = document.createElement('div');
                        setStyle(icon, style.closeIcon);
                        btn.appendChild(icon);
                        btn.onclick = function(){
                            var chartConfig = chartEditor.getConfig();
                            var node = chartEditor.getNode();
                            var orgConfig = node.config;
                            if (!orgConfig) orgConfig = {};
                            if (isDirty(chartConfig, orgConfig)){
                                node.config = chartConfig;
                                waitmask.show();
                                var el = chartEditor.getChart();
                                createPreview(el, function(canvas){
                                    createThumbnail(node, canvas);
                                    updateTitle(node);
                                    win.close();
                                    waitmask.hide();
                                }, this);
                            }
                            else{
                                win.close();
                            }
                        };
                        buttonDiv.appendChild(btn);
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
  // Updates the Title of the Node based on what is in the chart config
    var updateTitle = function(node) {
        var icon = iconHelper(chartEditor.getConfig().chartType);
        var chartTitle = chartEditor.getConfig().chartTitle;
        var el = node.childNodes[0];
        if(chartTitle != null) {
            el.innerHTML = "<i class=\"" + icon + "\"></i><span>" + chartTitle + "</span>";
        }
    }

  //**************************************************************************
  //** iconHelper
  //**************************************************************************
  //Grabs the corresponding Icon for the given Chart Type
    var iconHelper = function(chartType) {
        switch(chartType) {
            case "addData":
                return "fas fa-plus-circle";
            case "pieChart":
                return "fas fa-chart-pie";
            case "barChart":
                return "fas fa-chart-bar";
            case "lineChart":
                return "fas fa-chart-line";
            case "map":
                return "fas fa-map-marked-alt";
            default:
                return null;
        };
    }

  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(el, callback, scope){
        html2canvas(el).then((canvas) => {
            if (callback) callback.apply(scope, [canvas]);
        });
    };


  //**************************************************************************
  //** createThumbnail
  //**************************************************************************
  /** Inserts a PNG image into a node
   */
    var createThumbnail = function(node, canvas){

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
        var padding = width-rect.width;


        var maxWidth = width-padding;
        var maxHeight = height-padding;

        resizeCanvas(canvas, maxWidth, maxHeight, true);
        var type = "image/png";
        var base64image = canvas.toDataURL(type);

        node.preview = base64image;
        el.innerHTML = "<img class='noselect' src='" + base64image + "'/>";
        el.childNodes[0].ondragstart = function(e){
            e.preventDefault();
        };
    };


  //**************************************************************************
  //** createCSV
  //**************************************************************************
    var createCSV = function(grid){

      //Create csv
        var csvContent = ""; //"data:text/csv;charset=utf-8,";

      //Add csv header
        var columns = grid.getColumns();
        for (var i=0; i<columns.length; i++){
            if (i>0) csvContent += ",";
            csvContent += columns[i];
        }
        csvContent += "\r\n";


      //Add csv data
        grid.forEachRow(function (row, content) {
            var row = "";
            for (var i=0; i<content.length; i++){
                if (i>0) row += ",";
                var cell = content[i];
                if (!(typeof cell === "string")){
                    if (cell!=null) cell = cell.innerText;
                    else cell = "";
                }
                if (cell.indexOf(",")>-1 || cell.indexOf("\n")>-1){
                    cell = "\"" + cell + "\"";
                }
                cell = cell.replace("#",""); //TODO: find proper way to encode characters like this
                row += cell;
            }
            csvContent += row + "\r\n";
        });

        return csvContent;
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