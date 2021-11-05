if(!bluewave) var bluewave={};

//******************************************************************************
//**  MapAdmin
//******************************************************************************
/**
 *   Panel used to manage available map services and layers
 *
 ******************************************************************************/

bluewave.MapAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {};
    var waitmask;
    var basemaps = [];
    var grid, editor;
    var addButton, editButton, deleteButton, moveUpButton, moveDownButton;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


      //Create table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;

      //Row 1
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "panel-toolbar";
        tr.appendChild(td);
        createToolbar(td);

      //Row 2
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);

        parent.appendChild(table);
        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        basemaps = [];
        grid.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();

        waitmask.show(500);
        get("admin/settings/basemap", {
            success: function(arr){
               basemaps = arr;
               grid.load(basemaps);
               waitmask.hide();
            },
            failure: function(request){
                if (request.status!==404) alert(request);
                waitmask.hide();
            }
        });
    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){
        var toolbar = document.createElement('div');

      //Add button
        addButton = createButton(toolbar, {
            label: "Add",
            icon: "fas fa-plus-circle"
        });
        addButton.onClick = function(){
            editBaseMap();
        };

      //Edit button
        editButton = createButton(toolbar, {
            label: "Edit",
            icon: "fas fa-edit",
            disabled: true
        });
        editButton.onClick = function(){
            var index = 0;
            grid.forEachRow(function (row) {
                if (row.selected){
                    editBaseMap(row.record, index);
                    return true;
                }
                index++;
            });
        };

      //Delete button
        deleteButton = createButton(toolbar, {
            label: "Delete",
            icon: "fas fa-trash",
            disabled: true
        });
        deleteButton.onClick = function(){
            var index = 0;
            grid.forEachRow(function (row) {
                if (row.selected){
                    basemaps.splice(index, 1);
                    updateConfig();
                    return true;
                }
                index++;
            });
        };

        createSpacer(toolbar);

      //MoveUp button
        moveUpButton = createButton(toolbar, {
            label: "Move Up",
            icon: "fas fa-chevron-up",
            disabled: true
        });
        moveUpButton.onClick = function(){
            var records = grid.getSelectedRecords();
            if(records.length>0) moveBaseMap(records[0], 'up');
        };

      //MoveDown button
        moveDownButton = createButton(toolbar, {
            label: "Move Down",
            icon: "fas fa-chevron-down",
            disabled: true
        });
        moveDownButton.onClick = function(){
            var records = grid.getSelectedRecords();
            if(records.length>0) moveBaseMap(records[0], 'down');
        };

        createSpacer(toolbar);

      //Refresh button
        var refreshButton = createButton(toolbar, {
            label: "Refresh",
            icon: "fas fa-sync-alt",
            disabled: false,
            hidden: false
        });
        refreshButton.onClick = function(){
            me.update();
        };

        parent.appendChild(toolbar);
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

        var style = merge({
            column: "admin-map-table-col"
        }, config.style.table);


        grid = new javaxt.dhtml.DataGrid(parent, {
            style: style,
            columns: [
                {header: 'Thumbnail', width:'300', field:'thumbnail'},
                {header: 'URL', width:'100%', field:'url'}
            ],
            update: function(row, basemap){
                var baseURL = basemap.url;
                var layer = new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        url: baseURL
                    })
                });


                var img = document.createElement("img");
                getTilePreview(layer, [3,2,3], function(preview){
                    img.src = preview;
                });
                img.onload = function(){
                    row.set('Thumbnail', img);
                };

                var div = document.createElement("div");

                var name = document.createElement("div");
                name.innerHTML = basemap.name;
                div.appendChild(name);


                var url = document.createElement("div");
                url.innerHTML = basemap.url;
                div.appendChild(url);

                row.set('URL', div);
            }
        });

        grid.onSelectionChange = function(){
             var records = grid.getSelectedRecords();
             if (records.length>0){
                 editButton.enable();
                 deleteButton.enable();
                 moveUpButton.enable();
                 moveDownButton.enable();
             }
             else{
                 editButton.disable();
                 deleteButton.disable();
                 moveUpButton.disable();
                 moveDownButton.disable();
             }
        };

        grid.update = function(){
            grid.clear();
            grid.load(basemaps);
        };

    };


  //**************************************************************************
  //** editBaseMap
  //**************************************************************************
    var editBaseMap = function(basemap, index){

      //instantitate the editor if need be
        if (!editor) createEditor();


      //Clear/reset the form
        editor.clear();

      //Updated values
        if (basemap){
            editor.setTitle("Edit Base Map");
            editor.update(basemap, index);
            editor.show();
        }
        else{
            editor.setTitle("New Basemap");
            editor.show();
        }
    };


  //**************************************************************************
  //** moveBaseMap
  //**************************************************************************
    var moveBaseMap = function(basemap, movement){
        var originalIndex = basemaps.map(e => e.name).indexOf(basemap.name);
        var newIndex;
        if(movement === 'up'){
            newIndex = originalIndex - 1;
        }else if(movement === 'down'){
            newIndex = originalIndex + 1;
        }
        arrayMove(basemaps, originalIndex, newIndex);
        updateConfig();
    };


  //**************************************************************************
  //** arrayMove
  //**************************************************************************
    var arrayMove = function(arr, fromIndex, toIndex) {
        var element = arr[fromIndex];
        arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, element);
    };


  //**************************************************************************
  //** updateConfig
  //**************************************************************************
    var updateConfig = function(){
        save("admin/settings/basemap", JSON.stringify(basemaps), {
            success: function(){
                if (editor) editor.close();
                me.update();
            },
            failure: function(request){
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** createButton
  //**************************************************************************
    var createButton = function(parent, btn){
        var defaultStyle = JSON.parse(JSON.stringify(config.style.toolbarButton));
        if (btn.style) btn.style = merge(btn.style, defaultStyle);
        else btn.style = defaultStyle;
        return bluewave.utils.createButton(parent, btn);
    };


  //**************************************************************************
  //** createEditor
  //**************************************************************************
    var createEditor = function(){
        var win = new javaxt.dhtml.Window(document.body, {
            width: 450,
            valign: "top",
            modal: true,
            resizable: false,
            style: config.style.window
        });

        var form = new javaxt.dhtml.Form(win.getBody(), {
            style: config.style.form,
            items: [
                {
                    group: "Basemap",
                    items: [
                        {
                            name: "name",
                            label: "Name",
                            type: "text",
                            required: true
                        },
                        {
                            name: "url",
                            label: "URL",
                            type: "text",
                            required: true
                        },
                        {
                            name: "key",
                            label: "Key",
                            type: "text",
                            required: true
                        },
                        {
                            name: "id",
                            label: "id",
                            type: "hidden"
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
                        me.onCancel();
                    }
                },
                {
                    name: "Submit",
                    onclick: function(){

                        var values = form.getData();

                        var name = values.name;
                        if(name) name = name.trim();
                        if(name==null || name=="") {
                            warn("Name is required", form.findField("name"));
                            return;
                        }

                        var url = values.url;
                        if(url) url = url.trim();
                        if(url==null || url=="") {
                            warn("URL is required", form.findField("url"));
                            return;
                        }

                        var key = values.key;
                        if (key) key = key.trim();


                        var basemap = {
                            name: name,
                            url: url,
                            key: key
                        };


                        var id = parseInt(values.id);
                        if (isNaN(id)){
                            basemaps.push(basemap);
                        }
                        else{
                            basemaps[id] = basemap;
                        }


                        updateConfig();
                    }
                }
            ]
        });

        editor = win;
        editor.clear = form.clear;
        editor.update = function(baseMap, id){
            form.clear();
            if (baseMap){

                form.setValue("id", id+"");
                for (var key in baseMap) {
                    if (baseMap.hasOwnProperty(key)){
                        var value = baseMap[key];
                        form.setValue(key, value);
                    }
                }
            }
        };
    };


  //**************************************************************************
  //** getTilePreview
  //**************************************************************************
    var getTilePreview = function(layer, coord, callback){
        if (!callback) return;

        var proj = ol.proj.get('EPSG:3857');
        var getPreview = function(){
            var tileUrlFunction = layer.getSource().getTileUrlFunction();
            var tileCoord = [3,2,3]; //Southeast coast of US, Carribean, and part of South America
            var preview = tileUrlFunction(tileCoord, 1, proj);
            if (preview){
                if (preview.indexOf("-4")>-1){
                    preview = preview.replace("-4", "3"); //add hack to replace wierd -4 y coordinate
                }
            }
            return preview;
        };

        var preview = getPreview();
        if (preview){
            callback.apply(me, [preview]);
        }
        else{
            var timer;
            var checkPreview = function(){
                var preview = getPreview();
                if (preview){
                    clearTimeout(timer);
                    callback.apply(me, [preview]);
                }
                else{
                    timer = setTimeout(checkPreview, 1000);
                }
            };
            timer = setTimeout(checkPreview, 1000);
        }
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var createSpacer = bluewave.utils.createSpacer;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var get = bluewave.utils.get;
    var save = javaxt.dhtml.utils.post;
    var warn = bluewave.utils.warn;

    init();
};