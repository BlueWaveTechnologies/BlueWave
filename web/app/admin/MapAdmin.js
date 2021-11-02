if(!bluewave) var bluewave={};

//******************************************************************************
//**  MapAdmin
//******************************************************************************
/**
 *   Panel used to manage Map settings
 *
 ******************************************************************************/

 bluewave.UserEditor = function(parent, config) {
    var me = this;
    var defaultConfig = {

    };
    var grid, baseMapEditor;
    var addButton, editButton, deleteButton;
    var filter = {};

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
         //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;

      //Create main table
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
    }


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (baseMapEditor) baseMapEditor.hide();
        if (grid) grid.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        grid.update();
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
            editMap();
        };

      //Edit button
        editButton = createButton(toolbar, {
            label: "Edit",
            icon: "fas fa-edit",
            disabled: true
        });
        editButton.onClick = function(){
            var records = grid.getSelectedRecords();
            if (records.length>0) editMap(records[0]);
        };

      //Delete button
        deleteButton = createButton(toolbar, {
            label: "Delete",
            icon: "fas fa-trash",
            disabled: true
        });
        deleteButton.onClick = function(){
            var records = grid.getSelectedRecords();
            if (records.length>0) deleteMap(records[0]);
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
            url: "baseMaps",
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
                {header: 'ID', hidden:true, field:'id'},
                {header: 'Name', width:'100%', field:'name'},
                {header: 'URL', width:'150', field:'url'},
                {header: 'Thumbnail', width:'150', field:'thumbnail'},
                {header: 'Key', hidden:true, field:'key'},
                {header: 'Layers', hidden:true, field:'layers'},
            ],
            update: function(row, map){

                row.set('Name', map.name);
                row.set('URL', map.url);
                row.set('URL', map.thumbnail);
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
  //** editMap
  //**************************************************************************
    var editMap = function(map){

      //Instantiate base map editor as needed
        if (!baseMapEditor){
            baseMapEditor = new bluewave.BaseMapEditor(document.body, {
                style: config.style
            });
            baseMapEditor.onSubmit = function(){
                var map = baseMapEditor.getValues();

                save("maps", JSON.stringify(map), {
                    success: function(){
                        baseMapEditor.close();
                        grid.update();
                    },
                    failure: function(request){
                        alert(request);
                    }
                });
            };
        }

      //Clear/reset the form
        baseMapEditor.clear();

      //Updated values
        if (map){
            baseMapEditor.setTitle("Edit Base Map");

            get("user?id="+user.id, {
                success: function(user){
                    baseMapEditor.update(map);
                    baseMapEditor.show();
                },
                failure: function(request){
                    alert(request);
                }
            });

        }
        else{
            baseMapEditor.setTitle("New Map");
            baseMapEditor.show();
        }
    };


  //**************************************************************************
  //** deleteMap
  //**************************************************************************
    var deleteMap = function(map){
        del("map?id=" + map.id, {
            success: function(){
                grid.update();
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
  //** Utils
  //**************************************************************************
      var merge = javaxt.dhtml.utils.merge;
      var createTable = javaxt.dhtml.utils.createTable;
      var createSpacer = bluewave.utils.createSpacer;
      var get = bluewave.utils.get;
      var save = javaxt.dhtml.utils.post;
      var del = javaxt.dhtml.utils.delete;
      var merge = javaxt.dhtml.utils.merge;

 }