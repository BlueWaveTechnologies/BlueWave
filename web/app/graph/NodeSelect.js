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


  // lists of the current selections and currently visible elements
    var lists = {
        desired: function (){
          // get all of the properties in the desired row
            return selectionList;
        }
    }

  // set class-accessible 'selected' variables
    var currentNodeSelected = undefined;
    var currentPropertySelected = undefined;
    var currentPropertySelectedDesired = undefined;

  // declare public method for calling
  // selections made in NodeSelect window
    var selected = {
        node: function(){
          // get the currently selected node
            return currentNodeSelected;
        },
        available: function(){
          // get the currently selected property
            return currentPropertySelected;
        },
        desired: function(){
          // get the currently selected property in desired row
            return currentPropertySelectedDesired;
        },
    };


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
        var tr, td, div;


      //Nodes
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "5px";
        tr.appendChild(td);
        div = document.createElement("div");
        div.className = "node-select-list";
        div.style.height = "100%";
        div.style.overflow = "hidden";
        div.style.position = "relative";
        td.appendChild(div);
        nodeList = document.createElement("div");
        nodeList.style.position = "absolute";
        div.appendChild(nodeList);



      //Properties
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "5px";
        tr.appendChild(td);
        div = document.createElement("div");
        div.className = "node-select-list";
        div.style.height = "100%";
        div.style.overflow = "hidden";
        div.style.position = "relative";
        td.appendChild(div);
        propertyList = document.createElement("div");
        propertyList.style.position = "absolute";
        div.appendChild(propertyList);



      //Buttons
        td = document.createElement("td");
        td.style.width = "1%";
        tr.appendChild(td);
        createButtons(td);


      //Selected Properties
        td = document.createElement("td");
        td.style.width = "33%";
        td.style.height = "100%";
        td.style.padding = "5px";
        tr.appendChild(td);
        div = document.createElement("div");
        div.className = "node-select-list";
        div.style.height = "100%";
        div.style.overflow = "hidden";
        div.style.position = "relative";
        td.appendChild(div);
        selectionList = document.createElement("div");
        selectionList.style.position = "absolute";
        div.appendChild(selectionList);


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
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(nodes){
      // update config
        config = {
            "nodes":nodes
        }

        me.clear();

        for (var i in nodes){
            var div = document.createElement("div");
            div.innerHTML = nodes[i]["name"];
            div.onclick = function(){
                resetSelectedProperty();
                setSelectedNode(this.innerText);
                updateAvailableProperties();
                // renderOptions(this,nodes);
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
        // add 4 buttons
        // button to add a property to desired properties
        var buttonAdd = document.createElement("button");
        buttonAdd.innerHTML = '<i class="fas fa-chevron-right"></i>';
        buttonAdd.addEventListener("click", function(){
          addPropertyToDesired();
        });
        parent.appendChild(buttonAdd);

        // button to remove a property from desired properties
        var buttonRemove = document.createElement("button");
        buttonRemove.innerHTML = '<i class="fas fa-chevron-left"></i>';
        buttonRemove.addEventListener("click", function(){
          removePropertyFromDesired();
        });
        parent.appendChild(buttonRemove);

        // button to move a property up (to a higher priority) in desired properties
        var buttonUp = document.createElement("button");
        buttonUp.innerHTML = '<i class="fas fa-chevron-up"></i>';
        buttonUp.addEventListener("click", function(){
            movePropertyHigherPriority();
        });
        parent.appendChild(buttonUp);

        // button to move a property down (to a lower priority) in desired properties
        var buttonDown = document.createElement("button");
        buttonDown.innerHTML = '<i class="fas fa-chevron-down"></i>';
        parent.appendChild(buttonDown);
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
        for (var i in config.nodes){

            if (config.nodes[i]["name"] === selected.node()){

              // clear the properties div
                propertyList.innerHTML = "";

                if (selectionList.getElementsByTagName('div').length > 0 ){
                    
                  // get the list of currently selected properties 
                  // remove the node selection reference from the selected element before moving it back to "available properties"
                  // ie. "hospital_points - code" will be reduced to "code"
                    var hiddenProperties = [];
                    for (let s = 0; s <selectionList.getElementsByTagName('div').length; s++) {

                        var node = selectionList.getElementsByTagName('div')[s].innerText.split(' - ')[0];

                      // if the node name matches our currently selected node, add this item to the list of properties to hide (because they are already enabled)
                        if (node === config.nodes[i]["name"]){
                            var item = selectionList.getElementsByTagName('div')[s].innerText.split(' - ')[1];
                            hiddenProperties.push(item);
                        }
                    };
                };
                for (var p in config.nodes[i]["properties"]){

                  // compare this list to our available properties and remove the options that are already selected
                    var property = config.nodes[i]["properties"][p];
                    
                  // if hiddenProperties has items then check the current property against the hidden properties list before displaying the property
                    if (hiddenProperties !== undefined){
                        if (hiddenProperties.includes(property)){
                            // do nothing - go to next property 
                            continue;
                        };
                    };

                    div = document.createElement("div");
                    div.innerHTML = `<strong>${String(property)}</strong>`;

                  // add a "selected" option - show which item was last clicked
                    div.addEventListener("click", function(){
                    setSelectedProperty(this);
                    });
                    propertyList.appendChild(div);
                };
                break
            };
        };
    };

  //**************************************************************************
  //** addPropertyToDesired
  //**************************************************************************
  /**
   * @description adds currently selected (in available properties tab) property to desired properties tab
  */
    var addPropertyToDesired = function(){

        if (selected.available() !== undefined){

        // if this property isn't already added then add it
            for (let i = 0; i < selectionList.childNodes.length; i++) {
                var el = selectionList.childNodes[i];
                if (el.innerText === selected.node() + " - " + selected.available().innerText){
                // if this value does already exist, return early
                    return;
                };
            };

        // if this value doesn't exist then add it
            div = document.createElement("div");
            div.innerText = selected.node() + " - " + selected.available().innerText;
            div.style.fontWeight = "bold";
            div.addEventListener("click",function(){
            setSelectedPropertyDesired(this);
            });
            selectionList.appendChild(div);



        // remove property from "available properties" (2) row (to show that this option is already selected)
            updateAvailableProperties();
        };
    };

  //**************************************************************************
  //** removePropertyFromDesired
  //**************************************************************************
  /** 
   * @description Removes currently selected property from desired properties tab
  */
    var removePropertyFromDesired = function(){
        if (selected.desired() !== undefined){


          // remove the property where it matches our current selected property
            for (let i = 0; i <selectionList.childNodes.length; i++) {
                var el = selectionList.childNodes[i];
                if (el.innerText === selected.desired().innerText ){

              // delete this property from the "desired properties" section;
                selectionList.getElementsByTagName("div")[i].remove();

                updateAvailableProperties();

                };
            };
        };
    };


  //**************************************************************************
  //** setSelectedProperty
  //**************************************************************************
  /** 
   * @description Sets the selectedProperty cursor in the available properties tab
   * @param {object} propertyDiv - The div DOM object currently selected
  */
    var setSelectedProperty = function(propertyDiv){
      // set the td as selected
        currentPropertySelected = propertyDiv;
    };

  //**************************************************************************
  //** setSelectedNode
  //**************************************************************************
  /** 
   * @description Sets the selectedNode cursor in the available nodes tab
   * @param {object} nodeDiv - The div DOM object currently selected
  */
    var setSelectedNode = function(nodeDiv){
      // set the node td as selected
        currentNodeSelected = nodeDiv;
  };


  //**************************************************************************
  //** resetSelectedProperty
  //**************************************************************************
  /** 
   * @description resets all selection cursors
  */
    // consolidate this into the setSelectedProperty function later
    var resetSelectedProperty = function(){

      // resets for 1st row in table
        currentNodeSelected = undefined;

      // resets for 2nd row in table
        currentPropertySelected = undefined;

      // resets for 4th row in table
        currentPropertySelectedDesired = undefined;
    };


  //**************************************************************************
  //** setSelectedPropertyDesired
  //**************************************************************************
  /** 
   * @description Sets the selectedProperty cursor in the Desired tab
   * @param {object} propertyDesiredDiv - The div DOM object currently selected
  */
    var setSelectedPropertyDesired = function(propertyDesiredDiv){
      // set the td as selected
        currentPropertySelectedDesired = propertyDesiredDiv;
    };

  //**************************************************************************
  //** movePropertyHigherPriority
  //**************************************************************************
  /** 
   * @description Move selected property to a higher priority on the desired properties list
  */
    var movePropertyHigherPriority = function(){
        if (selected.desired() !== undefined){

          // get current location
          // if theres more than one row in the column then proceed
            if (lists.desired().length > 1){

            for (let i = 0; i < (lists.desired()).length; i++) {
                  // if the current item matches the selected item
                    if (lists.desired()[i].innerText === selected.desired().innerText){
                        console.log(lists.desired()[i].innerText)
                        console.log("item matches");

                    // if theres an item above this item then we move it up one
                        if (lists.desired()[i-1] !== undefined){
                            console.log(lists.desired()[i-1]);
                          // move item up one.. switch positions with the item above it
                            lists.desired()[i].innerHTML = lists.desired()[i-1].innerHTML;
                        };
                    };
                };
            };
        };
    };

  //**************************************************************************
  //** Utilites
  //**************************************************************************
  /** Common functions found in Utils.js
  */
    var createTable = javaxt.dhtml.utils.createTable;


    init();
};