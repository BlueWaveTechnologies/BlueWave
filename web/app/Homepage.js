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
    var t = new Date().getTime();
    var dashboardItems = [];
    var callout;
    var menu = {};
    var waitmask;
    var groupEditor;
    var windows = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;

        var div = document.createElement("div");
        div.className = "dashboard-homepage";
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";
        parent.appendChild(div);
        me.el = div;

        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        div.appendChild(innerDiv);
        mainDiv = innerDiv;


      //Add listeners to the "Dashboard" store
        var dashboards = config.dataStores["Dashboard"];
        dashboards.addEventListener("add", function(dashboard){
            refresh();
        }, me);

        dashboards.addEventListener("update", function(dashboard){
            t = new Date().getTime();
            refresh();
        }, me);

        dashboards.addEventListener("remove", function(dashboard){
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




            getGroups(function(groups){
                groups.insert(group, 0);
                saveGroup(group, function(){
                    if (callback) callback.apply(me,[group]);
                    refresh();
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
                if (dashboard.className && dashboard.className.indexOf("bluewave.dashboards.")===0){
                    sharedDashboards.push(dashboard.id);
                }
                else{
                    myDashboards.push(dashboard.id);
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
                            }
                        }
                    }
                }
                var g = createGroupBox(group);
                sort(arr);
                for (var j=0; j<arr.length; j++){
                    add(arr[j], g);
                }
            }
        }
    };


  //**************************************************************************
  //** sort
  //**************************************************************************
    var sort = function(arr){
        arr.sort(function(a, b){
            return a.name.localeCompare(b.name);
        });
    };


  //**************************************************************************
  //** add
  //**************************************************************************
    var add = function(dashboard, parent){
        var title = dashboard.name;


      //Create dashboardItem
        var dashboardItem = createDashboardItem(parent, {
            width: 360,
            height: 230,
            subtitle: title,
            settings: true
        });
        dashboardItem.dashboard = dashboard;
        dashboardItems.push(dashboardItem);


      //Make the dashboardItem draggable
        dashboardItem.el.draggable = true;
        dashboardItem.el.dataset["dashboard"] = dashboard.id;
        dashboardItem.el.ondragstart = onDragStart;


      //Update dashboardItem
        dashboardItem.innerDiv.style.cursor = "pointer";
        dashboardItem.innerDiv.style.textAlign = "center";
        dashboardItem.innerDiv.onclick = function(){
            if (callout) callout.hide();
            me.onClick(dashboardItem);
        };


      //Show/hide callout and setting wheel using the mouse over and out events
        dashboardItem.settings.style.opacity = 0;
        dashboardItem.el.onmouseover = function(){
            dashboardItem.settings.style.opacity = 1;
            if (callout){
                if (callout.dashboard.id!==dashboard.id){
                    callout.dashboardItem.settings.style.opacity = 0;
                    callout.hide();
                }
            }
        };
        dashboardItem.el.onmouseout = function(){
            if (callout){
                if (callout.isVisible()){
                    if (callout.dashboard.id===dashboard.id) return;
                }
            }
            dashboardItem.settings.style.opacity = 0;
        };


      //Watch for settings onClick events
        dashboardItem.settings.onclick = function(e){
            var callout = getCallout();
            var rect = javaxt.dhtml.utils.getRect(this);
            var x = rect.x + (rect.width/2) - 1;
            var y = rect.y + rect.height - 2;
            y = e.clientY;
            callout.dashboard = dashboard;
            callout.dashboardItem = dashboardItem;
            if (dashboard.permissions){
                callout.updateMenu(dashboard.permissions);
                if (callout.hasMenuItems()){
                    callout.showAt(x, y, "below", "right");
                }
            }
            else{
                get("dashboard/permissions?dashboardID="+dashboard.id,{
                    success: function(permissions) {
                        permissions = permissions[0];
                        if (permissions.dashboardID===callout.dashboard.id){
                            callout.dashboard.permissions = permissions.permissions;
                            callout.updateMenu(callout.dashboard.permissions);
                            if (callout.hasMenuItems()){
                                callout.showAt(x, y, "below", "right");
                            }
                        }
                        else{
                            callout.hide();
                        }
                    },
                    failure: function(){
                        callout.hide();
                    }
                });
            }
        };


        var icon = document.createElement("i");
        icon.className = "fas fa-camera";
        dashboardItem.innerDiv.appendChild(icon);


        var img = document.createElement("img");
        img.className = "noselect";
        img.style.cursor = "pointer";
        img.onload = function() {
            dashboardItem.innerDiv.innerHTML = "";
            var rect = javaxt.dhtml.utils.getRect(dashboardItem.innerDiv);
            dashboardItem.innerDiv.appendChild(this);
            this.style.border = "1px solid #ececec"; //this should be in the css


            var maxWidth = rect.width;
            var maxHeight = rect.height;
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


            var resize = function(img){
                width = img.width;
                height = img.height;

                if (maxHeight<maxWidth){

                    setHeight();
                    if (width>maxWidth) setWidth();
                }
                else{
                    setWidth();
                    if (height>maxHeight) setHeight();
                }

                if (width===0 || height===0) return;


                img.width = width;
                img.height = height;

                //TODO: Insert image into a canvas and do a proper resize
                //ctx.putImageData(img, 0, 0);
                //resizeCanvas(canvas, width, height, true);
                //var base64image = canvas.toDataURL("image/png");

            };

            resize(this);

        };
        img.src = "dashboard/thumbnail?id=" + dashboard.id + "&_=" + t;
    };


  //**************************************************************************
  //** createGroupBox
  //**************************************************************************
    var createGroupBox = function(group){

        var div = document.createElement("div");
        div.className = "dashboard-group";
        div.style.position = "relative";
        div.addEventListener('dragover', onDragOver, false);
        div.addEventListener('drop', onDrop, false);
        div.group = group;


        var label = document.createElement("div");
        label.className = "dashboard-group-label";
        label.style.position = "absolute";
        label.innerHTML = group.name;
        div.appendChild(label);

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
  //** deleteGroup
  //**************************************************************************
    var deleteGroup = function(){

    };


  //**************************************************************************
  //** getCallout
  //**************************************************************************
    var getCallout = function(){
        if (!callout){
            callout = new javaxt.dhtml.Callout(document.body,{
                style: config.style.callout
            });

            var div = document.createElement("div");
            div.className = "dashboard-homepage-menu";

            menu.delete = createMenuOption("Delete", "trash", function(){
                var dashboardID = callout.dashboard.id;
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

            });


            div.appendChild(menu.delete);
            div.appendChild(menu.move);
            callout.getInnerDiv().appendChild(div);


            callout.updateMenu = function(permissions){
                if (!permissions) permissions = "r";
                if (permissions=="r"){
                    menu.delete.hide();
                }
                else{
                    menu.delete.show();
                }
            };

            callout.hasMenuItems = function(){
                for (var key in menu) {
                    if (menu.hasOwnProperty(key)){
                        if (menu[key].isVisible()) return true;
                    }
                }
                return false;
            };

        }
        return callout;
    };


  //**************************************************************************
  //** createMenuOption
  //**************************************************************************
    var createMenuOption = function(label, icon, onClick){
        var div = document.createElement("div");
        div.className = "dashboard-homepage-menu-item noselect";
        if (icon && icon.length>0){
            div.innerHTML = '<i class="fas fa-' + icon + '"></i>' + label;
        }
        else{
            div.innerHTML = label;
        }
        div.label = label;
        div.onclick = function(){
            callout.hide();
            onClick.apply(this, [label]);
        };
        addShowHide(div);
        return div;
    };


  //**************************************************************************
  //** getGroups
  //**************************************************************************
    var getGroups = function(callback){

        var createGroups = function(groups){
            var dashboards = config.dataStores["Dashboard"];
            var myDashboards = [];
            var sharedDashboards = [];
            for (var i=0; i<dashboards.length; i++){
                var dashboard = dashboards.get(i);
                if (dashboard.className && dashboard.className.indexOf("bluewave.dashboards.")===0){
                    sharedDashboards.push(dashboard.id);
                }
                else{
                    myDashboards.push(dashboard.id);
                }
            }
            if (myDashboards.length>0){
                if (!groups) groups = new javaxt.dhtml.DataStore();
                groups.add({
                    name: "My Dashboards",
                    dashboards: myDashboards
                });
                groups.add({
                    name: "Shared Dashboards",
                    dashboards: sharedDashboards
                });
                return groups;
            }
        };

        var groups = config.dataStores["DashboardGroup"];
        if (groups){
            if (groups.length==0) createGroups(groups);
            callback.apply(me,[groups]);
            return;
        }

        groups = createGroups();
        config.dataStores["DashboardGroup"] = groups;
        get("dashboard/groups",{
            success: function(arr) {
                arr.forEach((g)=>{
                    groups.add(g);
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
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};