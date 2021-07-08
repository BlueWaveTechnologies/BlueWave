if(!bluewave) var bluewave={};

//******************************************************************************
//**  Permissions
//******************************************************************************
/**
 *   Panel used to view and manage permissions for individual dashboards
 *
 ******************************************************************************/

bluewave.Permissions = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };
    var grid, userEditor;
    var addButton, editButton, deleteButton;
    var lastRefresh;
    var currDashboard;
    var users; //DataStore. Do not use directly. Call getUsers() instead
    var currUser;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

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
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (userEditor) userEditor.hide();
        if (grid) grid.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(dashboardID){
        currDashboard = dashboardID;
        currUser = document.user.id;
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
            url: "DashboardUsers",
            getResponse: function(url, payload, callback){
                if (url.indexOf("?")==-1) url+= "?";
                get(url + "&dashboardID="+currDashboard+"&userID=!"+currUser, {
                    success: function(dashboardUsers){

                        getUsers(function(users){

                            for (var i=0; i<dashboardUsers.length; i++){
                                var dashboardUser = dashboardUsers[i];
                                for (var j=0; j<users.length; j++){
                                    var user = users.get(j);
                                    if (user.id===dashboardUser.userID){
                                        dashboardUser.username = user.username;
                                        dashboardUser.accessLevel = user.accessLevel;
                                        break;
                                    }
                                }
                            }


                            callback.apply(grid, [{
                               status: 200,
                               rows: dashboardUsers
                            }]);

                        });
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
                {header: 'ID', hidden:true, field: 'id'},
                {header: 'Username', width:'100%', field:'userID'},
                {header: 'Read Only', width:'150', field:'readOnly'}
            ],
            update: function(row, dashboardUser){
                row.set('ID', dashboardUser.id);
                row.set('Username', dashboardUser.username);

                if (dashboardUser.accessLevel<3) dashboardUser.readOnly = true;

                if (dashboardUser.readOnly){
                    var icon = document.createElement("i");
                    icon.className = "fas fa-check";
                    icon.style.lineHeight = "35px";
                    icon.style.color = "green";
                    row.set('Read Only', icon);
                }
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
            lastRefresh = new Date().getTime();
            grid.clear();
            grid.load();
        };

    };


  //**************************************************************************
  //** getUsers
  //**************************************************************************
    var getUsers = function(callback){

        if (users) callback.apply(me,[users]);
        else{
            if (!config.dataStores) config.dataStores = {};
            users = config.dataStores["User"];
            if (users) callback.apply(me,[users]);
            else{
                get("users", {
                    success: function(arr){

                        users = new javaxt.dhtml.DataStore(arr);
                        config.dataStores["User"] = users;
                        users.addEventListener("add", function(user){
                            refresh();
                        }, me);

                        users.addEventListener("update", function(user){
                            refresh();
                        }, me);

                        users.addEventListener("remove", function(user){
                            refresh();
                        }, me);


                        callback.apply(me,[users]);
                    },
                    failure: function(request){
                        alert(request);
                    }
                });
            }
        }
    };


  //**************************************************************************
  //** editUser
  //**************************************************************************
    var editUser = function(dashboardUser){

        if (!userEditor){

            var win = new javaxt.dhtml.Window(document.body, {
                title: "Edit User",
                width: 450,
                valign: "top",
                modal: true,
                style: config.style.window
            });

            var userList = new javaxt.dhtml.ComboBox(document.createElement("div"), {
                style: config.style.combobox,
                scrollbar: true
            });


            var form = new javaxt.dhtml.Form(win.getBody(), {
                style: config.style.form,
                items: [
                    {
                        name: "user",
                        label: "User",
                        type: userList
                    },
                    {
                        name: "readOnly",
                        label: "Read Only",
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
                    },
                    {
                        name: "id",
                        type: "hidden"
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

                            var values = form.getData();
                            var userID = parseInt(values.user);
                            if (isNaN(userID)) {
                                warn("User is required", form.findField("user"));
                                return;
                            }


                            var dashboardUser = {
                                dashboardID: currDashboard,
                                userID: userID,
                                readOnly: values.readOnly==="true"
                            };

                            var id = parseInt(values.id);
                            if (!isNaN(id)) dashboardUser.id = id;



                            save("DashboardUser", JSON.stringify(dashboardUser), {
                                success: function(){
                                    win.close();
                                    grid.update();
                                },
                                failure: function(request){
                                    alert(request);
                                }
                            });
                        }
                    }
                ]
            });


            var lastSearch = 0;
            form.onChange = function(field){
                if (field.name==="user"){
                    var name = field.getText();
                    var userID = field.getValue();

                    if (userID){ //user either selected an item in the list or typed in an exact match

                    }
                    else{

                        if (name.trim().length>0){
                            (function (name) {

                                get("users?username=startswith("+encodeURIComponent(name)+")&active=true&fields=id,username&limit=50",{
                                    success: function(arr){

                                        var currTime = new Date().getTime();
                                        if (currTime<lastSearch) return;
                                        lastSearch = currTime;

                                        userList.removeAll();
                                        if (arr.length===0){
                                            userList.hideMenu();
                                        }
                                        else{
                                            for (var i=0; i<arr.length; i++){
                                                var user = arr[i];
                                                if (user.id!==currUser){
                                                    userList.add(user.username, user.id);
                                                }
                                            }
                                            userList.showMenu();
                                        }
                                    }
                                });
                            })(name);
                        }
                    }
                }
            };


            userEditor = {
                show: function(){
                    win.show();
                },
                hide: function(){
                    win.hide();
                }
            };


            userEditor.update = function(dashboardUser){
                form.clear();
                if (userList.resetColor) userList.resetColor();
                form.enableField("fei");

                if (dashboardUser){
                    win.setTitle("Edit User");
                    form.setValue("id", dashboardUser.id);
                    form.setValue("readOnly", dashboardUser.readOnly);
                    userList.add(dashboardUser.username, dashboardUser.userID);
                    userList.setValue(dashboardUser.username);

                    if (dashboardUser.accessLevel<3){
                        form.disableField("readOnly");
                    }
                }
                else{
                    win.setTitle("Add User");
                    form.setValue("readOnly", true);
                }
            };
        }


        userEditor.update(dashboardUser);
        userEditor.show();

    };


  //**************************************************************************
  //** deleteUser
  //**************************************************************************
    var deleteUser = function(DashboardUser){
        del("DashboardUser?id=" + DashboardUser.id, {
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
    var get = bluewave.utils.get;
    var save = javaxt.dhtml.utils.post;
    var del = javaxt.dhtml.utils.delete;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var createSpacer = bluewave.utils.createSpacer;
    var warn = bluewave.utils.warn;



    init();
};