if(!bluewave) var bluewave={};
if(!bluewave.admin) bluewave.admin={};

//******************************************************************************
//**  BrowserAdmin
//******************************************************************************
/**
 *   Panel used to manage supported web browsers
 *
 ******************************************************************************/

bluewave.admin.BrowserAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {};
    var waitmask;
    var webconfig = {};
    var rows = {};
    

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;
        
        var table = createTable();
        parent.appendChild(table);
        table.style.height = "";
        var tbody = table.firstChild;

        ["Chrome", "Edge", "Brave", "Firefox", "Safari", "Opera", "Internet Explorer"]
        .forEach((browser)=>{
            rows[browser] = addRow(tbody, browser);
        });

        
    };
    
    this.getTitle = function(){
        return "Supported Browsers";
    };
    

  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        webconfig = {};
        //grid.clear();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();
        waitmask.show(500);
        get("admin/settings/webserver", {
            success: function(json){
               webconfig = json;
               //grid.update(browsers);
               waitmask.hide();
            },
            failure: function(request){
                if (request.status!==404) alert(request);
                waitmask.hide();
            }
        });
    };
    
    
  //**************************************************************************
  //** updateConfig
  //**************************************************************************
    var updateConfig = function(){
        save("admin/settings/webserver", JSON.stringify(webconfig), {
            success: function(){
                me.update();
            },
            failure: function(request){
                alert(request);
            }
        });
    };
    
    
  //**************************************************************************
  //** addRow
  //**************************************************************************
    var addRow = function(parent, browser){
        
        var tr = document.createElement("tr");
        tr.className = "admin-config-row noselect";
        parent.appendChild(tr);
        var td;


        td = document.createElement("td");
        td.style.padding = "0 5px";
        tr.appendChild(td);

        var img = document.createElement("img");
        img.src = getPixel();
        img.className = "browser-icon " + (browser.toLowerCase().replace(" ", "-"));
        td.appendChild(img);
        
        
        td = document.createElement("td");
        td.style.width = "100%";
        td.innerHTML = browser;
        tr.appendChild(td);
        
        td = document.createElement("td");
        tr.appendChild(td);
        
        return tr;
    };


    
    
    
  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var get = bluewave.utils.get;
    var save = javaxt.dhtml.utils.post;
    var getPixel = bluewave.utils.getPixel;

    init();
};