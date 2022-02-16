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
    var searchPopup;
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

        createSearchPopup();
    };

  //**************************************************************************
  //** createWindow
  //**************************************************************************
    var createWindow = function(config){
      var win = new javaxt.dhtml.Window(document.body, config);
      // windows.push(win);
      return win;
    };

  //**************************************************************************
  //** createSearchPopup
  //**************************************************************************
    createSearchPopup = function(){


        searchPopup = createWindow({
            title: "Search Results",
            width: 400,
            height: 600,
            valign: "top",
            modal: true,
            style: config.style.window
        });

        var createButton = function(parent, label){
          var input = document.createElement('input');
          input.className = "form-button";
          input.type = "button";
          input.name = label;
          input.value = label;
          input.disabled = true;
          parent.appendChild(input);
          return input;
      };

      var createButtonBar = function(parent){
        // add container
          var div = document.createElement("div");
          div.style.textAlign = "center";
          div.style.padding = "10px 10px 10px 0";
          parent.appendChild(div);
        // add search button
          var button = createButton(div,"Expand Search");

        button.enable = function(){
          this.disabled = false;
        };

        button.disable = function(){
          this.disabled = false;
        };

        button.enable();

        button.onclick = function(){
          console.log("button was clicked");
        };
      };


      var createSearchResultMessage = function(parent){
        // create container
          var div = document.createElement("div");
          div.className = "doc-external-search-popup-results";
          div.style.textAlign = "center";
        // add text
          var text = document.createElement("div");
          text.className = "doc-external-search-popup-results-text";
          div.appendChild(text);
          text.innerText =  "No Results returned - test message";
        // add background
          var iconContainer = document.createElement("div");
          iconContainer.className = "doc-external-search-popup-results-background";
          div.appendChild(iconContainer);
          iconContainer.innerHTML ='<i class="fas fa-not-equal"></i>';

        parent.appendChild(div);
      };

        var body = searchPopup.getBody();
        var table = createTable();
        var tbody = table.firstChild;

        body.appendChild(table);
        this.el = table;

        var tr, td;

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        createSearchResultMessage(td);

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createButtonBar(td);

        searchPopup.hide();
        // searchPopup.show();
    };


  //**************************************************************************
  //** getSearchPopup
  //**************************************************************************
    this.showSearchPopup = function(){
      searchPopup.show();
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