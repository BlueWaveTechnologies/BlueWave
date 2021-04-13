if(!bluewave) var bluewave={};

//******************************************************************************
//**  UserList
//******************************************************************************
/**
 *   Panel used to view and manage users
 *
 ******************************************************************************/

bluewave.UserList = function(parent, config) {

    var me = this;
    var grid, userEditor;
    var addButton, editButton, deleteButton;
    var filter = {};


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

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
            editUser();
        };


      //Edit button
        editButton = createButton(toolbar, {
            label: "Edit",
            icon: "fas fa-edit",
            disabled: true
        });
        editButton.onClick = function(){
            var records = grid.getSelectedRecords();
            if (records.length>0) editUser(records[0]);
        };



      //Delete button
        deleteButton = createButton(toolbar, {
            label: "Delete",
            icon: "fas fa-trash",
            disabled: true
        });
        deleteButton.onClick = function(){
            var records = grid.getSelectedRecords();
            if (records.length>0) deleteUser(records[0]);
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
            grid.refresh();
        };


        parent.appendChild(toolbar);
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){


        grid = new javaxt.dhtml.DataGrid(parent, {
            style: config.style.table,
            url: "users",
            filter: filter,
            parseResponse: parseResponse,
            columns: [
                {header: 'ID', hidden:true, field:'id'},
                {header: 'Name', width:'100%', field:'contactID'},
                {header: 'Username', width:'150', field:'username'},
                {header: 'Role', width:'240', field:'accessLevel'},
                {header: 'Active', width:'75', field:'active'}
            ],
            update: function(row, user){
                var name;
                if (user.fullName){
                    name = user.fullName;
                }
                else{
                    var firstName = user.firstName;
                    var lastName = user.firstName;
                    if (firstName){
                        name = firstName;
                        if (lastName) name += " " + lastName;
                    }
                    else{
                        name = lastName;
                    }
                }

                if (!name) name = user.username;
                row.set('Name', name);
                row.set('Username', user.username);
                var role = user.accessLevel;
                if (role==5) role = "Administrator";
                if (role==4) role = "Advanced";
                if (role==3) role = "Contributor";
                if (role==2) role = "Browser";
                if (role==1) role = "Custom";
                row.set('Role', role);
                row.set('Active', user.active+"");
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


        grid.update();
    };


  //**************************************************************************
  //** editUser
  //**************************************************************************
    var editUser = function(user){
        var nopass = "--------------";

      //Instantiate user editor as needed
        if (!userEditor){
            userEditor = new bluewave.UserEditor(document.body, {
                style: config.style
            });
            userEditor.onSubmit = function(){
                var user = userEditor.getValues();
                var password = user.password;
                if (password===nopass) delete user.password;

                save("user", JSON.stringify(user), {
                    success: function(){
                        userEditor.close();
                        grid.update();
                    },
                    failure: function(request){
                        alert(request);
                    }
                });
            };
        }


      //Clear/reset the form
        userEditor.clear();


      //Updated values
        if (user){
            userEditor.setTitle("Edit User");

            get("user?id="+user.id, {
                success: function(user){
                    userEditor.update(user);
                    userEditor.setValue("password", nopass);
                    userEditor.show();
                },
                failure: function(request){
                    alert(request);
                }
            });

        }
        else{
            userEditor.setTitle("New User");
            userEditor.setValue("active", true);
            userEditor.setValue("accessLevel", 2);
            userEditor.show();
        }
    };


  //**************************************************************************
  //** deleteUser
  //**************************************************************************
    var deleteUser = function(user){
        del("user?id=" + user.id, {
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
    var get = bluewave.utils.get;
    var save = javaxt.dhtml.utils.post;
    var del = javaxt.dhtml.utils.delete;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;


    var createSpacer = bluewave.utils.createSpacer;
    var parseResponse = function(request){

        var response;
        if ((typeof(request) === 'string' || request instanceof String)){
            response = JSON.parse(request);
        }
        else{
            response = JSON.parse(request.responseText);
        }


        var rows = response.rows;
        var cols = {};
        for (var i=0; i<response.cols.length; i++){
            cols[response.cols[i]] = i;
        }
        for (var i=0; i<rows.length; i++){
            var row = rows[i];
            var obj = {};
            for (var col in cols) {
                if (cols.hasOwnProperty(col)){
                    obj[col] = row[cols[col]];
                }
            }
            rows[i] = obj;
        }
        return rows;
    };


    init();
};