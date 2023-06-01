if(!bluewave) var bluewave={};

//******************************************************************************
//**  Homepage
//******************************************************************************
/**
 *   Landing page for the app.
 *
 ******************************************************************************/

bluewave.Homepage = function(parent, config) {

    var me = this;
    var mainDiv;
    var dashboardItems = [];
    var dashboardMenu, groupMenu; //callouts
    var waitmask;
    var groupEditor, moveOptions; //windows
    var windows = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;

        var div = createElement("div", parent);
        div.className = "dashboard-homepage";
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";
        me.el = div;

        mainDiv = createElement("div", div);
        mainDiv.style.height = "100%";


      //Add listeners to the "Dashboard" store
        var dashboards = config.dataStores["Dashboard"];
        dashboards.addEventListener("add", function(dashboard){
            deleteGroupStore();
            refresh();
        }, me);

        dashboards.addEventListener("update", function(dashboard){
            t = new Date().getTime();
            refresh();
        }, me);

        dashboards.addEventListener("remove", function(dashboard){
            deleteGroupStore();
            refresh();
        }, me);

    };


  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        return "Dashboards";
    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
    this.onUpdate = function(){};


  //**************************************************************************
  //** onClick
  //**************************************************************************
    this.onClick = function(dashboard){};


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        refresh();
        me.onUpdate();
    };


  //**************************************************************************
  //** getDashboardItems
  //**************************************************************************
  /** Returns all the dashboard items in the view
   */
    this.getDashboardItems = function(){
        return dashboardItems;
    };


  //**************************************************************************
  //** createGroup
  //**************************************************************************
    this.createGroup = function(callback){
        me.editGroup(null, callback);
    };


  //**************************************************************************
  //** editGroup
  //**************************************************************************
    this.editGroup = function(group, callback){
        if (!groupEditor){
            var win = createWindow({
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
                            checkGroupName(name, function(isValid){
                                waitmask.hide();
                                if (!isValid){
                                    warn("Name is not unique", form.findField("name"));
                                }
                                else{
                                    win.close();
                                    groupEditor.onSubmit(inputs);
                                }
                            });
                        }
                    }
                ]

            });

            groupEditor = form;
            groupEditor.show = function(){
                win.show();
            };
            groupEditor.setTitle = function(title){
                win.setTitle(title);
            };
        }

        groupEditor.clear();
        var nameField = groupEditor.findField("name");
        if (nameField.resetColor) nameField.resetColor();
        if (group){
            groupEditor.setTitle("Edit Group");
            if (group.name) groupEditor.setValue("name", group.name);
        }
        else{
            groupEditor.setTitle("New Group");
        }

        groupEditor.onSubmit = function(inputs){
            if (!group) group = {};
            for (var key in inputs) {
                if (inputs.hasOwnProperty(key)){
                    group[key] = inputs[key];
                }
            }


            var newGroup = isNaN(group.id);
            getGroups(function(groups){
                saveGroup(group, function(){
                    if (newGroup){
                        groups.insert(group, 0);
                        if (groups.length>3){
                            sort(groups);
                        }
                    }
                    refresh();
                    if (callback) callback.apply(me,[group]);
                });
            });
        };

        waitmask.hide();
        groupEditor.show();
    };


  //**************************************************************************
  //** refresh
  //**************************************************************************
    var refresh = function(){
        dashboardItems = [];
        mainDiv.innerHTML = "";
        getGroups(render);
    };


  //**************************************************************************
  //** render
  //**************************************************************************
    var render = function(){
        var dashboards = config.dataStores["Dashboard"];
        var groups = config.dataStores["DashboardGroup"];

      //Create groups as needed
        if (groups.length===0){
            var myDashboards = [];
            var sharedDashboards = [];
            for (var i=0; i<dashboards.length; i++){
                var dashboard = dashboards.get(i);
                if (dashboard.className && dashboard.className.indexOf("bluewave.Explorer")===0){
                    myDashboards.push(dashboard.id);
                }
                else{
                    sharedDashboards.push(dashboard.id);
                }
            }
            if (myDashboards.length>0){
                groups = new javaxt.dhtml.DataStore();
                groups.add({
                    name: "My Dashboards",
                    dashboards: myDashboards
                });
                groups.add({
                    name: "Shared Dashboards",
                    dashboards: sharedDashboards
                });
            }
        }



      //Render dashboards by group
        if (groups.length===0){
            var arr = [];
            for (var i=0; i<dashboards.length; i++){
                arr.push(dashboards.get(i));
            }
            sort(arr);
            for (var i=0; i<arr.length; i++){
                add(arr[i], mainDiv);
            }
        }
        else{
            var renderedDashboards = {};
            for (var i=0; i<groups.length; i++){
                var group = groups.get(i);
                var arr = [];
                if (group.dashboards){
                    for (var j=0; j<group.dashboards.length; j++){
                        var dashboardID = group.dashboards[j];
                        for (var k=0; k<dashboards.length; k++){
                            var dashboard = dashboards.get(k);
                            if (dashboard.id===dashboardID){
                                arr.push(dashboard);
                                renderedDashboards[dashboard.id+""] = true;
                            }
                        }
                    }
                }

                if (isDefaultGroup(group) && arr.length===0){
                    //don't render an empty default group
                }
                else{
                    var g = createGroupBox(group);
                    sort(arr);
                    for (var j=0; j<arr.length; j++){
                        add(arr[j], g);
                    }
                }
            }



          //Check if there are any dashboards without a group
            var arr = [];
            for (var i=0; i<dashboards.length; i++){
                var dashboard = dashboards.get(i);
                if (!renderedDashboards[dashboard.id+""]) arr.push(dashboard);
            }


          //Add ungrouped dashboards
            if (arr.length>0){


                groups.add({
                    name: "Shared Dashboards",
                    dashboards: []
                });

                var g = createGroupBox(groups.get(groups.length-1));

                sort(arr);
                for (var i=0; i<arr.length; i++){
                    add(arr[i], g);
                }
            }
        }
    };


  //**************************************************************************
  //** sort
  //**************************************************************************
    var sort = function(arr){
        if (!arr) return;
        arr.sort(function(a, b){
            return a.name.localeCompare(b.name);
        });
    };


  //**************************************************************************
  //** add
  //**************************************************************************
    var add = function(dashboard, parent){


      //Create dashboardItem
        var preview = new bluewave.dashboard.CardView(parent);
        preview.update(dashboard);
        var dashboardItem = preview.getDashboardItem();
        dashboardItem.dashboard = dashboard;
        dashboardItems.push(dashboardItem);


      //Make the dashboardItem draggable
        dashboardItem.el.draggable = true;
        dashboardItem.el.dataset["dashboard"] = dashboard.id;
        dashboardItem.el.ondragstart = onDragStart;


      //Update dashboardItem
        dashboardItem.innerDiv.style.verticalAlign = "top";
        //dashboardItem.innerDiv.style.cursor = "pointer";
        //dashboardItem.innerDiv.style.textAlign = "center";
        dashboardItem.innerDiv.onclick = function(){
            if (dashboardMenu) dashboardMenu.hide();
            me.onClick(dashboardItem);
        };


      //Show/hide dashboardMenu and setting wheel using the mouse over and out events
        dashboardItem.settings.style.opacity = 0;
        dashboardItem.el.onmouseover = function(){
            dashboardItem.settings.style.opacity = 1;
            if (dashboardMenu){
                if (dashboardMenu.dashboard.id!==dashboard.id){
                    dashboardMenu.dashboardItem.settings.style.opacity = 0;
                    dashboardMenu.hide();
                }
            }
        };
        dashboardItem.el.onmouseout = function(){
            if (dashboardMenu){
                if (dashboardMenu.isVisible()){
                    if (dashboardMenu.dashboard.id===dashboard.id) return;
                }
            }
            dashboardItem.settings.style.opacity = 0;
        };


      //Watch for settings onClick events
        dashboardItem.settings.onclick = function(e){
            getDashboardMenu();
            var rect = javaxt.dhtml.utils.getRect(this);
            var x = rect.x + (rect.width/2) - 1;
            var y = rect.y + rect.height - 2;
            y = e.clientY;
            dashboardMenu.dashboard = dashboard;
            dashboardMenu.dashboardItem = dashboardItem;
            if (dashboard.permissions){
                dashboardMenu.updateMenu(dashboard.permissions);
                if (dashboardMenu.hasMenuItems()){
                    dashboardMenu.showAt(x, y, "below", "right");
                }
            }
            else{
                get("dashboard/permissions?dashboardID="+dashboard.id,{
                    success: function(permissions) {
                        permissions = permissions[0];
                        if (permissions.dashboardID===dashboardMenu.dashboard.id){
                            dashboardMenu.dashboard.permissions = permissions.permissions;
                            dashboardMenu.updateMenu(dashboardMenu.dashboard.permissions);
                            if (dashboardMenu.hasMenuItems()){
                                dashboardMenu.showAt(x, y, "below", "right");
                            }
                        }
                        else{
                            dashboardMenu.hide();
                        }
                    },
                    failure: function(){
                        dashboardMenu.hide();
                    }
                });
            }
        };
    };


  //**************************************************************************
  //** createGroupBox
  //**************************************************************************
    var createGroupBox = function(group){

        var div = createElement("div", "dashboard-group");
        div.style.position = "relative";
        div.addEventListener('dragover', onDragOver, false);
        div.addEventListener('drop', onDrop, false);
        div.group = group;


        var header = createElement("div", div, "dashboard-group-header noselect");
        header.style.position = "absolute";


        var label = createElement("span", header);
        label.innerText = group.name;


        if (!isDefaultGroup(group)){

            var settings = createElement("div", header, "dashboard-group-settings");
            settings.innerHTML = '<i class="fas fa-cog"></i>';
            settings.style.opacity = 0;


          //Show/hide setting wheel using the mouse over and out events
            header.onmouseover = function(){
                settings.style.opacity = 1;
                if (groupMenu){
                    if (groupMenu.group.id!==group.id){
                        groupMenu.settings.style.opacity = 0;
                        groupMenu.hide();
                    }
                }
            };
            header.onmouseout = function(){
                if (groupMenu){
                    if (groupMenu.isVisible()){
                        if (groupMenu.group.id===group.id) return;
                    }
                }
                settings.style.opacity = 0;
            };

          //Watch for settings onClick events
            settings.onclick = function(e){
                getGroupMenu();
                var rect = javaxt.dhtml.utils.getRect(this);
                var x = rect.x + (rect.width/2) - 1;
                var y = rect.y + rect.height - 2;
                y = e.clientY;
                groupMenu.group = group;
                groupMenu.settings = this;
                groupMenu.showAt(x, y, "below", "left");
            };
        }

        mainDiv.appendChild(div);
        return div;
    };


  //**************************************************************************
  //** onDragStart
  //**************************************************************************
    var onDragStart = function(e) {
        e.dataTransfer.setData(
            "dashboard",
            e.target.getAttribute("data-dashboard")
        );
    };


  //**************************************************************************
  //** onDragOver
  //**************************************************************************
  /** Called when the client drags something over a groupbox
   */
    var onDragOver = function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy
    };


  //**************************************************************************
  //** onDrop
  //**************************************************************************
  /** Called when the client drops something onto a groupbox
   */
    var onDrop = function(e){
        e.stopPropagation();
        e.preventDefault();


      //Get dashboard ID from the data transfer
        var dashboardID = parseInt(e.dataTransfer.getData("dashboard"));

      //Move dashboard
        moveDashboard(dashboardID, this.group);
    };


  //**************************************************************************
  //** moveDashboard
  //**************************************************************************
  /** Used to move a dashboard from it's current group to a new one
   */
    var moveDashboard = function(dashboardID, newGroup){

      //Find original group
        var orgGroup, idx;
        config.dataStores["DashboardGroup"].forEach((group)=>{
            if (group.dashboards){
                idx = -1;
                group.dashboards.forEach((id, i)=>{
                   if (id===dashboardID) idx = i;
                });
                if (idx>-1){
                    orgGroup = group;
                    return true;
                }
            }
        });


      //Do some sanity checking to prevent dragging/dropping into the same group
        if (!orgGroup) return;
        if (orgGroup.id===newGroup.id && !isNaN(orgGroup.id) && !isNaN(newGroup.id)) return;
        if (orgGroup===newGroup) return;


      //Remove dashboard from it's original group
        orgGroup.dashboards.splice(idx, 1);


      //Add dashboard to the new group
        if (!newGroup.dashboards) newGroup.dashboards = [];
        newGroup.dashboards.push(dashboardID);



      //Save orginal and new groups as needed
        if (isNaN(newGroup.id)){
            if (isNaN(orgGroup.id)){
                refresh();
            }
            else{
                saveGroup(orgGroup, function(){
                    refresh();
                });
            }
        }
        else{
            saveGroup(newGroup, function(){
                if (isNaN(orgGroup.id)){
                    refresh();
                }
                else{
                    saveGroup(orgGroup, function(){
                        refresh();
                    });
                }
            });
        }
    };


  //**************************************************************************
  //** getDashboardMenu
  //**************************************************************************
    var getDashboardMenu = function(){
        if (!dashboardMenu){
            dashboardMenu = new javaxt.dhtml.Callout(document.body,{
                style: config.style.callout
            });

            var div = createElement("div", dashboardMenu.getInnerDiv(), "dashboard-homepage-menu");

            var menu = {};

            menu.delete = createMenuOption("Delete", "trash", function(){
                dashboardMenu.hide();
                var dashboardID = dashboardMenu.dashboard.id;
                confirm("Are you sure you want to delete this dashboard?",{
                    leftButton: {label: "Yes", value: true},
                    rightButton: {label: "No", value: false},
                    callback: function(yes){
                        if (yes){
                            waitmask.show();
                            del("dashboard/"+dashboardID, {
                                success: function(){
                                    me.update();
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
            });

            menu.move = createMenuOption("Move", "share", function(){
                dashboardMenu.hide();
                showMoveOptions(dashboardMenu.dashboard);
            });


            div.appendChild(menu.delete);
            div.appendChild(menu.move);


            dashboardMenu.updateMenu = function(permissions){
                if (!permissions) permissions = "r";
                if (permissions=="r"){
                    menu.delete.hide();
                }
                else{
                    menu.delete.show();
                }

                var numGroups = 0;
                var groups = config.dataStores["DashboardGroup"];
                if (groups){
                    groups.forEach((group=>{
                        if (!isDefaultGroup(group)) numGroups++;
                    }));
                }
                if (numGroups>0) menu.move.show();
                else menu.move.hide();
            };

            dashboardMenu.hasMenuItems = function(){
                for (var key in menu) {
                    if (menu.hasOwnProperty(key)){
                        if (menu[key].isVisible()) return true;
                    }
                }
                return false;
            };

        }
        return dashboardMenu;
    };


  //**************************************************************************
  //** getGroupMenu
  //**************************************************************************
    var getGroupMenu = function(){
        if (!groupMenu){
            groupMenu = new javaxt.dhtml.Callout(document.body,{
                style: config.style.callout
            });

            var div = createElement("div", groupMenu.getInnerDiv(), "dashboard-homepage-menu");

            var menu = {};

            menu.edit = createMenuOption("Edit Group", "edit", function(){
                groupMenu.hide();
                groupMenu.settings.style.opacity = 0;
                me.editGroup(groupMenu.group);
            });

            menu.delete = createMenuOption("Delete Group", "trash", function(){
                groupMenu.hide();
                groupMenu.settings.style.opacity = 0;
                var group = groupMenu.group;
                confirm("Are you sure you want to delete this group?",{
                    leftButton: {label: "Yes", value: true},
                    rightButton: {label: "No", value: false},
                    callback: function(yes){
                        if (yes){
                            deleteGroup(group);
                        }
                    }
                });
            });


            div.appendChild(menu.edit);
            div.appendChild(menu.delete);
        }
        return groupMenu;
    };


  //**************************************************************************
  //** createMenuOption
  //**************************************************************************
    var createMenuOption = function(label, icon, onClick){
        var div = createElement("div", "dashboard-homepage-menu-item noselect");
        if (icon && icon.length>0){
            div.innerHTML = '<i class="fas fa-' + icon + '"></i>' + label;
        }
        else{
            div.innerHTML = label;
        }
        div.label = label;
        div.onclick = function(){
            onClick.apply(this, [label]);
        };
        addShowHide(div);
        return div;
    };


  //**************************************************************************
  //** getGroups
  //**************************************************************************
    var getGroups = function(callback){

      //Function used to default "My Dashboards" and "Shared Dashboards" groups
        var createGroups = function(groups){
            var dashboards = config.dataStores["Dashboard"];
            var myDashboards = [];
            var sharedDashboards = [];
            for (var i=0; i<dashboards.length; i++){
                var dashboard = dashboards.get(i);
                if (dashboard.className && dashboard.className.indexOf("bluewave.Explorer")===0){
                    myDashboards.push(dashboard.id);
                }
                else{
                    sharedDashboards.push(dashboard.id);
                }
            }
            if (!groups) groups = new javaxt.dhtml.DataStore();
            if (myDashboards.length>0){
                groups.add({
                    name: "My Dashboards",
                    dashboards: myDashboards
                });
                groups.add({
                    name: "Shared Dashboards",
                    dashboards: sharedDashboards
                });
            }
            return groups;
        };

      //Check if groups exist and if they are populated
        var groups = config.dataStores["DashboardGroup"];
        if (groups){
            if (groups.length==0) createGroups(groups);
            callback.apply(me,[groups]);
            return;
        }

      //Create default groups
        groups = createGroups();
        config.dataStores["DashboardGroup"] = groups;

      //Get user groups
        get("dashboard/groups",{
            success: function(arr) {
                var dashboardIDs = [];

              //Update groups
                arr.forEach((g)=>{
                    groups.add(g);
                    if (g.dashboards) dashboardIDs.push(...g.dashboards);
                });
                sort(groups);


              //Remove items from the default "My Dashboards" and "Shared Dashboards" groups
                groups.forEach((group)=>{
                    if (isDefaultGroup(group)){
                        var dashboards = [];
                        group.dashboards.forEach((dashboardID)=>{
                            var addDashboard = true;
                            for (var i=0; i<dashboardIDs.length; i++){
                                if (dashboardIDs[i]===dashboardID){
                                    addDashboard = false;
                                    break;
                                }
                            }
                            if (addDashboard) dashboards.push(dashboardID);
                        });
                        group.dashboards = dashboards;
                    }
                });

                if (callback) callback.apply(me,[groups]);
            },
            failure: function(){
                if (!document.user){ //standalone mode
                    if (callback) callback.apply(me,[groups]);
                }
            }
        });
    };


  //**************************************************************************
  //** isDefaultGroup
  //**************************************************************************
    var isDefaultGroup = function(group){
        return (isNaN(group.id) && (group.name=="My Dashboards" || group.name=="Shared Dashboards"));
    };


  //**************************************************************************
  //** saveGroup
  //**************************************************************************
    var saveGroup = function(group, callback){
        post("dashboard/group", JSON.stringify(group), {
            success: function(id){
                group.id = parseInt(id);
                if (callback) callback.apply(me,[]);
            },
            failure: function(request){
                alert(request);
                //if (callback) callback.apply(me,[]);
            }
        });
    };


  //**************************************************************************
  //** deleteGroup
  //**************************************************************************
    var deleteGroup = function(group){
        waitmask.show();
        del("dashboard/group/"+group.id, {
            success: function(){
                deleteGroupStore();
                waitmask.hide();
                refresh();
            },
            failure: function(request){
                alert(request);
                waitmask.hide();
            }
        });
    };


  //**************************************************************************
  //** deleteGroupStore
  //**************************************************************************
  /** Destroys the DashboardGroup store. Required for the refresh method to
   *  work correctly.
   */
    var deleteGroupStore = function(){
        if (config.dataStores["DashboardGroup"]){
            config.dataStores["DashboardGroup"].destroy();
            delete config.dataStores["DashboardGroup"];
        }
    };


  //**************************************************************************
  //** checkGroupName
  //**************************************************************************
    var checkGroupName = function(name, callback){
        get("dashboard/groups?fields=id,name",{
            success: function(groups) {
                var isValid = true;
                for (var i in groups){
                    var group = groups[i];
                    if (group.name.toLowerCase()===name.toLowerCase()){
                        //if (group.id!==id){
                            isValid = false;
                            break;
                        //}
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
  //** showMoveOptions
  //**************************************************************************
    var showMoveOptions = function(dashboard){
        if (!moveOptions){

          //Create window
            var win = createWindow({
                title: "Select Group",
                width: 600,
                height: 400,
                valign: "top",
                modal: true,
                style: config.style.window
            });


          //Create buttons
            var buttonDiv = createElement("div", "button-div");
            win.setFooter(buttonDiv);
            var createButton = function(label, callback){
                var input = createElement("input", buttonDiv, "form-button");
                input.type = "button";
                input.name = label;
                input.value = label;
                input.onclick = function(){
                    if (callback) callback();
                    else win.close();
                };
                return input;
            };
            createButton("OK", function(){
                var group;
                grid.forEachRow((r)=>{
                    if (r.record.checked===true){
                        group = r.record;
                        return true;
                    }
                });
                if (!group.hasDashboard){
                    var groupID = group.id;
                    var dashboardID = moveOptions.dashboard.id;
                    config.dataStores["DashboardGroup"].forEach((group)=>{
                        if (group.id===groupID){
                            moveDashboard(dashboardID, group);
                            return true;
                        }
                    });
                }
                win.close();
            });
            createButton("Cancel");




          //Create grid
            var grid = new javaxt.dhtml.DataGrid(win.getBody(), {
                style: config.style.table,
                localSort: true,
                columns: [
                    {header: '', width:'24', sortable: true},
                    {header: 'Group', width:'100%', sortable: true}

                ],
                update: function(row, record){
                    if (record.checked){
                        row.set(0, createIcon());
                    }
                    row.set("Group", record.name);
                }
            });


          //Hide header in grid
            var headerRow = grid.el.getElementsByClassName("table-header")[0];
            headerRow.style.display = "none";


          //Create icon method
            var createIcon = function(){
                var icon = createElement("i", "fas fa-check");
                icon.style.marginTop = "10px";
                return icon;
            };


          //Create update method
            var update = function(dashboard){
                moveOptions.dashboard = dashboard;
                var data = [];
                var groups = config.dataStores["DashboardGroup"];
                groups.forEach((group=>{

                    var hasDashboard = false;
                    if (group.dashboards){
                        group.dashboards.forEach((dashboardID)=>{
                            if (dashboard.id===dashboardID){
                                hasDashboard = true;
                            }
                        });
                    }


                    var addRecord = true;
                    if (isDefaultGroup(group)){
                        addRecord = hasDashboard;
                    }

                    if (addRecord){
                        data.push({
                            id: group.id,
                            name: group.name,
                            checked: hasDashboard,
                            hasDashboard: hasDashboard
                        });
                    }

                }));

                grid.load(data);
                grid.onRowClick = function(row, e){
                    grid.forEachRow((r)=>{
                        r.record.checked = false;
                        r.set(0, '');
                    });
                    row.record.checked = true;
                    row.set(0, createIcon());
                };
            };


          //Create moveOptions object
            moveOptions = {
                show: win.show,
                update: update
            };
        }

        moveOptions.update(dashboard);
        moveOptions.show();
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
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var del = javaxt.dhtml.utils.delete;
    var post = javaxt.dhtml.utils.post;
    var createElement = javaxt.dhtml.utils.createElement;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var warn = bluewave.utils.warn;

    init();
};