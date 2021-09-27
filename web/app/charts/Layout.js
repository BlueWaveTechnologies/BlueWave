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
    console.log("the chart by default creates the dashboard item to the size of 350 x 250 pixels")
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
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                    // check the current parent size.. and set a percentage based on that.
                    // console.log(parent)
                    

                    // set the width and heights to %
                    // var width = "50%";
                    // var height = "50%";
                    // width = "50%";
                    // height = "50%";
                    // var width = "10000px";
                    // check the offset size of the elements
                    // console.log("current widht and hegith are ", width, height)
                    var dashboardItem = createDashboardItem(mainDiv,{
                        width: width,
                        height: height,
                        title: input.title,
                        subtitle: ""
                    });
                    // check the offset size of the elements
                    // console.log("the width passed is ",width, "height",height)
                    // console.log("hieght" , dashboardItem.offsetHeight)
                    // console.log("width" , dashboardItem.offsetWidth)

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                    var div = dashboardItem.el;
                    addResizeHandle(div);



                    div.inputID = key;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                    var rect = layout[key]
                    console.log(rect)
                    console.log("rect values ", rect.y , rect.x , rect.h, rect.w)
///////////////////////////////////////////////////////////////////////////////////////////////////////////////


                  //Update layout
                    if (layout && layout[key]){
                        var rect = layout[key];
                        div.style.position = "absolute";
                        div.style.left = rect.x+"px";
                        div.style.top = rect.y+"px";
                        div.style.width = rect.w+"px";
                        div.style.height = rect.h+"px";
                    }
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////


                  //Add image
                    addImage(input.image, dashboardItem);
                }
            }



          //Instantiate Packery
            var packery = new Packery(mainDiv, {
                columnWidth: 25,
                gutter: 25,
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
        
        var layout = {};
        for (var i in mainDiv.childNodes){
            var dashboardItem = mainDiv.childNodes[i];
            if (dashboardItem.nodeType===1){
                var rect = javaxt.dhtml.utils.getRect(dashboardItem);
        /////////////////////////////////////////////////////////////////////////////////////

                // console.log("INITIAL ------ our parent object is (should have specified width/height that we can use)", parent.offsetHeight,parent.offsetWidth)
                // console.log(parent.width, parent.height)
                // console.log(parent)
                

                // set a percentage that fits our screen to match the current default width and height
                console.log("the browser size is ", window.innerWidth, window.innerHeight)


                // percentageWidth = width/window.innerWidth;
                percentageWidth = rect.width/window.innerWidth;

                console.log("the decimal width is",percentageWidth)

                console.log("the percentage width is",(percentageWidth*100),"%")
                // percentageHeight = height/window.innerHeight;
                percentageHeight = rect.height/window.innerHeight;
                console.log("outer height of this object is ", window.outerHeight);
                console.log("the full object printout is", window);
                percentageMultiplier = null;
                console.log("the decimal height is",percentageHeight)
                console.log("the percentage height is",(percentageHeight*100),"%")
                console.log("the width and height set here is ", rect.width, rect.height)
                console.log("we want to get it so that it equals the same size for our computer.. it should be 350 x 250 .. but in percentages instead")

        /////////////////////////////////////////////////////////////////////////////////////
                var w = parseInt(dashboardItem.style.width);
                if (isNaN(w)) w = rect.width;

                var h = parseInt(dashboardItem.style.height);
                if (isNaN(h)) h = rect.height;

                var x = parseInt(dashboardItem.style.left);
                if (isNaN(x)) x = rect.x;

                var y = parseInt(dashboardItem.style.top);
                if (isNaN(y)) y = rect.y;

                var img = dashboardItem.getElementsByTagName("img")[0];
                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // here we want to set the widht and heigth to percentages isntead
                // console.log("our width and hegiht taht we want to make into percentages are", w, h)
                // console.log("our parent object is (should have specified width/height that we can use)", parent.offsetHeight,parent.offsetWidth)
                console.log("rect values ", y , x , h, w)
                ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                ////////////////////////////////////////////////////////////////////////////
                layout[dashboardItem.inputID] = {
                    x: x,
                    y: y,
                    w:w,
                    h:h,
                    widthPercentage:(`${percentageWidth*100}%`), 
                    heightPercentage:(`${percentageHeight*100}%`), 
                    imageWidth: img.naturalWidth,
                    imageHeight: img.naturalHeight
                };
                //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            }
        }
        console.log("layout to return ", layout)
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
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;

    init();

};