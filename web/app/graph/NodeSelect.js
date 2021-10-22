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
    }

 
  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        if (!config) config = {};


      //Create table with 5 columns
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
        propertyToAdd = getSelectedProperty();

        if (propertyToAdd !== undefined){
      
          // if this property isn't already added then add it
            for (let i = 0; i < (tableDivs.propertiesDesired().getElementsByTagName("tr")).length; i++) {

                if (tableDivs.propertiesDesired().getElementsByTagName("tr")[i].innerText === propertyToAdd.innerText){
                // if this value does already exist, return early
                    return
                };
            };

          // if this value doesn't exist then add it
            td = document.createElement("tr");
            td.innerHTML = propertyToAdd.innerHTML;
            td.addEventListener("click",function(){
            setSelectedPropertyDesired(this);
            });
            tableDivs.propertiesDesired().appendChild(td);



          // remove property from "available properties" (2) row (to show that this option is already selected)

            for (let i = 0; i < (tableDivs.properties().getElementsByTagName("tr")).length; i++) {

                if (tableDivs.properties().getElementsByTagName("tr")[i].innerText === propertyToAdd.innerText){
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
        propertyToRemove = getSelectedPropertyDesired();
        if (propertyToRemove !== undefined){


          // remove the property where it matches our current selected property
            for (let i = 0; i < (tableDivs.propertiesDesired().getElementsByTagName("tr")).length; i++) {

                if (tableDivs.propertiesDesired().getElementsByTagName("tr")[i].innerText === propertyToRemove.innerText ){

              // delete this property from the "desired properties" section;
                tableDivs.propertiesDesired().getElementsByTagName("tr")[i].remove();

              // add this property back to "available properties" , as an option
                td = document.createElement("tr");
                td.innerHTML = propertyToRemove.innerHTML;
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
        currentSelected = td;
    };


  //**************************************************************************
  //** getSelectedProperty
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
  */
    var getSelectedProperty = function(){
      // get the currently selected td
        return currentSelected;
    };


  //**************************************************************************
  //** resetSelectedProperty
  //**************************************************************************
  /** Use to reset the SelectedProperty when we move between different nodes
  */
    // consolidate this into the setSelectedProperty function later
    var resetSelectedProperty = function(){
      // resets for 2nd row in table
        currentSelected = undefined;
        tableDivs.properties().innerHTML = "";

      // resets for 4th row in table
        currentSelectedDesired = undefined;
        tableDivs.propertiesDesired().innerHTML = "";
        
    };

  
  //**************************************************************************
  //** setSelectedPropertyDesired
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
  */
    var setSelectedPropertyDesired = function(td){
      // set the td as selected
        currentSelectedDesired = td;
    };


  //**************************************************************************
  //** getSelectedPropertyDesired
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
  */
    var getSelectedPropertyDesired = function(){
      // get the currently selected td
        return currentSelectedDesired;
    };


  //**************************************************************************
  //** Utilites
  //**************************************************************************
  /** Common functions found in Utils.js
  */
    var createTable = javaxt.dhtml.utils.createTable;


    init();
};