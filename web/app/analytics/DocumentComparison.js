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
    var navbar;
    var ratings;



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

        navbar.clear();
        navbar.hide();
        ratings.clear();
        ratings.hide();

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


        navbar.update();
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


      //Function used to create an image
        var createPreview = function(file, page, parent, boxes){
            parent.innerHTML = "";
            var i = document.createElement("i");
            i.className = "fas fa-file";
            parent.appendChild(i);
            var img = document.createElement("img");
            img.src = "document/thumbnail?documentID="+file.document_id+"&page="+page;
            img.onload = function(){
                img = this;
                setTimeout(function(){
                    getImages(img).forEach((img)=>{
                        boxes.forEach((box)=>{
                            var type = box.type;
                            box.boxes.forEach((bbox)=>{
                                var x = bbox[0];
                                var y = bbox[1];
                                var w = bbox[2]-x;
                                var h = bbox[3]-y;
                                var d = document.createElement("div");
                                d.style.position = "absolute";
                                d.style.border = "1px solid red";
                                d.style.left = (x*img.width)+"px";
                                d.style.top = (y*img.height)+"px";
                                d.style.width = (w*img.width)+"px";
                                d.style.height = (h*img.height)+"px";
                                d.style.zIndex = 2;
                                img.parentNode.appendChild(d);
                            });
                        });
                    });
                }, 1200); //add slight delay for the carousel to finish sliding
            };
            parent.appendChild(img);
        };


      //Function used to find images in the carousel. Note that there may be
      //more than one image due to idiosyncrasies with the carousel
        var getImages = function(img){
            var arr = [];
            carousel.getPanels().forEach((panel)=>{
                var panels = panel.div.getElementsByClassName("doc-compare-panel");
                for (var i=0; i<panels.length; i++){
                    var images = panels[i].getElementsByTagName("img");
                    for (var j=0; j<images.length; j++){
                        if (images[j].src===img.src){
                            arr.push(images[j]);
                        }
                    }
                }
            });
            return arr;
        };


        return {
            el: el,
            update: function(pageIndex){

                var files = results.files;
                var leftFile = files[fileIndex];
                var rightFile;
                var leftPage = 0;
                var rightPage = 0;
                var rightIndex = 0;


              //Get suspiciousPairs associated with this pageIndex
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
                            rightIndex = parseInt(arr[0]);
                            rightFile = files[rightIndex];

                            leftPage = suspiciousPage.pageNumber;
                            suspiciousPairs = suspiciousPage.suspiciousPairs;

                            return false;
                        }
                        idx++;
                    }
                    return true;
                });


              //Get boxes
                var leftBoxes = [];
                var rightBoxes = [];
                suspiciousPairs.forEach((suspiciousPair)=>{

                    var leftBox = null;
                    var rightBox = null;

                    suspiciousPair.pages.forEach((page)=>{
                        if (page.file_index===fileIndex && page.page===leftPage){
                            leftBox = {
                                type: suspiciousPair.type,
                                boxes: page.bbox
                            };
                        }
                        if (page.file_index===rightIndex && page.page===rightPage){
                            rightBox = {
                                type: suspiciousPair.type,
                                boxes: page.bbox
                            };
                        }
                    });

                    if (leftBox && rightBox){
                        leftBoxes.push(leftBox);
                        rightBoxes.push(rightBox);
                    }
                });



                title.innerText = "Page " + (pageIndex+1) + " of " + totalPages;
                subtitle.innerText = suspiciousPairs.length + " similarit" + (suspiciousPairs.length>1 ? "ies" : "y");

                createPreview(leftFile, leftPage, leftPanel, leftBoxes);
                createPreview(rightFile, rightPage, rightPanel, rightBoxes);

                leftFooter.innerText = "Page " + leftPage + " of " + leftFile.n_pages + " " + leftFile.filename;
                rightFooter.innerText = "Page " + rightPage + " of " + rightFile.n_pages + " " + rightFile.filename;
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
            if (currPair>=0){
                backButton.disabled = false;
                navbar.show();
                ratings.show();
            }
            if (currPair<totalPages-1) nextButton.disabled = false;
        };

    };


  //**************************************************************************
  //** createFooter
  //**************************************************************************
    var createFooter = function(parent){
        createNavBar(parent);
        createRatings(parent);

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
            input.disabled = true;
            div.appendChild(input);
            return input;
        };

        backButton = createButton("Back");
        nextButton = createButton("Next");


        backButton.onclick = function(){
            currPair--;
            if (currPair >= 0) navbar.updateSelection(currPair);
            this.disabled = true;
            raisePanel(true);
        };

        nextButton.onclick = function(){
            currPair++;
            if (currPair >= 0) navbar.updateSelection(currPair);
            this.disabled = true;
            raisePanel(false);
        };
    };



  //**************************************************************************
  //** createRatings
  //**************************************************************************
    var createRatings = function(parent){ // lazy loaded
        var thumbsDown, thumbsUp;

        var createButton = function(buttonClassName){

            var icon = document.createElement("div");
            icon.className = "doc-compare-panel-ratings-icon";
            // icon.innerHTML = buttonClassName;
            icon.innerHTML =`<i class="${buttonClassName}"></i>`;
            return icon;
        };

        ratings = document.createElement("div");
        ratings.className = "doc-compare-panel-ratings";
        addShowHide(ratings);
        ratings.hide();
        // ratings.show();

        parent.appendChild(ratings);
        var div = document.createElement("div");
        div.className = "doc-compare-panel-ratings-container";
        ratings.appendChild(div);

        var thumbsUp = createButton("fas fa-thumbs-up");

        thumbsUp.onclick = function(){
            console.log("clicked the thumbsup button");

        };

        var thumbsDown = createButton("fas fa-thumbs-down");

        thumbsDown.onclick = function(){
            console.log("clicked the thumbsDown button");
        };

        div.appendChild(thumbsUp);
        div.appendChild(thumbsDown);

        ratings.clear = function(){

        };

        ratings.update = function(){
            ratings.clear();


        };

        ratings.select = function(currPair){

        };


    }
  //**************************************************************************
  //** createNavBar
  //**************************************************************************
    var createNavBar = function(parent){

        navbar = document.createElement("div");
        navbar.className = "doc-compare-panel-navbar";
        addShowHide(navbar);
        navbar.hide();

        parent.appendChild(navbar);
        var ul = document.createElement("ul");
        navbar.appendChild(ul);

        navbar.clear = function(){
            ul.innerHTML = "";
        };

        navbar.update = function(){
            navbar.clear();

            var maxDots = 10; // declare maximum number of dots to add
            var increment = 1;
            var bestIncrement = function (n, setMax){
                // round the number down to the nearest 10
                n = Math.floor( n /10 ) * 10;
                return Math.ceil(n / setMax);
            };

            // if its less than or equal to 10 increment by 1
            if (totalPages <= 10) increment = 1;
            // if its more than 10 and less than or equal to 50 then increment by 5
            if (totalPages > 10 & totalPages <= 50) increment = 5;
            // if its more than 50 and less than 100 increment by 10
            if (totalPages > 50 & totalPages <= 100) increment = 10;
            // if it's more than 100 then increment by whatever divides it best
            if (totalPages > 100) increment = bestIncrement(totalPages,maxDots);



            // set li elements with links to each page
            var numDots = Math.round(totalPages/increment);
            var fileIndexList = [];
            for (var i=0; i<numDots; i++){
                var li = document.createElement("li");
                li.name = i;
                fileIndexList.push((i * increment));
                li.onclick = function(){
                  // find li index #
                    var liIndex = this.name; // determine which button this is

                    var currSelection = -1;
                    for (var i=0; i<ul.childNodes.length; i++){
                        if (ul.childNodes[i].className==="active"){
                            currSelection = i;
                            break;
                        }
                    }
                    if (currSelection===liIndex) return;
                    var diff = liIndex-currSelection;

                    if (diff>0){
                        currPair = (liIndex * increment)-1; // counteract button increment
                        nextButton.click();
                    }
                    else{
                        currPair = (liIndex * increment)+1; // counteract button increment
                        backButton.click();
                    }

                    navbar.highlight(liIndex);

                };
                ul.appendChild(li);
            }
            ul.childNodes[0].className = "active";

            navbar.getFileIndexs = function(){
              return fileIndexList;
            };

            navbar.updateSelection = function(){
              for (var i in fileIndexList){
                if(currPair === fileIndexList[i]){
                  navbar.highlight(i);
                };
              };
            };
        };



        navbar.highlight = function(idx){
            for (var i=0; i<ul.childNodes.length; i++){
                ul.childNodes[i].className = "";
            }
            ul.childNodes[idx].className = "active";
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
        if (!nextPage) nextPage = panels[1].div; //strange!


      //Update nextPage
        var el = nextPage.firstChild;
        if (currPair<0){
            navbar.hide();
            ratings.hide();
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
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var onRender = javaxt.dhtml.utils.onRender;
    var isArray = javaxt.dhtml.utils.isArray;
    var round = javaxt.dhtml.utils.round;
    var get = bluewave.utils.get;


    init();
};