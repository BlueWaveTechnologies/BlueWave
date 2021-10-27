if(!bluewave) var bluewave={};

//******************************************************************************
//**  NodeSelect
//******************************************************************************
/**
 *   Panel used to select nodes and properties
 *
 ******************************************************************************/

bluewave.NodeSelect = function(parent, config) {

    var me = this;
    var nodeList, propertyList, selectionList;
    var nodes = [];


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        if (!config) config = {};


      //Create table with 4 columns
        var table = createTable();
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var tr, td;


      //Nodes
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "12px 5px 5px";
        nodeList = createList(td, "Available Nodes");
        tr.appendChild(td);


      //Properties
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "12px 5px 5px";
        propertyList = createList(td, "Available Properties");
        tr.appendChild(td);


      //Buttons
        td = document.createElement("td");
        td.style.width = "1%";
        tr.appendChild(td);
        createButtons(td);


      //Selected Properties
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "12px 5px 5px";
        selectionList = createList(td, "Selected Properties");
        tr.appendChild(td);


      //Append table to parent
        parent.appendChild(table);
        me.el = table;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        nodeList.innerHTML = "";
        propertyList.innerHTML = "";
        selectionList.innerHTML = "";
        nodes = [];
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(arr,selectedProperties){
        me.clear();
        nodes = arr;
        
        if (selectedProperties){
            setSelectedProperties(selectedProperties);
        }

        for (var i in nodes){
            var node = nodes[i];
            var div = document.createElement("div");
            div.className = "noselect";
            div.innerText = node.name;
            div.node = node;
            div.onclick = function(e){
                updateSelection(this, nodeList, e);
                updateAvailableProperties(this.node);
            };
            nodeList.appendChild(div);
        };
    };


  //**************************************************************************
  //** getSelectedProperties
  //**************************************************************************
    this.getSelectedProperties = function(){
        var arr = [];
        for (let i = 0; i < selectionList.childNodes.length; i++) {
            var el = selectionList.childNodes[i];
            arr.push({
                node: el.node.name,
                property: el.property
            });
        }
        return arr;
    };

  //**************************************************************************
  //** setSelectedProperties
  //**************************************************************************
  /** set the selected properties from a save point
   *  
   */
    var setSelectedProperties = function(selectedProperties){
        for (let i = 0; i < selectedProperties.length; i++) {
            var nodeName = selectedProperties[i].node;
            var property = selectedProperties[i].property;
            node = getNode(nodeName);
            addPropertyFromConfig(node, nodeName, property);
        }
    };

  //**************************************************************************
  //** getNode
  //**************************************************************************
  /** get the node that corresponds to the selected property 
   */
    var getNode = function(nodeName){
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].name == nodeName){
                return nodes[i];
            }
        }
    };


  //**************************************************************************
  //** createButtons
  //**************************************************************************
    var createButtons = function(parent){
        createButton(parent, "fas fa-chevron-right", addProperty);
        createButton(parent, "fas fa-chevron-left", removeProperty);
        createButton(parent, "fas fa-chevron-up", moveUp);
        createButton(parent, "fas fa-chevron-down", moveDown);
    };


  //**************************************************************************
  //** updateAvailableProperties
  //**************************************************************************
  /** Used to update the propertyList. Called whenever a node is clicked or
   *  when a propert is removed from the selectionList
   */
    var updateAvailableProperties = function(node){


      //Clear the properties div
        propertyList.innerHTML = "";


      //Generate a list of selected properties from the selectionList that
      //correspond to this node
        var selectedProperties = [];
        for (let i = 0; i < selectionList.childNodes.length; i++) {
            var el = selectionList.childNodes[i];
            if (el.node.name===node.name){
                selectedProperties.push(el.property);
            }
        }


      //Add properties assiciated with the node that are not in the selectionList
        for (var p in node.properties){
            var property = node.properties[p];
            if (!selectedProperties.includes(property)){
                var div = document.createElement("div");
                div.className = "noselect";
                div.innerText = property;
                div.node = node;
                div.onclick = function(e){
                    updateSelection(this, propertyList, e);
                    clearSelection(selectionList);
                };
                div.ondblclick = function(e){
                    addProperty();
                };
                propertyList.appendChild(div);
            };
        }
    };


  //**************************************************************************
  //** addProperty
  //**************************************************************************
  /**
   * @description adds currently selected (in available properties tab) property to desired properties tab
  */
    var addProperty = function(){
        var div = getSelection(propertyList);
        if (div){
            var node = div.node;
            var nodeName = node.name;
            var property = div.innerText;

            div.remove();


            div = document.createElement("div");
            div.className = "noselect";
            div.innerText = nodeName + " - " + property;
            div.node = node;
            div.property = property;
            div.onclick = function(e){
                updateSelection(this, selectionList, e);
                clearSelection(propertyList);
            };
            selectionList.appendChild(div);
            me.getSelectedProperties();
        }
    };
  //**************************************************************************
  //** addPropertyFromConfig
  //**************************************************************************
  /**
   * @description adds a selection to the "Selected Properties" tab from a supplied config
  */
   var addPropertyFromConfig = function(node, nodeName, property){

        div = document.createElement("div");
        div.className = "noselect";
        div.innerText = nodeName + " - " + property;
        div.node = node;
        div.property = property;
        div.onclick = function(e){
            updateSelection(this, selectionList, e);
            clearSelection(propertyList);
        };
        selectionList.appendChild(div);
        me.getSelectedProperties();
    };




  //**************************************************************************
  //** removeProperty
  //**************************************************************************
  /**
   * @description Removes currently selected property from desired properties tab
  */
    var removeProperty = function(){
        var div = getSelection(selectionList);
        if (div){
            var node = div.node;
            div.remove();
            updateAvailableProperties(node);
        }
    };


  //**************************************************************************
  //** moveUp
  //**************************************************************************
  /**
   * @description Move selected property to a higher priority on the desired properties list
   */
    var moveUp = function(){
        var div = getSelection(selectionList);
        if (div){

            var prev = div.previousSibling;
            if (prev){

                clearSelection(selectionList);

                var prevNode = prev.node;
                var prevProperty = prev.property;
                var currNode = div.node;
                var currProperty = div.property;

                div.innerText = prevNode.name + " - " + prevProperty;
                div.node = prevNode;
                div.property = prevProperty;

                prev.innerText = currNode.name + " - " + currProperty;
                prev.node = currNode;
                prev.property = currProperty;
                prev.className = "selected";
            }
        }
    };


  //**************************************************************************
  //** moveDown
  //**************************************************************************
  /**
   * @description Move selected property to a lower priority on the desired properties list
  */
    var moveDown = function(){
        var div = getSelection(selectionList);
        if (div){

            var next = div.nextSibling ;
            if (next){

                clearSelection(selectionList);

                var nextNode = next.node;
                var nextProperty = next.property;
                var currNode = div.node;
                var currProperty = div.property;

                div.innerText = nextNode.name + " - " + nextProperty;
                div.node = nextNode;
                div.property = nextProperty;

                next.innerText = currNode.name + " - " + currProperty;
                next.node = currNode;
                next.property = currProperty;
                next.className = "selected";
            }
        }
    };


  //**************************************************************************
  //** createList
  //**************************************************************************
    var createList = function(parent, label){

        var outerDiv = document.createElement("div");
        outerDiv.style.height = "100%";
        outerDiv.style.position = "relative";
        parent.appendChild(outerDiv);

        var div = document.createElement("div");
        div.className = "node-select-list";
        div.style.height = "100%";
        div.style.overflow = "hidden";
        div.style.position = "relative";
        outerDiv.appendChild(div);

        var list = document.createElement("div");
        list.style.position = "absolute";
        list.style.width = "100%";
        div.appendChild(list);

        var text = document.createElement("div");
        text.className = "node-select-list-label noselect";
        text.style.position = "absolute";
        text.innerText = label;
        outerDiv.appendChild(text);

        return list;
    };


  //**************************************************************************
  //** createButton
  //**************************************************************************
    var createButton = function(parent, icon, onclick){
        var button = document.createElement("button");
        button.className = "form-button";
        button.style.margin = "3px 0";
        button.style.width = "40px";
        button.innerHTML = '<i class="' + icon + '"></i>';
        button.onclick = onclick;
        parent.appendChild(button);
        return button;
    };


  //**************************************************************************
  //** updateSelection
  //**************************************************************************
    var updateSelection = function(div, list, e){
        for (var i=0; i<list.childNodes.length; i++){
            var el = list.childNodes[i];
            el.className = (el===div) ? "selected" : "";
        }
    };


  //**************************************************************************
  //** clearSelection
  //**************************************************************************
    var clearSelection = function(list){
        for (var i=0; i<list.childNodes.length; i++){
            var el = list.childNodes[i];
            el.className = "";
        }
    };


  //**************************************************************************
  //** getSelection
  //**************************************************************************
    var getSelection = function(list){
        for (var i=0; i<list.childNodes.length; i++){
            var el = list.childNodes[i];
            if (el.className === "selected") return el;
        }
        return null;
    };


  //**************************************************************************
  //** Utilities
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;


    init();
};