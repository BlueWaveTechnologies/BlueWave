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
  
  
  // var propertiesDiv = undefined;
  // var propertiesSelectedDiv = undefined;
  // var nodesDiv = undefined;
  // var buttonsDiv = undefined;
  
  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Parse config
        if (!config) config = {};


      //Create table with 5 columns
        var table = createTable();
        table.style = "width:100%;table-layout:fixed;"
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var tr, td;


      //Nodes
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"

        tr.appendChild(td);


      //Properties
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"

        tr.appendChild(td);


      //Buttons
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"

        tr.appendChild(td);


      //Selected Properties
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"
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


        /// theres more to add here
        var nodesDiv = parent.getElementsByTagName("td")[0];
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

          nodesDiv.appendChild(td);
        };
        
        var buttonsDiv = parent.getElementsByTagName("td")[2]

        // add 4 buttons
        // button to add a property to desired properties
        td = document.createElement("tr");
        var buttonAdd = document.createElement("button");
        buttonAdd.innerHTML = ">";
        buttonAdd.addEventListener("click", function(){
          addPropertyToDesired();
        });
        td.appendChild(buttonAdd);
        buttonsDiv.appendChild(td);

        // button to remove a property from desired properties
        td = document.createElement("tr");
        var buttonRemove = document.createElement("button");
        buttonRemove.innerHTML = "<";
        buttonRemove.addEventListener("click", function(){
          removePropertyFromDesired();
        });
        td.appendChild(buttonRemove);
        buttonsDiv.appendChild(td);

        // button to move a property up (to a higher priority) in desired properties
        td = document.createElement("tr");
        var buttonUp = document.createElement("button");
        buttonUp.innerHTML = "^";
        td.appendChild(buttonUp);
        buttonsDiv.appendChild(td);

        // button to move a property down (to a lower priority) in desired properties
        td = document.createElement("tr");
        var buttonDown = document.createElement("button");
        buttonDown.innerHTML = "V";
        td.appendChild(buttonDown);
        buttonsDiv.appendChild(td);

        var propertiesSelectedDiv = parent.getElementsByTagName("td")[3];

    };
  //**************************************************************************
  //** renderOptions
  //**************************************************************************
  /** code for rendering the options after the name is clicked
   */
    var renderOptions = function(td,nodes){
      var nodeName = td.innerText;
      var nodesDiv = parent.getElementsByTagName("td")[0];
      for (i in nodes){
        if (nodes[i]["name"] === nodeName ){
          console.log(nodes[i]["properties"]);
          var propertiesDiv = parent.getElementsByTagName("td")[1]

          // clear the properties div
          propertiesDiv.innerHTML = "";

          for (p in nodes[i]["properties"]){
            td = document.createElement("tr");
            td.innerHTML = `<strong>${String(nodes[i]["properties"][p])}</strong>`;
            
            // add a "selected" option - show which item was last clicked
            td.addEventListener("click", function(){
              setSelectedProperty(this);
            });


            propertiesDiv.appendChild(td);

          }
          break
        }

      }


    };

  //**************************************************************************
  //** addPropertyToDesired
  //**************************************************************************
  /** code for adding a td value to the selected table area
   */
    var addPropertyToDesired = function(){
      propertyToAdd = getSelectedProperty();

      if (propertyToAdd !== undefined){
        var propertiesSelectedDiv = parent.getElementsByTagName("td")[3];
      
      // if this property isn't already added then add it
        for (let i = 0; i < (propertiesSelectedDiv.getElementsByTagName("tr")).length; i++) {

          if (propertiesSelectedDiv.getElementsByTagName("tr")[i].innerText === propertyToAdd.innerText){
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
        propertiesSelectedDiv.appendChild(td);



        // remove property from "available properties" (2) row (to show that this option is already selected)
        var propertiesDiv = parent.getElementsByTagName("td")[1];

        for (let i = 0; i < (propertiesDiv.getElementsByTagName("tr")).length; i++) {

          if (propertiesDiv.getElementsByTagName("tr")[i].innerText === propertyToAdd.innerText){
            propertiesDiv.getElementsByTagName("tr")[i].remove();
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

      var propertiesSelectedDiv = parent.getElementsByTagName("td")[3];


    // remove the property where it matches our current selected property
      for (let i = 0; i < (propertiesSelectedDiv.getElementsByTagName("tr")).length; i++) {

        if (propertiesSelectedDiv.getElementsByTagName("tr")[i].innerText === propertyToRemove.innerText ){

          // delete this property from the "desired properties" section;
          propertiesSelectedDiv.getElementsByTagName("tr")[i].remove()

         // add this property back to "available properties" , as an option
          var propertiesDiv = parent.getElementsByTagName("td")[1];

          td = document.createElement("tr");
          td.innerHTML = propertyToRemove.innerHTML;
          td.addEventListener("click",function(){
            setSelectedProperty(this);
          });
          propertiesDiv.appendChild(td);
  
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
      // console.log("currently selected property is ", td.innerText);
      currentSelected = td;
    }


  //**************************************************************************
  //** getSelectedProperty
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
   */
   var getSelectedProperty = function(){
    // get the currently selected td
    return currentSelected;
  }


  //**************************************************************************
  //** resetSelectedProperty
  //**************************************************************************
  /** Use to reset the SelectedProperty when we move between different nodes
   */
  // consolidate this into the setSelectedProperty function later
  var resetSelectedProperty = function(){
    // resets for 2nd row in table
    currentSelected = undefined;
    parent.getElementsByTagName("td")[1].innerHTML = "";

    // resets for 4th row in table
    currentSelectedDesired = undefined;
    parent.getElementsByTagName("td")[3].innerHTML = "";


  }

  
  //**************************************************************************
  //** setSelectedPropertyDesired
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
   */
   var setSelectedPropertyDesired = function(td){
    // set the td as selected
    // console.log("currently selected property desired is ", td.innerText);
    currentSelectedDesired = td;
  }


  //**************************************************************************
  //** getSelectedPropertyDesired
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
   */
  var getSelectedPropertyDesired = function(){
    // get the currently selected td
    return currentSelectedDesired;
  }


  //**************************************************************************
  //** Utilites
  //**************************************************************************
  /** Common functions found in Utils.js
   */
    var createTable = javaxt.dhtml.utils.createTable;


    init();
};