if(!bluewave) var bluewave={};
if(!bluewave.graph) bluewave.graph={};

//******************************************************************************
//**  NodeSelect
//******************************************************************************
/**
 *   Panel used to select nodes and properties
 *
 ******************************************************************************/

bluewave.graph.NodeSelect = function(parent, config) {

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
  /** Used to populate the lists with available nodes and properties
   *  @param availableProperties An array containing all possible nodes and
   *  properties that users can select
   *  @param selectedProperties An array with nodes and properties from a
   *  previous selection
   */
    this.update = function(availableProperties, selectedProperties){
        me.clear();

        nodes = availableProperties;
        var nodeMap = {};


      //Populate nodeList
        nodes.forEach((node)=>{
            nodeMap[node.name] = node;

            var div = document.createElement("div");
            div.className = "noselect";
            div.innerText = node.name;
            div.node = node;
            div.onclick = function(e){
                updateSelection(this, nodeList, e);
                updateAvailableProperties(this.node);
            };
            nodeList.appendChild(div);
        });



        if (selectedProperties){
            var firstNode;

          //Populate selectionList
            selectedProperties.forEach((selected)=>{
                var nodeName = selected.node;
                var property = selected.property;
                var node = nodeMap[nodeName];
                createSelectedItem(node, property);
                if (!firstNode) firstNode = nodeName;
            });


          //Update labels in the selectionList
            updateLabels();


          //Select first in the selectedProperties from the nodeList
            for (let i = 0; i < nodeList.childNodes.length; i++) {
                var div = nodeList.childNodes[i];
                if (div.node.name===firstNode){
                    div.click();
                    break;
                }
            }

        }
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
   *  when a property is removed from the selectionList
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


      //Add properties associated with the node that are not in the selectionList
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
  /** Used to move an entry from the propertyList to the selectionList
   */
    var addProperty = function(){
        var div = getSelection(propertyList);
        if (div){
            var node = div.node;
            var property = div.innerText;
            div.remove();
            createSelectedItem(node, property);
            updateLabels();
        }
    };


  //**************************************************************************
  //** removeProperty
  //**************************************************************************
  /** Used to move an entry from the selectionList to the propertyList
   */
    var removeProperty = function(){
        var div = getSelection(selectionList);
        if (div){
            var node = div.node;
            var property = div.property;
            div.remove();
            updateLabels();
            updateAvailableProperties(node);

          //Highlight property in propertyList
            for (let i = 0; i < propertyList.childNodes.length; i++) {
                var div = propertyList.childNodes[i];
                if (div.innerText===property){
                    updateSelection(div, propertyList, null);
                    break;
                }
            }

          //Highlight node in nodeList
            for (let i = 0; i < nodeList.childNodes.length; i++) {
                var div = nodeList.childNodes[i];
                if (div.node.name===node.name){
                    updateSelection(div, nodeList, null);
                    break;
                }
            }

        }
    };


  //**************************************************************************
  //** moveUp
  //**************************************************************************
  /** Used to move a selected entry in the selectionList up one position
   */
    var moveUp = function(e){
        var div = getSelection(selectionList);
        if (div){

            var prev = div.previousSibling;
            if (prev){

                clearSelection(selectionList);

                var prevNode = prev.node;
                var prevProperty = prev.property;
                var currNode = div.node;
                var currProperty = div.property;


                div.node = prevNode;
                div.property = prevProperty;


                prev.node = currNode;
                prev.property = currProperty;


                updateLabels();
                updateSelection(prev, selectionList, e);
            }
        }
    };


  //**************************************************************************
  //** moveDown
  //**************************************************************************
  /** Used to move a selected entry in the selectionList down one position
   */
    var moveDown = function(e){
        var div = getSelection(selectionList);
        if (div){

            var next = div.nextSibling ;
            if (next){

                clearSelection(selectionList);

                var nextNode = next.node;
                var nextProperty = next.property;
                var currNode = div.node;
                var currProperty = div.property;

                div.node = nextNode;
                div.property = nextProperty;


                next.node = currNode;
                next.property = currProperty;


                updateLabels();
                updateSelection(next, selectionList, e);
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
  //** createSelectedItem
  //**************************************************************************
  /** Used to create an entry in the selectionList
   */
    var createSelectedItem = function(node, property){
        var div = document.createElement("div");
        div.className = "noselect";
        div.node = node;
        div.property = property;
        div.onclick = function(e){
            updateSelection(this, selectionList, e);
            clearSelection(propertyList);
        };
        div.ondblclick = removeProperty;
        div.updateLabel = function(addNodeName){
            var label = this.property;
            if (addNodeName===true) label += " (" + this.node.name + ")";
            this.innerText = label;
        };
        div.updateLabel();
        selectionList.appendChild(div);
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
  //** updateLabels
  //**************************************************************************
    var updateLabels = function(){

      //Generate a list of unique node names in the selectionList
        var selectedNodes = {};
        for (var i=0; i<selectionList.childNodes.length; i++) {
            var div = selectionList.childNodes[i];
            selectedNodes[div.node.name] = true;
        }

      //Count unique node names
        var uniqueNodes = 0;
        for (var n in selectedNodes){
            uniqueNodes++;
        }

      //Update labels in the selectionList
        var addNodeName = uniqueNodes>1;
        for (var i=0; i<selectionList.childNodes.length; i++) {
            var div = selectionList.childNodes[i];
            div.updateLabel(addNodeName);
        }
    };


  //**************************************************************************
  //** updateSelection
  //**************************************************************************
    var updateSelection = function(div, list, e){
        for (var i=0; i<list.childNodes.length; i++){
            var el = list.childNodes[i];
            el.className = (el===div) ? "selected noselect" : "noselect";
        }
    };


  //**************************************************************************
  //** clearSelection
  //**************************************************************************
    var clearSelection = function(list){
        for (var i=0; i<list.childNodes.length; i++){
            var el = list.childNodes[i];
            el.className = "noselect";
        }
    };


  //**************************************************************************
  //** getSelection
  //**************************************************************************
    var getSelection = function(list){
        for (var i=0; i<list.childNodes.length; i++){
            var el = list.childNodes[i];
            if (el.className.indexOf("selected")>-1) return el;
        }
        return null;
    };


  //**************************************************************************
  //** Utilities
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;


    init();
};