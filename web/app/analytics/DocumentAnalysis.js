if(!bluewave) var bluewave={};
if(!bluewave.analytics) bluewave.analytics={};

//******************************************************************************
//**  DocumentAnalysis
//******************************************************************************
/**
 *   Panel used to search and compare documents
 *
 ******************************************************************************/

bluewave.analytics.DocumentAnalysis = function(parent, config) {

    var me = this;
    var panels = [];
    var nav, carousel, sliding;
    var selectedDocuments; //datastore
    var searchPanel, previewPanel;
    var similarityResults, documentSimilarities;
    var windows = [];
    var settingsEditor;
    var formTotals;
    var waitmask;
    var comparisonsEnabled = true;
    var remoteSearch = false;
    var ws;
    var maxImportanceScoreEach = 0;

    var defaultConfig = {
        dateFormat: "M/D/YYYY h:mm A",
        style: {

        }
    };

    //Button components
    var mainButton = {};


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

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.padding = "0px";
        tr.appendChild(td);
        createButtonPanel(td);

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
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        return "Document Analysis";
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        remoteSearch = false;
        panels.forEach((panel)=>panel.clear());
        if (previewPanel) previewPanel.hide();

        if (ws){
            ws.stop();
            ws = null;
        }

    };


  //**************************************************************************
  //** update
  //**************************************************************************
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
                    updateButtons();
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
            updateButtons();
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

        var createButton = function(parent, btn){
            var defaultStyle = JSON.parse(JSON.stringify(config.style.toolbarButton));
            if (btn.style) btn.style = merge(btn.style, defaultStyle);
            else btn.style = defaultStyle;

            return bluewave.utils.createButton(parent, btn);
        };

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

            var updateGridByFilteredResults = function(){

                // counts, per match
                var totalImg = 0;
                var totalPage = 0;
                var totalText = 0;
                var totalDigit = 0;

                maxImportanceScoreEach = 0;

                grid.forEachRow((row)=>{
                 // get the original unmodified record
                    var recordVar = row.record;
                    var originalSimilarities = recordVar.similarities;
                    var newSimilarities = [];
                    originalSimilarities.forEach((similarity)=>{

                      // create modified copy (used for setting row link)
                        var newResults = documentSimilarities.getFilteredResults(similarity.results);
                        newSimilarities.push({ id: similarity.id, results: newResults});

                      // set new max importance score
                        if (newResults.maxImportanceScoreEach > maxImportanceScoreEach){
                            maxImportanceScoreEach = newResults.maxImportanceScoreEach;
                        };

                      // add to total for each type of match
                        totalDigit += newResults.digitCount;
                        totalImg += newResults.imgCount;
                        totalText += newResults.textCount;
                        totalPage += newResults.duplicatePageCount;
                    });

                    // set new link for this row in the grid
                    row.set("Comparison Results", getRowName(newSimilarities, originalSimilarities, row));

                });

             // update formTotals object for use by settings form
                formTotals = {
                    digitCount: totalDigit,
                    imgCount: totalImg,
                    textCount: totalText,
                    duplicatePageCount: totalPage
                };

              // update settings form if it has been initialized
                if(settingsEditor){
                    settingsEditor.updateGUI();
                };
            };


          //Add run button
            button["run"] = createButton(td, {
                label: "Compare Documents",
                icon: "fas fa-play"
            });
            button["run"].disable();
            button["run"].onClick = function(){
                button["run"].disable();
                button["clear"].disable();

              //Update grid, clear out any messages from previous run
                grid.forEachRow((row)=>{
                    row.record.similarities = null;
                    row.set("Comparison Results", "");
                });

              //Script to run comparisons
                var runComparison = function(){

                    var jobs = [];
                    selectedDocuments.forEach((document)=>{
                        var arr = [];
                        selectedDocuments.forEach((d)=>{
                            if (d.id!=document.id) arr.push(d.id);
                        });
                        if (document.id){
                            jobs.push({
                                doc: document.id,
                                otherDocs: arr
                            });
                        }
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
                    button["clear"].enable();
                    compareDocuments(jobs, function(){
                        button["run"].enable();
                        button["stop"].disable();
                        if (waitmask) waitmask.hide();
                        comparisonsEnabled = true;
                        updateGridByFilteredResults();
                    });
                };



              //Check if there are any remote files/folders that we need to download
                var downloads = [];
                selectedDocuments.forEach((d)=>{
                    if (isNaN(d.id)) downloads.push(d.name);
                });

                if (downloads.length===0){
                    runComparison();
                }
                else{ //download...

                  //Create web socket listener and watch for status updates
                    if (!ws) ws = new javaxt.dhtml.WebSocket({
                        url: "document",
                        onMessage: function(msg){
                            var arr = msg.split(",");
                            var op = arr[0];
                            if (op==="createFolder"){
                                var folderName = arr[1];
                                var step = parseInt(arr[2]);
                                var totalSteps = parseInt(arr[3]);
                                var row = getRow(folderName);
                                if (row){
                                    if (step===totalSteps) msg = "Download Complete";
                                    else msg = "Downloading " + step + "/" + totalSteps;
                                    row.set("Comparison Results", msg);
                                }
                            }
                        }
                    });


                    var getRow = function(folderName){
                        var ret = null;
                        grid.forEachRow((row)=>{
                            var r = row.record;
                            if (isNaN(r.id)){
                                var fileName = r.name;
                                var idx = fileName.lastIndexOf(".");
                                if (idx>0) fileName = fileName.substring(0, idx);
                                if (fileName===folderName || r.name===folderName){
                                    ret = row;
                                    return;
                                }
                            }
                        });
                        return ret;
                    };


                    var downloadFolder = function(folderName){
                        if (!folderName){
                            var row = getRow(folderName);
                            if (row) row.set("Comparison Results", "");
                            runComparison();
                            return;
                        }

                        get("document/folder?name="+folderName+"&returnID=true",{
                            success: function(id){
                                var row = getRow(folderName);
                                if (row) row.record.id = id;
                                downloadFolder(downloads.shift());
                            },
                            failure: function(request){
                                var row = getRow(folderName);
                                if (row) row.set("Comparison Results", "Download Failed!");
                                downloadFolder(downloads.shift());
                            }
                        });
                    };
                    var folderName = downloads.shift();
                    var row = getRow(folderName);
                    if (row) row.set("Comparison Results", "Downloading...");
                    downloadFolder(folderName);
                }
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

            createSpacer(td);

          // Add settings button
            button["settings"] = createButton(td, {
                label: "Settings",
                icon: "fas fa-cog"
            });

            button["settings"].onClick = function(){
                if (!settingsEditor) {
                    settingsEditor = createSettingsContextMenu(this);
                    settingsEditor.updateGrid = function(){
                        updateGridByFilteredResults();
                    };
                    settingsEditor.updateGUI();
                };
                settingsEditor.show();
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
                    {header: 'Document Name', width:'100%', sortable: true},
                    {header: 'Comparison Results', width:'310', sortable: true}
                ],
                update: function(row, record){
                    row.set("Document Name", record.name);
                    row.set("Comparison Results", record.similarities); //<-- Updated by compareDocuments()
                }
            });
        };



      //Watch for changes to the selectedDocuments data store
        selectedDocuments.addEventListener("add", function(document){
            if (grid){

              //Append document to the grid
                grid.load([document], 2);

              //Update buttons
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
  //** createContextMenu
  //**************************************************************************
    createSettingsContextMenu = function(button){
        var config = {
            style: javaxt.dhtml.style.default
        };

        //Update form
        var editor = new javaxt.dhtml.Window(document.body, {
            title: "Edit Settings",
            width: 400,
            valign: "top",
            modal: false,
            resizable: false,
            style: config.style.window
        });

        var body = editor.getBody();
        body.innerHTML = "";
        if (!documentSimilarities) createDocumentSimilarities();
        var comparisonConfig = documentSimilarities.getConfig();

        var form = new javaxt.dhtml.Form(body, {
            style: config.style.form,
            items: [
                {
                    group: "Text",
                    items: [
                        {
                            name: "textSimilarities",
                            label: "Show",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: false
                                }

                            ]
                        },
                        {
                            name: "minTextCharacters",
                            label: "Min Text Characters",
                            type: "text",
                            required: false
                        },
                        {
                            name: "minTextWords",
                            label: "Min Text Words",
                            type: "text",
                            required: false
                        }
                    ]
                },
                {
                    group: "Digit",
                    items: [
                        {
                            name: "digitSimilarities",
                            label: "Show",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: false
                                }

                            ],
                        },
                        {

                            name: "minDigitCount",
                            label: "Min Digit Count",
                            type: "text",
                            required: false
                        },
                        // {
                        //     name: "allowDigitSpaces",
                        //     label: "Allow Spaces Between Digits",
                        //     type: "checkbox",
                        //     options:[
                        //         {
                        //             label: "",
                        //             value: true,
                        //             checked: false
                        //         }
                        //     ]
                        // },
                        // {
                        //     name: "decimalsOnly",
                        //     label: "Decimals Only",
                        //     type: "checkbox",
                        //     options:[
                        //         {
                        //             label: "",
                        //             value: true,
                        //             checked: false
                        //         }
                        //     ]
                        // },
                        // {

                        //     name: "minDecimalPlaces",
                        //     label: "Min Decimal Places",
                        //     type: "text",
                        //     required: false
                        // }
                    ]
                },
                {
                    group: "Importance Score",
                    items: [
                        {
                            name:"minImportanceScoreEach",
                            label: "Min Score",
                            type: "text"
                        }
                        // {
                        //     name:"similarityThreshholdOverall",
                        //     label: "Min Score (per page)",
                        //     type: "text"
                        // }
                    ]
                },
                {
                    group: "Other",
                    items: [
                        {
                            name: "imgSimilarities",
                            label: "Show Images",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: false
                                }

                            ]
                        },
                        {
                            name: "duplicatePageSimilarities",
                            label: "Show Duplicate Pages",
                            type: "checkbox",
                            options: [
                                {
                                    label: "",
                                    value: true,
                                    checked: false
                                }

                            ]
                        }
                    ]
                },

            ]
        });

    //Set initial value for imgSimilarities
        var imgSimilaritiesField = form.findField("imgSimilarities");
        var imgSimilarities = comparisonConfig.imgSimilarities;
        var imgSimilaritiesFieldLabel = imgSimilaritiesField.row.getElementsByClassName("form-label noselect")[1];
        imgSimilaritiesField.setValue(imgSimilarities===true ? true : false);

    //Set initial value for digitSimilarities
        var digitSimilaritiesField = form.findField("digitSimilarities");
        var digitSimilaritiesFieldLabel = digitSimilaritiesField.row.getElementsByClassName("form-label noselect")[1];
        var digitSimilarities = comparisonConfig.digitSimilarities;
        digitSimilaritiesField.setValue(digitSimilarities===true ? true : false);

    //Set initial value for minDigitCount
        var minDigitCountField = form.findField("minDigitCount");
        var minDigitCount = comparisonConfig.minDigitCount;
        minDigitCountField.setValue(minDigitCount);

    // //Set initial value for allowDigitSpaces
    //     var allowDigitSpacesField = form.findField("allowDigitSpaces");
    //     var allowDigitSpacesFieldLabel = allowDigitSpacesField.row.getElementsByClassName("form-label noselect")[1];
    //     var allowDigitSpaces = comparisonConfig.allowDigitSpaces;
    //     allowDigitSpacesField.setValue(allowDigitSpaces===true ? true : false);

    // //Set initial value for decimalsOnly
    //     var decimalsOnlyField = form.findField("decimalsOnly");
    //     var decimalsOnlyFieldLabel = decimalsOnlyField.row.getElementsByClassName("form-label noselect")[1];
    //     var decimalsOnly = comparisonConfig.decimalsOnly;
    //     decimalsOnlyField.setValue(decimalsOnly===true ? true : false);

    // //Set initial value for minDecimalPlaces
    //     var minDecimalPlacesField = form.findField("minDecimalPlaces");
    //     var minDecimalPlacesFieldLabel = minDecimalPlacesField.row.getElementsByClassName("form-label noselect")[1];
    //     var minDecimalPlaces = comparisonConfig.minDecimalPlaces;
    //     minDecimalPlacesField.setValue(minDecimalPlaces);

    //Set intial value for textSimilarities
        var textSimilaritiesField = form.findField("textSimilarities");
        var textSimilaritiesFieldLabel = textSimilaritiesField.row.getElementsByClassName("form-label noselect")[1];
        var textSimilarities = comparisonConfig.textSimilarities;
        textSimilaritiesField.setValue(textSimilarities===true ? true : false);

    //Set initial value for minTextWords
        var minTextWordsField = form.findField("minTextWords");
        var minTextWords = comparisonConfig.minTextWords;
        minTextWordsField.setValue(minTextWords);

    //Set initial value for minTextCharacters
        var minTextCharactersField = form.findField("minTextCharacters");
        var minTextCharacters = comparisonConfig.minTextCharacters;
        minTextCharactersField.setValue(minTextCharacters);

    //Set initial value for duplicatePageSimilarities
    var duplicatePageSimilaritiesField = form.findField("duplicatePageSimilarities");
    var duplicatePageSimilaritiesFieldLabel = duplicatePageSimilaritiesField.row.getElementsByClassName("form-label noselect")[1];
    var duplicatePageSimilarities = comparisonConfig.duplicatePageSimilarities;
    duplicatePageSimilaritiesField.setValue(duplicatePageSimilarities===true ? true : false);


    // Use slider for minImportanceScoreEach
        var minImportanceScoreSlider = createSlider("minImportanceScoreEach", form, "", 0, maxImportanceScoreEach, 1); // min, max, inc

    //Set initial value for minImportanceScoreEach
        var minImportanceScoreEachField = form.findField("minImportanceScoreEach");
        var minImportanceScoreEach = comparisonConfig.minImportanceScoreEach;
        minImportanceScoreEachField.setValue(minImportanceScoreEach);

    // Use slider for similarityThreshholdOverall
        // createSlider("similarityThreshholdOverall", form, "", 0, maxOverall, 5);

    //Set initial value for similarityThreshholdOverall
        // var similarityThreshholdOverallField = form.findField("similarityThreshholdOverall");
        // var similarityThreshholdOverall = comparisonConfig.similarityThreshholdOverall;
        // var similarityThreshholdOverallFieldLabel = similarityThreshholdOverallField.row.getElementsByClassName("form-label noselect")[1];
        // similarityThreshholdOverallField.setValue(similarityThreshholdOverall);

        var updateSavedState = function(formSettings){
            // Update the saved state of the Comparison Panel form
                comparisonConfig.imgSimilarities = formSettings.imgSimilarities;
                comparisonConfig.digitSimilarities = formSettings.digitSimilarities;
                comparisonConfig.textSimilarities = formSettings.textSimilarities;
                comparisonConfig.minDigitCount = formSettings.minDigitCount;
                comparisonConfig.minImportanceScoreEach = formSettings.minImportanceScoreEach;
                // comparisonConfig.similarityThreshholdOverall = formSettings.similarityThreshholdOverall;
                // comparisonConfig.allowDigitSpaces = formSettings.allowDigitSpaces;
                // comparisonConfig.decimalsOnly = formSettings.decimalsOnly;
                // comparisonConfig.minDecimalPlaces = formSettings.minDecimalPlaces;
                comparisonConfig.minTextWords = formSettings.minTextWords;
                comparisonConfig.minTextCharacters = formSettings.minTextCharacters;
                comparisonConfig.duplicatePageSimilarities = formSettings.duplicatePageSimilarities;

            // reset sliders
                minImportanceScoreSlider.setAttribute("max", maxImportanceScoreEach);
        };

    //Process onChange events
        form.onChange = function(){
            var formSettings = form.getData();

        //Update form data
            if (formSettings.imgSimilarities==="true") formSettings.imgSimilarities = true;
            else formSettings.imgSimilarities = false;

            if (formSettings.digitSimilarities==="true") formSettings.digitSimilarities = true;
            else formSettings.digitSimilarities = false;

            if (formSettings.textSimilarities==="true") formSettings.textSimilarities = true;
            else formSettings.textSimilarities = false;

            // if (formSettings.allowDigitSpaces==="true") formSettings.allowDigitSpaces = true;
            // else formSettings.allowDigitSpaces = false;

            // if (formSettings.decimalsOnly==="true") formSettings.decimalsOnly = true;
            // else formSettings.decimalsOnly = false;

            if (formSettings.duplicatePageSimilarities==="true") formSettings.duplicatePageSimilarities = true;
            else formSettings.duplicatePageSimilarities = false;

        //Update comparisonConfig
            updateSavedState(formSettings);

        // reset form errors
            for (var fieldName in formSettings){
                if (form.findField(fieldName).resetColor) form.findField(fieldName).resetColor();
            };

        // disable/re-enable settings menu to prevent users from changing setting during rendering
            if (settingsEditor){
                settingsEditor.disableThis();
            };
            settingsEditor.updateGrid();
            settingsEditor.enableThis();
        };

        editor.updateGUI = function(){
            var totals = formTotals;

            // update GUI counts
                if (totals.digitCount < 1)digitSimilaritiesFieldLabel.innerText = '';
                else digitSimilaritiesFieldLabel.innerText = totals.digitCount + " total matches";

                if (totals.textCount < 1)textSimilaritiesFieldLabel.innerText = '';
                else textSimilaritiesFieldLabel.innerText = totals.textCount + " total matches";

                if (totals.imgCount < 1)imgSimilaritiesFieldLabel.innerText = '';
                else imgSimilaritiesFieldLabel.innerText = totals.imgCount + " total matches";

                if (totals.duplicatePageCount < 1)duplicatePageSimilaritiesFieldLabel.innerText = '';
                else duplicatePageSimilaritiesFieldLabel.innerText = totals.duplicatePageCount + " total matches";
        };

        editor.disableThis = function(){ // used for temporarily disabling settings options while changes render
            // modify style of fields to indicate this form is disabled
                form.disableField("imgSimilarities");
                form.disableField("digitSimilarities");
                form.disableField("textSimilarities");
                // form.disableField("minDecimalPlaces");
                form.disableField("minDigitCount");
                // form.disableField("allowDigitSpaces");
                form.disableField("minTextCharacters");
                form.disableField("minTextWords");
                form.disableField("minImportanceScoreEach");
                // form.disableField("similarityThreshholdOverall");
                // form.disableField("decimalsOnly");
                form.disableField("duplicatePageSimilarities");

            // disable checkboxes
                var formCheckboxes = form.el.getElementsByClassName("form-checkbox");
                for (var i in formCheckboxes){
                    formCheckboxes[i].disabled = true;
                };
        };

        editor.enableThis = function(){
        // modify style of fields to indicate this form is enabled
            form.enableField("imgSimilarities");
            form.enableField("digitSimilarities");
            form.enableField("textSimilarities");
            // form.enableField("minDecimalPlaces");
            form.enableField("minDigitCount");
            // form.enableField("allowDigitSpaces");
            form.enableField("minTextCharacters");
            form.enableField("minTextWords");
            form.enableField("minImportanceScoreEach");
            // form.enableField("similarityThreshholdOverall");
            // form.enableField("decimalsOnly");
            form.enableField("duplicatePageSimilarities");

        // enabled checkboxes
            var formCheckboxes = form.el.getElementsByClassName("form-checkbox");
            for (var i in formCheckboxes){
                formCheckboxes[i].disabled = false;
            };
        };

    // render settings Editor to the left of cog wheel icon
        var rect = javaxt.dhtml.utils.getRect(button);
        editor.showAt(rect.x - 400,rect.y);
        form.resize();

        return editor;
    };



  //**************************************************************************
  //** createSearchPanel
  //**************************************************************************
    var createSearchPanel = function(){

        var createPanel = function(parent){


            var table = createTable();
            var tbody = table.firstChild;
            var tr, td;

            tr = document.createElement("tr");
            tbody.appendChild(tr);
            td = document.createElement("td");
            td.style.width = "100%";
            tr.appendChild(td);
            var leftCol = td;
            td = document.createElement("td");
            tr.appendChild(td);
            createPreviewPanel(td);
            parent.appendChild(table);


          //Create document search panel
            searchPanel = new bluewave.analytics.DocumentSearch(leftCol,{
                dateFormat: config.dateFormat,
                showCheckboxes: false
            });
            var timer = null;
            searchPanel.onLoad = function(){
                if (previewPanel) previewPanel.hide();
                var numRecords = 0;
                var grid = searchPanel.getDataGrid();
                grid.forEachRow(function (row) {
                    numRecords++;

                  //Add custom select/deselect methods to the name column
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

                });


                var q = searchPanel.getSearchBar().getSearchTerms();
                if (!remoteSearch && q && q.length>0){
                    if (timer) clearTimeout(timer);

                    timer = setTimeout(()=>{

                      // check if remote search is enabled in config, if it is then request confirmation on remote search
                        var url = "/document/remoteSearchStatus";
                        get(url,{
                            success: function(status){
                                if (status === "true"){
                                    confirm("Found " + numRecords + " local documents. Would you like to check the server for more records?",{
                                        title: "Search Results",
                                        leftButton: {label: "Yes", value: true},
                                        rightButton: {label: "No", value: false},
                                        callback: function(yes){
                                            if (yes){

                                                remoteSearch = true;
                                                waitmask.show(500);



                                                var url = "documents?remote=true";
                                                q.forEach((s)=>{
                                                    url+= "&q=" + encodeURIComponent(s);
                                                });

                                                get(url, {
                                                    success: function(text){
                                                        waitmask.hide();

                                                      //Parse response
                                                        var data = parseSearchResults(text);

                                                      //Prune documents that we already have in the grid
                                                        var grid = searchPanel.getDataGrid();
                                                        grid.forEachRow((row)=>{
                                                            var r = row.record;
                                                            data.every((d, i)=>{
                                                                if (r.name===d.name){
                                                                    data.splice(i, 1);
                                                                    return false;
                                                                }
                                                                return true;
                                                            });
                                                        });


                                                      //Append search results to the grid
                                                        grid.load(data, 2);
                                                        remoteSearch = false;
                                                    },
                                                    failure: function(request){
                                                        waitmask.hide();
                                                        remoteSearch = false;
                                                    }
                                                });
                                            }
                                        }
                                    });
                                };
                            },
                            failure: function(){
                                console.log("this remote search failed to get checked!");
                            }
                        });
                    },1000);
                }

                updateButtons();
            };


            searchPanel.el.addEventListener('dragover', onDragOver, false);
            searchPanel.el.addEventListener('drop', onDrop, false);

            var grid = searchPanel.getDataGrid();



          //Watch for row click events
            grid.onRowClick = function(row, e){
                var r = row.record;
                if (e.detail === 2) { //double click


                  //Add or remove document from the selectedDocuments store
                    var addDocument = true;
                    selectedDocuments.forEach((d, i)=>{
                        if (isMatch(r, d)){
                            selectedDocuments.removeAt(i);
                            addDocument = false;
                            return true;
                        }
                    });

                    var o = row.get("Name");
                    if (addDocument){
                        selectedDocuments.add(r);
                        o.select();
                    }
                    else{
                        o.deselect();
                    }

                }
                else{
                    previewPanel.update(r);
                    previewPanel.show();
                }
            };


            selectedDocuments.addEventListener("remove", function(){
                var documents = arguments;
                grid.forEachRow((row)=>{
                    var r = row.record;
                    for (var i=0; i<documents.length; i++){
                        var d = documents[i];
                        if (isMatch(r, d)){
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
                if (previewPanel) previewPanel.hide();
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
  //** createPreviewPanel
  //**************************************************************************
    var createPreviewPanel = function(parent){

        previewPanel = document.createElement("div");
        previewPanel.style.position = "relative";
        previewPanel.style.width = "";
        previewPanel.style.height = "100%";
        parent.appendChild(previewPanel);
        var iframe = document.createElement("iframe");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0 none";
        previewPanel.appendChild(iframe);
        previewPanel.show = function(){
            if (this.offsetWidth<400){
                this.style.width = "400px";
            }
        };
        previewPanel.hide = function(){
            this.style.width = "0px";
        };
        previewPanel.update = function(record){
            if (record.id){
                var url = "document?id=" + record.id;
                if (iframe.src!=url) iframe.src = url;
            }
            else{
                //iframe.src = "";

                var maxSize = 0;
                var maxFile;
                if (record.documents){
                    record.documents.forEach((doc)=>{
                        if (doc.size>maxSize){
                            maxSize = doc.size;
                            maxFile = doc;
                        }
                    });
                    var id = maxFile.id;
                    get("document?id=" + id + "&remote=true",{
                        success: function(url){
                            if (iframe.src!=url) iframe.src = url;
                        }
                    });

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
                    if (searchPanel) searchPanel.update();
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
            job.row.set("Comparison Results", "Pending...");
            getSimilarities(job.doc, job.otherDocs,
                function(step, totalSteps, success){
                    job.row.set("Comparison Results", Math.round((step/totalSteps)*100) + "%");
                },
                function(similarities, originalSimilarities){
                    job.row.record.similarities = originalSimilarities;
                    job.row.set("Comparison Results", getRowName(similarities, originalSimilarities, job.row));
                    runJob();
                }
            );
        };
        runJob();
    };

  //**************************************************************************
  //** getRowName
  //**************************************************************************
    var getRowName = function(similarities, originalSimilarities, row){
        var numSimilarities = 0;
        var numOriginalSimilarities = 0;
        var totalMatches = 0;
        var hiddenMatches = 0;
        similarities.forEach((similarity)=>{
            totalMatches += similarity.results.num_suspicious_pairs;
            if (similarity.results.num_suspicious_pairs>0) numSimilarities++;
        });
        originalSimilarities.forEach((similarity)=>{
            numOriginalSimilarities += similarity.results.num_suspicious_pairs;
        });

        hiddenMatches = numOriginalSimilarities - totalMatches;

        var summaryIcon, summaryText;
        if (numSimilarities === 0 && hiddenMatches === 0){
            summaryIcon = "far fa-check-circle";
            summaryText = "No matches found";
        }
        else if (numSimilarities === 0 && hiddenMatches > 0){
            summaryIcon = "far fa-check-circle";
            summaryText = "No matches found (" + hiddenMatches + " hidden)";
        }
        else{
            var documentString = "document"; // for writing over
            summaryIcon = "fas fa-exclamation-triangle";
            if (numSimilarities>1) documentString = documentString+"s";

            if (numSimilarities !== 0 && hiddenMatches > 0){
                summaryText = totalMatches + " matches in " + numSimilarities + ` ${documentString}` + " ("+hiddenMatches+" hidden)";
            }
            if (numSimilarities !==0 && hiddenMatches <= 0){
                summaryText = totalMatches + " matches in " + numSimilarities + ` ${documentString}`;
            }

            var link = document.createElement("a");
            link.innerText = summaryText;
            link.document = row.record;
            link.onclick = function(){
                showSimilarityResults(this.document);
            };
            summaryText = link;
        }

        var summary = document.createElement("div");
        summary.className = "document-analysis-comparison-results";
        var icon = document.createElement("div");
        icon.className = summaryIcon;
        summary.appendChild(icon);
        var span = document.createElement("span");
        if (typeof summaryText === "string"){
            span.innerText = summaryText;
        }
        else{
            span.appendChild(summaryText);
        }

        summary.appendChild(span);

        return summary;
    };


  //**************************************************************************
  //** getSimilarities
  //**************************************************************************
    var getSimilarities = function(doc, otherDocs, onStep, onCompletion){
        var similarities = [];
        var originalSimilarities = [];
        var steps = 0;
        var totalSteps = otherDocs.length;


        var getSimilarity = function(doc, otherDocs){

            if (!comparisonsEnabled) otherDocs.splice(0,otherDocs.length);

            if (otherDocs.length===0){
                if (onCompletion) onCompletion.apply(me, [similarities,originalSimilarities]);
                return;
            }

            var b = otherDocs.shift();
            steps++;

            get("document/similarity?documents="+doc+","+b,{
                success: function(json){
                    if (!documentSimilarities) createDocumentSimilarities();


                    similarities.push({
                        id: b,
                      // get the default, baseline filtered results from documentComparison
                        results: documentSimilarities.getFilteredResults(json)
                    });
                    originalSimilarities.push({
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
    var showSimilarityResults = function(doc){

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
                    {header: 'Page Matches', width:'120', sortable: true},
                    {header: 'Image Matches', width:'120', sortable: true},
                    {header: 'Digit Matches', width:'120', sortable: true},
                    {header: 'Text Matches', width:'120', sortable: true},
                    {header: 'Total Matches', width:'120', sortable: true}
                ],
                update: function(row, record){
                    var CombinedMatchesCount = (record.results.textCount + record.results.digitCount + record.results.duplicatePageCount + record.results.imgCount);
                    if (record.suspicious_pages < 1 || CombinedMatchesCount < 1){
                        row.remove();
                        return;
                    }

                    var link = document.createElement("a");
                    link.innerText = record.name;
                    link.record = record;
                    link.onclick = function(){
                        showDocumentSimilarities(this.record);
                    };

                    var div = document.createElement("div");
                    div.className = "document-analysis-comparison-results";
                    div.appendChild(link);

                    row.set("Similar Document", div);
                    row.set("Total Matches", CombinedMatchesCount);
                    // row.set("Similarities", record.suspicious_pages);
                    row.set("Image Matches", record.results.imgCount);
                    row.set("Text Matches", record.results.textCount);
                    row.set("Digit Matches", record.results.digitCount);
                    row.set("Page Matches", record.results.duplicatePageCount);
                }
            });



            similarityResults = {
                update: function(document){
                    win.setTitle(document.name);
                    grid.clear();

                    var documentID = document.id;

                  //Create records for the grid
                    var data = [];

                    document.similarities.forEach((similarity)=>{

                      //Find "file" entry
                        var file;
                        similarity.results.files.every((f)=>{
                            if (f.document_id!==documentID){
                                file = f;
                                return false;
                            }
                            return true;
                        });

                        if (!documentSimilarities) createDocumentSimilarities();

                      //Create record
                        data.push({
                            id: file.document_id,
                            name: file.filename,
                            suspicious_pages: file.n_suspicious_pages,
                            sourceID: documentID,
                            results: documentSimilarities.getFilteredResults(similarity.results)
                        });

                    });


                  //Load records
                    grid.load(data);

                },
                show: win.show
            };

        }

        similarityResults.update(doc);
        similarityResults.show();
    };


  //**************************************************************************
  //** createDocumentSimilarities
  //**************************************************************************
    var createDocumentSimilarities = function(){
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
                },
                getFilteredResults: function(results){
                    return docCompare.getFilteredSimilarities(results);
                },
                getConfig: function(){
                    return docCompare.getConfig();
                }

            };
        };
    };


  //**************************************************************************
  //** showDocumentSimilarities
  //**************************************************************************
    var showDocumentSimilarities = function(record){
        if (!documentSimilarities) createDocumentSimilarities();
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
    var createButton = function(label, parent){
        var input = document.createElement('input');
        input.className = "form-button";
        input.type = "button";
        input.name = label;
        input.value = label;
        input.disabled = true;
        input.disable = function(){
            this.disabled = true;
        };
        input.enable = function(){
            this.disabled = false;
        };
        input.setText = function(label){
            this.name = label;
            this.value = label;
        };
        input.getText = function(){
            return this.value;
        };
        parent.appendChild(input);
        return input;
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
  //** createButtonPanel
  //**************************************************************************
    var createButtonPanel = function(parent){

        var buttonsDiv = document.createElement("div");
        buttonsDiv.className = "document-analysis-button-bar";
        parent.appendChild(buttonsDiv);


        var rightSideButtons = document.createElement("div");
        rightSideButtons.style.right = "10px";
        rightSideButtons.style.position = "absolute";

        buttonsDiv.appendChild(rightSideButtons);

        var leftSideButtons = document.createElement("div");
        leftSideButtons.style.left = "0px";
        leftSideButtons.style.position = "absolute";

        buttonsDiv.appendChild(leftSideButtons);



      //Add back button
        mainButton["back"] = createButton("Back", rightSideButtons);
        mainButton["back"].onclick = function(){
            for (var i in panels){
                if (panels[i].name == "Document Search") panels[i].select();
            }
        };

      //Add next button
        mainButton["next"] = createButton("Next", rightSideButtons);
        mainButton["next"].onclick = function(){
            for (var i in panels){
                if (panels[i].name == "Selected Documents") panels[i].select();
            }
        };


      //Add selectAll button
        mainButton["selectAll"] = createButton("Select All", leftSideButtons);
        mainButton["selectAll"].style.width = "100px";
        mainButton["selectAll"].onclick = function(){
            var currLabel = this.getText();
            if (currLabel==="Select All") this.setText("Deselect All");
            else this.setText("Select All");

            var grid = searchPanel.getDataGrid();
            grid.forEachRow((row)=>{

                var idx = null;
                var r = row.record;
                selectedDocuments.forEach((d, i)=>{
                    if (isMatch(r, d)){
                        idx = i;
                        return true;
                    }
                });

                if (currLabel==="Select All"){
                    row.get("Name").select();
                    if (idx==null) selectedDocuments.add(r);
                }
                else{
                    row.get("Name").deselect();
                    if (idx!=null) selectedDocuments.removeAt(idx);
                }
            });
        };

        updateButtons();
    };


  //**************************************************************************
  //** isMatch
  //**************************************************************************
    var isMatch = function(r, d){
        var foundMatch = false;
        if (isNaN(r.id)){
            if (d.name===r.name && isNaN(r.name)){
                foundMatch = true;
            }
        }
        else{
            if (d.id===r.id){
                foundMatch = true;
            }
        }
        return foundMatch;
    };



  //**************************************************************************
  //** updateButtons
  //**************************************************************************
    var updateButtons = function(){
        var selectedPanelName, selectedSelectAllPanel;

        for (var panel in panels){
            if (panels[panel].isSelected()) selectedPanelName = panels[panel].name;
        };

        if (mainButton){
            if (selectedPanelName == "Document Search") {
                mainButton["back"].disable();
                mainButton["next"].enable();
                mainButton["selectAll"].enable();
                selectedSelectAllPanel = searchPanel;

            }
            else if (selectedPanelName == "Selected Documents") {
                mainButton["back"].enable();
                mainButton["next"].disable();
                mainButton["selectAll"].disable();
            }

            // update SelectAll button text
            if (selectedSelectAllPanel){
                if (!selectedSelectAllPanel.selectAllStatus) mainButton["selectAll"].setText("Select All");
                else mainButton["selectAll"].setText("Deselect All");
            };
        };
    };


  //**************************************************************************
  //** parseSearchResults
  //**************************************************************************
    var parseSearchResults = function(csv){

        var rows = parseCSV(csv, ",");
        var header = rows.shift();
        var createRecord = function(row){
            var r = {};
            header.forEach((field, i)=>{
                var v = row[i];
                if (field=="size"){
                    v = parseFloat(v);
                }
                else if (field=="info"){
                    if (v) v = JSON.parse(decodeURIComponent(v));
                }
                r[field] = v;
            });
            return r;
        };


        var folders = {};
        rows.forEach((row)=>{
            var doc = createRecord(row);
            var name = doc.name;
            var idx = name.indexOf("/");
            var folderName = name.substring(0, idx);
            var arr = folders[folderName];
            if (arr==null){
                arr = [];
                folders[folderName] = arr;
            }
            arr.push(doc);
        });



        var data = [];
        for (var folderName in folders) {
            if (folders.hasOwnProperty(folderName)){
                var arr = folders[folderName];
                var size = 0;
                var date = 0;
                var highlightFragment = null;
                arr.forEach((doc)=>{
                    size+=doc.size;
                    date = Math.max(Date.parse(doc.date), date);
                    if (!highlightFragment){
                        if (doc.info){
                            if (doc.info.highlightFragment){
                                highlightFragment = doc.info.highlightFragment;
                            }
                        }
                    }
                });

                data.push({
                    name: folderName + ".pdf",
                    size: size,
                    type: "Remote",
                    date: new Date(date),
                    documents: arr,
                    info: {
                        highlightFragment: highlightFragment
                    }
                });
            }
        }

        return data;
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
    var parseCSV = bluewave.utils.parseCSV;
    var createSlider = bluewave.utils.createSlider;

    init();
};