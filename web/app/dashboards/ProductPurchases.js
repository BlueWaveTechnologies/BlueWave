if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  ProductPurchases
//******************************************************************************
/**
 *   Used to compare imports, RFI, and Premier data for specific products
 *
 ******************************************************************************/

bluewave.dashboards.ProductPurchases = function(parent, config) {

    var me = this;
    var title = "Product Purchases";
    var lineGraph; //dashboard item
    var tooltip, tooltipLine; //d3 svg nodes
    var productOptions, sourceOptions, groupOptions; //comboboxes
    var currProduct, currMonth; //strings
    var data = {};
    var callout;
    var useLogScale = false;


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
        td.appendChild(div);

        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        innerDiv.style.display = "inline-block";
        div.appendChild(innerDiv);


        createLineGraph(innerDiv);
        createTooltip(div);

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
    this.update = function(){
        productOptions.clear();
        sourceOptions.clear();
        data = {};


        getData("ImportSummary", function(json){

          //Generate list of productTypes
            var productTypes = [];
            for (var type in json) {
                if (json.hasOwnProperty(type)){
                    productTypes.push(type);
                }
            }


          //Parse data and update combobox
            for (var type in productTypes){
                var productType = productTypes[type];

              //Update combobox
                productOptions.add(productType, productType);



              //Parse data and conflate csv
                var _data = json[productType];
                for (var i=0; i<_data.length; i++){
                    var entry = _data[i];
                    var name = entry.name;
                    var csv = parseCSV(entry.csv, ",");

                  //Parse csv
                    var header = csv[0];
                    var arr = [];
                    for (var j=1; j<csv.length; j++){
                        var row = csv[j];
                        var date = formatDate(row[0]);

                        for (var k=1; k<row.length; k++){
                            var val = parseFloat(row[k]);
                            if (isNaN(val)) val = 0.0;
                            arr.push({
                                date: date,
                                type: header[k],
                                value: val
                            });
                        }
                    }



                  //Group data
                    var groups = {};
                    var labelFunction = {};
                    var updateGroups = function(name, entry){
                        var arr = groups[name];
                        if (arr==null){
                            arr = [];
                            groups[name] = arr;
                        }
                        arr.push(entry);
                    };
                    for (var j=0; j<arr.length; j++){
                        const v = arr[j];
                        const t = v.type;
                        var groupName;
                        if (name=="RFI"){
                            if (t=="order_total" || t=="fill_total"){
                                groupName = "order vs fill (total)";
                                updateGroups(groupName, v);
                                labelFunction[groupName] = function(str){
                                    return str.replace("_total","");
                                };
                            }
                            else{
                                if (t.indexOf("total_fillRate_")==0){
                                    groupName = "fill rate (by distributor)";
                                    updateGroups(groupName, v);
                                    labelFunction[groupName] = function(str){
                                        return str.substring("total_fillRate_".length);
                                    };
                                }
                                else if (
                                    t.indexOf("total_order_")==0 ||
                                    t.indexOf("total_fill_")==0){
                                    groupName = "order vs fill (by distributor)";
                                    updateGroups(groupName, v);
                                    labelFunction[groupName] = function(str){
                                        str = str.substring("total_".length);
                                        var arr = str.split("_");
                                        return arr[1] + " (" + arr[0] + ")";
                                    };
                                }
                                else if (
                                    t.indexOf("diff_fill_from_base_")==0 ||
                                    t.indexOf("diff_order_from_base_")==0){
                                    updateGroups("diff order vs fill from base (by distributor)", v);
                                }
                                else{
                                    if ( //ends with
                                        t.indexOf("_order_total")>0 ||
                                        t.indexOf("_fill_total")>0){
                                        groupName = "order vs fill (by product type)";
                                        updateGroups(groupName, v);
                                        labelFunction[groupName] = function(str){
                                            str = str.substring(0, str.length-("_total".length));
                                            var idx = str.lastIndexOf("_");
                                            var supplier = str.substring(0, idx);
                                            var type = str.substring(idx+1);
                                            return supplier + " (" + type + ")";
                                        };
                                    }
                                    else if ( //contains
                                        t.indexOf("_order_")>0 ||
                                        t.indexOf("_fill_")>0){
                                        updateGroups("order vs fill (product type to distributor)", v);
                                    }
                                    else if ( //contains
                                        t.indexOf("_fillRate_")>0){
                                        updateGroups("fill rate (product type to distributor)", v);
                                    }
                                    else{
                                        updateGroups("misc", v);
                                    }
                                }
                            }
                        }
                        else if (name=="Imports"){
                            if (t.indexOf("total")==0){
                                updateGroups(t, v);
                            }
                            else if ( //start with
                                t.indexOf("country_")==0 ||
                                t.indexOf("manufacturer_")==0 ||
                                t.indexOf("shipper_")==0 ||
                                t.indexOf("consignee_")==0
                            ){
                                groupName = t.substring(0, t.indexOf("_"));
                                updateGroups(groupName, v);
                                labelFunction[groupName] = function(str){
                                    return str.substring(str.indexOf("_")+1);
                                };
                            }
                            else{
                                updateGroups("misc", v);
                            }
                        }
                        else if (name=="Premier"){
                            if (t=="total"){
                                updateGroups(t, v);
                            }
                            else{
                                if ( //start with
                                    t.indexOf("Manufacturer_")==0 ||
                                    t.indexOf("Vendor_")==0
                                ){
                                    if (t.indexOf("_Top_")>1){
                                        groupName = t.substring(0, t.indexOf("_Top_")+4);
                                    }
                                    else{
                                        groupName = t.substring(0, t.indexOf("_"));
                                    }
                                    updateGroups(groupName, v);
                                    labelFunction[groupName] = function(str){
                                        str = str.substring(str.indexOf("_")+1);
                                        return str.replace("Top_","");
                                    };
                                }
                                else{
                                    updateGroups("misc", v);
                                }
                            }

                        }
                    }
                    //console.log(name, groups);
                    entry.groups = groups;
                    entry.labelFunction = labelFunction;
                    entry.data = arr;
                    delete entry.csv;
                }
                data[productType] = _data;
            }

            if (i>0) productOptions.setValue(productTypes[0]);
        });
    };


  //**************************************************************************
  //** createLineGraph
  //**************************************************************************
    var createLineGraph = function(parent){

      //Create dashboard item with a settings icon
        lineGraph = createDashboardItem(parent, {
            width: 1000,
            height: 640,
            settings: true
        });


      //Create menu callout for the settings icon
        callout = new javaxt.dhtml.Callout(document.body,{
            style: config.style.callout
        });
        var innerDiv = callout.getInnerDiv();
        var menu = document.createElement("div");
        menu.className = "app-menu";
        innerDiv.appendChild(menu);

        var menuItem = document.createElement("div");
        menuItem.className = "app-menu-item noselect";
        menuItem.innerHTML = '<i class="fas fa-check"></i>' + "Linear Scale";
        menuItem.onclick = function(){
            menu.toggle(this);
        };
        menu.appendChild(menuItem);

        menuItem = document.createElement("div");
        menuItem.className = "app-menu-item noselect";
        menuItem.innerHTML = '<i class="fas"></i>' + "Logarithmic Scale";
        menuItem.onclick = function(){
            menu.toggle(this);
        };
        menu.appendChild(menuItem);

        lineGraph.settings.onclick = function(){
            var rect = javaxt.dhtml.utils.getRect(this);
            var x = rect.x + (rect.width/2);
            var y = rect.y + rect.height + 3;
            callout.showAt(x, y, "below", "right");
        };


      //Add custom functions to toggle and select items in the menu
        lineGraph.menu = menu;
        menu.toggle = function(el){
            if (el && el.firstChild.className.indexOf("check")>-1) return;
            for (var i=0; i<menu.childNodes.length; i++){
                var menuItem = menu.childNodes[i];
                var isChecked = menuItem.firstChild.className.indexOf("check")>-1;
                menuItem.firstChild.className = "fas" + (isChecked?"" : " fa-check");
                if (!isChecked){
                    useLogScale = menuItem.lastChild.textContent.indexOf("Log")>-1 ? true : false;
                }
            }
            if (el){ //user initiated menu click
                updateLineGraph(lineGraph.data, lineGraph.groupName, lineGraph.labelFunction);
            }
        };
        menu.select = function(val){
            useLogScale = val.indexOf("Log")>-1 ? true : false;
            for (var i=0; i<menu.childNodes.length; i++){
                var menuItem = menu.childNodes[i];
                var isChecked = menuItem.firstChild.className.indexOf("check")>-1;
                if (menuItem.lastChild.textContent.indexOf(val)>-1){
                    if (isChecked) return;
                }
            }
            menu.toggle();
        };

    };


  //**************************************************************************
  //** updateLineGraph
  //**************************************************************************
    var updateLineGraph = function(data, groupName, labelFunction){


      //Update panel
        var subtitle = lineGraph.subtitle;
        var innerDiv = lineGraph.innerDiv;
        innerDiv.innerHTML = "";


      //Cache inputs
        lineGraph.data = clone(data);
        lineGraph.groupName = groupName;
        lineGraph.labelFunction = labelFunction;


      //Set the dimensions and margins of the graph
        var margin = {top: 20, right: 100, bottom: 50, left: 85},
        width = innerDiv.offsetWidth - margin.left - margin.right,
        height = innerDiv.offsetHeight - margin.top - margin.bottom;



      //set the ranges
        var x = d3.scaleTime().range([0, width]);
        var yScale = useLogScale ? d3.scaleLog() : d3.scaleLinear();
        var y = yScale.range([height, 0]);


      //create svg
        var svg = d3.select(innerDiv).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");



      //Group the data by line type
        var types = {};
        data.forEach(function(d) {
            var arr = types[d.type];
            if (!arr){
                arr = [];
                types[d.type] = arr;
            }
            arr.push(d);
        });
        data = [];



      //Create lines for each type
        var lines = {};
        for (var type in types) {
            if (types.hasOwnProperty(type)){


              //Sort data for each type by date
                var arr = types[type];
                arr.sort((a, b) => (a.date > b.date) ? 1 : -1);


              //Create line function for the type
                lines[type] = d3.line()
                    .defined(function(d) {return !isNaN(d.value);})
                    .x(function(d) { return x(d.date); })
                    .y(function(d) { return useLogScale? y(d.value+1):y(d.value); });


              //Update data
                data.push(...arr);
            }
        }



      //format the data
        var minY = useLogScale ? 1e12 : 100;
        var maxY = useLogScale ? -1e12 : -100;
        var parseTime = d3.timeParse("%Y-%m-%d"); //2020-08-07
        data.forEach(function(d) {
          // Sometimes months are expressed as first of month, other times they
          //  are expressed as last of month. Here we round always to the first.
            d.date = roundToYM(parseTime(d.date));

            minY = isNaN(d.value)? minY:Math.min(minY, d.value);
            maxY = isNaN(d.value)? maxY:Math.max(maxY, d.value);
        });
        if (minY == maxY) {maxY = minY + 1;}
        if (useLogScale) {
            minY = Math.pow(10, Math.floor(Math.log10(minY+1)));
            maxY = Math.pow(10, Math.ceil(Math.log10(maxY)));
        }


      //Scale the range of the data
        x.domain(d3.extent(data, function(d) { return d.date; }));
        y.domain([minY, maxY]);



        var colors = [

          //darker
            '#6699CC', //blue
            '#98DFAF', //green
            '#FF3C38', //red
            '#FF8C42', //orange
            '#933ed5', //purple
            '#bebcc1', //gray

          //lighter
            '#9DBEDE',
            '#C6EDD3',
            '#FF8280',
            '#FFB586'
        ];



      //Add y-axis
        svg.append("g")
            .attr("class", "axis")
            .call(useLogScale ? d3.axisLeft(y).ticks(5, ",") : d3.axisLeft(y).ticks(5));



      //add the X gridlines
        svg.append("g")
            .attr("class", "grid")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x)
              .ticks()
              .tickSize(-height)
              .tickFormat("")
            );

      //add the Y gridlines
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .ticks(5)
                .tickSize(-width)
                .tickFormat("")
              );


      //Add x-axis
        const allMonths = Object.values(types)
            .map(arr => arr.map(d => d.date))
            .flat();
        const allUniqueMonths = getUniqueDates(allMonths);
        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0,"+height+")")
            .call(d3.axisBottom(x)
                .tickFormat(ymFormat)
                .tickValues(allUniqueMonths)
            );


      //Extract types into a string array
        var keys = [];
        for (var type in types) {
            if (types.hasOwnProperty(type)){
                keys.push(type);
            }
        }


      //Sort the types as needed
        var hasOrdersAndFill = groupName.indexOf("order")>-1;
        if (hasOrdersAndFill){
            keys.sort(function(a, b){
                var t1 = a.replace("order","").replace("fill","");
                var t2 = b.replace("order","").replace("fill","");
                if (t1==t2){
                    return a.indexOf("fill") ? -1 : 1;
                }
                return -0;
            });
        }



      //Create rectangle over the grid to watch for mouse events.
      //Note that this is significantly faster than monitoring the svg node!
        var d = clone(data);
        svg.append('rect')
          .attr('width', width)
          .attr('height', height)
          .attr('opacity', 0)
          .on('mousemove', function() {
            drawTooltip(this, x, d, labelFunction);
          })
          .on('mouseout', function(){
            if (tooltip) tooltip.style('display', 'none');
            if (tooltipLine) tooltipLine.attr('stroke', 'none');
          });

      //Add vertical line for the tooltip
        tooltipLine = svg.append('line')
          .attr('stroke', 'black')
          .attr('y1', 0)
          .attr('y2', height);


      //Draw lines and tags
        var tags = {};
        var idx = 0;
        for (var i=0; i<keys.length; i++) {
            var type = keys[i];
            var line = lines[type];
            var arr = types[type];
            var color = colors[idx];
            var isFill = type.indexOf("fill")>-1 && hasOrdersAndFill;
            if (isFill){
                if (idx>0) idx--;
                else idx = 0;
                color = colors[idx];
            }


            idx++;
            if (idx>colors.length) idx = 0;


            var raiseCorrespondingTag = function(d) {
                  var tag = tags[d[0].type];
                  var poly = tag.poly.node().cloneNode(true);
                  var text = tag.text.node().cloneNode(true);

                  tag.poly.remove();
                  tag.text.remove();

                  svg.node().appendChild(poly);
                  svg.node().appendChild(text);

                  tag.poly = d3.select(poly);
                  tag.text = d3.select(text);
            }


          //Add thick transparent line for clicking purposes
            svg.append("path")
              .data([arr])
              .attr("class", "line")
              .style("stroke-opacity", 0.0)
              .style("stroke-width", "11px")
              .attr("d", line)
              .on('mousemove', function() { //show tooltip
                  drawTooltip(this, x, d, labelFunction);
              })
              .on("click", function(d) { raiseCorrespondingTag(d) });



          //Draw line
            svg.append("path")
              .data([arr])
              .attr("class", "line")
              .style("stroke", color)
              .style(isFill ? "stroke-dasharray" : "stroke", isFill ? ("3, 3") : color) //add dashes
              .attr("d", line)
              .on("click", function(d) { raiseCorrespondingTag(d) });



          //Add label to the end of the line
            var label = type;
            if (labelFunction) label = labelFunction(label);
            var lastItem = arr[arr.length-1];
            var lastVal = lastItem.value;
            var lastDate = lastItem.date;
            var tx = x(lastDate)+3; //vs width+3
            var ty = useLogScale? y(lastVal+1):y(lastVal);


            var temp = svg.append("text")
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .text(label);
            var box = temp.node().getBBox();
            temp.remove();

            var w = Math.max(box.width+8, 60);
            var h = box.height;
            var a = h/2;
            var vertices = [
              [0, 0], //ul
              [w, 0], //ur
              [w, h], //11
              [0, h], //lr
              [-a,a] //arrow point
            ];


          //Add tag (rect)
            var poly = svg.append("polygon")
                .attr("points", vertices.join(" "))
                .attr("transform", "translate("+ (tx+(a)) +","+ (ty-(a)) +")")
                .style("fill", color);

          //Add label
            var text = svg.append("text")
                .attr("transform", "translate("+ (tx+a+4) +","+ty +")")
                .attr("dy", ".35em")
                .attr("text-anchor", "start")
                .style("fill", "#fff")
                .text(label);


          //Update tags
            tags[type] = {
                poly: poly,
                text: text
            };
        }
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
        //productOptions.clear();
        productOptions.onChange = function(name, value){
            currProduct = value;
            title = value + " Time Series Views";

            var _data = data[currProduct];


          //Populate source combobox
            sourceOptions.clear();
            sourceOptions.add("All", "All");
            for (var i=0; i<_data.length; i++){
                var entry = _data[i];
                sourceOptions.add(entry.name, i);
            }
            sourceOptions.setValue("All");

            me.onUpdate();
        };



        td = document.createElement("td");
        td.style.paddingLeft = "15px";
        td.style.width = "65px";
        td.innerHTML = "Source:";
        tr.appendChild(td);
        td = document.createElement("td");
        td.style.width = "200px";
        tr.appendChild(td);
        sourceOptions = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });

        sourceOptions.onChange = function(name, value){
            groupOptions.clear();
            var _data = data[currProduct];

            if (value=="All"){
                groupOptions.hide();


              //Render combined data
                var arr = [];
                for (var i=0; i<_data.length; i++){
                    var entry = _data[i];
                    var groups = entry.groups;
                    var name = entry.name;
                    if (name=="RFI"){
                        var d = clone(groups["order vs fill (total)"]);
                        if (d){
                            for (var j=0; j<d.length; j++){
                                var t = d[j].type;
                                if (t=="order_total") t = "RFI Orders";
                                if (t=="fill_total") t = "RFI Fill";
                                d[j].type = t;
                            }
                            arr.push(...d);
                        }
                    }
                    else{
                        var d = clone(groups["total"]);
                        if (d){
                            for (var j=0; j<d.length; j++){
                                d[j].type = name;
                            }
                            arr.push(...d);
                        }
                    }
                }

                lineGraph.menu.select("Logarithmic");
                updateLineGraph(arr, "", null);

            }
            else{
                groupOptions.show();

              //Populate group options
                var groups = _data[value].groups;
                for (var name in groups) {
                    if (groups.hasOwnProperty(name)){
                        groupOptions.add(name, name);
                    }
                }


              //Update settings
                lineGraph.menu.select("Linear");


              //Select default value in the combobox
                var defaultView = "order vs fill (by distributor)";
                var foundDefault = false;
                var options = groupOptions.getOptions();
                if (options.length==0) return;
                for (var i=0; i<options.length; i++){
                    if (options[i].value==defaultView){
                        foundDefault = true;
                        break;
                    }
                }
                if (!foundDefault) defaultView = options[0].value;
                groupOptions.setValue(defaultView);
            }
        };


        td = document.createElement("td");
        td.style.width = "65px";
        td.style.paddingLeft = "15px";
        td.innerHTML = "Group:";
        var groupLabel = td;
        tr.appendChild(td);
        td = document.createElement("td");
        td.style.width = "320px";
        tr.appendChild(td);
        groupOptions = new javaxt.dhtml.ComboBox(td, {
            style: config.style.combobox,
            readOnly: true
        });
        var _show = groupOptions.show;
        var _hide = groupOptions.hide;

        groupOptions.show = function(){
            groupLabel.innerHTML = "Group:";
            _show();
        };

        groupOptions.hide = function(){
            groupLabel.innerHTML = "";
            _hide();
        };

        groupOptions.onChange = function(name, value){
            var groupName = value;
            var _data = data[currProduct];
            var entry = _data[sourceOptions.getValue()];
            var groups = entry.groups;
            var d = groups[groupName];
            if (d==null) return;
            var labelFunction = entry.labelFunction[groupName];
            updateLineGraph(clone(d), groupName, labelFunction);
        };


        td = document.createElement("td");
        tr.appendChild(td);
    };




  //**************************************************************************
  //** createTooltip
  //**************************************************************************
    var createTooltip = function(parent) {
        var div = document.createElement("div");
        div.className = "tooltip noselect";
        parent.appendChild(div);
        tooltip = d3.select(div);
    };


  //**************************************************************************
  //** drawTooltip
  //**************************************************************************
    var drawTooltip = function(node, x, data, labelFunction) {

      //Get date associated with the mouse position
        const date = roundToYM(x.invert(d3.mouse(node)[0]));


      //Update vertical line
        const xOffset = x(date);
        tooltipLine
          .attr('stroke', 'black')
          .attr('x1', xOffset)
          .attr('x2', xOffset);


      //Filter data by the selected date. Note that the data here is a clone
        data = data.filter(d => (d.date.slice(0, 7))==ymFormat(date));
        //data.sort((a, b) => b.value - a.value);



        var fmtNum = function(val) {
            val = Math.round(val).toLocaleString();
            return '<div style="text-align:right">' + val + '</div>';
        };

        var fmtLabel = function(label) {
            if (labelFunction) return labelFunction(label);
            var s = label;
            s = s.replaceAll('_', ' ');
            const words = s.split(' ');
            var ucwords = words.map(w => w.charAt(0).toUpperCase()+w.slice(1));
            return ucwords.join(' ');
        };


        var bound = tooltipLine.node().getBoundingClientRect();
        var html = document.documentElement;
        var minY = bound.left + window.pageXOffset - html.clientLeft;
        //var left = d3.event.pageX;
        //if (left<minY) left = minY;

        tooltip.html("<strong>"+ymFormat(date)+"</strong>")
            .style('display', 'block')
            //.style('left', left+20) //d3.event.pageX + 20
            .style('top', d3.event.pageY - 170)
            .append('table')
            .selectAll('tr')
            .data(data).enter()
                .append('tr')
                .selectAll('td')
                .data(d => [fmtLabel(d.type), fmtNum(d.value)]).enter()
                    .append('td')
                    .html(d => d);


      //Position the tooltip to the left of the vertical line
        var el = tooltip.node();
        var box = el.getBoundingClientRect();
        tooltip.style('left', minY-(box.width+30));
    };


  //**************************************************************************
  //** formatDate
  //**************************************************************************
  /** Returns date in YYYY-MM-DD format
   */
    var formatDate = function(date) {
        var d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;

        return [year, month, day].join('-');
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var createProductList = bluewave.utils.createProductList;
    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;


    var clone = function(json) {
        if (json==null) return null;
        return JSON.parse(JSON.stringify(json));
    };


    var ymFormat = d3.timeFormat("%Y-%m");
    var roundToYM = function(timeStamp) {
        const y = timeStamp.getFullYear();
        const m = timeStamp.getMonth();
        const result = new Date(y, m);
        if (timeStamp.getDate() > 15) {
            result.setMonth(result.getMonth()+1)
        }
        return result;
    };


    var isDateInArray = function(needle, haystack) {
        for (var i = 0; i < haystack.length; i++) {
            if (needle.getTime() === haystack[i].getTime()) {
                return true;
            }
        }
        return false;
    };

    var getUniqueDates = function(dates) {
        var uniqueDates = [];
        for (var i = 0; i < dates.length; i++) {
            if (!isDateInArray(dates[i], uniqueDates)) {
                uniqueDates.push(dates[i]);
            }
        }
        return uniqueDates;
    };


    init();
};