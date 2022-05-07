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
        cacheInfo.update();
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

        var addRow = function(label, value, icon, callback){
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
            if (icon){
                td.innerHTML = '<i class="' + icon + '"></i>';
                td.onclick = function(){
                    if (callback) callback.apply(me, [v]);
                };
            }
            tr.appendChild(td);

            return tr;
        };


        var indexRow = addRow("Total Documents", 0, "fas fa-sync", function(){
            if (waitmask) waitmask.show();
            get("/document/RefreshDocumentIndex", {
                success: function(status){
                    showMessage(true);
                    cacheInfo.update();
                },
                failure: function(){
                    showMessage(false);
                }
            });
        });


        var pathRow = addRow("Index Location", "", "far fa-folder", function(){
            //TODO: folder picker
        });

        var infoRow = addRow("Index Size", "");


        cacheInfo.clear = function(){
            indexRow.childNodes[1].innerHTML = 0;
            pathRow.childNodes[1].innerHTML = "";
            infoRow.childNodes[1].innerHTML = "";
        };


        cacheInfo.update = function(){

            get("/document/index", {
                success: function(index){

                    indexRow.childNodes[1].innerHTML = formatNumber(index.count);



                    var path = index.path;
                    path = path.replaceAll("\\", "/");
                    if (path.lastIndexOf("/") === path.length-1){
                        path = path.substring(0, path.length-1);
                    }
                    var arr = path.split("/");
                    var str = arr[0] + "/... " + "/" + arr[arr.length-2] + "/" + arr[arr.length-1];
                    pathRow.childNodes[1].innerHTML = str;


                    var size = index.size;
                    if (size<1024) size = "1 KB";
                    else{
                        size = formatNumber(Math.round(size/1024)) + " KB";
                    }
                    infoRow.childNodes[1].innerHTML = size;
                }
            });


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