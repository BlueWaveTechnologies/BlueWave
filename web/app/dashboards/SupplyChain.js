if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  Supply Chain Dashboard
//******************************************************************************
/**
 *   Used to visualize supply global chains networks
 *
 ******************************************************************************/

bluewave.dashboards.SupplyChain = function(parent, config) {

    var me = this;
    var title = "Supply Chain Dashboard";
    var footer;
    var svg = {};
    var sankey;
    var pie1, pie2; //dashboard items
    var productOptions, monthOptions;
    var slider;
    var currProduct, currMonth; //strings
    var tooltip;
    var data = {};


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){


      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;


      //Create toolbar
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createToolbar(td);


      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        tr.appendChild(td);
        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.position = "relative";
        div.style.overflowY = "auto";
        td.appendChild(div);

        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        innerDiv.style.display = "inline-block";
        innerDiv.style.maxWidth = "1410px";
        div.appendChild(innerDiv);

        createSankey(innerDiv);

        pie1 = createDashboardItem(innerDiv, {
          width: 325,
          height: 300
        });

        pie2 = createDashboardItem(innerDiv, {
          width: 325,
          height: 300
        });


        tooltip = d3.select(div).append("div")
          .attr("class", "tooltip")
          .style("display", "none")
          .style("opacity", 0);
        tooltip.append("div").attr("class", "count");
        tooltip.append("div").attr("class", "percent");


      //Create footer
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createFooter(td);

        parent.appendChild(table);
        me.el = table;
    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
    this.onUpdate = function(){};


  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        return title;
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(productCode){
        if (!productCode) productCode = productOptions.getValue();
        if (!footer) return;
        footer.innerHTML = "";
        pie1.innerDiv.innerHTML = "";
        pie2.innerDiv.innerHTML = "";
        productOptions.clear();
        monthOptions.clear();
        data = {};



        getData("SupplyChainSankey", function(json){

          //Update data
            data = json;

          //Generate list of productTypes
            var productTypes = [];
            for (var type in json) {
                if (json.hasOwnProperty(type)){
                    productTypes.push(type);
                }
            }

          //Update combobox
            for (var i in productTypes){
                var productType = productTypes[i];
                productOptions.add(productType, productType);
            }
            if (i>0) productOptions.setValue(productTypes[0]);
        });
    };


  //**************************************************************************
  //** updateCharts
  //**************************************************************************
    var updateCharts = function(data){

        pie1.innerDiv.innerHTML = "";
        pie2.innerDiv.innerHTML = "";


      //Get groups
        var groups = {};
        for (var i=0; i<data.nodes.length; i++){
            var node = data.nodes[i];
            var arr = groups[node.group];
            if (arr==null){
                arr = [];
                groups[node.group] = arr;
            }
            arr.push(node.name);
        }


      //
        var getDataset = function(groupName, key){
            var ret = {};
            for (var i=0; i<data.links.length; i++){
                var link = data.links[i];
                var name = link[key];
                if (name){
                    var value = link.value;
                    var nodeNames = groups[groupName];
                    for (var j=0; j<nodeNames.length; j++){
                        if (nodeNames[j]===name){
                            var v = ret[name];
                            if (v==null) v = 0;
                            ret[name] = (v+value);
                            break;
                        }
                    }
                }
            }
            return ret;
        };

        var distributorData = getDataset("distributor","source");
        pie1.title.innerHTML = currProduct + " Volume By Distributor";
        pie1.subtitle.innerHTML = currMonth;
        updatePieChart(pie1.innerDiv, distributorData);

        var orderData = getDataset("barrier level","target");
        pie2.title.innerHTML = currProduct + " Volume By Barrier";
        pie2.subtitle.innerHTML = currMonth;
        updatePieChart(pie2.innerDiv, orderData);

        updateSankey(data); //<-- this alters the data object!
    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){

        var div = document.createElement("div");
        div.className = "dashboard-toolbar";
        parent.appendChild(div);


        var table = createTable();
        div.appendChild(table);
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;


        productOptions = createProductList(tr, config.style.combobox);
        productOptions.clear();
        productOptions.onChange = function(name, value){
            currProduct = value;
            title = value + " Supply Chain Dashboard";


            var arr = data[currProduct];

            monthOptions.clear();
            for (var i=0; i<arr.length; i++){
                monthOptions.add(arr[i].name, i);
            }

            slider.setAttribute("max", arr.length);
            slider.value = 1;
            slider.onchange();


            me.onUpdate();
        };


        td = document.createElement("td");
        td.style.paddingLeft = "15px";
        td.style.width = "55px";
        td.innerHTML = "Month:";
        tr.appendChild(td);
        td = document.createElement("td");
        td.style.width = "250px";
        tr.appendChild(td);
        monthOptions = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        monthOptions.onChange = function(name, value){
            currMonth = name;
            var arr = data[currProduct];
            for (var i in arr){
                var entry = arr[i];
                if (entry.name===currMonth){
                    var json = JSON.parse(JSON.stringify(entry.data));
                    updateCharts(json);
                    updateFooter(entry);
                    break;
                }
            }
        };


        td = document.createElement("td");
        tr.appendChild(td);
        slider = document.createElement("input");
        slider.type = "range";
        slider.className = "dashboard-slider";
        slider.style.maxWidth = "500px";
        slider.style.marginLeft = "25px";
        slider.setAttribute("min", 1);
        slider.setAttribute("max", 3);
        slider.value = 1;
        slider.onchange = function(){
            var val = this.value-1;
            monthOptions.setValue(val);
        };
        td.appendChild(slider);
    };


  //**************************************************************************
  //** createSankey
  //**************************************************************************
    var createSankey = function(parent){
        var width = 1000;
        var height = 642;
        var margin = { top: 10, right: 10, bottom: 10, left: 10 };


        var div = document.createElement("div");
        div.className = "dashboard-item";
        parent.appendChild(div);


        svg.sankey = d3
        .select(div)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


      //Update width and height for the sankey
        width = width - margin.left - margin.right,
        height = height - margin.top - margin.bottom;

        sankey = d3
          .sankey()
          .nodeId((d) => d.name)
          .nodeWidth(20)
          .nodePadding(20)
          .iterations([6])
          .size([width, height]);
    };


  //**************************************************************************
  //** updateSankey
  //**************************************************************************
    var updateSankey = function(data){

        svg.sankey.selectAll("*").remove();

        let graph = sankey(data);
        var size = sankey.size();
        var width = size[0];

        var formatNumber = d3.format(",.0f"); // zero decimal places
        //var getColor = d3.scaleOrdinal(d3.schemeCategory10);


      //Add the nodes
        var node = svg.sankey
          .append("g")
          .selectAll(".node")
          .data(graph.nodes)
          .enter()
          .append("g")
          .attr("class", "sankey-node");


      //Add the rectangles for the nodes
        node
          .append("rect")
          .attr("x", function (d) {
            return d.x0;
          })
          .attr("y", function (d) {
            return d.y0;
          })
          .attr("height", function (d) {
            return d.y1 - d.y0;
          })
          .attr("width", sankey.nodeWidth())
          .style("fill", function (d) {
            return (d.color = getColor(d.name.replace(/ .*/, "")));
          })
          .style("stroke", function (d) {
            return d3.rgb(d.color).darker(2);
          })
          .append("title")
          .text(function (d) {
            return d.name + "\n" + formatNumber(d.value);
          });




      //Add the links
        var link = svg.sankey
          .append("g")
          .selectAll(".link")
          .data(graph.links)
          .enter()
          .append("path")
          .attr("class", "sankey-link")
          .attr("d", d3.sankeyLinkHorizontal())
          .attr("stroke-width", function (d) {
            return d.width;
          })
          .style("stroke-opacity", function (d) {
            if ("meta" in d) {
              const opacity = d.meta=="unfilled"? 0.15:0.45;
              return (d.opacity=opacity);
            } else {
              return (d.opacity=0.3);
            }
          })
          .style("stroke", function (d) {
            return d.source.color;
          })
          .on('mouseover', function(d){
            d3.select(this).style("stroke-opacity", 0.6);
          })
          .on('mouseout', function(d){
            d3.select(this).style("stroke-opacity", d.opacity);
          });



      //Add link labels
        link.append("title").text(function (d) {
          return d.source.name + " → " + d.target.name + "\n" + formatNumber(d.value);
        });



      //Add node labels
        node
          .append("text")
          .attr("x", function (d) {
            return d.x0 - 6;
          })
          .attr("y", function (d) {
            return (d.y1 + d.y0) / 2;
          })
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .text(function (d) {
            return d.name;
          })
          .filter(function (d) {
            return d.x0 < width / 2;
          })
          .attr("x", function (d) {
            return d.x1 + 6;
          })
          .attr("text-anchor", "start");
    };


  //**************************************************************************
  //** numberWithCommas
  //**************************************************************************
    const numberWithCommas = (x) => {
      return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };


  //**************************************************************************
  //** updatePieChart
  //**************************************************************************
    const updatePieChart = (parent, data) => {
      // set the dimensions and margins of the graph
      var margin = { top: 0, right: 0, bottom: 0, left: 0 },
        width = 650 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

      // The radius of the pieplot is half the width or half the height (smallest one). I subtract a bit of margin.
      var radius = Math.min(width, height) / 2 - margin.left - margin.right;

      // append the svg object
      var svg = d3
        .select(parent)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + width / 4 + "," + height / 2 + ")");

      // Compute the position of each group on the pie:
      var pie = d3
        .pie()
        .sort(null) // Do not sort group by size
        .value(function (d) {
          return d.value;
        });
      var data_ready = pie(d3.entries(data));

      // The arc generator
      var arc = d3
        .arc()
        .innerRadius(radius * 0.5) // This is the size of the donut hole
        .outerRadius(radius * 0.8);

      // Another arc that won't be drawn. Just for labels positioning
      var outerArc = d3
        .arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);

      // Build the pie chart: Basically, each part of the pie is a path that we build using the arc function.
      var path = svg
        .selectAll("allSlices")
        .data(data_ready)
        .enter()
        .append("path")
        .attr("d", arc)
        .attr("fill", function (d) {
          return getColor(d.data.key);
        })
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .style("opacity", 0.7);
      // .attr('transform', 'translate(0, 0)')
      //Our new hover effects



      path.on("mouseover", function (d) {
        let sum = 0;
        data_ready.map((cur) => {
          sum += cur.value;
        });

        var percent = Math.round((1000 * d.data.value) / sum) / 10;

        tooltip.select(".percent").html(percent + "%");
        tooltip.select(".count").html(numberWithCommas(d.data.value));
        tooltip.style("display", "block");
        tooltip.style("opacity", 2);
      });

      path.on("mousemove", function (d) {
        tooltip
          .style("top", event.pageY - 128 + "px")
          .style("left", event.pageX + 12 + "px");
      });

      path.on("mouseout", function () {
        tooltip.style("display", "none");
        tooltip.style("opacity", 0);
      });

      // Add the polylines between chart and labels:
      let cPositions = [];
      svg
        .selectAll("allPolylines")
        .data(data_ready)
        .enter()
        .append("polyline")
        .attr("stroke", "black")
        .style("fill", "none")
        .attr("stroke-width", 1)
        .attr("points", function (d) {
          var posA = arc.centroid(d); // line insertion in the slice
          var posB = outerArc.centroid(d); // line break: we use the other arc generator that has been built only for that
          var posC = outerArc.centroid(d); // Label position = almost the same as posB
          cPositions.forEach((val) => {
            if (posC[1] < val + 5 && posC[1] > val - 5) {
              posC[1] -= 14;
              posB[1] -= 14;
            }
          });
          cPositions.push(posC[1]);
          var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2; // we need the angle to see if the X position will be at the extreme right or extreme left
          posC[0] = radius * 0.95 * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left
          return [posA, posB, posC];
        });

      // Add the polylines between chart and labels:
      var positions = [];
      svg
        .selectAll("allLabels")
        .data(data_ready)
        .enter()
        .append("text")
        .text(function (d) {
          return d.data.key;
        })
        .attr("transform", function (d) {
          var pos = outerArc.centroid(d);
          positions.forEach((val) => {
            if (pos[1] < val + 5 && pos[1] > val - 5) {
              pos[1] -= 14;
            }
          });
          positions.push(pos[1]);

          var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          pos[0] = radius * 0.99 * (midangle < Math.PI ? 1 : -1);
          return "translate(" + pos + ")";
        })
        .style("text-anchor", function (d) {
          var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
          return midangle < Math.PI ? "start" : "end";
        });
    };


  //**************************************************************************
  //** createFooter
  //**************************************************************************
    var createFooter = function(parent){
        var div = document.createElement("div");
        div.className = "dashboard-footer";
        div.style.textAlign = "left";
        div.style.position = "absolute";
        div.style.bottom = 0;
        div.style.width = "100%";
        parent.appendChild(div);

        footer = div;
    };


  //**************************************************************************
  //** updateFooter
  //**************************************************************************
    var updateFooter = function(data){
        footer.innerHTML = "";
        footer.style.bottom = 0;
        var notes = data.notes;
        if (notes){
            notes += "";
            if (notes.length>0){
                var div = document.createElement("div");
                div.innerHTML = "NOTES: " + notes;
                footer.appendChild(div);
            }
        }
        var sources = data.sources;
        if (sources){
            sources += "";
            if (sources.length>0){
                var div = document.createElement("div");
                div.innerHTML = "SOURCE: " + sources;
                footer.appendChild(div);
            }
        }
        //footer.style.bottom = javaxt.dhtml.utils.getRect(footer).height;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createProductList = bluewave.utils.createProductList;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());
    var getData = bluewave.utils.getData;

    init();

};