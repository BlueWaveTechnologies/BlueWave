if(!bluewave) var bluewave={};
if(!bluewave.dashboard) bluewave.dashboard={};

//******************************************************************************
//**  Dashboard Composer
//******************************************************************************
/**
 *   Panel used design and edit dashboards
 *
 ******************************************************************************/

bluewave.dashboard.Composer = function(parent, config) {
    this.className = "bluewave.dashboard.Composer";

    var me = this;
    var defaultConfig = {


      /** Define supported nodes and editors
       */
        nodes: [
            {
                title: "Database",
                type: "query",
                icon: "fas fa-database",
                editor: {
                    width: 1020,
                    height: 600,
                    resizable: true,
//                    beforeClose: function(){
//                        dbView.onClose();
//                    },
                    class: bluewave.editor.QueryEditor
                },
                inputNodes: [

                ]
            },
            {
                title: "Filter",
                type: "filter",
                icon: "fas fa-filter",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.FilterEditor
                },
                inputNodes: [
                    "query", "datafile"
                ]
            },
            {
                title: "Pie Chart",
                type: "pieChart",
                icon: "fas fa-chart-pie",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.PieEditor
                },
                inputNodes: [
                    "query", "datafile", "filter", "sankeyChart"
                ]
            },
            {
                title: "Bar Chart",
                type: "barChart",
                icon: "fas fa-chart-bar",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.BarEditor
                },
                inputNodes: [
                    "query", "datafile", "filter"
                ]
            },
            {
                title: "Line Chart",
                type: "lineChart",
                icon: "fas fa-chart-line",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.LineEditor
                },
                inputNodes: [
                    "query", "datafile", "filter"
                ]
            },
            {
                title: "Histogram Chart",
                type: "histogramChart",
                icon: "fas fa-chart-area",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.HistogramEditor
                },
                inputNodes: [
                    "query", "datafile", "filter"
                ]
            },
            {
                title: "Scatter Chart",
                type: "scatterChart",
                icon: "fas fa-braille",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.ScatterEditor
                },
                inputNodes: [
                    "query", "datafile", "filter"
                ]
            },
            {
                title: "Map",
                type: "mapChart",
                icon: "fas fa-globe-americas",
                editor: {
                    width: 1180,
                    height: 700,
                    resizable: true,
                    class: bluewave.editor.MapEditor,
                    data: {
                        politicalBoundaries: "/data"
                    }
                },
                inputNodes: [
                    "query", "datafile", "filter"
                ]
            },
            {
                title: "Treemap Chart",
                type: "treeMapChart",
                icon: "fas fa-basketball-ball",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.TreeMapEditor
                },
                inputNodes: [
                    "query", "datafile", "filter"
                ]
            },
            {
                title: "Calendar Chart",
                type: "calendarChart",
                icon: "fas fa-th",
                editor: {
                    width: 1060,
                    height: 600,
                    resizable: true,
                    class: bluewave.editor.CalendarEditor
                },
                inputNodes: [
                    "query", "datafile", "filter"
                ]
            },
            {
                title: "Sankey Chart",
                type: "sankeyChart",
                icon: "fas fa-random",
                editor: {
                    width: 1680,
                    height: 920,
                    resizable: true,
                    class: bluewave.editor.SankeyEditor
                },
                inputNodes: [

                ]
            },
            {
                title: "Layout",
                type: "layout",
                icon: "far fa-object-ungroup",
                editor: {
                    width: 1425, //Up to 4 dashboard items at 250px width
                    height: 839,
                    resizable: true,
                    class: bluewave.editor.LayoutEditor
                },
                inputNodes: [

                ]
            }
        ],




      /** Define which nodes will appear in the toolbar
       */
        toolbar: {
            nodes: [
                "query", "filter",
                "pieChart", "barChart", "lineChart",
                "histogramChart", "scatterChart",
                "mapChart", "treeMapChart", "calendarChart",
                "sankeyChart",
                "layout"
            ]
        },


      /** Define list of supported file types. Used when dragging/dropping
       *  data files onto the canvas.
       */
        supportedFileTypes: [
            "csv", "tab", "tsv", "xls", "xlsx", "pdf"
        ]

    };



    var button = {};
    var explorer;
    var dashboardPanel, editPanel, explorer, toggleButton, mask, waitmask, hint;
    var propertyEditor, permissionsEditor;
    var windows = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);


      //Process config
        if (!config.fx) config.fx = new javaxt.dhtml.Effects();
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


        var table = createTable(parent);
        table.setAttribute("desc", me.className);
        me.el = table;


      //Create toolbar
        createToolbar(table.addRow().addColumn());


      //Create main panel
        var td = table.addRow().addColumn({
            height: "100%"
        });

        var div = createElement("div", td, {
            height: "100%",
            position: "relative"
        });


      //Add toggle button
        createToggleButton(div);
        toggleButton.hide();


      //Add add mask
        createMask(div);


      //Create inner div for overflow purposes
        var innerDiv = createElement("div", div, {
            width: "100%",
            height: "100%",
            position: "absolute"
        });


      //Create dashboard preview panel
        dashboardPanel = createDashboard(innerDiv);
        dashboardPanel.setAttribute("desc", "dashboardPanel");
        dashboardPanel.hide();


      //Create edit panel and instantiate explorer
        editPanel = createElement("div", innerDiv);
        editPanel.setAttribute("desc", "editPanel");
        editPanel.style.height = "100%";
        editPanel.tabIndex = -1;
        createExplorer(editPanel);
        addShowHide(editPanel);


      //Merge explorer buttons with the toolbar buttons
        var explorerButtons = explorer.getButtons();
        for (var key in explorerButtons) {
            if (explorerButtons.hasOwnProperty(key)){
                button[key] = explorerButtons[key];
            }
        }


      //Create little arrow/hint for the toolbar
        hint = createElement("div", explorer.getToolbar(), "drawflow-toolbar-hint noselect");
        hint.show = function(){
            config.fx.fadeIn(this,"easeIn",500);
        };
        hint.hide = function(b){
            if (b===true){
                this.style.opacity = 0;
                this.style.display = "none";
            }
            else{
                config.fx.fadeOut(this,"easeIn",100);
            }
        };
        hint.hide(true);



        addShowHide(me);
        addResizeListener(div, updateLayout);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){


      //Clear dashboard panel
        dashboardPanel.clear();

      //Reset toggleButton
        toggleButton.reset();



        explorer.clear();



      //Hide any popup dialogs
        for (var i in windows){
            windows[i].hide();
        }


    };


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to render a dashboard
   *  @param dashboard JSON object with dashboard info (see getDashboard)
   *  @param readOnly If true, prevent user from editing
   *  @param view Preferred view ("Edit", "Preview", or "Dashboard")
   */
    this.update = function(dashboard, readOnly, view){


      //Process args
        if (!dashboard) dashboard = {};
        if (!(readOnly===true || readOnly===false)) readOnly = false;
        if (!(view==="Edit" || view==="Preview" || view==="Dashboard")) view="Edit";

console.log(view);


      //Show mask
        mask.show();


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



      //Update buttons
        updateButtons();



      //Return early if the dashboard is missing config info
        if (!dashboard.info) return;



      //Update explorer
        explorer.update(dashboard, readOnly, function(){


          //Find any data nodes
            var csvRequests = [];
            var nodes = explorer.getNodes();
            for (var key in nodes) {
                if (nodes.hasOwnProperty(key)){
                    var node = nodes[key];

                    if (node.type==="addData" || node.type==="query"){


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





          //Execute CSV requests
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
                            editPanel.focus();
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
                waitmask.hide();
                editPanel.focus();
            }

        });


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
  //** addExtensions
  //**************************************************************************
    this.addExtensions = function(extensions){
        explorer.addExtensions(extensions);
    };


  //**************************************************************************
  //** setView
  //**************************************************************************
  /** */
    this.setView = function(name){
        if (!name) name = "Edit";
        if (name==="Edit"){

            if (me.getView()==="Dashboard"){
                var dashboard = me.getDashboard();
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
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        var name = explorer.getName();
        return name ? name : "Untitled";
    };


  //**************************************************************************
  //** setReadOnly
  //**************************************************************************
    this.setReadOnly = function(readOnly){
        explorer.setReadOnly(readOnly);
        updateButtons();
    };


  //**************************************************************************
  //** isReadOnly
  //**************************************************************************
  /** Returns true if the view is read-only
   */
    this.isReadOnly = function(){
        return explorer.isReadOnly();
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
            explorer.setName(formInputs.name);


            console.log(formInputs);

            var dashboard = explorer.getDashboard();
            var thumbnail = dashboard.thumbnail;

            post("dashboard", JSON.stringify(dashboard),{
                success: function(text) {
                    me.onUpdate();
                    var id = parseInt(text);
                    explorer.setID(id);
                    updateButtons();
                    if (thumbnail){
                        saveThumbnail(thumbnail, id, function(request){
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
    var saveThumbnail = function(thumbnail, dashboardID, callback){

      //Convert base64 encoded string into a binary object
        var data = thumbnail;
        var type = data.substring(data.indexOf(":")+1, data.indexOf(";"));
        data = data.substring(("data:" + type + ";base64,").length);
        var blob = base64ToBlob(data, type);

      //Create form data
        var formData = new FormData();
        formData.append("image", blob);
        formData.set("id", dashboardID);

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
        var toolbar = createElement('div', parent);

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
                        del("dashboard/"+explorer.getID(), {
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



    };



  //**************************************************************************
  //** createExplorer
  //**************************************************************************
    var createExplorer = function(parent){

//      //Get default config for explorer
//        var explorerConfig = new bluewave.Explorer(null, config).getConfig();
//
//
//      //Update default config
//        explorerConfig.nodes.forEach((node)=>{
//            if (node.type==="mapChart"){
//                node.editor.data = {
//                    politicalBoundaries: "/data/political_boundaries"
//                };
//            }
//        });




        //explorer = new bluewave.Explorer(editPanel, config);
//        explorer.onChange = function(event){
//            if (event==='nodeRemoved'){
////                if (nodeType==="layout" && !getLayoutNode()) toggleButton.hide();
////                updateButtons();
//            }
//        };


      //Instantiate and render explorer in the parent
        explorer = new bluewave.Explorer(parent, config);


//      //Add custom update() method to explorer
//        var _update = explorer.update;
//        explorer.update = function(){
//            _update.apply(me, arguments);
//            explorer.orgDashboard = JSON.parse(JSON.stringify(explorer.getDashboard()));
//        };
//
//
//      //Add custom clear() method to explorer
//        var _clear = explorer.clear;
//        explorer.clear = function(){
//            explorer.orgDashboard = {};
//            _clear();
//        };
//
//
//      //Add custom isDirty() method to explorer
//        explorer.isDirty = function(dashboard){
//            if (!dashboard) dashboard = explorer.getDashboard();
//            if (isDirty(dashboard, explorer.orgDashboard)){
//
//                var numNodes = 0;
//                try{
//                    for (var key in dashboard.info.nodes) {
//                        if (dashboard.info.nodes.hasOwnProperty(key)){
//                            numNodes++;
//                        }
//                    }
//                }
//                catch(e){}
//
//                var orgNodes = 0;
//                try{
//                    for (var key in explorer.orgDashboard.info.nodes) {
//                        if (dashboard.info.nodes.hasOwnProperty(key)){
//                            orgNodes++;
//                        }
//                    }
//                }
//                catch(e){}
//
//                if (numNodes===0 && orgNodes===0) return false;
//
//
//                return true;
//            }
//            else{
//                return false;
//            }
//        };


      //Watch for onChange events
        explorer.onChange = function(event){
            //console.log(event);

            if (event==='nodeCreated'){
                updateButtons();
            }
            if (event==='nodeRemoved'){
//                var nodes = explorer.getNodes();
//                try{
//                    for (var key in nodes) {
//                        if (nodes.hasOwnProperty(key)){
//                            var node = nodes[key];
//                            //if (nodeType==="layout" && !getLayoutNode()) toggleButton.hide();
//                        }
//                    }
//                }
//                catch(e){}

                updateButtons();
            }
        };
    };


  //**************************************************************************
  //** createToggleButton
  //**************************************************************************
    var createToggleButton = function(parent){

        var div = createElement("div", parent);
        div.setAttribute("desc", "toggleButton");
        div.style.position = "absolute";
        div.style.top = "60px";
        div.style.right = "20px";
        div.style.zIndex = 2;


        var options = ["Edit","Preview"];
        toggleButton = bluewave.utils.createToggleButton(div, {
            options: options,
            //defaultValue: options[0],
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
  //** updateButtons
  //**************************************************************************
    var updateButtons = function(){


      //Hide arrow
        hint.hide(true);


      //Disable all buttons
        for (var key in button) {
            if (button.hasOwnProperty(key)){
                button[key].disable();
            }
        }


      //Return early as needed
        if (me.isReadOnly()) return;


      //Enable editor buttons
        if (button.query) button.query.enable();
        if (button.sankeyChart) button.sankeyChart.enable();


      //Get number of nodes in the canvas
        var visibleNodes = Object.keys(explorer.getNodes()).length;


      //Show arrow if there are no nodes in the canvas and update the save button
        if (visibleNodes===0){
            hint.show();
            button["save"].disable();
        }
        else{
            button["save"].enable();
        }



      //Update toolbar
        if (isNaN(explorer.getID())){
            button["edit"].disable();
            button["delete"].disable();
            button["users"].disable();
        }
        else{
            button["edit"].enable();
            button["delete"].enable();
            button["users"].enable();
        }

    };


  //**************************************************************************
  //** updateDashboard
  //**************************************************************************
  /** Used to render/update a complete dashboard (collection of charts in a
   *  layout)
   */
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
        var nodes = explorer.getNodes();
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
                var outerDiv = createElement("div");
                outerDiv.style.position = "absolute";
                outerDiv.style.width = layout.width;
                outerDiv.style.height = layout.height;
                outerDiv.style.top = layout.top;
                outerDiv.style.left = layout.left;
                dashboardPanel.add(outerDiv);
                dashboardPanel.resize();


              //Create an inner div for padding purposes
                var innerDiv = createElement("div", outerDiv);
                innerDiv.style.width = "100%";
                innerDiv.style.height = "100%";
                innerDiv.style.padding = "10px";
                innerDiv.style.boxSizing = "border-box";


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
                    var chartContainer = createElement("div", innerDiv);
                    chartContainer.style.position = "absolute";
                    chartContainer.style.top = 0;
                    innerDiv.style.overflow = "hidden";
                    chartContainer.style.width = layout.imageWidth + "px";
                    chartContainer.style.height = layout.imageHeight + "px";
                    return chartContainer;
                };


                onRender(dashboardItem.innerDiv, function(){

                    var editor = getNodeEditor(node);
                    if (editor){
                        if (editor.renderChart){
                            editor.update(node);
                            editor.renderChart(createChartContainer());
                            //editor.clear();
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
  //** checkConnection
  //**************************************************************************
    var checkConnection = function(layoutNode, node){
        var connected = false;
        var nodes = explorer.getNodes();
        for (var inputID in layoutNode.inputs){
            var tempNode = nodes[inputID];
            if (tempNode === node){
                connected = true;
            }
        }
        return connected;
    };



  //**************************************************************************
  //** getLayoutNode
  //**************************************************************************
  /** Returns the first layout node
   */
    var getLayoutNode = function(){
        var nodes = explorer.getNodes();
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
  //** getName
  //**************************************************************************
    var getName = function(callback){
        var name = explorer.getName();
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
                var id = explorer.getID();
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
        if (!propertyEditor){
            var win = createWindow({
                title: "Save Dashboard",
                width: 450,
                valign: "top",
                modal: true,
                style: config.style.window,
                buttons: [
                    {
                        name: "Cancel",
                        onclick: function(){
                            propertyEditor.clear();
                            win.close();
                        }
                    },
                    {
                        name: "Submit",
                        onclick: function(){

//                            var inputs = form.getData();
//                            var name = inputs.name;
//                            if (name) name = name.trim();
//                            if (name==null || name==="") {
//                                warn("Name is required", form.findField("name"));
//                                return;
//                            }
//
//                            waitmask.show();
//                            checkName(name, function(isValid){
//                                waitmask.hide();
//                                if (!isValid){
//                                    warn("Name is not unique", form.findField("name"));
//                                }
//                                else{
//                                    win.close();
//                                    propertyEditor.onSubmit(inputs);
//                                }
//                            });
                        }
                    }
                ]
            });

            propertyEditor = new bluewave.dashboard.Properties(win.getBody(), config);
            propertyEditor.show = function(){
                win.show();
            };
        }


        propertyEditor.update();



        propertyEditor.onSubmit = function(inputs){
            if (callback) callback.apply(me,[inputs]);
        };

        waitmask.hide();
        propertyEditor.show();
    };


  //**************************************************************************
  //** editUsers
  //**************************************************************************
    var editUsers = function(){
        if (!permissionsEditor){
            var win = createWindow({
                title: "Manage Access",
                width: 650,
                height: 500,
                valign: "top",
                modal: true,
                resizable: true,
                shrintToFit: true,
                style: merge({body: {padding:0}}, config.style.window)
            });

            permissionsEditor = new bluewave.dashboard.Permissions(win.getBody(), config);

            permissionsEditor.show = function(){
                win.show();
            };
        }

        permissionsEditor.update(explorer.getID());
        permissionsEditor.show();
    };


  //**************************************************************************
  //** updateSVG
  //**************************************************************************
  /** Used to update the size and position of an individual dashboard items
   *  in a layout.
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

        var outerDiv = createElement("div", parent);
        outerDiv.style.height = "100%";
        outerDiv.style.textAlign = "center";
        addShowHide(outerDiv);


        var paddedDiv = createElement("div", outerDiv);
        paddedDiv.style.height = "100%";
        paddedDiv.style.position = "relative";
        paddedDiv.style.padding = "10px";
        paddedDiv.style.boxSizing = "border-box";
        paddedDiv.style.display = "inline-block";


        var innerDiv = createElement("div", paddedDiv);
        innerDiv.style.position = "relative";
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";



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
  //** createWindow
  //**************************************************************************
    var createWindow = function(config){
        var win = new javaxt.dhtml.Window(document.body, config);
        windows.push(win);
        return win;
    };


  //**************************************************************************
  //** createMask
  //**************************************************************************
    var createMask = function(parent){
        var div = createElement("div", parent);
        div.setAttribute("desc", "mask");
        div.style.position = "absolute";
        div.style.zIndex = 3;
        div.style.top = "0px";
        div.style.width = "100%";
        div.style.height = "100%";
        div.style.backgroundColor = "#f5f5f5"; //maybe put this in main.css?
        addShowHide(div);
        div.hide();
        mask = div;
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
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var isDirty = javaxt.dhtml.utils.isDirty;
    var isArray = javaxt.dhtml.utils.isArray;
    var setStyle = javaxt.dhtml.utils.setStyle;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var addResizeListener = javaxt.dhtml.utils.addResizeListener;
    var createElement = javaxt.dhtml.utils.createElement;
    var createTable = javaxt.dhtml.utils.createTable;

    var createSpacer = bluewave.utils.createSpacer;
    var resizeCanvas = bluewave.utils.resizeCanvas;
    var createDashboardItem = bluewave.utils.createDashboardItem;



    init();
};
