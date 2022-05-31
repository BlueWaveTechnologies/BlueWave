if(!bluewave) var bluewave={};
if(!bluewave.admin) bluewave.admin={};

//******************************************************************************
//**  ConfigAdmin
//******************************************************************************
/**
 *   Panel used to manage misc config settings
 *
 ******************************************************************************/

bluewave.admin.ConfigAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };
    var waitmask;
    var carousel;
    var panels = [];
    
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
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;
        
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        createHeader(td);
        tr.appendChild(td);
        
        
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.padding = "15px";
        td.style.verticalAlign = "top";
        createBody(td);
        tr.appendChild(td);
        
        
        parent.appendChild(table);
        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){

    };
    
    
  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){
        var div = document.createElement("div");
        div.className = "admin-header noselect";
        parent.appendChild(div);

        var icon = document.createElement("div");
        icon.className = "fas fa-sliders-h";
        div.appendChild(icon);

        var title = document.createElement("div");
        title.innerHTML = "General Settings";
        div.appendChild(title);
    };
    
    
  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){
        
      //Create container
        var div = document.createElement("div");
        div.className = "";
        div.style.display = "inline";
        parent.appendChild(div);
        
        
      //Create carousel
        carousel = new javaxt.dhtml.Carousel(div, {
            drag: false,
            loop: false,
            animate: true,
            animationSteps: 600,
            transitionEffect: "easeInOutCubic",
            fx: config.fx
        });
        
      //Create 2 panels for the carousel
        for (var i=0; i<2; i++){
            var panel = document.createElement("div");
            panel.style.height = "100%";
            carousel.add(panel);
        }


      //Add event handlers
        carousel.beforeChange = function(){
            //me.setTitle("");
            //backButton.hide();
            //nextButton.hide();
        };


        carousel.onChange = function(currPanel){
            console.log(currPanel);
        };
        
        
        
        var mainDiv = carousel.getPanels()[0].div;
        
        
        var table = createTable();
        table.style.height = "";
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;

        td = document.createElement("td");
        td.style.width = "36px";
        tr.appendChild(td);
        
        td = document.createElement("td");
        td.style.width = "100%";
        tr.appendChild(td);
        
        
        addRow(tbody, {
            icon: "browserIcon",
            title: "Supported Browsers",
            onClick: function(){
                raisePanel(bluewave.admin.BrowserAdmin, config);
            }
        });


        mainDiv.appendChild(table);
    };
    
    
  //**************************************************************************
  //** addRow
  //**************************************************************************
    var addRow = function(parent, config){
        
        var tr = document.createElement("tr");
        tr.className = "admin-config-row noselect";
        parent.appendChild(tr);
        var td;


        td = document.createElement("td");
        
        tr.appendChild(td);
        
        td = document.createElement("td");
        td.innerHTML = config.title;
        tr.appendChild(td);
        
        tr.onclick = function(){
            if (config.onClick) config.onClick();
        };
    };
    
    
  //**************************************************************************
  //** raisePanel
  //**************************************************************************
    var raisePanel = function(cls, config){
        
        var p;
        panels.forEach((panel)=>{
            if (panel instanceof cls){
                p = panel;
            }
            else{
                panel.hide();
            }
        });
        
        
        if (p){
            p.show();
        }
        else{
            var parent = carousel.getPanels()[1].div;
            p = new cls(parent, config);
            panels.push(p);
        }
        p.update();
        carousel.next();
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};