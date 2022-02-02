if(!bluewave) var bluewave={};
if(!bluewave.analytics) bluewave.analytics={};

//******************************************************************************
//**  DocumentComparison
//******************************************************************************
/**
 *   Panel used to compare documents
 *
 ******************************************************************************/

bluewave.analytics.DocumentComparison = function(parent, config) {

    var me = this;
    var carousel;
    var backButton, nextButton;
    var summaryPanel, comparisonPanel, comparisonPanel2;
    var waitmask;
    var results = {};
    var currPair = -1;



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
  //** getSummaryPanel
  //**************************************************************************
    this.getSummaryPanel = function(){
        return summaryPanel.el;
    };


  //**************************************************************************
  //** getSimilarities
  //**************************************************************************
    this.getSimilarities = function(){
        return results;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        results = {};
        currPair = -1;
        backButton.disabled = true;
        nextButton.disabled = true;

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

      //Process arguments
        var similarities, files;
        if (arguments.length>0){

            if (isArray(arguments[0])){
                files = "";
                var inputs = arguments[0];
                for (var i=0; i<inputs.length; i++){
                    if (i>0) files+=",";
                    files+= inputs[i];
                }

                if (arguments.length>1){
                    similarities = arguments[1];
                }

            }
            else{
                similarities = arguments[0];
            }
        }


      //Update the panel
        if (similarities){
            results = similarities;
            update(results);
        }
        else{
            if (files){
                waitmask.show(500);
                get("document/similarity?files="+files,{
                    success: function(json){
                        waitmask.hide();
                        results = json;
                        update(results);
                    },
                    failure: function(request){
                        alert(request);
                        waitmask.hide();
                    }
                });
            }
        }
    };


  //**************************************************************************
  //** update
  //**************************************************************************
  /** Used to populate the panels in the carousel control. Assumes that the
   *  carousel is cleared (see clear method)
   */
    var update = function(){
        var suspiciousPairs = results.suspicious_pairs;
        if (suspiciousPairs.length>0){
            nextButton.disabled = false;
        }

        var panels = carousel.getPanels();
        if (!summaryPanel) summaryPanel = createSummaryPanel();
        summaryPanel.update();
        panels[0].div.appendChild(summaryPanel.el);

        if (suspiciousPairs.length===0) return;

        if (!comparisonPanel) comparisonPanel = createComparisonPanel();
        comparisonPanel.update(0);
        panels[1].div.appendChild(comparisonPanel.el);
    };


  //**************************************************************************
  //** createSummaryPanel
  //**************************************************************************
    var createSummaryPanel = function(){

        var table, tbody, tr, td;

      //Create main table
        table = createTable();
        tbody = table.firstChild;
        var el = table;

      //Create title
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "doc-compare-title";
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
        div.className = "doc-compare-background";
        div.innerHTML = '<i class="fas fa-not-equal"></i>';
        td.appendChild(div);


      //Create details
        table = createTable();
        table.style.height = "";
        table.style.width = "";
        tbody = table.firstChild;
        td.appendChild(table);

        var addRow = function(key, value){
            tr = document.createElement("tr");
            tbody.appendChild(tr);

            td = document.createElement("td");
            td.className = "doc-compare-key";
            td.innerText = key + ":";
            tr.appendChild(td);

            td = document.createElement("td");
            td.className = "doc-compare-value";
            td.innerText = value;
            tr.appendChild(td);
        };


        return {
            el: el,
            update: function(){

              //Update title
                var suspiciousPairs = results.suspicious_pairs;
                if (suspiciousPairs.length>0){
                    icon.className = "fas fa-exclamation-triangle";
                    title.innerText = "Similarities Found!";
                }
                else{
                    icon.className = "far fa-check-circle";
                    title.innerText = "Unique Documents";
                }


                var elapsedTime = Math.round(results.elapsed_time_sec);
                if (elapsedTime<1) elapsedTime = "<1 sec";
                else elapsedTime += " sec";


              //Update body
                tbody.innerHTML = "";
                addRow("Files Analyzed", results.files.length);
                addRow("Suspicious Pairs", suspiciousPairs.length);
                addRow("Elapsed Time", elapsedTime);
                addRow("Pages Per Second", results.pages_per_second);
            }
        };
    };


  //**************************************************************************
  //** createComparisonPanel
  //**************************************************************************
    var createComparisonPanel = function(){

      //Create table
        var table = createTable();
        var tbody = table.firstChild;
        var el = table;
        var tr, td;


      //Create title row
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "doc-compare-panel-title";
        td.colSpan = 2;
        tr.appendChild(td);
        var title = td;


      //Create subtitle row
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "doc-compare-panel-subtitle";
        td.colSpan = 2;
        tr.appendChild(td);
        var subtitle = td;


      //Create body row
        tr = document.createElement("tr");
        tbody.appendChild(tr);


      //Left column
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.padding = "10px 10px 5px 10px";
        td.style.textAlign = "center";
        tr.appendChild(td);
        var leftPanel = document.createElement("div");
        leftPanel.className = "doc-compare-panel";
        td.appendChild(leftPanel);


      //Right column
        td = td.cloneNode();
        tr.appendChild(td);
        var rightPanel = document.createElement("div");
        rightPanel.className = "doc-compare-panel";
        td.appendChild(rightPanel);


      //Create footer row
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "doc-compare-panel-footer";
        tr.appendChild(td);
        var leftFooter = td;
        td = td.cloneNode();
        tr.appendChild(td);
        var rightFooter = td;



        var createPreview = function(file, page, parent){
            parent.innerHTML = "";
            var i = document.createElement("i");
            i.className = "fas fa-file";
            parent.appendChild(i);
            var img = document.createElement("img");
            img.src = "document/thumbnail?documentID="+file.document_id+"&page="+page;
            parent.appendChild(img);
        };


        return {
            el: el,
            update: function(index){
                var suspiciousPairs = results.suspicious_pairs;
                var suspiciousPair = suspiciousPairs[index];

                title.innerText = "Pair " + (index+1) + " of " + suspiciousPairs.length;
                var type = suspiciousPair.type;
                if (type==="Common digit string"){
                    subtitle.innerText = "Found pairs of files that have long digit sequences in common. " +
                    "This is extremely unlikely to be random and indicates copied data or numbers."
                }
                else{
                    subtitle.innerText = type;
                }


                var files = results.files;
                var pages = suspiciousPair.pages;
                var left = pages[0];
                var right = pages[1];
                var leftFile = files[left.file_index];
                var rightFile = files[right.file_index];
                createPreview(leftFile, left.page, leftPanel);
                createPreview(rightFile, right.page, rightPanel);

                leftFooter.innerText = "Page " + left.page + " of " + leftFile;
                rightFooter.innerText = "Page " + right.page + " of " + rightFile;
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


      //Create 2 panels for the carousel
        for (var i=0; i<2; i++){
            var panel = document.createElement("div");
            panel.style.height = "100%";
            carousel.add(panel);
        }


      //Add event handlers
        carousel.onChange = function(){
            var suspiciousPairs = results.suspicious_pairs;
            if (currPair>=0) backButton.disabled = false;
            if (currPair<suspiciousPairs.length-1) nextButton.disabled = false;
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

        var createButton = function(label){
            var input = document.createElement('input');
            input.className = "form-button";
            input.type = "button";
            input.name = label;
            input.value = label;
            div.appendChild(input);
            return input;
        };

        backButton = createButton("Back");
        nextButton = createButton("Next");


        backButton.onclick = function(){
            currPair--;
            this.disabled = true;
            raisePanel(true);
        };

        nextButton.onclick = function(){
            currPair++;
            this.disabled = true;
            raisePanel(false);
        };
    };


  //**************************************************************************
  //** raisePanel
  //**************************************************************************
    var raisePanel = function(slideBack){


      //Find panels in the carousel
        var currPage, nextPage;
        var panels = carousel.getPanels();
        for (var i=0; i<panels.length; i++){
            var panel = panels[i];
            var el = panel.div;
            if (panel.isVisible){
                currPage = el;
            }
            else{
                nextPage = el;
            }
        }
        if (!currPage) currPage = panels[0].div; //strange!



      //Update nextPage
        var el = nextPage.firstChild;
        if (currPair<0){
            if (el){
                if (el!==summaryPanel.el){
                    nextPage.removeChild(el);
                    nextPage.appendChild(summaryPanel.el);
                }
            }
            else{
                nextPage.appendChild(summaryPanel.el);
            }
        }
        else{
            if (el) nextPage.removeChild(el);

            var nextComparison;
            if (comparisonPanel.el.parentNode===nextPage){
                nextComparison = comparisonPanel;
            }
            else{
                if (!comparisonPanel2) comparisonPanel2 = createComparisonPanel();
                nextComparison = comparisonPanel2;
            }

            nextPage.appendChild(nextComparison.el);
            nextComparison.update(currPair);
        }


      //Slide carousel
        if (slideBack===true) carousel.back();
        else carousel.next();
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var isArray = javaxt.dhtml.utils.isArray;
    var get = bluewave.utils.get;


    init();
};