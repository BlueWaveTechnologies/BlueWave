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
    var defaultConfig = {

    };
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
        grid.update();
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
               grid.update
               waitmask.hide();
            },
            failure: function(request){
                alert(request);
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
                var records = grid.getSelectedRecords();
                if (records.length>0) editBaseMap(records[0]);
            };

          //Delete button
            deleteButton = createButton(toolbar, {
                label: "Delete",
                icon: "fas fa-trash",
                disabled: true
            });
            deleteButton.onClick = function(){
                var records = grid.getSelectedRecords();
                if (records.length>0) deleteBaseMap(records[0]);
            };

          //MoveUp button
            moveUpButton = createButton(toolbar, {
                label: "Move Up",
                icon: "fas fa-chevron-up",
                disabled: true
            });
            moveUpButton.onClick = function(){
                var records = grid.getSelectedRecords();
                //TODO Move this record up one spot.
            };

          //MoveDown button
            moveDownButton = createButton(toolbar, {
                label: "Move Down",
                icon: "fas fa-chevron-down",
                disabled: true
            });
            moveDownButton.onClick = function(){
                var records = grid.getSelectedRecords();
                //TODO Move this record down one spot.
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
                grid.update();
            };

            parent.appendChild(toolbar);
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

        grid = new javaxt.dhtml.DataGrid(parent, {
            style: config.style.table,
            url: "admin/settings/basemap",
            filter: filter,
            getResponse: function(url, payload, callback){
                get(url, {
                    payload: payload,
                    success: function(json){
                        callback.apply(grid, [{
                           status: 200,
                           rows: json
                        }]);
                    },
                    failure: function(request){
                        callback.apply(grid, [request]);
                    }
                });
            },
            parseResponse: function(obj){
                return obj.rows;
            },
            columns: [
                {header: 'Name', width:'100%', field:'name'},
                {header: 'URL', width:'150', field:'url'},
                {header: 'Key', width:'240', field:'key'},
                {header: 'Thumbnail', width:'240', field:'thumbnail'}
            ],
            update: function(row, basemap){
                var baseURL = basemap.url;
                var layer = new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        url: baseURL
                    })
                });

                var img = document.createElement("img");
                img.src = preview;

                row.set('Name', basemap.name);
                row.set('URL', basemap.url);
                row.set('Key', basemap.key);
                row.set('Thumbnail', img);
            }
        });

        grid.onSelectionChange = function(){
             var records = grid.getSelectedRecords();
             if (records.length>0){
                 editButton.enable();
                 deleteButton.enable();
             }
             else{
                 editButton.disable();
                 deleteButton.disable();
             }
        };

        grid.update = function(){
            grid.clear();
            grid.load();
        };

    };


  //**************************************************************************
  //** editBaseMap
  //**************************************************************************
    var editBaseMap = function(basemap){

        //instantitate the editor if need be
        if (!editor){
            editor = new bluewave.BaseMapEditor(document.body, {
                style: config.style
            });
            editor.onSubmit = function(){
                var basemap = editor.getValues();
                save("admin/settings/basemap", JSON.stringify(basemap), {
                    success: function(){
                        editor.close();
                        grid.update();
                    },
                    failure: function(request){
                        alert(request);
                    }
                });
            };
        }


      //Clear/reset the form
        editor.clear();


      //Updated values
        if (basemap){
            userEditor.setTitle("Edit Base Map");

            get("admin/settings/basemap?id="+basemap.id, {
                success: function(basemap){
                    editor.update(user);
                    editor.show();
                },
                failure: function(request){
                    alert(request);
                }
            });

        }
        else{
            editor.setTitle("New Basemap");
            editor.show();
        }
    };


  //**************************************************************************
  //** deleteBaseMap
  //**************************************************************************
    var deleteBaseMap = function(basemap){
        del("admin/settings/basemap?id=" + basemap.id, {
            success: function(){
                grid.update();
            },
            failure: function(request){
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** updateConfig
  //**************************************************************************
    var updateConfig = function(){
        save("admin/settings/basemap", JSON.stringify(basemaps), {
            success: function(){
                editor.close();
                grid.update();
            },
            failure: function(request){
                alert(request);
            }
        });
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

    init();
};