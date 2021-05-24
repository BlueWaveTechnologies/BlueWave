if(!bluewave) var bluewave={};

//******************************************************************************
//**  AdminPanel
//******************************************************************************
/**
 *   Panel used to render admin components (e.g. UserList)
 *
 ******************************************************************************/

bluewave.AdminPanel = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };
    var userAdmin;
    var ws;

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;


      //Create main panel
        var mainPanel = document.createElement("div");
        //mainPanel.style.borderTop = "1px solid #cccccc";
        mainPanel.style.width = "100%";
        mainPanel.style.height = "100%";
        parent.appendChild(mainPanel);


        userAdmin = new bluewave.UserAdmin(mainPanel, config);

        me.el = mainPanel;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        userAdmin.clear();

        if (ws){
            ws.stop();
            ws = null;
        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){

        userAdmin.update();


      //Create web socket listener
        if (!ws) ws = new javaxt.dhtml.WebSocket({
            url: "report",
            onMessage: function(msg){
                var arr = msg.split(",");
                var op = arr[0];
                var model = arr[1];
                var id = parseInt(arr[2]);
                //var store = config.dataStores[model];


                if (op=="webrequest" || op=="logoff"){
                    if (userAdmin) userAdmin.updateActivity(id, op);
                }


            }
        });

    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};