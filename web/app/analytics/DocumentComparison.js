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
    var ratings; // to be appended to the currently selected tag



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
  //** createRatings
  //**************************************************************************
    var createRatings = function(){ // lazy loaded when a new img is pulled up
        var thumbsDown, thumbsUp;
            var div = document.createElement("div");
            div.style.position = "absolute";
            div.style.width = "100%"; // temporary styling - strange
            div.style.bottom = "86%"; // temporary styling - strange
            div.style.left = "-20%"; // temporary styling - strange


            ratings = document.createElement("div");
            ratings.className = "doc-compare-panel-ratings";
            addShowHide(ratings);

            div.appendChild(ratings);
            var div = document.createElement("div");
            div.className = "doc-compare-panel-ratings-container";
            ratings.appendChild(div);

            // create thumbs up
                var thumbsUp = document.createElement("i");
                thumbsUp.className = "fas fa-thumbs-up";

            // create thumbs down
                var thumbsDown = document.createElement("i");
                thumbsDown.className = "fas fa-thumbs-down";

            ratings.detach = function(){
                // if ratings container div is attached somewhere within the dom, detach it
                    if (this.parentNode.parentNode ) this.parentNode.parentNode.removeChild(this.parentNode);
            };

            ratings.attach = function(parent){
                // append the ratings container div to the first child of the parent element
                    parent.insertBefore(this.parentNode, parent.firstChild);
            };

            ratings.update = function(t){
                if (this.tag){
                    this.tag.clear(); // deSelect tag
                };
                this.detach();
                console.log("updating with this object", t);
                ratings.attach(t.parentNode);
                this.tag = t;
                this.thumbsDown.tag = t;
                this.thumbsUp.tag = t;
                ratings.show();
            };


            ratings.disApproveSimilarity = function(){ // TODO: add server event handler - passing information via URL
                this.tag.removeSimilarity();
                this.tag.remove();
                this.tag.matchingTag.remove();

            };

            ratings.approveSimilarity = function(){ // TODO: add server event handler - passing information via URL

            };

            ratings.appendChild(thumbsUp);
            ratings.appendChild(thumbsDown);
            ratings.thumbsUp = thumbsUp;
            ratings.thumbsDown = thumbsDown;

            thumbsUp.onclick = function(){
                console.log("clicked the thumbsup button");
                ratings.approveSimilarity();
                ratings.hide();
            };

            thumbsDown.onclick = function(){
                console.log("clicked the thumbsDown button");
                ratings.disApproveSimilarity();
                ratings.hide();
            };



            return ratings;
        };


  //**************************************************************************
  //** createOutlineBox
  //**************************************************************************
    var createSimilarityOutlineBox = function(bbox, img){


        var x = bbox[0];
        var y = bbox[1];
        var w = bbox[2]-x;
        var h = bbox[3]-y;


        var d = document.createElement("div");
        d.style.position = "absolute"; // add a class here
        d.style.border = "1px solid red";
        d.style.left = (x*img.width)+"px";
        d.style.top = (y*img.height)+"px";
        d.style.width = (w*img.width)+"px";
        d.style.height = (h*img.height)+"px";
        d.style.zIndex = 2;

        // set values used during rescaling
            d.originalHeight = h*img.height;
            d.originalWidth = w*img.width;
            d.originalX = x*img.width;
            d.originalY = y*img.height;

        d.rescale = function(scaleW, scaleH){

            var newHeight = this.originalHeight * scaleH;
            var newWidth = this.originalWidth * scaleW;
            var newX = this.originalX * scaleW;
            var newY = this.originalY * scaleH;

            this.style.height = `${newHeight}px`;
            this.style.width = `${newWidth}px`;
            this.style.left = `${newX}px`;
            this.style.top = `${newY}px`;
        };

        d.clear = function(){
            this.innerHTML = "";
            this.style.backgroundColor = ""; // add a class to replace this, in-active class
            this.style.opacity = ""; // add a class to replace this, in-active class
            this.isSelected = false;
        };

        d.select = function(){
            this.isSelected = true;
            this.highlight();
            this.scrollIntoView(true); // add this later for scrolling to the highlighted element in the right-hand view


        };

        d.highlight = function(){
            this.style.backgroundColor = "red"; // add a class to replace this, active class
            this.style.opacity = "35%"; // add a class to replace this, active class
        };

        d.removeSimilarity = function(){
            this.hide();
        };
        return d;
    };


  //**************************************************************************
  //** createSimilarityTag
  //**************************************************************************
    var createSimilarityTag = function(bbox, int, img){

        var x = bbox[0];
        var y = bbox[1];

        var tag = document.createElement("div");
        tag.className = "doc-compare-panel-similarity-tag";
        var tagInner = document.createElement("div");
        tagInner.innerText = int;
        tagInner.style.textAlign = "center";
        tag.appendChild(tagInner);



        // dynamically set styles
            tag.style.left = (x*img.width)+"px";
            tag.style.top = (y*img.height)+"px";

        // other functional styles
            tag.style.zIndex = 3;

        // set values used during rescaling
            tag.originalX = x*img.width;
            tag.originalY = y*img.height;

        tag.rescale = function(scaleW, scaleH){
            var newX = this.originalX * scaleW;
            var newY = this.originalY * scaleH;

            this.style.left = `${newX}px`;
            this.style.top = `${newY}px`;
        };



        tag.onclick = function (){
            if (!ratings) {
                ratings = createRatings();
                ratings.attach(this.parentNode);
            };
            ratings.update(this);
            this.matchingD.select();
            this.matchingTag.hide();
        };

        tag.removeSimilarity = function(){
            this.matchingD.removeSimilarity();
            this.d.removeSimilarity();
        };

        tag.onmouseover = function(){ // TODO: add tooltip and mouseleave event
            this.showTooltip();
            this.matchingD.highlight();
            this.matchingTag.hide();
        };

        tag.onmouseleave = function(){
            // this.d.clear();
            if (!this.matchingD.isSelected){
                this.matchingD.clear();
                this.matchingTag.show();
            }
        };

        tag.showTooltip = function(){
            console.log(this.type);
            console.log("calling show tooltip");
            console.log("not yet implemented!")
        };

        tag.clear = function(){ // called by ratings when a new tag is selected
            this.matchingD.clear();
            this.matchingTag.show();
        };

        return tag;
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
        var div = document.createElement("div");
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
        var createPreview = function(file, page, parent, boxes, matchingImg){
            parent.innerHTML = "";
            var i = document.createElement("i");
            i.className = "fas fa-file";
            parent.appendChild(i);
            var img = document.createElement("img");
            img.src = "document/thumbnail?documentID="+file.document_id+"&page="+page;

            if (matchingImg){
                img.matchingImg = matchingImg;
                img.isFirstDocument = false;
            }
            else{
                img.matchingImg = null;
                img.isFirstDocument = true;
            };


            if (!img.isFirstDocument){ // render left image first and then load this (right) image
                img.onload = function(){
                    img = this;
                    setTimeout(function(){
                        getImages(img).forEach((rightImage)=>{
                            getImages(rightImage.matchingImg).forEach((leftImage)=>{
                                leftImage.matchingImg = rightImage; // add match reference
                                leftImage.LoadOverlay();  // render left image
                                rightImage.matchingImg = leftImage; // update matched reference
                                rightImage.LoadOverlay(); // render right image
                            });
                        });
                    }, 1200); //add slight delay for the carousel to finish sliding
                };
            };



            img.LoadOverlay = function (){
                img = this;
              // set original width/height for determining scaling for tag & d elements
                var rect = javaxt.dhtml.utils.getRect(img);
                img.originalHeight = rect.height;
                img.originalWidth = rect.width;

                    var int = 0;
                    img.d = [];
                    img.tag = [];
                    for ( var i=0; i<boxes.length; i++){
                        var box = boxes[i];

                        var type = box.type;
                        int++;

                        var updateMatchingImg = function(){

                            // update matching img object references to link to this created tag
                                img.matchingImg.matchingImg = img; // set the matching imgs' pair to reflect this img
                                tag.matchingTag = img.matchingImg.tag[i];
                                tag.matchingD = img.matchingImg.d[i];
                                if (!img.matchingImg.matchingD){
                                        img.matchingImg.matchingD = [];
                                };
                                if (!img.matchingImg.matchingTag){
                                    img.matchingImg.matchingTag = [];
                                };

                                img.matchingImg.matchingD[i] = d;
                                img.matchingImg.matchingTag[i] = tag;

                                img.matchingImg.tag[i].matchingTag = tag;
                                img.matchingImg.tag[i].matchingD = d;
                        };

                        var d = createSimilarityOutlineBox(box.boxes, img);
                        var tag = createSimilarityTag(box.boxes, int, img);

                        if (!img.isFirstDocument){
                            updateMatchingImg();
                        };

                        tag.d = d;
                        tag.type = type;

                        img.d.push(d);
                        img.tag.push(tag);
                        img.parentNode.appendChild(d);
                        img.parentNode.appendChild(tag);
                        addShowHide(d);
                        addShowHide(tag);

                        // set resize listeners
                        var resizeListener = function(){
                            var rect = javaxt.dhtml.utils.getRect(img);
                            var scaleByH = rect.height / img.originalHeight;
                            var scaleByW = rect.width / img.originalWidth;

                            var dElements = img.d; // a list of the d elements associated with the image
                            dElements.forEach((d)=>{
                                d.rescale(scaleByW,scaleByH);
                            });

                            var tagElements = img.tag; // a list of tag elements associated with the image
                            tagElements.forEach((tag)=>{
                                tag.rescale(scaleByW,scaleByH);
                            });
                        };
                        addResizeListener(parent, resizeListener);
                    };
            };

            parent.appendChild(img);
            return img;
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
                            images[j].matchingImg = img.matchingImg;
                            images[j].isFirstDocument = img.isFirstDocument;
                            images[j].LoadOverlay = img.LoadOverlay;
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
                        };
                        idx++;
                    };
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
                var leftSideImg = createPreview(leftFile, leftPage, leftPanel, leftBoxes);
                createPreview(rightFile, rightPage, rightPanel, rightBoxes, leftSideImg);

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
            }
            if (currPair<totalPages-1) nextButton.disabled = false;
        };

    };


  //**************************************************************************
  //** createFooter
  //**************************************************************************
    var createFooter = function(parent){
        createNavBar(parent);

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
            if (totalPages <= 10) {
                increment = 1;
                var numDots = Math.round(totalPages/increment);

            }
            else {
                increment = bestIncrement(totalPages,maxDots-1);
                var numDots = Math.round(totalPages/increment)+1;
            };


            // set li elements with links to each page
            var fileIndexList = [];
            for (var i=0; i < numDots; i++){
                var li = document.createElement("li");
                li.name = i;
                if (i == 0){ // if it's the first dot then index at file index 0
                     fileIndexList.push(0);
                     li.indexedPage = 0;
                }
                else if (i == numDots-1){// if its the last dot then index at last file index
                    fileIndexList.push(totalPages-1);
                    li.indexedPage = (totalPages-1);
                }
                else{
                    fileIndexList.push(i * increment);
                    li.indexedPage = (i * increment);
                }

                li.onclick = function(){
                  // find li index #
                    var liIndex = this.name; // determine which button this is
                    var pageIndex = this.indexedPage; // determine page number associated with this button
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
                        currPair = pageIndex-1; // counteract button increment
                        nextButton.click();
                    }
                    else{
                        currPair = pageIndex+1; // counteract button increment
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
    var addResizeListener = javaxt.dhtml.utils.addResizeListener;


    init();
};