if(!bluewave) var bluewave={};

//******************************************************************************
//**  GraphAdmin
//******************************************************************************
/**
 *   Panel used to manage graph settings
 *
 ******************************************************************************/

bluewave.GraphAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };

    var connectionInfo;


    var propogateEvents = false;
    var currGraph = {};


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


      //Create header
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "noselect";
        tr.appendChild(td);
        createHeader(td);


      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        td.style.verticalAlign = "top";
        td.style.padding = "15px";
        tr.appendChild(td);
        createPanels(td);


        parent.appendChild(table);
        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        currGraph = {};
        connectionInfo.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        propogateEvents = false;
        me.clear();
        get("admin/settings/graph", {
            success: function(graph){
                connectionInfo.update(graph);
            }
        });

        get("graph/cache", {
            success: function(arr){

            }
        });
    };

  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){
        var div = document.createElement("div");
        div.className = "admin-header";
        parent.appendChild(div);

        var icon = document.createElement("div");
        icon.className = "fas fa-share-alt noselect";
        div.appendChild(icon);

        var title = document.createElement("div");
        title.innerHTML = "Graph Settings";
        div.appendChild(title);

    };


  //**************************************************************************
  //** createPanels
  //**************************************************************************
    var createPanels = function(parent){
        createConnectionInfo(parent);
        createCacheInfo(parent);
    };


  //**************************************************************************
  //** createConnectionInfo
  //**************************************************************************
    var createConnectionInfo = function(parent){
        connectionInfo = createDashboardItem(parent, {
            width: 360,
            height: 230,
            title: "Connection Properties",
            settings: true
        });
        connectionInfo.innerDiv.style.verticalAlign = "top";
        connectionInfo.innerDiv.style.padding = "10px 0 0 0";

      //Create static view
        var propPanel = document.createElement("div");
        addShowHide(propPanel);
        connectionInfo.innerDiv.appendChild(propPanel);
        var table = createTable();
        //table.style.width = "";
        table.style.height = "";
        var tbody = table.firstChild;
        var tr, td;
        propPanel.appendChild(table);
        propPanel.addRow = function(label, value){
            tr = document.createElement("tr");
            tbody.appendChild(tr);
            td = document.createElement("td");
            td.className = "form-label noselect";
            td.style.paddingRight = "10px";
            td.innerHTML = label + ":";
            tr.appendChild(td);
            td = document.createElement("td");
            td.className = "form-label";
            td.style.width = "100%";
            td.innerHTML = value;
            tr.appendChild(td);
        };


      //Watch for settings
        connectionInfo.settings.onclick = function(){
                propPanel.hide();
                editPanel.show();
                form.resize();
        };



      //Create edit view
        var editPanel = document.createElement("div");
        addShowHide(editPanel);
        editPanel.hide();
        connectionInfo.innerDiv.appendChild(editPanel);
        var form = new javaxt.dhtml.Form(editPanel, {
            style: config.style.form,
            items: [

                {
                    name: "host",
                    label: "Host",
                    type: "text",
                    required: true
                },
                {
                    name: "username",
                    label: "Username",
                    type: "text",
                    required: true
                },
                {
                    name: "password",
                    label: "Password",
                    type: "password",
                    required: true
                }

            ],

            buttons: [
                {
                    name: "Cancel",
                    onclick: function(){
                        editPanel.hide();
                        propPanel.show();
                    }
                },
                {
                    name: "Update",
                    onclick: function(){

                        var values = form.getData();
                        var username = values.username;
                        if (username) username = username.trim();
                        if (username==null || username==="") {
                            warn("Username is required", form.findField("username"));
                            return;
                        }

                        var password = values.password;
                        if (password) password = password.trim();
                        if (password==null || password==="") {
                            warn("Password is required", form.findField("password"));
                            return;
                        }


                        var graph = {};
                        graph.username = username;
                        graph.password = password;
                        graph.host = values.host;


                        confirm("Are you sure you want to update the connection?",{
                            leftButton: {label: "Yes", value: true},
                            rightButton: {label: "No", value: false},
                            callback: function(yes){
                                if (yes){
                                    console.log(graph);
                                }
                                else{
                                    me.update();
                                }
                            }
                        });



                    }
                }
            ]
        });

        var btn = form.getButton("Update");
        btn.disabled = true;

        form.onChange = function(field){
            btn.disabled = true;
            if (!propogateEvents) return;

            if (isDirty(currGraph, form.getData())){
                btn.disabled = false;
            }
            else{
                btn.disabled = true;
            }
        };

        connectionInfo.clear = function(){
            tbody.innerHTML = "";
        };

        connectionInfo.update = function(graph){


            propPanel.addRow("Graph", "Neo4J");
            propPanel.addRow("Host", graph.host);
            propPanel.addRow("Port", graph.port);
            propPanel.addRow("User", graph.username);


            form.setValue("username", graph.username);
            form.setValue("password", graph.password);
            form.setValue("host", graph.host + ":" + graph.port);
            currGraph = form.getData();

            propogateEvents = true;
        };


    };


  //**************************************************************************
  //** createCacheInfo
  //**************************************************************************
    var createCacheInfo = function(parent){
        var dashboardItem = createDashboardItem(parent, {
            width: 360,
            height: 230,
            title: "Cache Control"
        });
    };




  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var isDirty = javaxt.dhtml.utils.isDirty;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createDashboardItem = bluewave.utils.createDashboardItem;

    init();
};