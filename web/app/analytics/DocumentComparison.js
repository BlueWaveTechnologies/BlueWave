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
    var fileIndex = 0;
    var suspiciousPages = [];
    var totalPages = 0;
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
        suspiciousPages = [];
        totalPages = 0;
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
        var files = results.files;
        if (files.length>2) return; //only 2 docs supported at this time
        fileIndex = 0;


      //Get suspicious pages and count total number of pages to display
        suspiciousPages = getSuspiciousPages(fileIndex);
        suspiciousPages.forEach((suspiciousPage)=>{
            var similarPages = {};
            suspiciousPage.suspiciousPairs.forEach((suspiciousPair)=>{
                var pages = suspiciousPair.pages;
                for (var i=0; i<pages.length; i++){
                    var page = pages[i];
                    if (page.file_index!==fileIndex){
                        var rightPage = page.page;
                        var rightFile = page.file_index;
                        similarPages[rightFile +","+ rightPage] = true;
                    }
                }
            });
            totalPages+=Object.keys(similarPages).length;
        });



        if (totalPages>0){
            nextButton.disabled = false;
        }

        var panels = carousel.getPanels();
        if (!summaryPanel) summaryPanel = createSummaryPanel();
        summaryPanel.update();
        panels[0].div.appendChild(summaryPanel.el);

        if (totalPages===0) return;

        if (!comparisonPanel) comparisonPanel = createComparisonPanel();
        comparisonPanel.update(0);
        panels[1].div.appendChild(comparisonPanel.el);
    };


  //**************************************************************************
  //** getSuspiciousPages
  //**************************************************************************
    var getSuspiciousPages = function(fileIndex){

        var files = results.files;
        var file = files[fileIndex];

        var suspiciousPages = [];
        file.suspicious_pages.forEach((pageNumber)=>{
            var suspiciousPairs = [];
            results.suspicious_pairs.forEach((suspiciousPair)=>{
                var addPair = false;
                var pages = suspiciousPair.pages;
                for (var i=0; i<pages.length; i++){
                    var page = pages[i];
                    if (page.file_index===fileIndex && page.page===pageNumber){
                        addPair = true;
                        break;
                    }
                }
                if (addPair) suspiciousPairs.push(suspiciousPair);
            });

            suspiciousPages.push({
                pageNumber: pageNumber,
                suspiciousPairs: suspiciousPairs
            });
        });

        return suspiciousPages;
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

                var n = 0;
                results.files.forEach((file)=>{
                    n+= file.n_pages;
                });


              //Update body
                tbody.innerHTML = "";
                addRow("Files Analyzed", results.files.length);
                addRow("Pages Analyzed", n);
                addRow("Suspicious Pages", totalPages);
                addRow("Suspicious Pairs", suspiciousPairs.length);
                addRow("Elapsed Time", elapsedTime);
                addRow("Pages Per Second", round(results.pages_per_second, 1));
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
        // el.id = "comparisonPanel";
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
        var tdContainer = document.createElement("div");
        tdContainer.style.paddingBottom = "35px";
        tdContainer.style.position = "relative";
        td.appendChild(tdContainer);
        var div = document.createElement("div");
        div.style.position = "absolute";
        tdContainer.appendChild(div);
        var subtitle = div;

      //Create navbar row
        var div = document.createElement("div");
        tdContainer.appendChild(div);
        div.className = "doc-compare-panel-navbar";
        div.style.width = "100%";
        div.style.position = "absolute";
        var navbar = div;


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
            update: function(pageIndex){

                var files = results.files;
                var leftFile = files[fileIndex];
                var rightFile;
                var leftPage = 0;
                var rightPage = 0;

                var suspiciousPairs = [];
                var idx = 0;
                suspiciousPages.every((suspiciousPage)=>{
                    var similarPages = {};
                    suspiciousPage.suspiciousPairs.forEach((suspiciousPair)=>{
                        var pages = suspiciousPair.pages;
                        for (var i=0; i<pages.length; i++){
                            var page = pages[i];
                            if (page.file_index!==fileIndex){
                                var rightPage = page.page;
                                var rightFile = page.file_index;
                                similarPages[rightFile +","+ rightPage] = true;
                            }
                        }
                    });
                    similarPages = Object.keys(similarPages);
                    for (var i=0; i<similarPages.length; i++){
                        if (idx===pageIndex){
                            var arr = similarPages[i].split(",");
                            rightPage = parseInt(arr[1]);
                            rightFile = files[parseInt(arr[0])];

                            leftPage = suspiciousPage.pageNumber;
                            suspiciousPairs = suspiciousPage.suspiciousPairs;

                            return false;
                        }
                        idx++;
                    }
                    return true;
                });


                var ourNav;
                ourNav = document.createElement("div");
                ourNav.style.textAlign = "center";
                navbar.appendChild(ourNav);

                var div1 = document.createElement("div");
                // div1.className = "doc-compare-panel-dot-navbar";
                div1.style.width = "100%";
                div1.style.height = "100%";
                div1.style.background = "#34495e"; // this currently allows you to see the dot
                div1.style.opacity = "50%";
                div1.style.display = "table";
                ourNav.appendChild(div1);

                var div2 = document.createElement("div");
                // div2.className = "doc-compare-panel-dot-navbar-container";
                div2.style.display = "table-cell";
                div2.style.verticalAlign = "middle";
                div2.style.margin = "auto";
                div2.style.textAlign = "center";
                div1.appendChild(div2);

                var ul = document.createElement("ul");
                // ul.className = "doc-compare-panel-dot-navbar-ul";
                ul.style.position = "relative";
                ul.style.display = "inline-block";
                ul.style.margin = "0";
                ul.style.padding = "0";
                ul.style.listStyle = "none";
                ul.style.cursor = "default";
                div2.appendChild(ul);

                var maxDots = 10; // declare maximum number of dots to add
                var totalPages = 9; // set a random totalpage amount



                var bestIncrement = function (n, setMax){
                    // round the number down to the nearest 10
                        n = Math.floor( n /10 ) * 10;
                    return Math.ceil(n / setMax);
                }

                // if its less than or equal to 10 increment by 1
                    if (totalPages <= 10) increment = 1;
                // if its more than 10 and less than or equal to 50 then increment by 5
                    if (totalPages > 10 & totalPages <= 50) increment = 5;
                // if its more than 50 and less than 100 increment by 10
                    if (totalPages > 50 & totalPages <= 100) increment = 10;
                // if it's more than 100 then increment by whatever divides it best
                    if (totalPages > 100) increment = bestIncrement(totalPages,maxDots);

                // console.log(increment);

                numDots = Math.round(totalPages/increment);
                // console.log(numDots);

                var li = [];
                for (var i=0; i <= numDots-1; i++){
                  li.push(document.createElement("li"));
                };

                // set li elements with links to each page
                  for (var i=0; i <= numDots-1; i++){
                    li[i].className = "doc-compare-panel-dot-navbar-li";
                    li[i].name = i;
                    li[i].style.position = "relative";
                    li[i].style.display = "block";
                    li[i].style.float = "left";
                    li[i].style.margin = "0 16px";
                    li[i].style.width = "20px";
                    li[i].style.height = "20px";
                    li[i].style.cursor = "pointer";

                    // a refs inside li element
                      var a = document.createElement("a");
                      a.className = "doc-compare-panel-dot-navbar-a";
                      a.style.top = "0";
                      a.style.left = "0";
                      a.style.width = "100%";
                      a.style.height = "100%";
                      a.style.outline = "none";
                      a.style.borderRadius = "50%";
                      a.style.textIndent = "-999em"; // send it offscreen
                      a.style.cursor = "pointer";
                      a.style.position = "absolute";
                      a.style.overflow = "hidden";
                      a.style.backgroundColor = "transparent";
                      a.style.boxShadow = "inset 0 0 0 2px white";
                      a.style.transition = "all 0.3s ease";
                      a.style.transform = "scale3d(1, 1, 1)";

                    li[i].appendChild(a);
                    console.log(`dot page index is ${ i * increment}`);

                    li[i].onclick = function (){
                      console.log("dot was clicked!");
                      // find  li index #
                        var liIndex;
                        liIndex = this.name; // determine which button this is

                      // use li index # to calculate page index
                      console.log(`dot page index (not page number) is ${ liIndex * increment }`); // page number would be index +1
                    };

                    ul.appendChild(li[i]);
                  };




                title.innerText = "Page " + (pageIndex+1) + " of " + totalPages;
                subtitle.innerText = suspiciousPairs.length + " similarit" + (suspiciousPairs.length>1 ? "ies" : "y");

                createPreview(leftFile, leftPage, leftPanel);
                createPreview(rightFile, rightPage, rightPanel);

                leftFooter.innerText = "Page " + leftPage + " of " + totalPages + " " + leftFile.filename;
                rightFooter.innerText = "Page " + rightPage + " of " + totalPages + " " + rightFile.filename;
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
            if (currPair>=0) backButton.disabled = false;
            if (currPair<totalPages-1) nextButton.disabled = false;
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
    var round = javaxt.dhtml.utils.round;
    var get = bluewave.utils.get;


    init();
};