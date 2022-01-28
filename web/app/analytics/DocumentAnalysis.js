if(!bluewave) var bluewave={};
if(!bluewave.analytics) bluewave.analytics={};


//******************************************************************************
//**  CarouselTest
//******************************************************************************
/**
 *   Panel used to test a looping carousel with 3 panels
 *
 ******************************************************************************/

bluewave.analytics.DocumentAnalysis = function(parent, config) {

    var me = this;
    var charts = [];
    var nav, carousel, sliding;
    var searchPanel; //panels


    var defaultConfig = {
        dateFormat: "M/D/YYYY h:mm A",
        style: {

        }
    };


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);

        if (!config.fx) config.fx = new javaxt.dhtml.Effects();


        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


        tr = document.createElement("tr");
        tbody.appendChild(tr);

        td = document.createElement("td");
        tr.appendChild(td);
        createHeader(td);


        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.padding = "7px";
        tr.appendChild(td);
        createBody(td);


        parent.appendChild(table);



        createPanel("Document Search", createSearchPanel);
        createPanel("Selected Documents", createResultsPanel);



        onRender(table, function(){

          //Update carousel
            carousel.resize();


          //Select default chart
            var chart = charts[0];
            chart.select();


          //Add default chart to carousel
            var panels = carousel.getPanels();
            for (var i=0; i<panels.length; i++){
                var panel = panels[i];
                if (panel.isVisible){
                    panel.div.appendChild(chart.div);
                    break;
                }
            }
        });

    };



  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        for (var i=0; i<charts.length; i++){
            charts[i].clear();
        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update the panel and render a timeline
   */
    this.update = function(){

      //Clear the panel
        me.clear();


        try{
            var chart = charts[0];
            chart.select();
            chart.update();
        }
        catch(e){
            console.log(e);
        }
    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){

        var header = document.createElement("div");
        header.className = "carousel-header";
        parent.appendChild(header);


      //Create table with two columns
        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;


      //Create placeholder for title
        td = document.createElement("td");
        td.style.width = "50%";
        tr.appendChild(td);




      //Create nav in column 2
        td = document.createElement("td");
        td.style.width = "50%";
        td.style.textAlign = "right";
        tr.appendChild(td);
        nav = document.createElement("ul");
        nav.className = "carousel-header-nav noselect";
        td.appendChild(nav);



        header.appendChild(table);
    };


  //**************************************************************************
  //** createBody
  //**************************************************************************
    var createBody = function(parent){

      //Create carousel
        carousel = new javaxt.dhtml.Carousel(parent, {
            drag: false, //should be true if touchscreen
            loop: true,
            animate: true,
            animationSteps: 600,
            transitionEffect: "easeInOutCubic",
            fx: config.fx
        });


      //Add panels to the carousel
        var currPanel = document.createElement('div');
        currPanel.style.height = "100%";
        carousel.add(currPanel);

        var nextPanel = currPanel.cloneNode(false);
        carousel.add(nextPanel);

        var prevPanel = currPanel.cloneNode(false);
        carousel.add(prevPanel);


      //Add event handlers
        carousel.beforeChange = function(){
            parent.className = "blur";
            sliding = true;
        };
        carousel.onChange = function(currPanel){
            parent.className = "";
            sliding = false;

            for (var i=0; i<charts.length; i++){
                if (charts[i].isSelected()){
                    charts[i].update(currPanel);
                    break;
                }
            }
        };
    };


  //**************************************************************************
  //** createPanel
  //**************************************************************************
    var createPanel = function(label, createChart){


        var div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "100%";
        div.setAttribute("desc", label);
        var chart = createChart(div);
        chart.div = div;
        chart.name = label;



        var cls = "carousel-header-link";


        var li = document.createElement("li");
        li.className = cls;
        li.tabIndex = -1; //allows the element to have focus
        li.innerHTML = label;

        li.select = function(){
            if (sliding){
                this.blur();
                return;
            }
            this.focus();


          //Find the selected menu item
            var idx = 0;
            var currSelection = -1;
            for (var i=0; i<nav.childNodes.length; i++){
                var li = nav.childNodes[i];
                if (li==this) idx = i;

                if (li.selected){
                    currSelection = i;

                    if (li!==this){
                        li.selected = false;
                        li.className = cls;
                    }
                }
            }


          //Update selected item and the carousel
            if (idx!=currSelection){

              //Update selection
                this.selected = true;
                this.className = cls + " " + cls + "-selected";


              //If nothing was selected, then no need to continue
                if (currSelection==-1) return;


              //Find next panel and previous panel
                var nextPanel, prevPanel;
                var panels = carousel.getPanels();
                for (var i=0; i<panels.length; i++){
                    if (panels[i].isVisible){
                        if (i==0){
                            prevPanel = panels[panels.length-1];
                        }
                        else{
                            prevPanel = panels[i-1];
                        }
                        if (i==panels.length-1){
                            nextPanel = panels[0];
                        }
                        else{
                            nextPanel = panels[i+1];
                        }
                        break;
                    }
                }


              //Update panels
                if (currSelection<idx){
                    var el = prevPanel.div;
                    removeChild(el);
                    el.appendChild(charts[idx].div);
                    removeChild(nextPanel.div);
                    //console.log("slide right");
                    carousel.back();
                }
                else if (currSelection>idx){
                    var el = nextPanel.div;
                    removeChild(el);
                    el.appendChild(charts[idx].div);
                    removeChild(prevPanel.div);
                    //console.log("slide left");
                    carousel.next();
                }
            }
        };
        li.onclick = function(){
            this.select();
        };
        nav.appendChild(li);


        chart.select = function(){
            li.select();
        };
        chart.isSelected = function(){
            return li.selected;
        };
        charts.push(chart);
    };



  //**************************************************************************
  //** createResultsPanel
  //**************************************************************************
    var createResultsPanel = function(parent){


        var grid = new javaxt.dhtml.DataGrid(parent, {
            style: config.style.table,
            localSort: true,
            columns: [
                {header: 'Name', width:'100%', sortable: true},
                {header: 'Similarities', width:'140', sortable: true}
            ],
            update: function(row, record){
                row.set("Name", record.name);
                row.set("Similarities", record.similarities);
            }
        });



        return {
            clear: function(){
                grid.clear();
            },
            update: function(panel){


            }
        };

    };


  //**************************************************************************
  //** createSearchPanel
  //**************************************************************************
    var createSearchPanel = function(parent){

        searchPanel = new bluewave.analytics.DocumentSearch(parent,{
            dateFormat: config.dateFormat,
            showCheckboxes: true
        });



        return {
            clear: function(){
                searchPanel.clear();
            },
            update: function(){
                searchPanel.update();


            }
        };
    };



  //**************************************************************************
  //** removeChild
  //**************************************************************************
  /** Used to remove the first child from a carousel panel
   */
    var removeChild = function(el){
        if (el.childNodes.length>0){

          //Remove child
            var div = el.removeChild(el.childNodes[0]);

          //Update charts
            if (div.childNodes.length>0){
                var desc = div.getAttribute("desc");
                for (var j=0; j<charts.length; j++){
                    var chart = charts[j];
                    if (chart.div.getAttribute("desc")==desc){
                        chart.div = div;
                        break;
                    }
                }
            }
        }
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;


    init();
};