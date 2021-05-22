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
    var defaultConfig = {
        maxIdleTime: 5*60*1000 //5 minutes
    };
    var grid, userEditor;
    var addButton, editButton, deleteButton;
    var lastRefresh;
    var filter = {};
    var activeUsers = {};


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
    this.update = function(_activeUsers){
        activeUsers = _activeUsers;
        grid.update();
    };


  //**************************************************************************
  //** updateActivity
  //**************************************************************************
    this.updateActivity = function(userID, op){
        var currTime = new Date().getTime();
        if (op==="logoff") delete activeUsers[userID+""];
        else activeUsers[userID+""] = currTime;
        grid.forEachRow(function (row) {
            if (row.record.id===userID){
                lastRefresh = currTime;
                row.update(row, row.record);
                return true;
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
            url: "users",
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
                {header: 'Name', width:'100%', field:'contactID'},
                {header: 'Username', width:'150', field:'username'},
                {header: 'Role', width:'240', field:'accessLevel'},
                {header: 'Enabled', width:'75', field:'active'},
                {header: 'Last Active', width:'125', align:'left'}
            ],
            update: function(row, user){

              //Get name
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



              //Render name with status icon
                var div = document.createElement("div");
                div.style.height = "100%";
                var statusIcon = document.createElement("div");
                statusIcon.className = "user-status";
                div.appendChild(statusIcon);
                var span = document.createElement("span");
                span.innerHTML = name;
                div.appendChild(span);
                var lastEvent = activeUsers[user.id+""];
                if (lastEvent){
                    var startTime = lastEvent;
                    var endTime = lastEvent+config.maxIdleTime;
                    fadeOut(statusIcon, "#00c34e", "#cccccc", startTime, endTime, lastRefresh);

                  //TODO: add moment.js to the libs so we don't have to do this...
                    var d = new Date(lastEvent);
                    var m = d.getMinutes(); m = (m<9 ? "0"+m : m+"");
                    var h = d.getHours();
                    if (h==0) h = "12:" + m + " am";
                    else if (h==12) h = "12:" + m + " pm";
                    else{
                        if (h>12) h = h-12 + ":" + m + " pm";
                        else h += ":" + m + " am";
                    }
                    var month = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(",");
                    var str = month[d.getMonth()] +" "+d.getDate() + " " + h;

                    row.set('Last Active', str);
                }



                row.set('Name', div);
                row.set('Username', user.username);
                var role = user.accessLevel;
                if (role==5) role = "Administrator";
                if (role==4) role = "Advanced";
                if (role==3) role = "Contributor";
                if (role==2) role = "Browser";
                if (role==1) role = "Custom";
                row.set('Role', role);
                row.set('Enabled', user.active+"");
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
  //** fadeOut
  //**************************************************************************
    var fadeOut = function(div, startColor, endColor, startTime, endTime, refreshID){

        if (refreshID!==lastRefresh) return;


        var currTime = new Date().getTime();

        if (currTime >= endTime){
            div.style.backgroundColor = endColor;

            var inactiveUsers = [];
            for (var key in activeUsers) {
                if (activeUsers.hasOwnProperty(key)){
                    var lastUpdate = activeUsers[key];
                    if (lastUpdate===startTime){
                        inactiveUsers.push(key);
                    }
                }
            }

            for (var i in inactiveUsers){
                var userID = inactiveUsers[i];
                delete activeUsers[userID];
            }

            return;
        }

        var ellapsedTime = currTime-startTime;
        var totalRunTime = endTime-startTime;
        var percentComplete = ellapsedTime/totalRunTime;
        //console.log(percentComplete);


        div.style.backgroundColor = chroma.mix(startColor, endColor, percentComplete);


        setTimeout(function(){
            fadeOut(div, startColor, endColor, startTime, endTime, refreshID);
        }, 1000);

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



    init();
};