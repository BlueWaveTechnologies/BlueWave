if(!bluewave) var bluewave={};
if(!bluewave.dashboard) bluewave.dashboard={};

//******************************************************************************
//**  Dashboard Card View
//******************************************************************************
/**
 *   Panel used render a thumbnail, title, and description of a dashboard
 *
 ******************************************************************************/

bluewave.dashboard.CardView = function(parent, config) {

    var me = this;
    var defaultConfig = {};
    var dashboardItem;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);

        dashboardItem = createDashboardItem(parent, {
            width: 360,
            height: 230,
            //subtitle: title,
            settings: true
        });
    };


  //**************************************************************************
  //** getDashboardItem
  //**************************************************************************
    this.getDashboardItem = function(){
        return dashboardItem;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        dashboardItem.innerDiv.innerHTML = "";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(dashboard){
        me.clear();


        var imageContainer = createElement("div", dashboardItem.innerDiv, "dashboard-item-image");
        createElement("i", imageContainer, "fas fa-camera");


        var img = createElement("img");
        img.className = "noselect";
        img.style.cursor = "pointer";
        img.style.opacity = 0;
        img.onload = function() {
            imageContainer.innerHTML = "";
            imageContainer.style.backgroundImage = "url(dashboard/thumbnail?id=" + dashboard.id + "&_=" + t + ")";
            if (true) return;

            var rect = javaxt.dhtml.utils.getRect(imageContainer);
            imageContainer.appendChild(this);


            var maxWidth = rect.width;
            var maxHeight = rect.height;
            var width = 0;
            var height = 0;

            var setWidth = function(){
                var ratio = maxWidth/width;
                width = width*ratio;
                height = height*ratio;
            };

            var setHeight = function(){
                var ratio = maxHeight/height;
                width = width*ratio;
                height = height*ratio;
            };


            var resize = function(img){
                width = img.width;
                height = img.height;

                if (maxHeight<maxWidth){

                    setHeight();
                    if (width>maxWidth) setWidth();
                }
                else{
                    setWidth();
                    if (height>maxHeight) setHeight();
                }

                if (width===0 || height===0) return;


                //img.width = width;
                //img.height = height;

                //TODO: Insert image into a canvas and do a proper resize
                //ctx.putImageData(img, 0, 0);
                //resizeCanvas(canvas, width, height, true);
                //var base64image = canvas.toDataURL("image/png");

            };

            resize(this);

        };
        var t = new Date().getTime();
        img.src = "dashboard/thumbnail?id=" + dashboard.id + "&_=" + t;
        imageContainer.style.backgroundImage = "url(dashboard/thumbnail?id=" + dashboard.id + "&_=" + t + ")";


        var dashboardBody = createElement("div", dashboardItem.innerDiv, "dashboard-item-body");

        var dashboardTitle = createElement("div", dashboardBody, "dashboard-item-title");
        dashboardTitle.innerText = dashboard.name;

        if (dashboard.info){
            var description = dashboard.info.description;
            if (description){
                description.split(/\n\n/).forEach((d)=>{
                    d = d.trim();
                    if (d.length===0) return;
                    var dashboardDescription = createElement("div", dashboardBody, "dashboard-item-description");
                    dashboardDescription.innerHTML = d;
                });
            }
        }
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createElement = javaxt.dhtml.utils.createElement;
    var createDashboardItem = bluewave.utils.createDashboardItem;


    init();
};