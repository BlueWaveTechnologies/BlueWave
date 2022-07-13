if(!bluewave) var bluewave={};
if(!bluewave.dashboard) bluewave.dashboard={};

//******************************************************************************
//**  Dashboard Preview
//******************************************************************************
/**
 *   Panel used render a preview of a dashboard
 *
 ******************************************************************************/

bluewave.dashboard.Preview = function(parent, config) {

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



        var imageContainer = document.createElement("div");
        imageContainer.className = "dashboard-item-image";
        dashboardItem.innerDiv.appendChild(imageContainer);

        var icon = document.createElement("i");
        icon.className = "fas fa-camera";
        imageContainer.appendChild(icon);


        var img = document.createElement("img");
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


        var dashboardBody = document.createElement("div");
        dashboardBody.className = "dashboard-item-body";
        dashboardItem.innerDiv.appendChild(dashboardBody);

        var dashboardTitle = document.createElement("div");
        dashboardTitle.className = "dashboard-item-title";
        dashboardTitle.innerText = dashboard.name;
        dashboardBody.appendChild(dashboardTitle);


        if (dashboard.info){
            var description = dashboard.info.description;
            if (description){
                description.split(/\n\n/).forEach((d)=>{
                    d = d.trim();
                    if (d.length===0) return;
                    var dashboardDescription = document.createElement("div");
                    dashboardDescription.className = "dashboard-item-description";
                    dashboardDescription.innerHTML = d;
                    dashboardBody.appendChild(dashboardDescription);
                });
            }
        }


    };




  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createDashboardItem = bluewave.utils.createDashboardItem;


    init();
};