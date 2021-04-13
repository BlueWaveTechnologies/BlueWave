if (!bluewave) var bluewave = {};
if (!bluewave.dashboards) bluewave.dashboards = {};

//******************************************************************************
//**  ProductPurchases Dashboard
//******************************************************************************
/**
 *   Used to visualize product purchases by region
 *
 ******************************************************************************/

bluewave.dashboards.ProductPurchases = function (parent, config) {
  var me = this;
  var title = "Product Purchases By Region";
  var monthOptions;
  var slider;
  var treemap, pieChart, lineGraph; //dashboard items
  var grid;
  var linechartTooltip, linechartTooltipLine;
  var allData = {};

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function () {


      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        parent.appendChild(table);
        me.el = table;
        var tr, td;


      //Create toolbar
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        tr.appendChild(td);
        createToolbar(td);


      //Create body
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);



        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";
        td.appendChild(div);

        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        innerDiv.style.display = "inline-block";
        innerDiv.style.maxWidth = "1685px";
        div.appendChild(innerDiv);


        treemap = createDashboardItem(innerDiv, {
          width: 1200,
          height: 800
        });

        pieChart = createDashboardItem(innerDiv, {
          width: 400,
          height: 379,
          title: "Sales Volume By Region"
        });

        lineGraph = createDashboardItem(innerDiv, {
          width: 400,
          height: 379,
          title: "Total Purchases Per Month"
        });
        createLinechartTooltip(parent);

        createGrid(innerDiv);
    };

  //**************************************************************************
  //** getTitle
  //**************************************************************************
  this.getTitle = function () {
    return title;
  };

  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function () {
        monthOptions.clear();

        getData("ProductPurchases", function (data) {

          //Parse csv
            var rows = parseCSV(data.csv);


          //Create data for the treemap
            let monthKeys = [];
            var months = {};
            for (var i = 1; i < rows.length; i++) {
              var col = rows[i];
              var region = formatRegion(col[0]);
              if(region ==="Aggregated"){
                continue;
              }
              var period = col[1];
              var year = period.substring(0, 4);
              var month = period.substring(5);
              var key = year + "-" + month;

              if (!months[key]) {
                months[key] = {};
              }
              var arr = months[key][region];

              if (!arr) {
                arr = [];
                months[key][region] = arr;
              }

              var productDesc = col[3];
              if (productDesc !== null && productDesc !== "") {
                arr.push(col);
              }
            }
            let prices = {};
            for (let key in months) {
              monthKeys.push(key);
              let newPrices = {};
              for (let region in months[key]) {
                let totalRegionValue = 0;
                months[key][region] = months[key][region].map((val) => {
                  let thisPrice = parseInt(val[4].replace(/[,$]/g, ""), 10);
                  totalRegionValue += thisPrice;
                  if (prices[region + val[3]]) {
                    let pastPrice = parseInt(
                      prices[region + val[3]].replace(/[,$]/g, ""),
                      10
                    );
                    let percentage = (1 - thisPrice / pastPrice) * 100;
                    val.push(percentage);
                  } else {
                    val.push(0);
                  }
                  newPrices[region + val[3]] = val[4];
                  return {
                    region: formatRegion(val[0]),
                    name: val[3] || "delete",
                    landedSpend: thisPrice,
                    change: val[5],
                  };
                });
                months[key][region]["totalValue"] = totalRegionValue;
              }
              prices = { ...newPrices };
            }
            allData = months;



          //Create a sorted list of unique months
            monthKeys = [...new Set(monthKeys)];
            monthKeys.sort(function(a,b){
                a = parseInt(a.split("-").join(""));
                b = parseInt(b.split("-").join(""));
                return b-a;
            });


          //Update slider
            slider.setAttribute("max", monthKeys.length);


          //Update combobox
            for (var i = 0; i < monthKeys.length; i++) {
                monthOptions.add(monthKeys[i], i);
            }
            var lastPeriod = "2020-11";
            monthOptions.setValue(lastPeriod);


          //Update lineGraph
            var startDate = monthKeys[0];
            var endDate = monthKeys[monthKeys.length - 1];
            lineGraph.subtitle.innerHTML = formatDate(startDate) + " - " + formatDate(endDate);
            updateLineGraph(rows);
        });
    };


  //**************************************************************************
  //** updateCharts
  //**************************************************************************
    var updateCharts = function (month) {
        pieChart.subtitle.innerHTML = formatDate(month);
        let data = getMontlyData(month);
        createTreemap(data);
        updatePieChart(data);
        updateGrid(data);
    };


  //**************************************************************************
  //** Get Montly Data
  //**************************************************************************
  var getMontlyData = function (month) {
    const treeMapData = [];

    for (let region in allData[month]) {
      if (
        allData[month][region].length !== 0 &&
        region !== "AGGREGATED TO FACILITY PRIMARY SERVICE TYPE"
      ) {
        let data = {
          name: region,
          children: allData[month][region],
          totalValue: allData[month][region]["totalValue"],
        };
        treeMapData.push(data);
      }
    }
    return { children: treeMapData };
  };


  //**************************************************************************
  //** createGrid
  //**************************************************************************
    var createGrid = function(parent){
        var div = document.createElement("div");
        div.className = "dashboard-item";
        div.style.width = "100%";
        div.style.height = "400px";
        div.style.padding = "0px";
        div.style.maxWidth = "1664px";
        parent.appendChild(div);

        grid = new javaxt.dhtml.Table(div, {
            style: javaxt.dhtml.style.default.table,
            columns: [
                {header: 'Name', width:'100%'},
                {header: 'Region', width:'150'},
                {header: 'Total Sales', width:'150', align:"right"},
                {header: 'Weekly Change', width:'150', align:"center"}
            ]
        });
    };


  //**************************************************************************
  //** updateGrid
  //**************************************************************************
    var updateGrid = function(data){
        grid.clear();
        if (data.children.length === 0) return;
        setTimeout(function(){
            var rows = [];
            for (var i in data.children) {
                var region = data.children[i];
                for (var j in region.children) {
                    var d = region.children[j];
                    rows.push([d.name,d.region,d.landedSpend,d.change]);
                }
            }

            rows.sort(function(a,b){
                a = a[2];
                b = b[2];
                if (isNaN(a)) a = 0;
                if (isNaN(b)) b = 0;
                return b-a;
            });



            var rows = rows.slice(0,50);
            for (var i in rows){
                var change = rows[i][3];
                var str = Math.round(change)+"%";
                if (change>0){
                    change = '<div style="color:#00ab37"><i class="fas fa-arrow-up" style="margin-right:5px"></i>' + str + "</div>";
                }
                else if (change<0){
                    change = '<div style="color:#FF3C38"><i class="fas fa-arrow-down" style="margin-right:5px"></i>' + str + "</div>";
                }
                else{
                    change = "-";
                }
                rows[i][3] = change;

                rows[i][2] =  "$" + formatNumber(rows[i][2]+"");
            }

            grid.addRows(rows);

        }, 1500);
    };


  //**************************************************************************
  //** numberWithCommas
  //**************************************************************************
    const formatNumber = (x) => {
      return x.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };


  //**************************************************************************
  //** createTreemap
  //**************************************************************************
  var createTreemap = function (data) {
    if (data.children.length === 0) return;
    treemap.innerDiv.innerHTML = "";

    var margin = { top: 0, right: 5, bottom: 0, left: 5 },
      width = treemap.innerDiv.offsetWidth - margin.left - margin.right,
      height = treemap.innerDiv.offsetHeight - margin.top - margin.bottom;

    var breaks = {};
    for (var i in data.children) {
      var region = data.children[i];
      var name = region.name;
      var negativeValues = [];
      var positiveValues = [];
      for (var j in region.children) {
        var change = region.children[j].change;
        if (change < 0) {
          negativeValues.push(change);
        } else if (change > 0) {
          positiveValues.push(change);
        }
      }
      breaks[name] = {};
      breaks[name].negative = getNaturalBreaks(negativeValues, 3);
      breaks[name].positive = getNaturalBreaks(positiveValues, 3);
    }

    var root = d3.hierarchy(data).sum(function (d) {
      return d.landedSpend;
    });

    let d3Treemap = d3
      .treemap()
      .size([width, height])
      .paddingTop(14)
      .paddingRight(3)
      .paddingInner(2)(root);

    //d3.select("svg").remove();

    var svg = d3
      .select(treemap.innerDiv)
      .append("svg")
      .style("font-family", "sans-serif")
      .style("margin-top", "-12px")
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g").attr("class", "treemap-container");

    // Place the labels for our countries
    g.selectAll("text.region")
      // The data is the first "generation" of children
      .data(root.children)
      .join("text")
      .attr("class", "chart-title")
      // The rest is just placement/styling
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("dy", "0.75em")
      .attr("dx", 0)
      .text((d) => {
        var region = d.data.name;
        // region = region.substring(0, region.indexOf(" "));
        // region = region.substring(0, 1) + region.substring(1).toLowerCase();
        return region;
      });

    // Now, we place the groups for all of the leaf nodes
    const leaf = g
      .selectAll("g.leaf")
      // root.leaves() returns all of the leaf nodes
      .data(root.leaves())
      .join("g")
      .attr("class", "leaf")
      // position each group at the top left corner of the rect
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    // A title element tells the browser to display its text value
    leaf
      .append("title")
      .text(
        (d) =>
          `${d.parent.data.name}-${d.data.name}\n${d.value.toLocaleString()}`
      );

    leaf
      .append("rect")
      .attr("fill", function (d) {
        var name = d.data.region;
        var change = d.data.change;

        if (change < 0) {
          var negativeBreaks = breaks[name].negative;
          return getColor2(change, ["#f63538", "#f6f8f5"], negativeBreaks);
        } else if (change > 0) {
          var positiveBreaks = breaks[name].positive;
          return getColor(change, ["#30cc5a", "#f6f8f5"], positiveBreaks);
        } else {
          return "#f6f8f5";
        }
      })
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0);

    // This next section checks the width and height of each rectangle
    // If it's big enough, it places labels. If not, it doesn't.
    leaf.each((d, i, arr) => {
      // The current leaf element
      const current = arr[i];

      const left = d.x0,
        right = d.x1,
        // calculate its width from the data
        width = right - left,
        top = d.y0,
        bottom = d.y1,
        // calculate its height from the data
        height = d.y1 - d.y0;

      let letterHeight = 25;
      let str = d.data.name;
      let textWidth = 6;

      let letterWidth = str.length * textWidth;

      var fontSize = 8; //9
      if (width > 65) fontSize = 10; //11
      if (width > 120) fontSize = 12; //14

      var textHeight = 9;
      if (fontSize == 10) textHeight = 11;
      if (fontSize == 12) textHeight = 14;

      var fontColor = "#2b2b2b";
      var change = d.data.change;
      if (change < 0) {
        var name = d.data.region;
        var negativeBreaks = breaks[name].negative;
        if (change < negativeBreaks[2]) {
          fontColor = "#dcdcdc";
        }
      }

      // Short cut out of this if the width or height is too small.
      // This saves us from the heavier appending and string manipulation below

      //if (width < 20 || (letterWidth / width) * letterHeight > height) return;

      if (width < letterWidth) {
        let chunks = [];
        chunks = splitText(str, width / textWidth);
        if (chunks.length > 2) {
          chunks = chunks.slice(0, 2);
          var lastChunk = chunks[1];
          if (lastChunk === "or") {
            chunks = [chunks[0] + "..."];
          } else {
            chunks[1] = chunks[1] + "...";
          }
        }

        var numRows = chunks.length + 2;
        if (numRows * textHeight > height) {
          fontSize = fontSize - 2;
        }

        letterWidth = Math.max(...chunks.map((el) => el.length)) * textWidth;
        d.data["formattedName"] = chunks;
        letterHeight = (chunks.length + 2) * textHeight;
      } else {
        d.data["formattedName"] = [str];
      }

      // too small to show text
      var tooSmall = width < letterWidth || height < letterHeight;
      tooSmall = false;

      const text = d3
        .select(current)
        .append("text")
        // If it's too small, don't show the text
        .attr("opacity", tooSmall ? 0 : 0.9)
        .style("font-size", fontSize + "px")
        .style("fill", fontColor)
        .selectAll("tspan")
        .data((d) => {
          return [
            ...d.data.formattedName,
            "$"+d.value.toLocaleString(),
            Math.round(d.data.change, 2) + "%",
          ];
        })
        .join("tspan")
        .attr("x", 3)
        .attr("y", (d, i) => {
          let offset = i + 1;

          return fontSize < 10 ? `${offset}.0em` : `${offset}.5em`;
        })
        .text((d) => {
          return d;
        });
    });
  };

  //**************************************************************************
  //** Colors for line and pie
  //**************************************************************************






    var colorRange = chroma.scale(["#98DFAF", "#FFB586"]);


  //**************************************************************************
  //** updateLineGraph
  //**************************************************************************
  var updateLineGraph = function (rows) {
      var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette(true));


      //Create data for the line graph
        var data = [];
        const accumulator = {};
        for (var i = rows.length - 1; i >= 1; i--) {
          var reg = rows[i][0];
          if (reg !== "AGGREGATED TO FACILITY PRIMARY SERVICE TYPE") {
            reg = reg.split(' ')[0].toLowerCase();
            reg = reg.charAt(0).toUpperCase() + reg.slice(1);

            const month = rows[i][1];
            const valStr = rows[i][4];
            const val = Number(valStr.replace(/[^0-9.-]+/g, ""));
            if (!(month in accumulator)) {
              accumulator[month] = {};
            }
            if (!(reg in accumulator[month])) {
              accumulator[month][reg] = 0;
            }
            accumulator[month][reg] = accumulator[month][reg] + val;
          }
        }

        for (month in accumulator) {
          const y = Number(month.slice(0, 4));
          const m = Number(month.slice(-2));
          const monthDate = new Date(y, m);
          var regions = accumulator[month];
          if (Object.keys(regions).length<4) break;
          for (var region in regions) {
            data.push({
              date: monthDate,
              type: region,
              value: accumulator[month][region]
            });
          }
        }



    var useLogScale = false;

    // Select the inner div which will contain the d3, and clear it
    var innerDiv = lineGraph.innerDiv;
    innerDiv.innerHTML = "";


    //Set the dimensions and margins of the graph
    var margin = { top: 2, right: 60, bottom: 50, left: 40 },
      width = innerDiv.offsetWidth - margin.left - margin.right,
      height = innerDiv.offsetHeight - margin.top - margin.bottom;

    //set the ranges
    var x = d3.scaleTime().range([0, width]);
    var yScale = useLogScale ? d3.scaleLog() : d3.scaleLinear();
    var y = yScale.range([height, 0]);

    //create svg
    var svg = d3
      .select(innerDiv)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //Group the data by line type
    var types = {};
    data.forEach(function (d) {
      var arr = types[d.type];
      if (!arr) {
        arr = [];
        types[d.type] = arr;
      }
      arr.push(d);
    });
    data = [];

    //Create lines for each type
    var lines = {};
    for (var type in types) {
      if (types.hasOwnProperty(type)) {
        //Sort data for each type by date
        var arr = types[type];
        arr.sort((a, b) => (a.date > b.date ? 1 : -1));

        //Create line function for the type
        lines[type] = d3
          .line()
          .defined(function (d) {
            return !isNaN(d.value);
          })
          .x(function (d) {
            return x(d.date);
          })
          .y(function (d) {
            return useLogScale ? y(d.value + 1) : y(d.value);
          });

        //Update data
        data.push(...arr);
      }
    }

    //format the data
    var minY = useLogScale ? 1e12 : 100;
    var maxY = useLogScale ? -1e12 : -100;
    data.forEach(function (d) {
      minY = isNaN(d.value) ? minY : Math.min(minY, d.value);
      maxY = isNaN(d.value) ? maxY : Math.max(maxY, d.value);
    });
    if (minY == maxY) {
      maxY = minY + 1;
    }
    if (useLogScale) {
      minY = Math.pow(10, Math.floor(Math.log10(minY + 1)));
      maxY = Math.pow(10, Math.ceil(Math.log10(maxY)));
    }

    //Scale the range of the data
    x.domain(
      d3.extent(data, function (d) {
        return d.date;
      })
    );
    if (useLogScale) {
      y.domain([minY, maxY]);
    } else {
      y.domain([minY, maxY]);
    }

    //Add y-axis
    svg
      .append("g")
      .attr("class", "axis")
      .call(
        useLogScale
          ? d3
              .axisLeft(y)
              .ticks(5, ",")
              .tickFormat((d) => "$" + d3.format("~s")(d).replace("G", "B"))
          : d3
              .axisLeft(y)
              .ticks(5)
              .tickFormat((d) => "$" + d3.format("~s")(d).replace("G", "B"))
      );

    //add the X gridlines
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x).ticks().tickSize(-height).tickFormat(""));

    //add the Y gridlines
    svg
      .append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""));

    //Add x-axis
    const allMonths = Object.values(types)
      .map((arr) => arr.map((d) => d.date))
      .flat();
    const allUniqueMonths = getUniqueDates(allMonths);
    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + height + ")")
      .call(
        d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%m/%y"))
        // .tickValues(allUniqueMonths)
      );

    //Create rectangle over the grid to watch for mouse events.
    //Note that this is significantly faster than monitoring the svg node!
    var d = clone(data);
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("opacity", 0)
      .on("mousemove", function () {
        drawLinechartTooltip(this, x, d);
      })
      .on("mouseout", function () {
        if (linechartTooltip) linechartTooltip.style("display", "none");
        if (linechartTooltipLine) linechartTooltipLine.attr("stroke", "none");
      });

    //Add vertical line for the tooltip
    linechartTooltipLine = svg
      .append("line")
      .attr("stroke", "black")
      .attr("y1", 0)
      .attr("y2", height);

    //Draw lines and tags
    var tags = {};
    for (type in types) {
      // var type = keys[i];
      var line = lines[type];
      var arr = types[type];
      var color = getColor(type);

      var raiseCorrespondingTag = function (d) {
        var tag = tags[d[0].type];
        var poly = tag.poly.node().cloneNode(true);
        var text = tag.text.node().cloneNode(true);

        tag.poly.remove();
        tag.text.remove();

        svg.node().appendChild(poly);
        svg.node().appendChild(text);

        tag.poly = d3.select(poly);
        tag.text = d3.select(text);
      };

      //Add thick transparent line for clicking purposes
      svg
        .append("path")
        .data([arr])
        .attr("class", "line")
        .style("stroke-opacity", 0.0)
        .style("stroke-width", "11px")
        .attr("d", line)
        .on("mousemove", function () {
          //show tooltip
          drawLinechartTooltip(this, x, d);
        })
        .on("click", function (d) {
          raiseCorrespondingTag(d);
        });

      //Draw line
      svg
        .append("path")
        .data([arr])
        .attr("class", "line")
        .style("stroke", color)
        .attr("d", line)
        .on("click", function (d) {
          raiseCorrespondingTag(d);
        });

      //Add label to the end of the line
      var label = type;
      var lastItem = arr[arr.length - 1];
      var lastVal = lastItem.value;
      var lastDate = lastItem.date;
      var tx = x(lastDate) + 3; //vs width+3
      var ty = useLogScale ? y(lastVal + 1) : y(lastVal);

      var temp = svg
        .append("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "start")
        .attr("font-size", "10px")
        .text(label);
      var box = temp.node().getBBox();
      temp.remove();

      var w = Math.max(box.width + 8, 60);
      var h = box.height;
      var a = h / 2;
      var vertices = [
        [0, 0], //ul
        [w, 0], //ur
        [w, h], //11
        [0, h], //lr
        [-a, a], //arrow point
      ];

      //Add tag (rect)
      var poly = svg
        .append("polygon")
        .attr("points", vertices.join(" "))
        .attr("transform", "translate(" + (tx + a) + "," + (ty - a) + ")")
        .style("fill", color);

      //Add label
      var text = svg
        .append("text")
        .attr("transform", "translate(" + (tx + a + 4) + "," + ty + ")")
        .attr("dy", ".35em")
        .attr("text-anchor", "start")
        .attr("font-size", "10px")
        .style("fill", "#fff")
        .text(label);
    }
  };



  //**************************************************************************
  //** updatePieChart
  //**************************************************************************
  const updatePieChart = (data) => {
        pieChart.innerDiv.innerHTML = "";


      //Prep the data and get colors
        var values = [];
        var colors = {};
        data.children.forEach((child) => {
            values.push({
                region: child.name,
                value: child.totalValue
            });
        });
        values.sort(function(a, b){
            return b.value-a.value;
        });
        data = {};
        for (var i in values){
            var d = values[i];
            data[d.region] = d.value;
            colors[d.region] = colorRange(i/values.length);
        }




      //set the dimensions and margins of the graph
        var margin = { top: 0, right: 20, bottom: 0, left: 20 },
          width = pieChart.innerDiv.clientWidth,
          height = pieChart.innerDiv.clientHeight;



    // The radius of the pieplot is half the width or half the height (smallest one). I subtract a bit of margin.
        var radius = Math.min(width, height) / 2 - margin.left - margin.right;

        var svg = d3
          .select(pieChart.innerDiv)
          .append("svg")
          .attr("style", "margin-top:-25px")
          .attr("width", width)
          .attr("height", height)
          .append("g")
          .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

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
            return colors[d.data.key];
      })
      .attr("stroke", "white")
      .style("stroke-width", "2px")
      .style("opacity", 1);

    d3.select('#purchase-pie').remove()

    var tooltip = d3
      .select(pieChart.innerDiv)
      .append("div")
      .attr("id", "purchase-pie")
      .attr("class", "tooltip")
      .attr("opacity", 0)
    tooltip.append("div").attr("class", "count");

    path.on("mouseover", function (d) {
      tooltip.select(".count").html(
        d.data.value.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        })
      );
      tooltip.style("display", "block");
      tooltip.style("opacity", 2);
      this.style.opacity = .7;
    });

    path.on("mousemove", function () {
      tooltip
        .style("top", event.offsetY + 10 + "px")
        .style("left", event.offsetX + 12 + "px");
    });

    path.on("mouseout", function () {
      tooltip.style("display", "none");
      tooltip.style("opacity", 0);
      this.style.opacity = 1;
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
        posC[0] = radius * 0.9 * (midangle < Math.PI ? 1 : -1); // multiply by 1 or -1 to put it on the right or on the left
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
        pos[0] = radius * 0.92 * (midangle < Math.PI ? 1 : -1);
        return "translate(" + pos + ")";
      })
      .style("text-anchor", function (d) {
        var midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
        return midangle < Math.PI ? "start" : "end";
      });
  };

  //**************************************************************************
  //** Helper Word Wrap
  //**************************************************************************
  // Dynamic Width (Build Regex)
  function splitText(str, w) {
    return (
      str
        .split(/\s+/)

        // Then join words so that each string section is less then 40
        .reduce(function (prev, curr) {
          if (prev.length && (prev[prev.length - 1] + " " + curr).length <= w) {
            prev[prev.length - 1] += " " + curr;
          } else {
            prev.push(curr);
          }
          return prev;
        }, [])
    );
  }

  //**************************************************************************
  //** createLinechartTooltip
  //**************************************************************************
  var createLinechartTooltip = function (parent) {
    var div = document.createElement("div");
    div.className = "tooltip noselect";
    parent.appendChild(div);
    linechartTooltip = d3.select(div);
  };

  //**************************************************************************
  //** drawLinechartTooltip
  //**************************************************************************
  var drawLinechartTooltip = function (node, x, data) {
    //Get date associated with the mouse position
    const date = roundToYM(x.invert(d3.mouse(node)[0]));

    //Update vertical line
    const xOffset = x(date);
    linechartTooltipLine
      .attr("stroke", "black")
      .attr("x1", xOffset)
      .attr("x2", xOffset);

    //Filter data by the selected date. Note that the data here is a clone
    data = data.filter(
      (d) => d.date.slice(0, 7) == d3.timeFormat("%Y-%m")(date)
    );
    //data.sort((a, b) => b.value - a.value);

    var fmtDollars = function (val) {
      val = Math.round(val).toLocaleString();
      return '<div style="text-align:right">$' + val + "</div>";
    };

    var fmtLabel = function (label) {
      var s = label;
      s = s.replaceAll("_", " ");
      const words = s.split(" ");
      var ucwords = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
      return ucwords.join(" ");
    };

    var bound = linechartTooltipLine.node().getBoundingClientRect();
    var html = document.documentElement;
    var minY = bound.left + window.pageXOffset - html.clientLeft;
    //var left = d3.event.pageX;
    //if (left<minY) left = minY;

    linechartTooltip
      .html("<strong>" + d3.timeFormat("%b %Y")(date) + "</strong>")
      .style("display", "block")
      //.style('left', left+20) //d3.event.pageX + 20
      .style("top", d3.event.pageY - 170)
      .append("table")
      .selectAll("tr")
      .data(data)
      .enter()
      .append("tr")
      .selectAll("td")
      .data((d) => [fmtLabel(d.type.split(" ")[0]), fmtDollars(d.value)])
      .enter()
      .append("td")
      .html((d) => d);

    //Position the tooltip to the left of the vertical line
    var el = linechartTooltip.node();
    var box = el.getBoundingClientRect();
    linechartTooltip.style("left", minY - (box.width + 30));
  };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
  var createToolbar = function (parent) {
    var div = document.createElement("div");
    div.className = "dashboard-toolbar";
    parent.appendChild(div);

    var table = createTable();
    div.appendChild(table);
    var tbody = table.firstChild;
    var tr = document.createElement("tr");
    tbody.appendChild(tr);
    var td;

    td = document.createElement("td");
    td.style.width = "55px";
    td.innerHTML = "Month:";
    tr.appendChild(td);
    td = document.createElement("td");
    td.style.width = "175px";
    tr.appendChild(td);
    monthOptions = new javaxt.dhtml.ComboBox(td, {
      style: config.style.combobox,
      readOnly: true
    });
    var sliding = false;
    monthOptions.onChange = function (name, value) {
      if (!sliding) {
        var options = monthOptions.getOptions();
        for (var i in options) {
          var option = options[i];
          if (option.value === value) {
            slider.value = i;
            break;
          }
        }
      }
      updateCharts(name);
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
    slider.onchange = function () {
      sliding = true;
      var val = this.value - 1;
      monthOptions.setValue(val);
      sliding = false;
    };
    td.appendChild(slider);
  };

  //**************************************************************************
  //** getColor
  //**************************************************************************
  /** Returns a color for a descrete value using a precomputed classification
   *  @param colors An array of colors. Example: ['#b6e4ff', '#ea442c']
   *  @param breaks An array of classes (e.g. see getNaturalBreaks)
   */
  var getColor = function (n, colors, breaks) {
    var val = 0;
    while (n > breaks[val]) val++;
    return chroma.scale(colors)(val / breaks.length);
  };

  var getColor2 = function (n, colors, breaks) {
    var val = breaks.length - 1;
    while (n < breaks[val]) val--;
    return chroma.scale(colors)(val / breaks.length);
  };

  //**************************************************************************
  //** formatDate
  //**************************************************************************
  var formatDate = function (str) {
    var arr = str.split("-");
    return arr[1] + "/" + arr[0];
  };

  //**************************************************************************
  //** formatRegion
  //**************************************************************************
  var formatRegion = function (region) {
    region = region.substring(0, region.indexOf(" "));
    region = region.substring(0,1) + region.substring(1).toLowerCase();
    return region;
  };

  //**************************************************************************
  //** clone
  //**************************************************************************
  var clone = function (json) {
    if (json == null) return null;
    return JSON.parse(JSON.stringify(json));
  };

  //**************************************************************************
  //** Date utils
  //**************************************************************************

  var roundToYM = function (timeStamp) {
    const y = timeStamp.getFullYear();
    const m = timeStamp.getMonth();
    const result = new Date(y, m);
    if (timeStamp.getDate() > 15) {
      result.setMonth(result.getMonth() + 1);
    }
    return result;
  };

  var isDateInArray = function (needle, haystack) {
    for (var i = 0; i < haystack.length; i++) {
      if (needle.getTime() === haystack[i].getTime()) {
        return true;
      }
    }
    return false;
  };

  var getUniqueDates = function (dates) {
    var uniqueDates = [];
    for (var i = 0; i < dates.length; i++) {
      if (!isDateInArray(dates[i], uniqueDates)) {
        uniqueDates.push(dates[i]);
      }
    }
    return uniqueDates;
  };

  //**************************************************************************
  //** Utils
  //**************************************************************************
  var createTable = javaxt.dhtml.utils.createTable;
  var createDashboardItem = bluewave.utils.createDashboardItem;
  var getData = bluewave.utils.getData;
  var parseCSV = bluewave.utils.parseCSV;
  var getNaturalBreaks = bluewave.utils.getNaturalBreaks;

  init();
};