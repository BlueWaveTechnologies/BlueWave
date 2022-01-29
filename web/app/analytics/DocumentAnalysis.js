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
    var panels = [];
    var nav, carousel, sliding;
    var selectedDocuments; //datastore


    var defaultConfig = {
        dateFormat: "M/D/YYYY h:mm A",
        style: {

        }
    };


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Process config
        if (!config) config = {};
        config = merge(config, defaultConfig);
        if (!config.fx) config.fx = new javaxt.dhtml.Effects();
        if (!config.style) config.style = javaxt.dhtml.style.default;



      //Create main table
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
        td.style.padding = "0px";
        tr.appendChild(td);
        createBody(td);

        parent.appendChild(table);
        me.el = table;


      //Create data store
        selectedDocuments = new javaxt.dhtml.DataStore();


      //Create panels
        createPanel("Document Search", createSearchPanel);
        createPanel("Selected Documents", createResultsPanel);


      //Update carousel onRender
        onRender(table, function(){

          //Update carousel
            carousel.resize();


          //Select default panel
            var panel = panels[0];
            panel.select();


          //Add default panel to carousel
            carousel.getPanels().every((p)=>{
                if (p.isVisible){
                    p.div.appendChild(panel.div);
                    return false;
                }
                return true;
            });
        });
    };



  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        panels.forEach((panel)=>panel.clear());
    };


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to update the panel and render a timeline
   */
    this.update = function(){

      //Clear the panel
        me.clear();


        var panel = panels[0];
        panel.select();
        setTimeout(()=>{

          //Find visible panel
            carousel.getPanels().every((p)=>{
                if (p.isVisible){
                    panel.update(p.div);
                    return false;
                }
                return true;
            });

        },200);

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

            panels.every((panel)=>{
                if (panel.isSelected()){
                    panel.update(currPanel);
                    return false;
                }
                return true;
            });
        };
    };


  //**************************************************************************
  //** createPanel
  //**************************************************************************
    var createPanel = function(label, _createPanel){


        var div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "100%";
        div.setAttribute("desc", label);
        var panel = _createPanel();
        panel.div = div;
        panel.name = label;



        var cls = "carousel-header-link";


        var li = document.createElement("li");
        li.className = cls;
        li.tabIndex = -1; //allows the element to have focus
        li.innerHTML = label;
        panel.menu = li;

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


              //Find next panel and previous panel in the carousel
                var nextPanel, prevPanel;
                var arr = carousel.getPanels();
                for (var i=0; i<arr.length; i++){
                    if (arr[i].isVisible){
                        if (i==0){
                            prevPanel = arr[arr.length-1];
                        }
                        else{
                            prevPanel = arr[i-1];
                        }
                        if (i==arr.length-1){
                            nextPanel = arr[0];
                        }
                        else{
                            nextPanel = arr[i+1];
                        }
                        break;
                    }
                }


              //Update panels
                if (currSelection<idx){
                    var el = prevPanel.div;
                    removeChild(el);
                    el.appendChild(panels[idx].div);
                    removeChild(nextPanel.div);
                    //console.log("slide right");
                    carousel.back();
                }
                else if (currSelection>idx){
                    var el = nextPanel.div;
                    removeChild(el);
                    el.appendChild(panels[idx].div);
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


        panel.select = function(){
            li.select();
        };
        panel.isSelected = function(){
            return li.selected;
        };
        panels.push(panel);
    };



  //**************************************************************************
  //** createResultsPanel
  //**************************************************************************
    var createResultsPanel = function(){


      //Create toolbar and grid panel
        var grid, button = {};
        var createPanel = function(parent){

          //Create main table
            var table = createTable();
            parent.appendChild(table);
            var tbody = table.firstChild;
            var tr, td;


          //Row 1
            tr = document.createElement("tr");
            tbody.appendChild(tr);
            td = document.createElement("td");
            td.className = "panel-toolbar";
            td.style.background = "#f1f1f1";
            tr.appendChild(td);


          //Add run button
            button["run"] = createButton(td, {
                label: "Compare Documents",
                icon: "fas fa-play"
            });
            button["run"].disable();
            button["run"].onClick = function(){

                var jobs = [];
                selectedDocuments.forEach((document)=>{
                    var arr = [];
                    selectedDocuments.forEach((d)=>{
                        if (d.id!=document.id) arr.push(d.id);
                    });
                    jobs.push({
                        doc: document.id,
                        otherDocs: arr
                    });
                });

                jobs.forEach((job)=>{
                    grid.forEachRow((row)=>{
                        var document = row.record;
                        if (document.id==job.doc){
                            job.row = row;
                            return true;
                        }
                    });
                });


                compareDocuments(jobs, function(){

                });
            };


          //TODO: Add stop button



          //Row 2
            tr = document.createElement("tr");
            tbody.appendChild(tr);
            td = document.createElement("td");
            td.style.height = "100%";
            tr.appendChild(td);


            var gridStyle = config.style.table;
            if (!gridStyle) gridStyle = javaxt.dhtml.style.default.table;
            grid = new javaxt.dhtml.DataGrid(td, {
                style: gridStyle,
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
        };



      //Watch for changes to the selectedDocuments data store
        selectedDocuments.addEventListener("add", function(document){
            if (grid){
                grid.load([document], 2); //second arg is a page number (hack for DataGrid)
                if (selectedDocuments.length>1) button["run"].enable();
            }
            updateCount();
        }, me);

        selectedDocuments.addEventListener("update", function(document){

        }, me);

        selectedDocuments.addEventListener("remove", function(document){
            if (grid){
                grid.clear();
                grid.load(selectedDocuments);
                if (selectedDocuments.length<2) button["run"].disable();
            }
            updateCount();
        }, me);



      //Return "panel"
        return {
            clear: function(){
                if (grid) grid.clear();
            },
            update: function(panel){
                if (!grid){
                    createPanel(panel.childNodes[0]);
                    grid.load(selectedDocuments);
                    if (selectedDocuments.length>1) button["run"].enable();
                }

            }
        };

    };


  //**************************************************************************
  //** createSearchPanel
  //**************************************************************************
    var createSearchPanel = function(){

        var searchPanel;
        var createPanel = function(parent){

          //Create document search panel
            searchPanel = new bluewave.analytics.DocumentSearch(parent,{
                dateFormat: config.dateFormat,
                showCheckboxes: false,
                getIcon: function(document){
                    //<i class="fas fa-check"></i>
                }
            });
            var grid = searchPanel.getDataGrid();


          //Watch for row click events
            grid.onRowClick = function(row, e){
                var document = row.record;
                if (e.detail === 2) { //double click

                  //Add or remove document from the selectedDocuments store
                    var addDocument = true;
                    selectedDocuments.forEach((d, i)=>{
                        if (d.id===document.id){
                            selectedDocuments.removeAt(i);
                            addDocument = false;
                            return true;
                        }
                    });
                    if (addDocument) selectedDocuments.add(document);
                }
            };
        };



        return {
            clear: function(){
                if (searchPanel) searchPanel.clear();
            },
            update: function(panel){
                if (!searchPanel) createPanel(panel.childNodes[0]);
                searchPanel.update();
            }
        };
    };


  //**************************************************************************
  //** updateCount
  //**************************************************************************
    var updateCount = function(){
        var li = panels[1].menu;
        if (!li.counter){
            var div = document.createElement("div");
            div.className = "carousel-header-link-count";
            div.style.float = "right";
            addShowHide(div);
            div.hide();
            li.appendChild(div);
            li.counter = div;
        }

        if (selectedDocuments.length>0){
            li.counter.innerText = selectedDocuments.length;
            li.counter.show();
        }
        else{
            li.counter.hide();
        }

    };


    var compareDocuments = function(jobs, onCompletion){

        var runJob = function(){
            if (jobs.length==0){
                if (onCompletion) onCompletion.apply(me, []);
                return;
            }
            
            var job = jobs.shift();
            getSimilarities(job.doc, job.otherDocs,
                function(step, totalSteps, success){
                    job.row.set("Similarities", Math.round((step/totalSteps)*100) + "%");
                },
                function(similarities){
                    job.row.record.similarities = similarities;
                    job.row.set("Similarities", "Done!");
                    runJob();
                }
            );
        };
        runJob();
    };


    var getSimilarities = function(doc, otherDocs, onStep, onCompletion){

        var similarities = [];
        var steps = 0;
        var totalSteps = otherDocs.length;

        var getSimilarity = function(doc, otherDocs){

            if (otherDocs.length==0){
                if (onCompletion) onCompletion.apply(me, [similarities]);
                return;
            }

            var b = otherDocs.shift();
            steps++;

            get("document/similarity?documents="+doc+","+b,{
                success: function(json){
                    similarities.push({
                        id: b,
                        results: json
                    });
                    if (onStep) onStep.apply(me, [steps,totalSteps,true]);
                    getSimilarity(doc, otherDocs);
                },
                failure: function(){
                    if (onStep) onStep.apply(me, [steps,totalSteps,false]);
                    getSimilarity(doc, otherDocs);
                }
            });
        };

        getSimilarity(doc, otherDocs);

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

          //Update panels
            if (div.childNodes.length>0){
                var desc = div.getAttribute("desc");
                panels.every((panel)=>{
                    if (panel.div.getAttribute("desc")==desc){
                        panel.div = div;
                        return false;
                    }
                    return true;
                });
            }
        }
    };


  //**************************************************************************
  //** createButton
  //**************************************************************************
    var createButton = function(parent, btn){
        if (!config.style.toolbarButton){
            config.style.toolbarButton = javaxt.dhtml.style.default.toolbarButton;
        }

        var defaultStyle = JSON.parse(JSON.stringify(config.style.toolbarButton));
        if (btn.style) btn.style = merge(btn.style, defaultStyle);
        else btn.style = defaultStyle;

        return bluewave.utils.createButton(parent, btn);
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};