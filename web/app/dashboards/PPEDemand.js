if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};


//******************************************************************************
//**  PPEDemand
//******************************************************************************
/**
 *   Used to estimate PPE demand using hospitalization rates
 *
 ******************************************************************************/

bluewave.dashboards.PPEDemand = function(parent, config) {

    var me = this;
    var title = "Estimating PPE Demand Using COVID Hospitalizations";
    var trendGraph, stateGraph, mapGraph, grid;
    var monthOptions;
    var slider;
    var allWeeks = [];


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
        td.style.height = "395px";
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
        innerDiv.style.width = "1328px";
        div.appendChild(innerDiv);


        trendGraph = createDashboardItem(innerDiv, {
          width: 360,
          height: 320,
          title: "Increased Hospitilization Rates",
          waitmask: true
        });

        stateGraph = createDashboardItem(innerDiv, {
          width: 360,
          height: 320,
          title: "Hospital Capacity By State",
          subtitle: "Ordered By Increased Demand",
          waitmask: true
        });

        mapGraph = createDashboardItem(innerDiv, {
          width: 480,
          height: 320,
          title: "Predicted Shortages",
          waitmask: true
        });



      //Create grid
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "100%";
        td.style.textAlign = "center";
        tr.appendChild(td);
        createGrid(td);


        parent.appendChild(table);
        me.el = table;
    };


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
        allWeeks = [];
        monthOptions.clear();
        if (grid) grid.clear();


        trendGraph.waitmask.show();
        stateGraph.waitmask.show();
        mapGraph.waitmask.show();
        grid.waitmask.show();
        getData("Bed_Utilization_Per_State_AllWeeks", function(data){

            var rows = parseCSV(data);
            var weeks = [];
            for (var i=1; i<rows.length; i++){
                var d = rows[i];
                var week = d[0];
                rows[i] = {
                    collection_week: week,
                    state: d[1],
                    rate: parseFloat(d[2])
                };
                weeks.push(week);
            };
            allWeeks = rows;

            var weeks = [...new Set(weeks)];
            weeks.sort(function(a,b){
                a = parseInt(a.replace(/-/g, '').replace(/\//g, ''));
                b = parseInt(b.replace(/-/g, '').replace(/\//g, ''));
                return b-a;
            });


            for (var i=0; i<weeks.length; i++){
                var week = weeks[i];
                monthOptions.add(week, i);
            }

            var options = monthOptions.getOptions();
            monthOptions.setValue(options[0].value);
            slider.setAttribute("max", options.length);
        });

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(week, prevWeek){

        var params = "";
        if (week || prevWeek){
            params = "?";
            if (week) params += "&week=" + week;
            if (prevWeek) params += "&prevWeek=" + prevWeek;
        }



        renderTrends(allWeeks, function(topStates){
            trendGraph.waitmask.hide();


            var states = {};
            topStates.forEach(function(record) {
                var state = record.state;
                states[state] = true;
            });


            getData("Beds_Per_State_CurrWeek"+params, function(csv){
                var filteredData = [];
                var rows = parseCSV(csv);
                for (var i=1; i<rows.length; i++){
                    var d = rows[i];
                    d = {
                        state: d[0],
                        suspected_cases: parseInt(d[1]),
                        beds_used: parseInt(d[2]),
                        total_beds: parseInt(d[3])
                    };
                    d.available_beds = d.total_beds-d.beds_used;



                    if (states[d.state]){
                        var change;
                        for (var j in topStates){
                            if (topStates[j].state == d.state){
                                change = topStates[j].change;
                            }
                            else{
                                if (change) break;
                            }
                        }


                        filteredData.push({
                            state: d.state,
                            available_beds: parseInt(d.available_beds),
                            total_beds: parseInt(d.total_beds),
                            suspected_cases: parseInt(d.suspected_cases),
                            change: change
                        });
                    }
                }
                renderStates(filteredData);
                stateGraph.waitmask.hide();
            });
        });




        getData("Beds_Per_Hospital_PrevWeek"+params, function(csv){
            var data = [];
            var rows = parseCSV(csv);
            var header = rows[0];
            for (var i=1; i<rows.length; i++){
                var row = rows[i];
                var rec = {};
                for (var j in header){
                    var key = header[j];
                    var val = row[j];
                    if (j>2) val = parseFloat(val);
                    rec[key] = val;
                }
                data.push(rec);
            }

            updateMap(data, function(data){
                mapGraph.waitmask.hide();
                updateTable(data);
                grid.waitmask.hide();
            });
        });

    };


  //**************************************************************************
  //** updateMap
  //**************************************************************************
    var updateMap = function(data, callback){

        var innerDiv = mapGraph.innerDiv;
        innerDiv.innerHTML = "";

      //Subtract 20px height
        //innerDiv.style.marginTop = "-20px";
        //mapGraph.innerDiv.parentNode.style.height = "320px";


        // Define path generator
        var path = d3.geoPath();


      //set the dimensions and margins of the graph
        var margin = {top: 0, right: 0, bottom: 0, left: 0},
        width = 480;//innerDiv.offsetWidth - margin.left - margin.right,
        height = 330; //innerDiv.offsetHeight - margin.top - margin.bottom;



        var svg = d3.select(innerDiv)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
            .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");



        d3.json("data/states-albers-10m.json").then(function(mapData) {

          //Render country polygon
            svg.append("path")
              .attr("class", "state-lines")
              .attr("d", path(topojson.feature(mapData, mapData.objects.nation)))

            .attr("transform",
              "scale(0.5)");


          //Render state lines
            svg.append("path")
              .attr("class", "state-lines")
              .attr("d", path(
                    topojson.mesh(mapData, mapData.objects.states, function (a, b) {
                      return a !== b;
                    })
                  )
              )

              .attr("transform",
              "scale(0.5)");


            var projection = d3.geoAlbersUsa().scale(650).translate([(width/2)+3, (height/2)-12]);

            data.forEach(function(d) {
                var lat = parseFloat(d.lat);
                var lon = parseFloat(d.lon);
                if (isNaN(lat) || isNaN(lon))return;
                var coord = projection([lon, lat]);
                if (!coord) return;

                var rate = parseFloat(d.beds_used)/parseFloat(d.total_beds);
                var prevRate = parseFloat(d.prev_beds_used)/parseFloat(d.prev_total_beds);
                if (isNaN(rate) || isNaN(prevRate)) return;

                var change = rate-prevRate;
                if (change<=0) return;
                var color = change>0 ? "#FF3C38" : "#6699CC";
                if (change<0) change = -change;

                svg.append("circle")
                .attr("cx", coord[0])
                .attr("cy", coord[1])
                .attr("r", change*20)
                .style("fill", color)
                .style("opacity", 0.65);
            });


            if (callback) callback.apply(this, [data]);
        });
    };


  //**************************************************************************
  //** renderTrends
  //**************************************************************************
    var renderTrends = function(data, callback){

        var subtitle = trendGraph.subtitle;
        var innerDiv = trendGraph.innerDiv;
        innerDiv.innerHTML = "";


      //set the dimensions and margins of the graph
        var margin = {top: 20, right: 0, bottom: 50, left: 20},
        width = innerDiv.offsetWidth - margin.left - margin.right,
        height = innerDiv.offsetHeight - margin.top - margin.bottom;



      //set the ranges
        var x = d3.scaleTime().range([0, width]);
        var y = d3.scaleLinear().range([height, 0]);


      //create svg
        var svg = d3.select(innerDiv).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
            .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");



      //Group the data by state
        var states = {};
        for (var i in data){
            var d = data[i];
            var arr = states[d.state];
            if (!arr){
                arr = [];
                states[d.state] = arr;
            }
            arr.push(d);
        }
        data = [];



      //Create lines for each state
        var lines = {};
        for (var state in states) {
            if (states.hasOwnProperty(state)){

              //Sort data for each state by week
                var arr = states[state];
                arr.sort((a, b) => (a.collection_week > b.collection_week) ? 1 : -1);

              //Add rate of change property to each entry in the array
                arr[0].change = 0;
                for (var i=1; i<arr.length; i++){
                    var currWeek = arr[i];
                    var prevWeek = arr[i-1];
                    currWeek.change = currWeek.rate-prevWeek.rate;
                }

              //Create line function for the state
                lines[state] = d3.line()
                    .x(function(d) { return x(d.date); })
                    .y(function(d) { return y(d.change); });


              //Update data
                data.push(...arr);
            }
        }




        var filterData = true;
        if (filterData){

          //Find states with the biggest positive rate change
            var increasingRates = [];
            for (var state in states) {
                if (states.hasOwnProperty(state)){
                    var arr = states[state];
                    var lastEntry = arr[arr.length-1].change;
                    if (lastEntry>0) increasingRates.push({
                        state: state,
                        change: lastEntry
                    });
                }
            }

            if (increasingRates.length>0){
                increasingRates.sort((a, b) => (a.change > b.change) ? -1 : 1);
                var filteredStates = {};
                data = [];
                var maxEntries = Math.min(8, increasingRates.length);
                for (var i=0; i<maxEntries; i++){
                    var key = increasingRates[i].state;
                    var arr = states[key];
                    filteredStates[key] = arr;
                    data.push(...arr);
                }
                states = filteredStates;
                subtitle.innerHTML = "Top States";
            }
        }



      //format the data
        var minY = 100;
        var maxY = -100;
        var parseTime = d3.timeParse("%Y-%m-%d"); //2020-08-07
        data.forEach(function(d) {
            d.date = parseTime(d.collection_week.replace(/\//g, '-'));
            minY = Math.min(minY,d.change);
            maxY = Math.max(maxY,d.change);
        });


      //Scale the range of the data
        x.domain(d3.extent(data, function(d) { return d.date; }));
        y.domain([minY, maxY]);


        var colors = [
            '#C6EDD3',
            '#98DFAF',

            '#FF8280',
            '#FF3C38',

            '#FFB586',
            '#FF8C42',

            '#9DBEDE',
            '#6699CC'
        ];


      //Add lines
        var idx = 0;
        for (var state in states) {
            if (states.hasOwnProperty(state)){

                var line = lines[state];
                var arr = states[state].slice(1); //slice off the first value in the array
                var color = colors[idx];
                idx++;
                if (idx>colors.length) idx = 0;

                svg.append("path")
                  .data([arr])
                  .attr("class", "line")
                  .style("stroke", color)
                  .attr("d", line);
            }
        }


//      //Add the X Axis
//        svg.append("g")
//          .attr("transform", "translate(0," + height + ")")
//          .call(d3.axisBottom(x));



          //Add x-axis
            svg.append("g")
                .attr("class", "axis")
                .attr("transform", "translate(0,"+height+")")
                .call(d3.axisBottom(x).ticks(null, "s"));


          //Add y-axis
            svg.append("g")
                .attr("class", "axis")
                .call(d3.axisLeft(y));


        if (callback) callback.apply(this, [data]);
    };


  //**************************************************************************
  //** renderStates
  //**************************************************************************
    var renderStates = function(data){

        var innerDiv = stateGraph.innerDiv;
        innerDiv.innerHTML = "";


      //set the dimensions and margins of the graph
        var margin = {top: 20, right: 10, bottom: 50, left: 30},
        width = innerDiv.offsetWidth - margin.left - margin.right,
        height = innerDiv.offsetHeight - margin.top - margin.bottom;



      //create svg
        var svg = d3.select(innerDiv).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

        var g = svg.append("g")
            .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");


        var y = d3.scaleBand()
            .rangeRound([0, height])
            .paddingInner(0.2)
            .align(0.1);

        var x = d3.scaleLinear()
            .rangeRound([0, width]);



        var colors = ["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"];
        var colors = [" #FF8C42", "#98DFAF", "#C6EDD3"];
        var keys = ["suspected_cases","other_beds","available_beds"];

        var z = d3.scaleOrdinal()
            .range(colors);



        data.forEach(function(d) {
            var usedBeds = d.total_beds-d.available_beds;
            d.other_beds = usedBeds-d.suspected_cases;
        });
        data.sort(function(a, b) { return b.change - a.change; });


        y.domain(data.map(function(d) { return d.state; }));
        x.domain([0, d3.max(data, function(d) { return d.total_beds; })]).nice();



        z.domain(keys);

      //Add bars
        g.append("g")
          .selectAll("g")
          .data(d3.stack().keys(keys)(data))
          .enter().append("g")
            .attr("fill", function(d) { return z(d.key); })
          .selectAll("rect")
          .data(function(d) { return d; })
          .enter().append("rect")
            .attr("y", function(d) { return y(d.data.state); })
            .attr("x", function(d) { return x(d[0]); })
            .attr("width", function(d) { return x(d[1]) - x(d[0]); })
            .attr("height", y.bandwidth());


      //Add x-axis
        g.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0,"+height+")")
            .call(d3.axisBottom(x).ticks(null, "s"))
          .append("text")
            .attr("y", 2)
            .attr("x", x(x.ticks().pop()) + 0.5);

      //Add y-axis
        g.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y));
    };


  //**************************************************************************
  //** createGrid
  //**************************************************************************
    var createGrid = function(parent){
        var div = document.createElement("div");
        div.className = "dashboard-item";
        div.style.width = "1304px";
        div.style.height = "100%";
        div.style.padding = "0px";
        div.style.float = "none";
        parent.appendChild(div);

        grid = new javaxt.dhtml.Table(div, {
            style: javaxt.dhtml.style.default.table,
            columns: [
                {header: 'ID', hidden:true},
                {header: 'Name', width:'100%'},
                {header: 'State', width:'150'},
                {header: 'COVID Patients', width:'150', align:"center"},
                {header: 'Total Beds', width:'150', align:"center"},
                {header: 'Total Occupancy', width:'150', align:"center"},
                {header: 'Weekly Change', width:'150', align:"center"}
            ]
        });

        grid.waitmask = new javaxt.express.WaitMask(div);
    };


  //**************************************************************************
  //** updateTable
  //**************************************************************************
    var updateTable = function(data){

        grid.clear();
        setTimeout(function(){

            data.forEach(function(d) {
                var rate = parseFloat(d.beds_used)/parseFloat(d.total_beds);
                var prevRate = parseFloat(d.prev_beds_used)/parseFloat(d.prev_total_beds);
                if (isNaN(rate) || isNaN(prevRate)) return;
                d.change = rate-prevRate;
            });
            data.sort((a, b) => (a.change > b.change) ? -1 : 1);

            var arr = [];
            data.forEach(function(d) {
                if (isNaN(d.change)) return;

                var change = javaxt.dhtml.utils.round(d.change*100,1)+"%";
                if (d.change>0){
                    change = '<div style="color:#FF3C38"><i class="fas fa-arrow-up" style="margin-right:5px"></i>' + change + "</div>";
                }
                else{
                    change = '<div style="color:#98DFAF"><i class="fas fa-arrow-down" style="margin-right:5px"></i>' + change + "</div>";
                }


                arr.push([
                    d.hospital_pk,
                    d.hospital_name,
                    d.state,
                    d.suspected_cases,
                    d.total_beds,
                    javaxt.dhtml.utils.round((d.beds_used/d.total_beds)*100,1) + "%",
                    change
                ]);
            });

            var rows = arr.slice(0,50);
            grid.addRows(rows);

        }, 500);

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
        monthOptions.onChange = function(name, value){
            var options = monthOptions.getOptions();
            var week = name;
            var prevWeek = options[value+1].text;

            if (!sliding){
                for (var i in options){
                    var option = options[i];
                    if (option.value===value){
                        slider.value = i;
                        break;
                    }
                }
            }
            trendGraph.waitmask.show();
            stateGraph.waitmask.show();
            mapGraph.waitmask.show();
            grid.waitmask.show();
            update(week, prevWeek);
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
            sliding = true;
            var val = this.value-1;
            monthOptions.setValue(val);
            sliding = false;
        };
        td.appendChild(slider);
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var createDashboardItem = bluewave.utils.createDashboardItem;
    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;


    init();
};
