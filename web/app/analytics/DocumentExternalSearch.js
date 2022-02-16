if(!bluewave) var bluewave={};
if(!bluewave.analytics) bluewave.analytics={};

//******************************************************************************
//**  DocumentExternalSearch
//******************************************************************************
/**
 *   Panel used to get/view external search results
 *
 ******************************************************************************/

bluewave.analytics.DocumentExternalSearch = function(parent, config) {

    var me = this;
    var carousel;
    var resultsPanel;

    var waitmask;
    // var results = {};




  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        if (!config.fx) config.fx = new javaxt.dhtml.Effects();
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


        var table = createTable();
        var tbody = table.firstChild;

        parent.appendChild(table);
        me.el = table;
        var tr, td;


        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createBody(td);


        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createFooter(td);
    };


  //**************************************************************************
  //** getResultsPanel
  //**************************************************************************
    this.getResultsPanel = function(){
        return resultsPanel.el;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        var panels = carousel.getPanels();
        for (var i=0; i<panels.length; i++){
            var panel = panels[i];
            var el = panel.div.firstChild;
            if (el) panel.div.removeChild(el);
        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();
        update();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to populate the panels in the carousel control. Assumes that the
   *  carousel is cleared (see clear method)
   */
    var update = function(){
        var panels = carousel.getPanels();
        if (!resultsPanel) resultsPanel = createResultsPanel();
        resultsPanel.update();
        panels[0].div.appendChild(resultsPanel.el);
    };

  //**************************************************************************
  //** createResultsPanel
  //**************************************************************************
    var createResultsPanel = function(){

        var table, tbody, tr, td;

      //Create main table
        table = createTable();
        tbody = table.firstChild;
        var el = table;

      //Create title
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        // td.className = "doc-external-search-title";
        tr.appendChild(td);
        var icon = document.createElement("i");
        td.appendChild(icon);
        var title = document.createElement("span");
        td.appendChild(title);


      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.verticalAlign = "top";
        td.style.padding = "20px 5px 0";
        tr.appendChild(td);


        var div = document.createElement("div");
        // div.className = "doc-external-search-background";
        // div.innerHTML = '<i class="fas fa-not-equal"></i>';
        td.appendChild(div);

        var createButton = function(label){
          var input = document.createElement('input');
          input.className = "form-button";
          input.type = "button";
          input.name = label;
          input.value = label;
          input.disabled = true;
          div.appendChild(input);
          return input;
      };

        return {
            el: el,
            update: function(){
              console.log("update function called external results panel");
            }
        };
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){


      //Create carousel
        carousel = new javaxt.dhtml.Carousel(parent, {
            drag: false,
            loop: true,
            animate: true,
            animationSteps: 600,
            transitionEffect: "easeInOutCubic",
            fx: config.fx
        });

        onRender(carousel.el, ()=>{
            console.log("ready!");
        });



      //Create a panel for the carousel
        var panel = document.createElement("div");
        panel.style.height = "100%";
        carousel.add(panel);


      //Add event handlers
        carousel.onChange = function(){

        };

    };


  //**************************************************************************
  //** createFooter
  //**************************************************************************
    var createFooter = function(parent){

        var div = document.createElement("div");
        div.className = "noselect";
        div.style.float = "right";
        div.style.textAlign = "center";
        div.style.padding = "10px 10px 10px 0";
        parent.appendChild(div);

    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    // var addShowHide = javaxt.dhtml.utils.addShowHide;
    var onRender = javaxt.dhtml.utils.onRender;
    // var isArray = javaxt.dhtml.utils.isArray;
    // var round = javaxt.dhtml.utils.round;
    // var get = bluewave.utils.get;


    init();
};