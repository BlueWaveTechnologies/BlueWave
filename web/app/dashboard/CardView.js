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
    var dashboardTitle, dashboardDescription, dashboardImage; //DOM elements
    var placeholderImage;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);


      //Create dashboard item
        dashboardItem = createDashboardItem(parent, {
            width: 285,
            height: 500,
            //subtitle: title,
            settings: true
        });
        dashboardItem.innerDiv.style.verticalAlign = "top";


      //Create DOM elements
        dashboardImage = createElement("div", dashboardItem.innerDiv, "dashboard-item-image");
        placeholderImage = createElement("i", dashboardImage, "fas fa-camera middle");
        addShowHide(placeholderImage);
        var dashboardBody = createElement("div", dashboardItem.innerDiv, "dashboard-item-body");
        dashboardTitle = createElement("div", dashboardBody, "dashboard-item-title");
        dashboardDescription = createElement("div", dashboardBody);
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
        dashboardTitle.innerHTML = "";
        dashboardDescription.innerHTML = "";
        dashboardImage.style.backgroundImage = "none";
        placeholderImage.show();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(dashboard){
        me.clear();
        if (!dashboard) dashboard = {};


      //Set title
        me.setTitle(dashboard.name);


      //Set description
        var description;
        if (dashboard.info){
            description = dashboard.info.description;
        }
        else{
            description = dashboard.description;
        }
        me.setDescription(description);


      //Set image/thumbnail
        var img = createTempImage();
        if (dashboard.thumbnail){
            img.src = URL.createObjectURL(dashboard.thumbnail);
        }
        else{
            var t = new Date().getTime();
            if (dashboard.id){
                img.src = "dashboard/thumbnail?id=" + dashboard.id + "&_=" + t;
                //dashboardImage.style.backgroundImage = "url(dashboard/thumbnail?id=" + dashboard.id + "&_=" + t + ")";
            }
        }
    };


  //**************************************************************************
  //** setTitle
  //**************************************************************************
    this.setTitle = function(title){
        if (!title) title = "";
        dashboardTitle.innerText = title;
    };


  //**************************************************************************
  //** setDescription
  //**************************************************************************
    this.setDescription = function(description){
        dashboardDescription.innerHTML = "";
        if (description){
            description.split(/\n\n/).forEach((d)=>{
                d = d.trim();
                if (d.length===0) return;
                createElement("div", dashboardDescription, "dashboard-item-description").innerHTML = d;
            });
        }
    };


  //**************************************************************************
  //** setImage
  //**************************************************************************
    this.setImage = function(src){
        if (!src){
            placeholderImage.show();
            return;
        }
        placeholderImage.hide();
        var img = createTempImage();
        img.src = URL.createObjectURL(src);
    };


  //**************************************************************************
  //** createTempImage
  //**************************************************************************
    var createTempImage = function(){
        var img = createElement("img");
        img.onload = function() {
            if (typeof img.src === "string"){
                dashboardImage.style.backgroundImage = "url(" + img.src + ")";
                //dashboardImage.style.backgroundImage = "url(dashboard/thumbnail?id=" + dashboard.id + "&_=" + t + ")";
                img = null;
            }
            else{
                var reader = new FileReader();
                reader.onload = function(event){
                    dashboardImage.style.backgroundImage = "url(" + event.target.result + ")";
                    img = null;
                };
                reader.readAsBinaryString(img.src);
            }

        };
        return img;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createElement = javaxt.dhtml.utils.createElement;
    var createDashboardItem = bluewave.utils.createDashboardItem;


    init();
};