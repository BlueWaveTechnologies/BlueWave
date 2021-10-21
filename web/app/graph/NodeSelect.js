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
        // tbody.style = "width:33%"
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        // tr.style = "width:100%; table-layout: fixed;"
        var tr, td;

        /// remove the class names - we don't need them.
        // everything here references to itself.
        

      //Nodes
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"
        // td.className = "Nodes"
        // this is placeholder styling
        // td.style = "max-width:5%"
        tr.appendChild(td);


      //Properties
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"
        // td.className = "Properties"
        // this is placeholder styling
        // td.style = "width:10%"

        tr.appendChild(td);


      //Buttons
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"
        // td.className = "Buttons"
        // this is placeholder styling
        // td.style = "width:10%"

        tr.appendChild(td);


      //Selected Properties
        td = document.createElement("td");
        // add this to css file instead
        td.style = "overflow: hidden;text-overflow: ellipsis;white-space: nowrap;"
        // td.className = "selectedProperties"
        // this is placeholder styling
        // td.style = "width:10%"
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

        // for each name.. show the name in the nodes td
        // ourDiv = document.getElementsByTagName("td")[2]
        // console.log(ourDiv)
        // console.log(parent)
        // console.log(document.getElementsByTagName("td"))
        // console.log(parent.getElementsByTagName("td")[0])
        // console.log("nodes", nodes)
        var nodesDiv = parent.getElementsByTagName("td")[0];
        for (i in nodes){
          td = document.createElement("tr");
          // td.style = "width:100%"
          tdDiv = document.createElement("div");
          // tdDiv.className = "asdasdadad";
          // tdDiv.style = "overflow:hidden;white-space:nowrap";
          // tdDiv.style = "width:100%; overflow:hidden;";

          tdDiv.innerHTML = `<strong>${nodes[i]["name"]}</strong>`;

          td.appendChild(tdDiv);
          // td.style = "overflow: hidden; white-space: nowrap;";
          // td.innerText = `${nodes[i]["name"]}`;
          // td.innerHTML = `<strong>${nodes[i]["name"]}</strong>`;
          // td.style = "font-weight: 'bold'";
          // td.style = "border"
          // td.onclick = function(){console.log(`clicked node ${nodes[i]} `)};
          td.onclick = function()
          {
            renderOptions(this,nodes);
          };

          nodesDiv.appendChild(td);

        };
        

        var buttonsDiv = parent.getElementsByTagName("td")[2]

        var propertiesSelectedDiv = parent.getElementsByTagName("td")[3]

        // for each name make it so that when it is selected.. 
        // show in the properties window the properties that are available
        // add an onclick event


        // then work on the buttons and currently selected properties


    };
  //**************************************************************************
  //** renderOptions
  //**************************************************************************
  /** code for rendering the options after the name is clicked
   */
    var renderOptions = function(td,nodes){
      // console.log(`currently selected div is ${i} `)
      // console.log("current thing is ", td)
      // console.log(td.innerText)
      var nodeName = td.innerText;
      var nodesDiv = parent.getElementsByTagName("td")[0];
      // console.log(nodes)
      for (i in nodes){
        if (nodes[i]["name"] === nodeName ){
          // console.log("found it")
          console.log(nodes[i]["properties"]);
          var propertiesDiv = parent.getElementsByTagName("td")[1]
          // var propertiesToShow = nodes[i]["properties"];

          // clear the properties div
          propertiesDiv.innerHTML = "";

          for (p in nodes[i]["properties"]){
            td = document.createElement("tr");
            // td.innerText = `${nodes[i]["properties"][i]}`;
            td.innerHTML = `<strong>${String(nodes[i]["properties"][p])}</strong>`;
            propertiesDiv.appendChild(td);
          }
          break
        }

      }

      // console.log(propertiesToShow);
      // var propertiesDiv = parent.getElementsByTagName("td")[1]


    };

  //**************************************************************************
  //** Utilites
  //**************************************************************************
  /** Common functions found in Utils.js
   */
    var createTable = javaxt.dhtml.utils.createTable;


    init();
};