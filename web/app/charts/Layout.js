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
    var layout;

    var width = 350; //360
    var height = 250; //260


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


        layout = document.createElement("div");
        layout.className = "dashboard-layout";
        layout.style.width = "100%";
        layout.style.height = "100%";
        td.appendChild(layout);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        layout.innerHTML = "";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(thumbnails, config){
        for (var thumbnailID in thumbnails) {
            if (thumbnails.hasOwnProperty(thumbnailID)){
                var thumbnail = thumbnails[thumbnailID];
                var base64image = thumbnail;

                var dashboardItem = createDashboardItem(layout,{
                    width: width,
                    height: height,
                    title: "Hospital Capacity By State",
                    subtitle: "Ordered By Increased Demand"
                });


                dashboardItem.innerDiv.innerHTML =
                "<img class='noselect' src='" + base64image + "' style='width:100%'/>";


            }
        }

        layout.style.height = "";
        onRender(layout, function(){

            layout.style.height = body.offsetHeight + "px";
            layout.style.minHeight = layout.style.height;


            var packery = new Packery(layout, {
                columnWidth: width,
                gutter: 25
            });


            for (var i=0; i<packery.items.length; i++){
                var draggie = new Draggabilly(packery.items[i].element);
                packery.bindDraggabillyEvents(draggie);
            }

        });

    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){

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
  //** Utils
  //**************************************************************************
    var onRender = javaxt.dhtml.utils.onRender;
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;

    init();

};