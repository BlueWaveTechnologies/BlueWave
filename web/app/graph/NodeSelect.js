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
    var defaultConfig = {
      margin: {
          top: 15,
          right: 5,
          bottom: 65,
          left: 82
      }
  };
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
        console.log("nodes passed in are ", nodes);
        var nodesDiv = parent.getElementsByTagName("td")[0];
        for (i in nodes){
          td = document.createElement("tr");
          tdDiv = document.createElement("div");

          tdDiv.innerHTML = `<strong>${nodes[i]["name"]}</strong>`;

          td.appendChild(tdDiv);
          td.onclick = function()
          {
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
          removePropertyToDesired();
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
      console.log("property to add is ");
      console.log(propertyToAdd.innerText);

      var propertiesSelectedDiv = parent.getElementsByTagName("td")[3];
     // button to move a property up (to a higher priority) in desired properties
      td = document.createElement("tr");
      td.innerHTML = propertyToAdd.innerHTML;
      td.addEventListener("click",function(){
        setSelectedPropertyDesired(this);
      });
      propertiesSelectedDiv.appendChild(td);

    };

  
  //**************************************************************************
  //** removePropertyFromDesired
  //**************************************************************************
  /** code for adding a td value to the selected table area
   */
   var removePropertyFromDesired = function(){
    propertyToRemove = getSelectedPropertyDesired();
    console.log("property to add is ");
    console.log(propertyToRemove.innerText);

    var propertiesSelectedDiv = parent.getElementsByTagName("td")[3];
   // button to move a property up (to a higher priority) in desired properties
    td = document.createElement("tr");
    td.innerHTML = propertyToRemove.innerHTML;
    propertiesSelectedDiv.appendChild(td);

  };



  //**************************************************************************
  //** setSelectedProperty
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
   */
    var setSelectedProperty = function(td){
      // set the td as selected
      console.log("currently selected property is ", td);
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
    currentSelected = "";
    // resets for 4th row in table
    currentSelectedDesired = "";
  }

  
  //**************************************************************************
  //** setSelectedPropertyDesired
  //**************************************************************************
  /** code for rendering the options after the name property name is selected
   */
   var setSelectedPropertyDesired = function(td){
    // set the td as selected
    console.log("currently selected property desired is ", td);
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