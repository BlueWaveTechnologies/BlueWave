if(!bluewave) var bluewave={};
if(!bluewave.admin) bluewave.admin={};

//******************************************************************************
//**  AdminPanel
//******************************************************************************
/**
 *   Panel used to render admin components (e.g. UserList)
 *
 ******************************************************************************/

bluewave.admin.AdminPanel = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };
    var waitmask;
    var sidebar, mainPanel, landingPage;
    var panel = {};
    var userAdmin;
    var ws;


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
        var table = createTable(parent);
        table.className = "admin-panel";
        var tr = table.addRow();
        var td;


      //Create side bar
        td = tr.addColumn({
            height: "100%"
        });
        sidebar = createElement("div", td, "admin-sidebar");
        sidebar.style.height = "100%";



      //Create main panel
        mainPanel = tr.addColumn({
            width: "100%",
            height: "100%"
        });



      //Create landing page
        landingPage = createElement("div", mainPanel, "admin-landing-page noselect");
        landingPage.className = "admin-landing-page noselect";
        landingPage.innerHTML = '<i class="fas fa-cogs"></i>';

        addShowHide(landingPage);


      //Create panels
        createPanel("Users", "fas fa-users", bluewave.UserAdmin, config);
        createPanel("Database", "fas fa-database", javaxt.express.DBView, {
            waitmask: waitmask,
            queryService: "admin/job/",
            getTables: "admin/tables/",
            onTreeClick: function(item){
                var sql = "select * from ";
                var schemaName = item.node.schema;
                if (schemaName) sql += schemaName + ".";
                sql += item.name;
                this.getComponents().editor.setValue(sql);
            },
            style:{
                table: config.style.table,
                toolbar: config.style.toolbar,
                toolbarButton: config.style.toolbarButton,
                toolbarIcons: {
                    run: "fas fa-play",
                    cancel: "fas fa-stop"
                }
            }
        });
        createPanel("Graph", "fas fa-share-alt", bluewave.admin.GraphAdmin, config);
        createPanel("Config", "fas fa-sliders-h", bluewave.admin.ConfigAdmin, config);
        createPanel("Base Map", "fas fa-globe-americas", bluewave.admin.MapAdmin, config);


      //Add additional panels via plugin extensions
        get("extensions", {
            success: function(extensions){
                extensions.forEach(function(extension){
                    var adminExtensions = [];
                    if (extension.admin){
                        if (isArray(extension.admin)){
                            extension.admin.forEach(function(e){
                                adminExtensions.push(e);
                            });
                        }
                        else{
                            adminExtensions.push(extension.admin);
                        }
                    }

                    adminExtensions.forEach(function(extension){
                        if (extension.type==="panel"){
                            extension = extension.config;
                            if (typeof extension.class === "string"){
                                extension.class = eval(extension.class);
                            }
                            createPanel(extension.title, extension.icon, extension.class, config);
                        }
                    });

                });
            }
        });



        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

        for (var key in panel) {
            var app = panel[key].app;
            if (app && app.clear) app.clear();
        }


        if (ws){
            ws.stop();
            ws = null;
        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){


      //Create web socket listener
        if (!ws) ws = new javaxt.dhtml.WebSocket({
            url: "report",
            onMessage: function(msg){
                var arr = msg.split(",");
                var op = arr[0];
                var model = arr[1];
                var id = parseInt(arr[2]);


                if (op=="webrequest" || op=="logoff"){
                    if (userAdmin) userAdmin.updateActivity(id, op);
                }

            }
        });

    };


  //**************************************************************************
  //** raisePanel
  //**************************************************************************
    this.raisePanel = function(name){
        landingPage.hide();

        for (var key in panel) {
            if (key!==name) panel[key].body.hide();
            panel[key].button.className =
            panel[key].button.className.replace(" selected","").trim();
        }

        var p = panel[name];
        p.body.show();
        if (!p.app){
            var cls = eval(p.className);
            if (cls){
                mainPanel.appendChild(p.body);
                p.app = new cls(p.body, p.config);
                if (p.app.update) p.app.update();
                if (p.app instanceof bluewave.UserAdmin){
                    userAdmin = p.app;
                }
            }
        }
        p.button.className += " selected";
    };


  //**************************************************************************
  //** createPanel
  //**************************************************************************
    var createPanel = function(name, icon, className, config){
        var button = createElement("div", sidebar, icon + " noselect");
        button.onclick = function(){
            me.raisePanel(name);
        };

        var body = createElement("div", {
            height: "100%"
        });
        addShowHide(body);
        body.hide();


        panel[name] = {
           button: button,
           body: body,
           className: className,
           config: config,
           app: null
        };

    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var createElement = javaxt.dhtml.utils.createElement;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var isArray = javaxt.dhtml.utils.isArray;
    var get = bluewave.utils.get;

    init();
};