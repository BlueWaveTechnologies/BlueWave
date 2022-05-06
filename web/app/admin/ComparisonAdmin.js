if(!bluewave) var bluewave={};
if(!bluewave.admin) bluewave.admin={};

//******************************************************************************
//**  ComparisonAdmin
//******************************************************************************
/**
 *   Panel used to manage Document Comparison settings
 *
 ******************************************************************************/

bluewave.admin.ComparisonAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };

    var messageDiv;
    var cacheInfo;
    var waitmask;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;

      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Create header
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.className = "noselect";
        tr.appendChild(td);
        createHeader(td);


      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        td.style.verticalAlign = "top";
        td.style.padding = "15px";
        tr.appendChild(td);
        createPanels(td);


        parent.appendChild(table);
        me.el = table;
        addShowHide(me);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        cacheInfo.clear();
        messageDiv.innerHTML = "";
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();



//        get("document/count", {
//            success: function(numDocuments){
                var numDocuments = 0;
                cacheInfo.addRow("Index", numDocuments, function(el){

                    if (waitmask) waitmask.show();

                    get("/document/RefreshDocumentIndex", {
                        success: function(status){
                          showMessage(true, JSON.parse(status));
                        },
                        failure: function(){
                          showMessage(false);
                        }
                    });

                });
//            }
//        });

    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){
        var div = document.createElement("div");
        div.className = "admin-header";
        parent.appendChild(div);

        var icon = document.createElement("div");
        icon.className = "fas fa-not-equal noselect";
        div.appendChild(icon);

        var title = document.createElement("div");
        title.innerHTML = "Document Comparison Settings";
        div.appendChild(title);


        messageDiv = document.createElement("div");
        div.appendChild(messageDiv);
        parent.style.paddingBottom = "5px"; // add padding to keep the message out from behind the dashboard item

    };


  //**************************************************************************
  //** createPanels
  //**************************************************************************
    var createPanels = function(parent){
        createCacheInfo(parent);
    };


  //**************************************************************************
  //** createCacheInfo
  //**************************************************************************
    var createCacheInfo = function(parent){
        cacheInfo = createDashboardItem(parent, {
            width: 360,
            height: 230,
            title: "Document Cache"
        });


        cacheInfo.innerDiv.style.verticalAlign = "top";
        cacheInfo.innerDiv.style.padding = "10px 0 0 0";


        var table = createTable();
        //table.style.width = "";
        table.style.height = "";
        var tbody = table.firstChild;
        var tr, td;
        cacheInfo.innerDiv.appendChild(table);

        cacheInfo.addRow = function(label, value, callback){
            tr = document.createElement("tr");
            tbody.appendChild(tr);

            td = document.createElement("td");
            td.className = "form-label noselect";
            td.style.paddingRight = "10px";
            td.innerHTML = label + ":";
            tr.appendChild(td);

            td = document.createElement("td");
            td.className = "form-label";
            td.style.width = "100%";
            td.innerHTML = value;
            tr.appendChild(td);
            var v = td;


            td = document.createElement("td");
            td.innerHTML = '<i class="fas fa-sync"></i>';
            td.onclick = function(){
                if (callback) callback.apply(me, [v]);
            };
            tr.appendChild(td);
        };


        cacheInfo.clear = function(){
            tbody.innerHTML = "";
        };

    };


    var showMessage = function(success, status){
        if (waitmask) waitmask.show();
        messageDiv.innerHTML = "";

        var div = messageDiv;
        if (success){
            div.style.color = "green";
            var divInnerMsg = "Success!";
            if (status){
                divInnerMsg = divInnerMsg + " Added new documents.";
            }
            else {
                divInnerMsg = divInnerMsg + " Documents up-to-date.";
            };

        }
        else {
            div.style.color = "red";
            divInnerMsg = "Failed to update index";
        }
        div.innerText = divInnerMsg;
        if (waitmask) waitmask.hide();
    };



  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createDashboardItem = bluewave.utils.createDashboardItem;


    init();
};