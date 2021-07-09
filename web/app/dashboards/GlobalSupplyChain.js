if (!bluewave) var bluewave = {};
if (!bluewave.dashboards) bluewave.dashboards = {};

bluewave.dashboards.GlobalSupplyChain = function (parent, config) {
    let me = this;
    let title = "Global Supply Chain";
    let map, sankey, countryChart, volumeChart; //dashboard items
    let innerDiv = "";
    let slider;
    let productOptions, monthOptions;
    let monthKeys = [];
    let monthData = {};
    let politicalBoundaries, portsOfEntry; //static data
    let linechartTooltip, linechartTooltipLine;
    let tooltip, tooltipBody;
    let legend;
    let sankeyData;
    let currProduct;
    let displayNameDict;

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

        innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        innerDiv.style.display = "inline-block";
        innerDiv.style.textAlign = "center";
        innerDiv.style.maxWidth = "1658px";
        innerDiv.style.position = "relative";
        div.appendChild(innerDiv);

        tooltip = d3
            .select(tr)
            .append("div")
            .attr("class", "tooltip")
            .style("display", "none")
            .style("opacity", 0);
        tooltipBody = tooltip.append("div").attr("class", "tooltip-body");

        createMap(innerDiv);
        createSankey(innerDiv);
        createCountryOfOrigin(innerDiv);
        createProductVolume(innerDiv);
        createLinechartTooltip(innerDiv);
    };

  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function () {
        return title;
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

        productOptions = createProductList(tr, config.style.combobox);
        productOptions.clear();
        productOptions.onChange = function (name, value) {
            currProduct = value;
            title = value + " Supply Chain Dashboard";

            var arr = sankeyData[currProduct];
            changeProductData(currProduct);
            slider.setAttribute("max", arr.length);
            slider.value = 1;
            slider.onchange();
        };

        td = document.createElement("td");
        td.style.width = "55px";
        td.innerHTML = "Month:";
        tr.appendChild(td);
        td = document.createElement("td");
        td.style.width = "175px";
        tr.appendChild(td);

        monthOptions = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true,
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
            updateMontlyCharts(name);
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
  //** update
  //**************************************************************************
    this.update = function () {
        sankeyData = [];

        if (politicalBoundaries){
            getDynamicData();
        }
        else{
            getStaticData(function(){
                getDynamicData();
            });
        }
    };

    var getStaticData = function(callback){
        getData("countries", function(data) {
            politicalBoundaries = data;
            createBackgroundMap()
            getData("PortsOfEntry", function(data) {
                displayNameDict = {}
                data.forEach((port)=>{
                    displayNameDict[port.country] = port.country;
                    displayNameDict[port.iso2] = port.country;
                    displayNameDict[port.iso3] = port.country;
                })
                portsOfEntry = data;
                if (callback) callback.apply(me, []);
            });
        });
    };


    var getDynamicData = function(callback){
        getData("SupplyChainSankey", function (data) {
            sankeyData = data;
            let products = Object.keys(data);
            productOptions.clear();
            products.forEach((val) => {
                productOptions.add(val, val);
            });

            productOptions.setValue(products[0]);
        });
    };


  //**************************************************************************
  //** changeProductData
  //**************************************************************************
    const changeProductData = function (name) {
        let selected = name;
        let data = clone(sankeyData[selected]);
        let lineData = clone(data);
        let orders = [];
        monthKeys = [];

        monthOptions.clear();

        data.forEach(({ name, data, notes }) => {
            monthKeys.push(name);
            monthData[name] = {
                notes: notes || "",
                data,
            };
        });

        monthKeys.sort(function (a, b) {
            a = parseInt(a.split("-").join(""));
            b = parseInt(b.split("-").join(""));
            return b - a;
        });

        monthKeys.forEach((month, i) => {
            monthOptions.add(month, i);

            let filled = 0;
            let unfilled = 0;
            monthData[month].data.links.forEach((val) => {
                switch (val.meta) {
                    case "filled":
                        filled += val.value;
                        break;
                    case "unfilled":
                        unfilled += val.value;
                        break;

                    default:
                        break;
                }
            });
            orders.push({
                date: parseDate(month),
                filled,
                unfilled,
            });
        });

        //Update slider
        let currentMonth = monthKeys[monthKeys.length - 1];

        slider.setAttribute("max", monthKeys.length);
        monthOptions.setValue(currentMonth);

        // Add All Dropdown option
        // Merge existing monthly data to all data group
        monthOptions.add("All");
        let linkMap = {};
        let nodeMap = {};
        const merge = (data) => {
            for (var key in data) {
                data[key].data.links.forEach((val) => {
                    if (linkMap[`${val.source}${val.target}`]) {
                        linkMap[`${val.source}${val.target}`].value +=
                            val.value;
                    } else {
                        linkMap[`${val.source}${val.target}`] = val;
                    }
                });
                data[key].data.nodes.forEach((val) => {
                    if (!nodeMap[val.name]) {
                        nodeMap[val.name] = val;
                    }
                });
            }
        };
        merge(monthData);

        monthData["All"] = { data: { links: [], nodes: [] } };
        monthData["All"]["data"]["links"] = Object.values(linkMap);
        monthData["All"]["data"]["nodes"] = Object.values(nodeMap);

        updateMontlyCharts(currentMonth);
        updateYearlyCharts(orders, lineData);
    };


  //**************************************************************************
  //** updateYearlyCharts
  //**************************************************************************
    var updateYearlyCharts = (orders, lineData) => {
        // Prep LineData
        lineData = lineData.reduce((acc, month) => {
            // for each month:
            // filter only filled orders
            // add dates and flatten array
            let distributor = {};
            month.data.links.forEach(({ source, value, meta }) => {
                if (meta !== "filled") {
                    return;
                }
                if (distributor[source]) {
                    distributor[source] += value;
                } else {
                    distributor[source] = value;
                }
            });
            let keys = Object.keys(distributor);

            var str = month.name;
            var date = parseDate(str)


            let result = keys.map((key) => {
                return { type: key, date, value: distributor[key] };
            });

            return [...acc, ...result];
        }, []);

        updateCountryOfOrigin(orders);
        updateProductVolume(lineData);
    };

  //**************************************************************************
  //** updateMontlyCharts
  //**************************************************************************
    var updateMontlyCharts = function (month) {
        let { sankeyData, connectionsData } = getMonthlyData(month);

        let volumeMap = {};
        sankeyData.links.forEach((location) => {
            if (volumeMap[location.source]) {
                volumeMap[location.source] += location.value;
            } else {
                volumeMap[location.source] = location.value;
            }
        });
        connectionsData = connectionsData.map((location) => {
            let {country,iso2,iso3} = location;
            let value = volumeMap[country] || volumeMap[iso2] || volumeMap[iso3]
            return { ...location, value };
        });

        updateMap(connectionsData);
        updateSankey(sankeyData);
    };

  //**************************************************************************
  //** Get Montly Data
  //**************************************************************************
    var getMonthlyData = function (month) {
        let sankeyMonthData = clone(monthData[month].data);
        let countries = {};

        sankeyMonthData.nodes.forEach(({ name }) => {
            countries[name] = true;
        });

        // Filter Countries by port country name Should check alias IE: iso2,iso3
        let connectionsMonthData = portsOfEntry.filter((port) => {
            if(countries[port.iso2] || countries[port.iso3] || countries[port.country]){
                return true
            }
        });

        return {
            sankeyData: sankeyMonthData,
            connectionsData: connectionsMonthData,
        };
    };

  //**************************************************************************
  //** createMap
  //**************************************************************************
    var createMap = function(parent) {
        let width = 980;
        let height = 580;
        map = createDashboardItem(parent, {
            width: width,
            height: height,
        });
        map.innerDiv.id = "world_map_div";
        createLegend(map.innerDiv);

        map.projection = d3
            .geoMercator()
            .scale(width / 2 / Math.PI)
            .rotate([120, 0])
            .center([0, 30])
            .translate([width / 2, height / 2]);

        map.path = d3.geoPath().projection(map.projection);

        map.svg = d3
            .select(map.innerDiv)
            .append("svg")
            .attr("id", "world_map")
            .style("fill", "none")
            .style("stroke", "#000")
            .style("strokeLinejoin", "round")
            .style("strokeLinecap", "round");

        map.svg.attr("viewBox", "0 0 " + width + " " + height).attr(
            "preserveAspectRatio",
            "xMinYMin"
        );

    };
  //**************************************************************************
  //** createBackgroundMap
  //**************************************************************************
    var createBackgroundMap = function (){

        map.svg
        .append("path")
        .attr("class", "countries")
        .attr("d", map.path(topojson.feature(politicalBoundaries, politicalBoundaries.objects.countries)))
    }


  //**************************************************************************
  //** updateMap
  //**************************************************************************
    var updateMap = function (locations, monthlyVolume) {
        let svg = map.svg;
        let projection = map.projection;
        let path = map.path;
        var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette(true));

        // Add Path
        let max = d3.max(locations, (d) => d.value);
        let min = d3.min(locations, (d) => d.value);

        let logScale = d3.scaleLinear().domain([min, max]).range([2, 15]);

        svg.selectAll("#connection-path").remove();

        let connections = svg.selectAll("#connection-path").data(locations);

        connections
            .enter()
            .append("path")
            .attr("id", "connection-path")
            .attr("d", function (d) {
                return path({
                    type: "LineString",
                    coordinates: [
                        [d.imlongitude, d.imlatitude],
                        [d.exlongitude, d.exlatitude],
                    ],
                });
            })
            .style("fill", "none")
            .style("stroke-opacity", 0.5)
            .style("stroke", (d) => {
                return getColor(d.country);
            })
            .style("stroke-width", (d) => {
                return logScale(d.value);
            })
            .on("mouseover", function (d) {
                d3.select(this).style("stroke-opacity", 1);
                tooltip.select(tooltipBody).html("");
                tooltip.select(tooltipBody).html(() => {
                    return (
                        "<table>" +
                        "<tr>" +
                        "<td>Export:</td>" +
                        "<td>" +
                        d.country +
                        "</td>" +
                        "</tr>" +
                        "<tr>" +
                        "<td>Import:</td>" +
                        "<td>" +
                        d["im-port"] +
                        "</td>" +
                        "</tr>" +
                        "<tr>" +
                        "<td>Value:</td>" +
                        "<td>" +
                        fmtDollars(d.value) +
                        "</td>" +
                        "</tr>" +
                        "</table>"
                    );
                });
                tooltip.style("display", "block");
                tooltip.style("opacity", 2);
                tooltip.style("opacity", 2);
            })
            .on("mouseout", function (d) {
                d3.select(this).style("stroke-opacity", 0.6);
                tooltip.style("display", "none");
                tooltip.style("opacity", 0);
            })
            .on("mousemove", function (d) {
                tooltip
                    .style("top", event.pageY - 128 + "px")
                    .style("left", event.pageX + 12 + "px");
            });

        // Location Points
        svg.selectAll("#connection-dot").remove();

        let dots = svg
            .append("g")
            .attr("id", "connection-dot")
            .selectAll("#connection-dot")
            .data(locations)
            .enter();

        dots.append("circle")
            .attr("cx", function (d) {
                let lat = d.exlatitude;
                let lon = d.exlongitude;
                return projection([lon, lat])[0];
            })
            .attr("cy", function (d) {
                let lat = d.exlatitude;
                let lon = d.exlongitude;
                return projection([lon, lat])[1];
            })
            .attr("r", 6)
            .attr("fill", (d) => {
                return getColor(d.country);
            })
            .on("mouseover", function (d) {
                d3.select(this).style("stroke-opacity", 0.6);

                tooltip.select(".tooltip-body").html("");
                tooltip.select(".tooltip-body").html(() => {
                    return (
                        "<table>" +
                        "<tr>" +
                        "<td>Export:</td>" +
                        "<td>" +
                        d.country +
                        "</td>" +
                        "</tr>" +
                        "<tr>" +
                        "<td>Import:</td>" +
                        "<td>" +
                        d["im-port"] +
                        "</td>" +
                        "</tr>" +
                        "<tr>" +
                        "<td>Value:</td>" +
                        "<td>" +
                        fmtDollars(d.value) +
                        "</td>" +
                        "</tr>" +
                        "</table>"
                    );
                });
                tooltip.style("display", "block");
                tooltip.style("opacity", 2);
                tooltip.style("opacity", 2);
            })
            .on("mouseout", function (d) {
                d3.select(this).style("stroke-opacity", d.opacity);
                tooltip.style("display", "none");
                tooltip.style("opacity", 0);
            })
            .on("mousemove", function (d) {
                tooltip
                    .style("top", event.pageY - 128 + "px")
                    .style("left", event.pageX + 12 + "px");
            });

        dots.append("circle")
            .attr("cx", function (d) {
                let lat = d.imlatitude;
                let lon = d.imlongitude;
                return projection([lon, lat])[0];
            })
            .attr("cy", function (d) {
                let lat = d.imlatitude;
                let lon = d.imlongitude;
                return projection([lon, lat])[1];
            })
            .attr("r", 6)
            .attr("fill", (d) => {
                return getColor(d["im-port"]);
            })
            .on("mouseover", function (d) {
                d3.select(this).style("stroke-opacity", 0.6);
                tooltip.select(".tooltip-body").html("");
                tooltip.select(".tooltip-body").html(() => {
                    return d["im-port"];
                });
                tooltip.style("display", "block");
                tooltip.style("opacity", 2);
                tooltip.style("opacity", 2);
            })
            .on("mouseout", function (d) {
                d3.select(this).style("stroke-opacity", d.opacity);
                tooltip.style("display", "none");
                tooltip.style("opacity", 0);
            })
            .on("mousemove", function (d) {
                tooltip
                    .style("top", event.pageY - 128 + "px")
                    .style("left", event.pageX + 12 + "px");
            });

        let labelMap = {};

        let importLabels = locations.filter((location) => {
            if (labelMap[location["im-port"]]) {
                return false;
            } else {
                labelMap[location["im-port"]] = {
                    label: location["im-port"],
                    lat: location.imlatitude,
                    lon: location.imlongitude,
                };
                return true;
            }
        });

        let exportLabels = locations.filter((location) => {
            if (labelMap[location["iso2"]]) {
                return false;
            } else {
                labelMap[location["iso2"]] = {
                    label: location.country,
                    lat: location.exlatitude,
                    lon: location.exlongitude,
                };
                return true;
            }
        });

        let labels = [];

        for (let label in labelMap) {
            labels.push(labelMap[label]);
        }

        legend.innerHTML = "";
        labels.forEach((label) => {
            let name = label.label;
            let rgb = colorValues(getColor(name));
            legend.addItem(name, rgb);
        });
    };

  //**************************************************************************
  //** createLegend
  //**************************************************************************
    var createLegend = function (parent) {
        legend = document.createElement("div");
        legend.className = "map-legend";
        legend.style.width = "120px";
        legend.style.left = "15px";
        parent.appendChild(legend);
        legend.addItem = function (name, backgroundColor, borderColor) {
            var row = document.createElement("div");
            row.style.display = "inline-block";
            row.style.width = "100%"; //remove to have label aligned horizontally
            this.appendChild(row);

            var icon = document.createElement("div");
            icon.className = "map-legend-circle";
            icon.style.backgroundColor = isArray(backgroundColor)
                ? "rgba(" + backgroundColor.join(",") + ")"
                : backgroundColor;
            if (borderColor) {
                icon.className += "-outline";
                icon.style.borderColor = borderColor;
            }
            row.appendChild(icon);

            var label = document.createElement("div");
            label.className = "map-legend-label noselect";
            label.innerHTML = name;
            row.appendChild(label);
        };
    };

  //**************************************************************************
  //** createSankey
  //**************************************************************************
    var createSankey = function (parent) {
        var width = 560;
        var height = 310;

        sankey = createDashboardItem(parent, {
            width,
            height,
            title: "Total Product Distribution",
        });

        sankey.innerDiv.id = "sankey_supply-parent";

        var margin = { top: 10, right: 10, bottom: 20, left: 10 };
        sankey.svg = d3.select(sankey.innerDiv)
            .append("svg")
            .attr("id", "sankey_supply")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr(
                "transform",
                "translate(" + margin.left + "," + margin.top + ")"
            );

        // Update width and height for the sankey
        let sankeyWidth = width - margin.left - margin.right;
        let sankeyHeight = height - margin.top - margin.bottom;

        sankey.d3Sankey = d3
            .sankey()
            .nodeId((d) => d.name)
            .nodeWidth(20)
            .nodePadding(20)
            .iterations([6])
            .size([sankeyWidth, sankeyHeight]);

    };

  //**************************************************************************
  //** updateSankey
  //**************************************************************************
    var updateSankey = function (data) {
        let svg = sankey.svg
        let d3Sankey = sankey.d3Sankey
        var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());

        let graph = d3Sankey(data);
        var size = d3Sankey.size();
        var width = size[0];

        var formatNumber = d3.format(",.0f"); // zero decimal places

        svg.selectAll('.sankey-node').remove()
        //Add the nodes
        var node = svg
            .append("g")
            .selectAll(".node")
            .data(graph.nodes)
            .enter()
            .append("g")
            .attr("class", "sankey-node");

        //Add the rectangles for the nodes
        node.append("rect")
            .attr("x", function (d) {
                return d.x0;
            })
            .attr("y", function (d) {
                return d.y0;
            })
            .attr("height", function (d) {
                return d.y1 - d.y0;
            })
            .attr("width", d3Sankey.nodeWidth())
            .style("fill", function (d) {
                let name = displayNameDict[d.name]||d.name
                return (d.color = getColor(name));
            })
            .style("stroke", function (d) {
                return d3.rgb(d.color).darker(2);
            })
            .append("title")
            .text(function (d) {
                return d.name + "\n" + formatNumber(d.value);
            });

        svg.selectAll('.sankey-link').remove()
        //Add the links
        var link = svg
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
                    const opacity = d.meta == "unfilled" ? 0.15 : 0.45;
                    return (d.opacity = opacity);
                } else {
                    return (d.opacity = 0.3);
                }
            })
            .style("stroke", function (d) {
                return d.source.color;
            })
            .on("mouseover", function (d) {
                d3.select(this).style("stroke-opacity", 0.6);

                tooltip.select(".tooltip-body").html("");
                tooltip.select(".tooltip-body").html(() => {
                    return (
                        d.source.name +
                        ">" +
                        d.target.name +
                        fmtDollars(d.value)
                    );
                });
                tooltip.style("display", "block");
                tooltip.style("opacity", 2);
                tooltip.style("opacity", 2);
            })
            .on("mouseout", function (d) {
                d3.select(this).style("stroke-opacity", d.opacity);
                tooltip.style("display", "none");
                tooltip.style("opacity", 0);
            })
            .on("mousemove", function (d) {
                tooltip
                    .style("top", event.pageY - 128 + "px")
                    .style("left", event.pageX + 12 + "px");
            });

        //Add node labels
        node.append("text")
            .attr("x", function (d) {
                return d.x0 - 6;
            })
            .attr("y", function (d) {
                return (d.y1 + d.y0) / 2;
            })
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .text(function (d) {
                return displayNameDict[d.name]||d.name;
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
  //** createCountry
  //**************************************************************************
    var createCountryOfOrigin = function (parent) {
        countryChart = createDashboardItem(parent, {
            width: 300,
            height: 200,
            title: "Order Volume",
        });

        countryChart.innerDiv.id = "countryChart";
    };

  //**************************************************************************
  //** updateCountry
  //**************************************************************************
    var updateCountryOfOrigin = function (data) {
        var margin = { top: 10, right: 30, bottom: 30, left: 50 },
            width = 300 - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        countryChart.innerHTML = ""
        // append the svg object to the body of the page
        var svg = d3
            .select(countryChart.innerDiv)
            .append("svg")
            .attr("id", "country_chart_SVG")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr(
                "transform",
                "translate(" + margin.left + "," + margin.top + ")"
            );


        let subgroups = ["filled", "unfilled"];

        let max = 0;

        data.forEach(({ filled, unfilled }) => {
            let newMax = filled + unfilled;
            if (max < newMax) {
                max = newMax;
            }
        });

        let groups = d3
            .map(data, function (d) {
                return d.date;
            })
            .keys();

        // Add X axis
        var band = d3
            .scaleBand()
            .domain(groups)
            .range([0, width])
            .padding([0.1]);

        var x = d3
            .scaleTime()
            .range([0, width])
            .domain(
                d3.extent(data, function (d) {
                    return d.date;
                })
            );

        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%m/%y")));

        // Add Y axis
        var y = d3.scaleLinear()
        .domain([0, max])
        .range([height, 0]);

        svg.append("g").call(
            d3
                .axisLeft(y)
                .ticks(5, ",")
                .tickFormat((d) => "$" + d3.format("~s")(d).replace("G", "B"))
        );

        // color palette = one color per subgroup
        var color = d3
            .scaleOrdinal()
            .domain(subgroups)
            .range(["#377eb8", "#e41a1c"]);

        //stack the data? --> stack per subgroup
        var stackedData = d3.stack().keys(subgroups)(data);

        // Show the bars
        svg.append("g")
            .selectAll("g")
            // Enter in the stack data = loop key per key = group per group
            .data(stackedData)
            .enter()
            .append("g")
            .attr("fill", function (d) {
                return color(d.key);
            })
            .selectAll("rect")
            // enter a second time = loop subgroup per subgroup to add all rectangles
            .data(function (d) {
                return d;
            })
            .enter()
            .append("rect")
            .attr("x", function (d) {
                return band(d.data.date);
            })
            .attr("y", function (d) {
                return y(d[1]);
            })
            .attr("height", function (d) {
                let height = y(d[0]) - y(d[1]);
                if(height<0) height = 0;
                return height;
            })
            .attr("width", band.bandwidth())
            .on("mouseover", function (d) {
                tooltip.select(tooltipBody).html("");
                tooltip
                    .select(tooltipBody)
                    .append("div")
                    .html(() => {
                        return "Filled: " + fmtDollars(d.data.filled);
                    })
                    .append("div")
                    .html(() => {
                        return "Unfilled: " + fmtDollars(d.data.unfilled);
                    });
                tooltip.style("display", "block");
                tooltip.style("opacity", 2);
                tooltip.style("opacity", 2);
            })
            .on("mousemove", function (d) {
                tooltip
                    .style("top", event.pageY - 128 + "px")
                    .style("left", event.pageX + 12 + "px");
            })
            .on("mouseout", function () {
                tooltip.style("display", "none");
                tooltip.style("opacity", 0);
            });
    };

  //**************************************************************************
  //** createCountry
  //**************************************************************************
    var createProductVolume = function (parent) {
        volumeChart = createDashboardItem(parent, {
            width: 300,
            height: 200,
            settings: false,
            title: "Total Purchases Per Month",
        });

        volumeChart.innerDiv.id = "country_line";
    };

    var updateProductVolume = function (data) {
        volumeChart.innerHTML = "";

        // Create data for the line graph
        // set the dimensions and margins of the graph
        var margin = { top: 10, right: 60, bottom: 30, left: 40 },
            width = 300 - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        // append the svg object to the body of the page
        var svg = d3
            .select(volumeChart.innerDiv)
            .append("svg")
            .attr("id", "country_line_SVG")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr(
                "transform",
                "translate(" + margin.left + "," + margin.top + ")"
            );


        var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette(true));

        // group the data: I want to draw one line per group
        var sumstat = d3
            .nest() // nest function allows to group the calculation per level of a factor
            .key(function (d) {
                return d.type;
            })
            .entries(data);

        // Add X axis --> it is a date format
        var x = d3
            .scaleTime()
            .domain(
                d3.extent(data, function (d) {
                    return d.date;
                })
            )
            .range([0, width]);
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x).ticks(5));

        // Add Y axis
        var y = d3
            .scaleLinear()
            .domain([
                0,
                d3.max(data, function (d) {
                    return +d.value;
                }),
            ])
            .range([height, 0]);

        svg.append("g").call(
            d3
                .axisLeft(y)
                .ticks(5)
                .tickFormat((d) => "$" + d3.format("~s")(d).replace("G", "B"))
        );

        var lines = {};
        let types = data.reduce((acc, val) => {
            if (acc[val.type]) {
                acc[val.type].push(val);
            } else {
                acc[val.type] = [val];
            }
            return acc;
        }, {});

        for (var type in types) {
            lines[type] = d3
                .line()
                .x(function (d) {
                    return x(d.date);
                })
                .y(function (d) {
                    return y(+d.value);
                });
        }

        var d = clone(data);
        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("opacity", 0)
            .on("mousemove", function () {
                drawLinechartTooltip(this, x, d);
            })
            .on("mouseout", function () {
                if (linechartTooltip) linechartTooltip.style("display", "none");
                if (linechartTooltipLine)
                    linechartTooltipLine.attr("stroke", "none");
            });

        //Add vertical line for the tooltip
        linechartTooltipLine = svg
            .append("line")
            .attr("stroke", "black")
            .attr("y1", 0)
            .attr("y2", height);

        let useLogScale = false;
        for (type in types) {
            var line = lines[type];
            var arr = types[type];
            let color = getColor(type);
            svg.append("path")
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

            var w = Math.max(box.width + 8, 40);
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
            svg.append("polygon")
                .attr("points", vertices.join(" "))
                .attr(
                    "transform",
                    "translate(" + (tx + a) + "," + (ty - a) + ")"
                )
                .style("fill", color);

            //Add label
            svg.append("text")
                .attr("transform", "translate(" + (tx + a + 4) + "," + ty + ")")
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .attr("font-size", "10px")
                .style("fill", "#fff")
                .text(label);
        }
    };

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

        var fmtDollars = function (val) {
            val = Math.round(val).toLocaleString();
            return '<div style="text-align:right">$' + val + "</div>";
        };

        var fmtLabel = function (label) {
            var s = label;
            s = s.replaceAll("_", " ");
            const words = s.split(" ");
            var ucwords = words.map(
                (w) => w.charAt(0).toUpperCase() + w.slice(1)
            );
            return ucwords.join(" ");
        };

        var bound = linechartTooltipLine.node().getBoundingClientRect();
        var html = document.documentElement;
        var minY = bound.left + window.pageYOffset - html.clientLeft;
        var minX = bound.left + window.pageXOffset - html.clientLeft;


        linechartTooltip
            .html("<strong>" + d3.timeFormat("%b %Y")(date) + "</strong>")
            .style("display", "block")
            //.style('left', left+20) //d3.event.pageX + 20
            .style('top', d3.event.pageY - 170)
            .append("table")
            .selectAll("tr")
            .data(data)
            .enter()
            .append("tr")
            .selectAll("td")
            .data((d) => {
                return [fmtLabel(d.type.split(" ")[0]), fmtDollars(d.value)];
            })
            .enter()
            .append("td")
            .html((d) => d);


      //Position the tooltip to the left of the vertical line
      var el = tooltip.node();
      var box = el.getBoundingClientRect();
      linechartTooltip.style('left', ()=>{
        return d3.event.pageX
      } );
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

    var fmtDollars = function (val) {
        val = Math.round(val).toLocaleString();
        return '<div style="text-align:right">$' + val + "</div>";
    };



  //**************************************************************************
  //** clone
  //**************************************************************************
    var clone = function (json) {
        if (json == null) return null;
        return JSON.parse(JSON.stringify(json));
    };

  //**************************************************************************
  //** color Value
  //**************************************************************************
    function colorValues(color) {
        if (!color) return;
        if (color.toLowerCase() === "transparent") return [0, 0, 0, 0];
        if (color[0] === "#") {
            if (color.length < 7) {
                // convert #RGB and #RGBA to #RRGGBB and #RRGGBBAA
                color =
                    "#" +
                    color[1] +
                    color[1] +
                    color[2] +
                    color[2] +
                    color[3] +
                    color[3] +
                    (color.length > 4 ? color[4] + color[4] : "");
            }
            return [
                parseInt(color.substr(1, 2), 16),
                parseInt(color.substr(3, 2), 16),
                parseInt(color.substr(5, 2), 16),
                color.length > 7 ? parseInt(color.substr(7, 2), 16) / 255 : 1,
            ];
        }
        if (color.indexOf("rgb") === -1) {
            // convert named colors
            var temp_elem = document.body.appendChild(
                document.createElement("fictum")
            ); // intentionally use unknown tag to lower chances of css rule override with !important
            var flag = "rgb(1, 2, 3)"; // this flag tested on chrome 59, ff 53, ie9, ie10, ie11, edge 14
            temp_elem.style.color = flag;
            if (temp_elem.style.color !== flag) return; // color set failed - some monstrous css rule is probably taking over the color of our object
            temp_elem.style.color = color;
            if (temp_elem.style.color === flag || temp_elem.style.color === "")
                return; // color parse failed
            color = getComputedStyle(temp_elem).color;
            document.body.removeChild(temp_elem);
        }
        if (color.indexOf("rgb") === 0) {
            if (color.indexOf("rgba") === -1) color += ",1"; // convert 'rgb(R,G,B)' to 'rgb(R,G,B)A' which looks awful but will pass the regxep below
            return color.match(/[\.\d]+/g).map(function (a) {
                return +a;
            });
        }
    }

  //**************************************************************************
  //** updateMontlyCharts
  //**************************************************************************
    const parseDate = function (str){
        var date;
        var idx = str.indexOf("_");
        if (idx>-1){
            var year = parseInt(str.substring(idx+1));
            var month = str.substring(0,3).toLowerCase();
            if (month=="jan") month = "01";
            if (month=="feb") month = "02";
            if (month=="mar") month = "03";
            if (month=="apr") month = "04";
            if (month=="may") month = "05";
            if (month=="jun") month = "06";
            if (month=="jul") month = "07";
            if (month=="aug") month = "08";
            if (month=="sep") month = "09";
            if (month=="oct") month = "10";
            if (month=="nov") month = "11";
            if (month=="dec") month = "12";
            date = new Date(year + "-" + month);
        }
        else{
            date = new Date(str);
        }
        return date;
    };
    

  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var onRender = javaxt.dhtml.utils.onRender;
    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;
    var isArray = javaxt.dhtml.utils.isArray;
    var createProductList = bluewave.utils.createProductList;

    init();
};
