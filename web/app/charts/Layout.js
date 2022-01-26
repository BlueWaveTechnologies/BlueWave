if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  Layout
//******************************************************************************
/**
 *   Panel used to create dashboard layouts
 *
 ******************************************************************************/

bluewave.charts.Layout = function(parent, config) {

    var me = this;
    var defaultConfig = {
        style: {

        }
    };
    var titleDiv, body;
    var mainDiv;
    var width = 350; //360
    var height = 250; //260

    var mask;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        var div = document.createElement("div");
        div.style.height = "100%";
        parent.appendChild(div);
        me.el = div;


      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Create header nav
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createHeader(td);


      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "grid-panel";
        td.style.height = "100%";
        td.style.padding = "26px";
        tr.appendChild(td);
        body = td;

        div.appendChild(table);


      //Create overflow wrapper for the main div
        var outerDiv = document.createElement("div");
        outerDiv.className = "dashboard-layout";
        outerDiv.style.height = "100%";
        outerDiv.style.overflowY = "auto";
        td.appendChild(outerDiv);


      //Create main div
        mainDiv = document.createElement("div");
        mainDiv.className = "dashboard-layout";
        mainDiv.style.height = "100%";
        outerDiv.appendChild(mainDiv);


      //Create mask for resizer
        mask = document.createElement('div');
        mask.style.position = "absolute";
        mask.style.left = "0px";
        mask.style.top = "0px";
        mask.style.width = "100%";
        mask.style.height = "100%";
        mask.style.display = "none";
        mask.style.visibility = "hidden";
        div.appendChild(mask);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        titleDiv.innerHTML = "";
        mainDiv.innerHTML = "";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(inputs, layout){
        me.clear();


        mainDiv.style.height = "";
        onRender(body, function(){

          //Set height for Packery
            mainDiv.style.height = "100%";
            mainDiv.style.height = mainDiv.offsetHeight + "px";
            mainDiv.style.minHeight = mainDiv.style.height;


          //Create dashboard items
            for (var key in inputs) {
                if (inputs.hasOwnProperty(key)){
                    var input = inputs[key];

                    var dashboardItem = createDashboardItem(mainDiv,{
                        width: width,
                        height: height,
                        title: input.title,
                        subtitle: ""
                    });


                    var div = dashboardItem.el;
                    addResizeHandle(div);
                    div.inputID = key;


                  //Update layout
                    if (layout && layout[key]){
                        var rect = layout[key];
                        div.style.position = "absolute";
                        div.style.left = rect.x+"px";
                        div.style.top = rect.y+"px";
                        div.style.width = rect.w+"px";
                        div.style.height = rect.h+"px";
                    }


                  //Add image
                    addImage(input.image, dashboardItem);
                }
            }



          //Instantiate Packery
            var packery = new Packery(mainDiv, {
                columnWidth: 5,
                gutter: 5,
                initLayout: false // disable initial layout
            });


          //Stamp dashboard items so they don't move on layout
            for (var i in packery.items){
                packery.stamp(packery.items[i].element);
            }


          //Initialize layout
            packery.layout();


          //Unstamp dashboard items and enable drag events
            for (var i in packery.items){
                var dashboardItem = packery.items[i].element;
                var draggie = new Draggabilly(dashboardItem);
                dashboardItem.draggie = draggie;
                packery.bindDraggabillyEvents(draggie);
                packery.unstamp(dashboardItem);
            }

        });
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return mainDiv;
    };



  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){

      //Compute bounding coordinates of all the dashboard items
        var minX = Number.MAX_VALUE;
        var maxX = 0;
        var minY = Number.MAX_VALUE;
        var maxY = 0;
        for (var i in mainDiv.childNodes){
            var dashboardItem = mainDiv.childNodes[i];
            if (dashboardItem.nodeType===1){
                var rect = javaxt.dhtml.utils.getRect(dashboardItem);
                minX = Math.min(rect.left, minX);
                maxX = Math.max(rect.right, maxX);
                minY = Math.min(rect.top, minY);
                maxY = Math.max(rect.bottom, maxY);
            }
        }
        var width = maxX - minX;
        var height = maxY - minY;


      //Compute max width/height as a ratio of the bounding coordinate
        var maxWidth, maxHeight;
        if (width>=height){
            maxWidth = 1;
            maxHeight = height/width;
        }
        else{
            maxHeight = 1;
            maxWidth = width/height;
        }



      //Generate layout config
        var layout = {};
        for (var i in mainDiv.childNodes){
            var dashboardItem = mainDiv.childNodes[i];
            if (dashboardItem.nodeType===1){
                var rect = javaxt.dhtml.utils.getRect(dashboardItem);

                var w = parseInt(dashboardItem.style.width);
                if (isNaN(w)) w = rect.width;

                var h = parseInt(dashboardItem.style.height);
                if (isNaN(h)) h = rect.height;

                var x = parseInt(dashboardItem.style.left);
                if (isNaN(x)) x = rect.x;

                var y = parseInt(dashboardItem.style.top);
                if (isNaN(y)) y = rect.y;

                var img = dashboardItem.getElementsByTagName("img")[0];

                layout[dashboardItem.inputID] = {
                    x: x,
                    y: y,
                    w: w,
                    h: h,
                    left: round(((rect.x-minX)/width)*maxWidth*100, 4)+"%",
                    top: round(((rect.y-minY)/height)*maxHeight*100, 4)+"%",
                    width: round((rect.width/width)*maxWidth*100, 4)+"%",
                    height: round((rect.height/height)*maxHeight*100, 4)+"%",
                    imageWidth: img.naturalWidth,
                    imageHeight: img.naturalHeight
                };

            }
        }
        return layout;
    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){
        titleDiv = document.createElement("div");
        titleDiv.className = "dashboard-title noselect";
        parent.appendChild(titleDiv);
    };


  //**************************************************************************
  //** addImage
  //**************************************************************************
    var addImage = function(base64image, dashboardItem){
        var img = document.createElement('img');
        img.className = "noselect";
        img.style.width = "100%";
        img.onload = function() {
            dashboardItem.innerDiv.style.verticalAlign = "top";
            dashboardItem.innerDiv.appendChild(this);

            //if (dashboardItem.el.style.position==="absolute") return;

            dashboardItem.el.childNodes[0].style.height = "";
            //dashboardItem.innerDiv.style.height = this.height;
            //dashboardItem.el.style.height = "";


            var rect = javaxt.dhtml.utils.getRect(dashboardItem.el);
            var div = dashboardItem.el.parentNode;
            div.style.height = rect.h+"px";
        };
        img.src = base64image;
    };


  //**************************************************************************
  //** addResizeHandle
  //**************************************************************************
    var addResizeHandle = function(parent){

        var xOffset, yOffset;
        var orgHeight, orgWidth;
        var dx, dy;
        var onDragStart = function(x,y,e){
            var div = this;

            mask.style.cursor = div.style.cursor;
            mask.style.display = "";
            mask.style.visibility = "";

            var rect = javaxt.dhtml.utils.getRect(div);
            var rect2 = javaxt.dhtml.utils.getRect(parent);

            xOffset = (x-rect.x)+rect2.x;
            yOffset = (y-rect.y)+rect2.y;
            orgHeight = rect2.height;
            orgWidth = rect2.width;

            dx = parseFloat(parent.style.width);
            if (dx<orgWidth) dx = orgWidth-dx;
            else dx = 0;

            dy = parseFloat(parent.style.height);
            if (dy<orgHeight) dy = orgHeight-dy;
            else dy = 0;

            parent.draggie.dispatchEvent( 'dragStart', e, [ e ] );
        };
        var onDragEnd = function(e){

            mask.style.display = "none";
            mask.style.visibility = "hidden";
            mask.style.cursor = "";


            parent.draggie.dispatchEvent( 'dragEnd', e, [ e ] );

            parent.focus();
        };


      //Add vertical resizer to the top of the window (buggy!)
        var resizeHandle = document.createElement("div");
        resizeHandle.style.position = "absolute";
        resizeHandle.style.width = "100%";
        resizeHandle.style.height = "10px";
        resizeHandle.style.top = "-5px";
        resizeHandle.style.left = "0px";
        resizeHandle.style.cursor = "ns-resize";
        resizeHandle.style.zIndex = 2;
//        parent.appendChild(resizeHandle);
//        javaxt.dhtml.utils.initDrag(resizeHandle, {
//            onDragStart: onDragStart,
//            onDrag: function(x,y){
//                var top = (yOffset-y);
//                parent.style.top = (y) + "px";
//                parent.style.height = ((orgHeight+top)-dy) + "px";
//                //me.onResize();
//            },
//            onDragEnd: onDragEnd
//        });
        resizeHandle.onmouseover = function(){
            parent.draggie.disable();
        };
        resizeHandle.onmouseout = function(){
            parent.draggie.enable();
        };


      //Add vertical resizer to the bottom of the window
        resizeHandle = resizeHandle.cloneNode();
        resizeHandle.style.top = "";
        resizeHandle.style.bottom = "-5px";
        parent.appendChild(resizeHandle);
        javaxt.dhtml.utils.initDrag(resizeHandle, {
            onDragStart: onDragStart,
            onDrag: function(x,y,e){
                var top = -(yOffset-y);
                parent.style.height = (top+dy) + "px";
                //me.onResize();

                var moveVector = {
                    x: x,
                    y: y
                };
                parent.draggie.dispatchEvent( 'dragMove', e, [ e, moveVector ] ); //pointer, moveVector
                var placeholder = mainDiv.getElementsByClassName("packery-drop-placeholder")[0];
                if (placeholder){
                    placeholder.style.height = (top+dy) + "px";
                }
            },
            onDragEnd: onDragEnd
        });
        resizeHandle.onmouseover = function(){
            parent.draggie.disable();
        };
        resizeHandle.onmouseout = function(){
            parent.draggie.enable();
        };


      //Add horizontal resizer to the left of the window
        resizeHandle = resizeHandle.cloneNode();
        resizeHandle.style.top = "0px";
        resizeHandle.style.bottom = "";
        resizeHandle.style.left = "-5px";
        resizeHandle.style.height = "100%";
        resizeHandle.style.width = "10px";
        resizeHandle.style.cursor = "ew-resize";
//        parent.appendChild(resizeHandle);
//        javaxt.dhtml.utils.initDrag(resizeHandle, {
//            onDragStart: onDragStart,
//            onDrag: function(x,y){
//                var top = (xOffset-x);
//                parent.style.left = x + 'px';
//                parent.style.width = ((orgWidth+top)) + "px";
//                //me.onResize();
//            },
//            onDragEnd: onDragEnd
//        });
        resizeHandle.onmouseover = function(){
            parent.draggie.disable();
        };
        resizeHandle.onmouseout = function(){
            parent.draggie.enable();
        };


      //Add nw resizer
        resizeHandle = resizeHandle.cloneNode();
        resizeHandle.style.top = "-5px";
        resizeHandle.style.right = "";
        resizeHandle.style.height = "10px";
        resizeHandle.style.cursor = "se-resize";
//        parent.appendChild(resizeHandle);
//        javaxt.dhtml.utils.initDrag(resizeHandle, {
//            onDragStart: onDragStart,
//            onDrag: function(x,y){
//                var top = (xOffset-x);
//                parent.style.left = x + 'px';
//                parent.style.width = ((orgWidth+top)) + "px";
//
//                var top = (yOffset-y);
//                parent.style.top = (y) + "px";
//                parent.style.height = ((orgHeight+top)-dy) + "px";
//                //me.onResize();
//            },
//            onDragEnd: onDragEnd
//        });


      //Add sw resizer
        resizeHandle = resizeHandle.cloneNode();
        resizeHandle.style.top = "";
        resizeHandle.style.bottom = "-5px";
        resizeHandle.style.cursor = "ne-resize";
//        parent.appendChild(resizeHandle);
//        javaxt.dhtml.utils.initDrag(resizeHandle, {
//            onDragStart: onDragStart,
//            onDrag: function(x,y){
//                var top = (xOffset-x);
//                parent.style.left = x + 'px';
//                parent.style.width = ((orgWidth+top)) + "px";
//
//                var top = -(yOffset-y);
//                parent.style.height = (top+dy) + "px";
//                //me.onResize();
//            },
//            onDragEnd: onDragEnd
//        });
        resizeHandle.onmouseover = function(){
            parent.draggie.disable();
        };
        resizeHandle.onmouseout = function(){
            parent.draggie.enable();
        };


      //Add horizontal resizer to the right of the window
        resizeHandle = resizeHandle.cloneNode();
        resizeHandle.style.left = "";
        resizeHandle.style.right = "-5px";
        resizeHandle.style.top = "0px";
        resizeHandle.style.height = "100%";
        resizeHandle.style.cursor = "ew-resize";
        parent.appendChild(resizeHandle);
        javaxt.dhtml.utils.initDrag(resizeHandle, {
            onDragStart: onDragStart,
            onDrag: function(x,y,e){
                var d = -(xOffset-x);
                parent.style.width = (d+dx) + "px";
                //me.onResize();
                var moveVector = {
                    x: x,
                    y: y
                };
                parent.draggie.dispatchEvent( 'dragMove', e, [ e, moveVector ] ); //pointer, moveVector
                var placeholder = mainDiv.getElementsByClassName("packery-drop-placeholder")[0];
                if (placeholder){
                    placeholder.style.width = (d+dx) + "px";
                }
            },
            onDragEnd: onDragEnd
        });
        resizeHandle.onmouseover = function(){
            parent.draggie.disable();
        };
        resizeHandle.onmouseout = function(){
            parent.draggie.enable();
        };


      //Add ne resizer
        resizeHandle = resizeHandle.cloneNode();
        resizeHandle.style.top = "-5px";
        resizeHandle.style.height = "10px";
        resizeHandle.style.cursor = "ne-resize";
//        parent.appendChild(resizeHandle);
//        javaxt.dhtml.utils.initDrag(resizeHandle, {
//            onDragStart: onDragStart,
//            onDrag: function(x,y){
//                var d = -(xOffset-x);
//                parent.style.width = (d+dx) + "px";
//                var top = (yOffset-y);
//                parent.style.top = (y) + "px";
//                parent.style.height = ((orgHeight+top)-dy) + "px";
//                //me.onResize();
//            },
//            onDragEnd: onDragEnd
//        });

        resizeHandle.onmouseover = function(){
            parent.draggie.disable();
        };
        resizeHandle.onmouseout = function(){
            parent.draggie.enable();
        };


      //Add se resizer
        resizeHandle = resizeHandle.cloneNode();
        resizeHandle.style.top = "";
        resizeHandle.style.cursor = "se-resize";
        resizeHandle.style.bottom = "-5px";
        parent.appendChild(resizeHandle);
        javaxt.dhtml.utils.initDrag(resizeHandle, {
            onDragStart: onDragStart,
            onDrag: function(x,y,e){
                var d = -(xOffset-x);
                parent.style.width = (d+dx) + "px";
                var top = -(yOffset-y);
                parent.style.height = (top+dy) + "px";
                //me.onResize();

                var moveVector = {
                    x: x,
                    y: y
                };
                parent.draggie.dispatchEvent( 'dragMove', e, [ e, moveVector ] ); //pointer, moveVector
                var placeholder = mainDiv.getElementsByClassName("packery-drop-placeholder")[0];
                if (placeholder){
                    placeholder.style.width = (d+dx) + "px";
                    placeholder.style.height = (top+dy) + "px";
                }

            },
            onDragEnd: onDragEnd
        });
        resizeHandle.onmouseover = function(){
            parent.draggie.disable();
        };
        resizeHandle.onmouseout = function(){
            parent.draggie.enable();
        };
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var round = javaxt.dhtml.utils.round;
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;

    init();

};