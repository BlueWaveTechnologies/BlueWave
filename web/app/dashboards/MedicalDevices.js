if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//** MedicalDevices
//******************************************************************************
/**
 *   Panel for displaying medical device groups
 *
 ******************************************************************************/

bluewave.dashboards.MedicalDevices = function(parent, config) {

    var me = this;
    var mainDiv;
    var dashboardItems = [];
    var dashboardMenu, groupMenu; //callouts
    var waitmask;
    var groupEditor, moveOptions; //windows
    var windows = [];



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;

        var div = document.createElement("div");
        div.className = "dashboard-homepage";
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";
        parent.appendChild(div);
        me.el = div;

        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        div.appendChild(innerDiv);
        mainDiv = innerDiv;
  

    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
    this.onUpdate = function(){};


  //**************************************************************************
  //** onClick
  //**************************************************************************
    this.onClick = function(dashboard){

      console.log(dashboard.data)
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(data){
        clear();
        render(data);
        me.onUpdate();
    };


  //**************************************************************************
  //** getDashboardItems
  //**************************************************************************
  /** Returns all the dashboard items in the view
   */
    this.getDashboardItems = function(){
        return dashboardItems;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    var clear = function(){
        dashboardItems = [];
        mainDiv.innerHTML = "";
    };

  //**************************************************************************
  //** render
  //**************************************************************************
    var render = function(data){

      for (group in groupURLs){
        addGroup(group, mainDiv, data);
      }

    };

  //**************************************************************************
  //** addGroup
  //**************************************************************************
   var addGroup = function(group, parent, data){

        var rows = d3.csvParse(data);

        var dashboardItem = createDashboardItem(parent, {
          width: 360,
          height: 230,
          title: group,
          // subtitle: "test",
          // settings: true
        });

        dashboardItem.innerDiv.style.cursor = "pointer";
        dashboardItem.innerDiv.style.textAlign = "center";
        dashboardItem.el.addEventListener("mouseover", function(event) {
        
          // console.log("mouseover")
         
        });

        dashboardItem.innerDiv.onclick = function () {
          me.onClick(dashboardItem);
        };

        var icon = document.createElement("img");
        icon.src = groupURLs[group];
        icon.style.height = "100%";

        dashboardItem.innerDiv.appendChild(icon);
        dashboardItem.icon = icon;
        dashboardItem.data = rows.filter(function(row){
          var g1 = row.group.toLowerCase();
          var g2 = group.toLowerCase();
          var medSpec = row["n.medical_specialty_description"].toLowerCase();
          if (g1.includes(g2) || g2.includes(g1) || g2 == medSpec) return true;

          return false;
        })

        dashboardItems.push(dashboardItem)


   };
   
  //**************************************************************************
  //** createMenuOption
  //**************************************************************************
    var createMenuOption = function(label, icon, onClick){
        var div = document.createElement("div");
        div.className = "dashboard-homepage-menu-item noselect";
        if (icon && icon.length>0){
            div.innerHTML = '<i class="fas fa-' + icon + '"></i>' + label;
        }
        else{
            div.innerHTML = label;
        }
        div.label = label;
        div.onclick = function(){
            onClick.apply(this, [label]);
        };
        addShowHide(div);
        return div;
    };


  //**************************************************************************
  //** createWindow
  //**************************************************************************
    var createWindow = function(config){
        var win = new javaxt.dhtml.Window(document.body, config);
        windows.push(win);
        return win;
    };


  //**************************************************************************
  //** URLs
  //**************************************************************************

    // var searchTerms = ["hyperbaric","decontamination","mask", "glove", "gown", "shoe", "swab", "shield", "thermometer", "disinfectant",
    // "transport", "cap,","pipette", "applicator", "collection", "storage", "concentrator", "nucleic", "ventilator", 
    // "ventilation", "respirator", "vacuum", "dialysis", "prosthesis", "oxygen", "test", "reagent", "first aid"];
   var groupURLs =
   {
    "Gloves": "../../images/medical_icons/ppe_gloves.svg",
    "Masks": "../../images/medical_icons/ppe_face_mask.svg",
    "Gowns": "../../images/medical_icons/ppe_gown.svg",
    "Shields": "../../images/medical_icons/ppe_face_shield.svg",
    "Shoes": "../../images/medical_icons/foot.svg",
    "Disinfectant": "../../images/medical_icons/disinfecting_wipes.svg",
    "Ventilators": "../../images/medical_icons/ventilator.svg",
    "Respirators": "../../images/medical_icons/respirator.svg",
    "Tests": "../../images/medical_icons/microscope.svg",
    "Oxygen": "../../images/medical_icons/oxygen_tank.svg",
    "First Aid": "../../images/medical_icons/health_alt.svg",
    "Dental": "../../images/medical_icons/tooth.svg",
    "Orthopedic": "../../images/medical_icons/orthopaedics.svg", //meh
    "Radiology": "../../images/medical_icons/radiology.svg",
    "Microbiology": "../../images/medical_icons/bacteria.svg",
    "Physical Medicine": "../../images/medical_icons/physical_therapy.svg",
    "General, Plastic Surgery": "../../images/medical_icons/surgical_sterilization.svg",
    "Gastroenterology, Urology": "../../images/medical_icons/gastroenterology.svg",
    "Obstetrics/Gynecology": "../../images/medical_icons/obstetricsmonia.svg",
    "Ear, Nose, Throat": "../../images/medical_icons/ears_nose_and_throat.svg",
    "Cardiovascular": "../../images/medical_icons/cardiology.svg",
    "Clinical Chemistry": "../../images/medical_icons/biochemistry_laboratory.svg",
    "Ophthalmic": "../../images/medical_icons/opthalmology.svg",
    "General Hospital": "../../images/medical_icons/hospital.svg",
    "Pathology": "../../images/medical_icons/virus-research.svg",
    "Anesthesiology": "../../images/medical_icons/ventilator_alt.svg", //meh
    "Hematology": "../../images/medical_icons/hematology.svg",
    "Neurology": "../../images/medical_icons/psychology.svg",
    "Immunology": "../../images/medical_icons/virus_lab_research_test_tube.svg", //meh
    "Clinical Toxicology": "../../images/medical_icons/poison.svg",
    "Medical Genetics": "../../images/medical_icons/dna.svg",
    "Unknown": "../../images/medical_icons/question_mark.svg",
  };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var del = javaxt.dhtml.utils.delete;
    var post = javaxt.dhtml.utils.post;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var warn = bluewave.utils.warn;

    init();
};