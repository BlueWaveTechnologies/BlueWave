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
    var timer;
    

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;
        
        var div = document.createElement("div");
        div.className = "admin-config-table";
        parent.appendChild(div);
        
        var table = createTable();
        div.appendChild(table);
        table.style.height = "";
        var tbody = table.firstChild;

        ["Chrome", "Edge", "Brave", "Firefox", "Safari", "Opera", "Internet Explorer"]
        .forEach((browser)=>{
            rows[browser] = addRow(tbody, browser);
        });

        me.el = div;
        
      //Add public show/hide methods
        addShowHide(me);
    };
    
    
  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        return "Supported Browsers";
    };
    

  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        webconfig = {};
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
                if (webconfig.browsers){ 
                    for (var browser in rows) {
                        if (rows.hasOwnProperty(browser)){
                            var row = rows[browser];
                            var toggleSwitch = row.toggleSwitch;
                            toggleSwitch.setValue(false, true);
                        }
                    }
                    webconfig.browsers.forEach((browser)=>{
                        if (rows[browser]) rows[browser].toggleSwitch.setValue(true, true);
                    });
                }
                else{
                    for (var browser in rows) {
                        if (rows.hasOwnProperty(browser)){
                            var row = rows[browser];
                            var toggleSwitch = row.toggleSwitch;
                            toggleSwitch.setValue(true, true);
                        }
                    }
                }
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
        

        var browsers = [];
        for (var browser in rows) {
            if (rows.hasOwnProperty(browser)){
                var row = rows[browser];
                var toggleSwitch = row.toggleSwitch;
                if (toggleSwitch.getValue()){
                    browsers.push(browser);
                }
            }
        }
        
        if (browsers.length===rows.length) delete webconfig.browsers;
        else webconfig.browsers = browsers;
        

        waitmask.show(500);
        save("admin/settings/webserver", JSON.stringify(webconfig), {
            success: function(){
                waitmask.hide();
                me.update();
            },
            failure: function(request){
                waitmask.hide();
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
        td.style.padding = "0 5px";
        tr.appendChild(td);
        
        var toggleSwitch = new javaxt.dhtml.Switch(td);
        toggleSwitch.onChange = function(){
            if (timer) clearTimeout(timer);
            timer = setTimeout(updateConfig, 800);
        };
        tr.toggleSwitch = toggleSwitch;

        
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