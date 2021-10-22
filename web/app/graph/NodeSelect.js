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
 
    var tableDivs = {
        nodes: function(){
            return parent.getElementsByTagName("td")[0];
        },
        properties: function(){
            return parent.getElementsByTagName("td")[1];
        },
        buttons: function(){
            return parent.getElementsByTagName("td")[2];
        },
        propertiesDesired: function(){
            return parent.getElementsByTagName("td")[3];
        }
    };

  // lists of the current selections and currently visible elements
    var lists = {
        desired: function (){
          // get all of the properties in the desired row
            return tableDivs.propertiesDesired().getElementsByTagName("tr");
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
        table.style = "width:100%;table-layout:fixed;";
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var tr, td;


      //Nodes
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;";

        tr.appendChild(td);


      //Properties
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;";

        tr.appendChild(td);


      //Buttons
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;";

        tr.appendChild(td);


      //Selected Properties
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;";
        
        tr.appendChild(td);



      //Append table to parent
        parent.appendChild(table);
        me.el = table;
    };

  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

    };

  //**************************************************************************
  //** update
  //**************************************************************************
    // this.update = function(config,nodes){
    this.update = function(nodes){

        me.clear();

        for (i in nodes){
          td = document.createElement("tr");
          tdDiv = document.createElement("div");

          tdDiv.innerHTML = `<strong>${nodes[i]["name"]}</strong>`;

          td.appendChild(tdDiv);
          td.onclick = function()
          {
            resetSelectedProperty();
            renderOptions(this,nodes);
          };

          tableDivs.nodes().appendChild(td);
        };
        
        // add 4 buttons
        // button to add a property to desired properties
        td = document.createElement("tr");
        var buttonAdd = document.createElement("button");
        buttonAdd.innerHTML = ">";
        buttonAdd.addEventListener("click", function(){
          addPropertyToDesired();
        });
        td.appendChild(buttonAdd);
        tableDivs.buttons().appendChild(td);

        // button to remove a property from desired properties
        td = document.createElement("tr");
        var buttonRemove = document.createElement("button");
        buttonRemove.innerHTML = "<";
        buttonRemove.addEventListener("click", function(){
          removePropertyFromDesired();
        });
        td.appendChild(buttonRemove);
        tableDivs.buttons().appendChild(td);

        // button to move a property up (to a higher priority) in desired properties
        td = document.createElement("tr");
        var buttonUp = document.createElement("button");
        buttonUp.innerHTML = "^";
        buttonUp.addEventListener("click", function(){
            movePropertyHigherPriority();
        });
        td.appendChild(buttonUp);
        tableDivs.buttons().appendChild(td);

        // button to move a property down (to a lower priority) in desired properties
        td = document.createElement("tr");
        var buttonDown = document.createElement("button");
        buttonDown.innerHTML = "V";
        td.appendChild(buttonDown);
        tableDivs.buttons().appendChild(td);

    };

  //**************************************************************************
  //** renderOptions
  //**************************************************************************
  /** code for rendering the options after the name is clicked
   */
    var renderOptions = function(td,nodes){
        var nodeName = td.innerText;
        setSelectedNode(nodeName);
        for (i in nodes){
            if (nodes[i]["name"] === nodeName ){

              // clear the properties div
                tableDivs.properties().innerHTML = "";
                for (p in nodes[i]["properties"]){
                    td = document.createElement("tr");
                    td.innerHTML = `<strong>${String(nodes[i]["properties"][p])}</strong>`;
                    
                  // add a "selected" option - show which item was last clicked
                    td.addEventListener("click", function(){
                    setSelectedProperty(this);
                    });

                    tableDivs.properties().appendChild(td);
                }
            break
            };
        };
    };

  //**************************************************************************
  //** addPropertyToDesired
  //**************************************************************************
  /** code for adding a td value to the selected table area
  */
    var addPropertyToDesired = function(){
        
        if (selected.available() !== undefined){
      
          // if this property isn't already added then add it
            for (let i = 0; i < (tableDivs.propertiesDesired().getElementsByTagName("tr")).length; i++) {

                if (tableDivs.propertiesDesired().getElementsByTagName("tr")[i].innerText === selected.available().innerText){
                // if this value does already exist, return early
                    return
                };
            };

          // if this value doesn't exist then add it
            td = document.createElement("tr");
            td.innerHTML = selected.available().innerHTML;
            td.addEventListener("click",function(){
            setSelectedPropertyDesired(this);
            });
            tableDivs.propertiesDesired().appendChild(td);



          // remove property from "available properties" (2) row (to show that this option is already selected)

            for (let i = 0; i < (tableDivs.properties().getElementsByTagName("tr")).length; i++) {

                if (tableDivs.properties().getElementsByTagName("tr")[i].innerText === selected.available().innerText){
                    tableDivs.properties().getElementsByTagName("tr")[i].remove();
                };
            };
        };
    };

  
  //**************************************************************************
  //** removePropertyFromDesired
  //**************************************************************************
  /** code for adding a td value to the selected table area
  */
    var removePropertyFromDesired = function(){
        if (selected.desired() !== undefined){


          // remove the property where it matches our current selected property
            for (let i = 0; i < (tableDivs.propertiesDesired().getElementsByTagName("tr")).length; i++) {

                if (tableDivs.propertiesDesired().getElementsByTagName("tr")[i].innerText === selected.desired().innerText ){

              // delete this property from the "desired properties" section;
                tableDivs.propertiesDesired().getElementsByTagName("tr")[i].remove();

              // add this property back to "available properties" , as an option
                td = document.createElement("tr");
                td.innerHTML = selected.desired().innerHTML;
                td.addEventListener("click",function(){
                    setSelectedProperty(this);
                });
                tableDivs.properties().appendChild(td);
        
                };
            };
        };
    };


  //**************************************************************************
  //** setSelectedProperty
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
  */
    var setSelectedProperty = function(td){
      // set the td as selected
        currentPropertySelected = td;
    };

  //**************************************************************************
  //** setSelectedNode
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
  */
    var setSelectedNode = function(td){
      // set the node td as selected
        currentNodeSelected = td;
  };


  //**************************************************************************
  //** resetSelectedProperty
  //**************************************************************************
  /** Use to reset the SelectedProperty when we move between different nodes
  */
    // consolidate this into the setSelectedProperty function later
    var resetSelectedProperty = function(){
        
      // resets for 1st row in table
        currentNodeSelected = undefined;

      // resets for 2nd row in table
        currentPropertySelected = undefined;
        tableDivs.properties().innerHTML = "";

      // resets for 4th row in table
        currentPropertySelectedDesired = undefined;
        tableDivs.propertiesDesired().innerHTML = "";
    };

  
  //**************************************************************************
  //** setSelectedPropertyDesired
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
  */
    var setSelectedPropertyDesired = function(td){
      // set the td as selected
        currentPropertySelectedDesired = td;
    };

  //**************************************************************************
  //** movePropertyHigherPriority
  //**************************************************************************
  /** Move this property to a higher priority on the list... or just move it up on the list.
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
                        // console.log("item matches");

                    // if theres an item above this item then we move it up one
                        if (lists.desired()[i-1] !== undefined){
                            console.log(lists.desired()[i-1]);
                          // move item up one.. switch positions with the item above it
                            lists.desired()[i].innerHTML = lists.desired()[i-1].innerHTML;
                        };
                    };
                }


            }

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