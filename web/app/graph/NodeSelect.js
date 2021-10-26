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
    this.update = function(arr){
        me.clear();
        nodes = arr;

        for (var i in nodes){
            var div = document.createElement("div");
            div.className = "noselect";
            div.innerHTML = nodes[i].name;
            div.onclick = function(e){
                updateSelection(this, nodeList, e);
                updateAvailableProperties();
            };
            nodeList.appendChild(div);
        };
    };


  //**************************************************************************
  //** createButtons
  //**************************************************************************
  /**
   * @description update available properties - find which properties are within this node and compare with which properties have already been selected
   * @param {object} parent - main application DOM object assigned for rendering NodeSelect window
   *
  */
    var createButtons = function(parent){
        createButton(parent, "fas fa-chevron-right", addProperty);
        createButton(parent, "fas fa-chevron-left", removeProperty);
        createButton(parent, "fas fa-chevron-up", moveUp);
        createButton(parent, "fas fa-chevron-down", moveDown);
    };


  //**************************************************************************
  //** updateAvailableProperties
  //**************************************************************************
  /**
   * @description update available properties - find which properties are within this node and compare with which properties have already been selected
   *
   *
   * info: this will update any time a new node selection is made, when a property is removed from the 'desired properties' tab,
   * and when properties are added from the 'available properties' tab to the 'desired properties' tab.
   *
  */
    var updateAvailableProperties = function(){
        for (var i in nodes){

            var currentNodeSelected = getSelection(nodeList);
            if (nodes[i].name === currentNodeSelected.innerText){

              // clear the properties div
                propertyList.innerHTML = "";

                if (selectionList.childNodes.length > 0 ){

                  // get the list of currently selected properties
                  // remove the node selection reference from the selected element before moving it back to "available properties"
                  // ie. "hospital_points - code" will be reduced to "code"
                    var hiddenProperties = [];
                    for (let s = 0; s <selectionList.childNodes.length; s++) {

                        var node = selectionList.childNodes[s].innerText.split(' - ')[0];

                      // if the node name matches our currently selected node, add this item to the list of properties to hide (because they are already enabled)
                        if (node === nodes[i].name){
                            var item = selectionList.childNodes[s].innerText.split(' - ')[1];
                            hiddenProperties.push(item);
                        }
                    }
                }

                for (var p in nodes[i].properties){

                  // compare this list to our available properties and remove the options that are already selected
                    var property = nodes[i].properties[p];

                  // if hiddenProperties has items then check the current property against the hidden properties list before displaying the property
                    if (hiddenProperties !== undefined){
                        if (hiddenProperties.includes(property)){
                            // do nothing - go to next property
                            continue;
                        };
                    };

                    var div = document.createElement("div");
                    div.className = "noselect";
                    div.innerHTML = property;

                  // add a "selected" option - show which item was last clicked
                    div.onclick = function(e){
                        updateSelection(this, propertyList, e);
                        clearSelection(selectionList);
                    };
                    propertyList.appendChild(div);
                }
                break;
            }
        }
    };


  //**************************************************************************
  //** addProperty
  //**************************************************************************
  /**
   * @description adds currently selected (in available properties tab) property to desired properties tab
  */
    var addProperty = function(){
        var currentPropertySelected = getSelection(propertyList);
        if (currentPropertySelected !== undefined){
            var currentNodeSelected = getSelection(nodeList);

        // if this property isn't already added then add it
            for (let i = 0; i < selectionList.childNodes.length; i++) {
                var el = selectionList.childNodes[i];
                if (el.innerText === currentNodeSelected.innerText + " - " + currentPropertySelected.innerText){
                // if this value does already exist, return early
                    return;
                }
            }

        // if this value doesn't exist then add it
            var div = document.createElement("div");
            div.className = "noselect";
            div.innerText = currentNodeSelected.innerText + " - " + currentPropertySelected.innerText;
            div.onclick = function(e){
                updateSelection(this, selectionList, e);
                clearSelection(propertyList);
            };
            selectionList.appendChild(div);



        // remove property from "available properties" (2) row (to show that this option is already selected)
            updateAvailableProperties();
        }
    };


  //**************************************************************************
  //** removeProperty
  //**************************************************************************
  /**
   * @description Removes currently selected property from desired properties tab
  */
    var removeProperty = function(){
        var currentPropertySelectedDesired = getSelection(selectionList);
        if (currentPropertySelectedDesired){


          // remove the property where it matches our current selected property
            for (let i = 0; i <selectionList.childNodes.length; i++) {
                var el = selectionList.childNodes[i];
                if (el.innerText === currentPropertySelectedDesired.innerText ){

                  //delete this property from the "desired properties" section;
                    el.remove();
                    updateAvailableProperties();
                    break;
                }
            }
        }
    };


  //**************************************************************************
  //** moveUp
  //**************************************************************************
  /**
   * @description Move selected property to a higher priority on the desired properties list
   */
    var moveUp = function(){
        var currentPropertySelectedDesired = getSelection(selectionList);
        if (currentPropertySelectedDesired){

          // get current location
          // if theres more than one row in the column then proceed
            if (selectionList.childNodes.length > 1){
                clearSelection(selectionList);

                for (let i = 0; i < selectionList.childNodes.length; i++) {
                    // if the current item matches the selected item
                    if (selectionList.childNodes[i].innerText === currentPropertySelectedDesired.innerText){

                        // if theres an item above this item then we move it up one
                        if (selectionList.childNodes[i-1] !== undefined){

                            // move item up one.. switch positions with the item above it
                            var value1 = selectionList.childNodes[i].innerHTML;
                            var value2 = selectionList.childNodes[i-1].innerHTML;

                            selectionList.childNodes[i].innerHTML = value2;
                            selectionList.childNodes[i-1].innerHTML = value1;
                            selectionList.childNodes[i-1].className = "selected";
                        }

                        break;
                    }
                }
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
        var currentPropertySelectedDesired = getSelection(selectionList);
        if (currentPropertySelectedDesired){

          // get current location
          // if theres more than one row in the column then proceed
            if (selectionList.childNodes.length > 1){
                clearSelection(selectionList);

                for (let i = 0; i < selectionList.childNodes.length; i++) {
                    // if the current item matches the selected item
                    if (selectionList.childNodes[i].innerText === currentPropertySelectedDesired.innerText){

                    // if theres an item above this item then we move it up one
                        if (selectionList.childNodes[i+1] !== undefined){

                            // move item down one.. switch positions with the item above it
                            var value1 = selectionList.childNodes[i].innerHTML;
                            var value2 = selectionList.childNodes[i+1].innerHTML;

                            selectionList.childNodes[i].innerHTML = value2;
                            selectionList.childNodes[i+1].innerHTML = value1;
                            selectionList.childNodes[i+1].className = "selected";
                        }
                    }
                }
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