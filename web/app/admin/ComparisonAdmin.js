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
        messageDiv.hide();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();


        get("/document/count", {
            success: function(numDocuments){

                numDocuments = formatNumber(numDocuments);
                var tr = cacheInfo.addRow("Total Documents", numDocuments, function(){
                    if (waitmask) waitmask.show();
                    get("/document/RefreshDocumentIndex", {
                        success: function(status){
                            showMessage(true);

                            get("/document/count", {
                                success: function(numDocuments){
                                    tr.childNodes[1].innerHTML = formatNumber(numDocuments);
                                }
                            });
                        },
                        failure: function(){
                            showMessage(false);
                        }
                    });

                });
            }
        });
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
        parent.style.paddingBottom = "5px";
        addShowHide(messageDiv);
        messageDiv.hide();
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
            title: "Document Index"
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

            return tr;
        };


        cacheInfo.clear = function(){
            tbody.innerHTML = "";
        };

    };


  //**************************************************************************
  //** showMessage
  //**************************************************************************
    var showMessage = function(success, status){
        if (waitmask) waitmask.hide();
        messageDiv.innerHTML = "";


        var msg = "";
        if (success){
            messageDiv.style.color = "green";
            msg = "Success!";
            if (status){
                msg += " " + status + " Added new documents.";
            }
            else {
                msg += " Documents up-to-date.";
            }
        }
        else {
            messageDiv.style.color = "red";
            msg = "Failed to update index";
        }


        messageDiv.innerHTML = msg;
        messageDiv.show();
        setTimeout(function(){
            messageDiv.hide();
        }, 5000);
    };



  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var formatNumber = bluewave.utils.formatNumber;

    init();
};