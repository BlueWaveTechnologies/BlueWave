if(!bluewave) var bluewave={};

//******************************************************************************
//**  ComparisonAdmin
//******************************************************************************
/**
 *   Panel used to manage Document Comparison settings
 *
 ******************************************************************************/

bluewave.ComparisonAdmin = function(parent, config) {

    var me = this;
    var defaultConfig = {

    };

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        config = merge(config, defaultConfig);
        if (!config.style) config.style = javaxt.dhtml.style.default;


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
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        me.clear();
    };


  //**************************************************************************
  //** createHeader
  //**************************************************************************
    var createHeader = function(parent){
        var div = document.createElement("div");
        div.className = "admin-header";
        parent.appendChild(div);

        var icon = document.createElement("div");
        icon.className = "fas fa-file-import noselect";
        div.appendChild(icon);

        var title = document.createElement("div");
        title.innerHTML = "Document Comparison Settings";
        div.appendChild(title);

    };


  //**************************************************************************
  //** createPanels
  //**************************************************************************
    var createPanels = function(parent){
        createButtonPanel(parent);
    };

  //**************************************************************************
  //** createButtonPanel
  //**************************************************************************
    var createButtonPanel = function(parent){
        var refreshButton;

        var buttonsDiv = document.createElement("div");
        buttonsDiv.className = "document-analysis-button-bar";
        buttonsDiv.style.bottom = "10px";
        parent.appendChild(buttonsDiv);

        var leftSideButtons = document.createElement("div");
        leftSideButtons.style.left = "0px";
        leftSideButtons.style.position = "absolute";

        buttonsDiv.appendChild(leftSideButtons);
        var messageDiv = document.createElement("div");

        var showMessage = function(success, status){
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
          leftSideButtons.appendChild(messageDiv);
          refreshButton.enable();

      };

  //Add refresh document index button
      refreshButton = createButton("Refresh Document Index", leftSideButtons);
      refreshButton.style.width = "200px";
      refreshButton.enable();
      refreshButton.onclick = function(){
          this.disable();
         // hit the API endpoint, and show the respective message
          get("/document/RefreshDocumentIndex", {
              success: function(status){
                showMessage(true, JSON.parse(status));
              },
              failure: function(){
                showMessage(false);
              }
          });
      };
    };



  //**************************************************************************
  //** createButton
  //**************************************************************************
    var createButton = function(label, parent){
        var input = document.createElement('input');
        input.className = "form-button";
        input.type = "button";
        input.name = label;
        input.value = label;
        input.disabled = true;
        input.disable = function(){
            this.disabled = true;
        };
        input.enable = function(){
            this.disabled = false;
        };
        input.setText = function(label){
            this.name = label;
            this.value = label;
        };
        input.getText = function(){
            return this.value;
        };
        parent.appendChild(input);
        return input;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var get = bluewave.utils.get;
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var addShowHide = javaxt.dhtml.utils.addShowHide;
    init();
};