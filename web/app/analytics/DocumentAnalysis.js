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
    var similarityResults, documentSimilarities;
    var windows = [];
    var waitmask;
    var comparisonsEnabled = true;

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
        if (!config.style.table) config.style.table = javaxt.dhtml.style.default.table;
        if (!config.style.window) config.style.window = javaxt.dhtml.style.default.window;
        if (!config.style.toolbarButton) config.style.toolbarButton = javaxt.dhtml.style.default.toolbarButton;

        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;


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
                label: "Run",
                icon: "fas fa-play"
            });
            button["run"].disable();
            button["run"].onClick = function(){

                grid.forEachRow((row)=>{
                    row.record.similarities = null;
                    row.set("Similarities", "");
                });


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


                button["stop"].enable();
                compareDocuments(jobs, function(){
                    button["stop"].disable();
                    if (waitmask) waitmask.hide();
                    comparisonsEnabled = true;
                });
            };



          //Add stop button
            button["stop"] = createButton(td, {
                label: "Cancel",
                icon: "fas fa-stop"
            });
            button["stop"].disable();
            button["stop"].onClick = function(){
                comparisonsEnabled = false;
                waitmask.show();
            };


            createSpacer(td);


          //Add clear button
            button["clear"] = createButton(td, {
                label: "Clear",
                icon: "fas fa-times"
            });
            button["clear"].disable();
            button["clear"].onClick = function(){
                selectedDocuments.clear();
            };



          //Row 2
            tr = document.createElement("tr");
            tbody.appendChild(tr);
            td = document.createElement("td");
            td.style.height = "100%";
            tr.appendChild(td);


          //Create data grid
            grid = new javaxt.dhtml.DataGrid(td, {
                style: config.style.table,
                localSort: true,
                columns: [
                    {header: 'Name', width:'100%', sortable: true},
                    {header: 'Similarities', width:'215', sortable: true}
                ],
                update: function(row, record){
                    row.set("Name", record.name);
                    row.set("Similarities", record.similarities);
                }
            });


          //Watch for row click events
            grid.onRowClick = function(row, e){
                var document = row.record;
                if (e.detail === 2) { //double click
                    if (document.similarities){
                        var numSimilarities = 0;
                        document.similarities.forEach((similarity)=>{
                            if (similarity.results.num_suspicious_pairs>0) numSimilarities++;
                        });
                        if (numSimilarities>0){
                            showSimilarityResults(document);
                        }
                    }
                }
            };

        };



      //Watch for changes to the selectedDocuments data store
        selectedDocuments.addEventListener("add", function(document){
            if (grid){
                grid.load([document], 2); //second arg is a page number (hack for DataGrid)
                if (selectedDocuments.length>1) button["run"].enable();
                if (selectedDocuments.length>0) button["clear"].enable();
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
                if (selectedDocuments.length<1) button["clear"].disable();
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
                    if (selectedDocuments.length>0) button["clear"].enable();
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
                showCheckboxes: false
            });

            searchPanel.el.addEventListener('dragover', onDragOver, false);
            searchPanel.el.addEventListener('drop', onDrop, false);

            var grid = searchPanel.getDataGrid();


          //Watch for row click events
            grid.onRowClick = function(row, e){
                if (e.detail === 2) { //double click

                    var o = row.get("Name");
                    if (!o.select){
                        var div = document.createElement("div");
                        div.className = "document-analysis-selected-row";
                        div.select = function(){
                            div.style.left = "0px";
                        };
                        div.deselect = function(){
                            div.style.left = "-34px";
                        };
                        div.deselect();

                        var check = document.createElement("div");
                        check.className = "fas fa-check-square";
                        div.appendChild(check);

                        var span = document.createElement("span");
                        if ( //is element?
                            typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
                            o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
                        ) span.appendChild(o);
                        else span.innerText = o;
                        div.appendChild(span);

                        row.set("Name", div);
                        o = div;
                    }


                  //Add or remove document from the selectedDocuments store
                    var addDocument = true;
                    var r = row.record;
                    selectedDocuments.forEach((d, i)=>{
                        if (d.id===r.id){
                            selectedDocuments.removeAt(i);
                            addDocument = false;
                            return true;
                        }
                    });
                    if (addDocument){
                        selectedDocuments.add(r);
                        o.select();
                    }
                    else{
                        o.deselect();
                    }
                }
            };


            selectedDocuments.addEventListener("remove", function(){
                var documents = arguments;
                grid.forEachRow((row)=>{
                    var d = row.record;
                    for (var i=0; i<documents.length; i++){
                        var document = documents[i];
                        if (d.id===document.id){
                            try{ row.get("Name").deselect(); }
                            catch(e) {}
                        }
                    }
                });
            });

        };



        return {
            clear: function(){
                if (searchPanel) searchPanel.clear();
            },
            update: function(panel){
                if (!searchPanel){
                    createPanel(panel.childNodes[0]);
                    searchPanel.update();
                }
            }
        };
    };


  //**************************************************************************
  //** onDragOver
  //**************************************************************************
  /** Called when the client drags something over the searchPanel
   */
    var onDragOver = function(e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy
    };


  //**************************************************************************
  //** onDrop
  //**************************************************************************
  /** Called when the client drops something onto the searchPanel
   */
    var onDrop = function(e) {

        e.stopPropagation();
        e.preventDefault();
        var files = e.dataTransfer.files;
        if (files.length>0){

          //Generate list of files to upload
            var arr = [];
            for (var i=0; i<files.length; i++) {
                var file = files[i];
                var fileName = file.name.toLowerCase();
                var ext = fileName.substring(fileName.lastIndexOf(".")+1);
                if (ext==="pdf" || ext==="txt"){
                    arr.push(file);
                }
            }


            if (arr.length==0) return;
            waitmask.show(500);


          //Upload files to the server
            var failures = [];
            var upload = function(){

                if (arr.length===0){
                    waitmask.hide();
                    if (failures.length>0){
                        alert("Failed to upload " + failures);
                    }
                    return;
                }

                var file = arr.shift();
                var formData = new FormData();
                formData.append(file.name, file);
                post("document", formData, {
                    success: function(text){
                        var results = JSON.parse(text);
                        if (results[0].result==="error"){
                            failures.push(file.name);
                        }
                        upload();
                    },
                    failure: function(request){
                        failures.push(file.name);
                        upload();
                    }
                });
            };
            upload();
        }
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


  //**************************************************************************
  //** compareDocuments
  //**************************************************************************
    var compareDocuments = function(jobs, onCompletion){

        var runJob = function(){

            if (!comparisonsEnabled) jobs.splice(0,jobs.length);

            if (jobs.length==0){
                if (onCompletion) onCompletion.apply(me, []);
                return;
            }

            var job = jobs.shift();
            job.row.set("Similarities", "Pending...");
            getSimilarities(job.doc, job.otherDocs,
                function(step, totalSteps, success){
                    job.row.set("Similarities", Math.round((step/totalSteps)*100) + "%");
                },
                function(similarities){
                    var numSimilarities = 0;
                    similarities.forEach((similarity)=>{
                        if (similarity.results.num_suspicious_pairs>0) numSimilarities++;
                    });
                    job.row.record.similarities = similarities;
                    var summary;
                    if (numSimilarities==0){
                        summary = "No similarities found";
                    }
                    else{
                        summary = "Found " + numSimilarities + " matching document";
                        if (numSimilarities>1) summary+="s";
                    }
                    job.row.set("Similarities", summary);
                    runJob();
                }
            );
        };
        runJob();
    };


  //**************************************************************************
  //** getSimilarities
  //**************************************************************************
    var getSimilarities = function(doc, otherDocs, onStep, onCompletion){

        var similarities = [];
        var steps = 0;
        var totalSteps = otherDocs.length;

        var getSimilarity = function(doc, otherDocs){

            if (!comparisonsEnabled) otherDocs.splice(0,otherDocs.length);

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
  //** showSimilarityResults
  //**************************************************************************
    var showSimilarityResults = function(document){
        if (!similarityResults){

            var win = createWindow({
                width: 800,
                height: 450,
                valign: "top",
                modal: true,
                style: config.style.window
            });


          //Create data grid
            var grid = new javaxt.dhtml.DataGrid(win.getBody(), {
                style: config.style.table,
                localSort: true,
                columns: [
                    {header: 'Similar Document', width:'100%', sortable: true},
                    {header: 'Digit Similarity', width:'120', sortable: true},
                    {header: 'Text Similarity', width:'120', sortable: true},
                    {header: 'Similarities', width:'120', sortable: true}
                ],
                update: function(row, record){
                    row.set("Similar Document", record.name);
                    row.set("Similarities", record.suspicious_pages);
                }
            });


          //Watch for row click events
            grid.onRowClick = function(row, e){
                if (e.detail === 2) { //double click
                    showDocumentSimilarities(row.record);
                }
            };


            similarityResults = {
                update: function(document){
                    win.setTitle(document.name);
                    grid.clear();

                    var documentID = document.id;

                  //Create records for the grid
                    var data = [];
                    document.similarities.forEach((similarity)=>{
                        console.log(similarity.results);


                      //Find "file" entry
                        var file;
                        similarity.results.files.every((f)=>{
                            if (f.document_id!==documentID){
                                file = f;
                                return false;
                            }
                            return true;
                        });


                      //Create record
                        data.push({
                            id: file.document_id,
                            name: file.filename,
                            suspicious_pages: file.n_suspicious_pages,
                            sourceID: documentID,
                            results: similarity.results
                        });

                    });


                  //Load records
                    grid.load(data);

                },
                show: win.show
            };

        }

        similarityResults.update(document);
        similarityResults.show();
    };


  //**************************************************************************
  //** showDocumentSimilarities
  //**************************************************************************
    var showDocumentSimilarities = function(record){

        if (!documentSimilarities){

            var win = createWindow({
                title: "Document Analysis",
                width: 965,
                height: 600,
                valign: "top",
                modal: true,
                style: config.style.window
            });

            var docCompare = new bluewave.analytics.DocumentComparison(win.getBody());
            documentSimilarities = {
                show: win.show,
                update: function(similarities){
                    docCompare.update(similarities);
                }
            };
        }

        documentSimilarities.update(record.results);
        documentSimilarities.show();
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
        var defaultStyle = JSON.parse(JSON.stringify(config.style.toolbarButton));
        if (btn.style) btn.style = merge(btn.style, defaultStyle);
        else btn.style = defaultStyle;

        return bluewave.utils.createButton(parent, btn);
    };


  //**************************************************************************
  //** createWindow
  //**************************************************************************
    var createWindow = function(config){
        var win = new javaxt.dhtml.Window(document.body, config);
        windows.push(win);
        return win;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var post = javaxt.dhtml.utils.post;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createSpacer = bluewave.utils.createSpacer;

    init();
};