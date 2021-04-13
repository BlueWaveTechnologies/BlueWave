if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

bluewave.dashboards.CovidDashboard = function(parent, config) {

    var me = this;
    var title = "";
    var svg, path; //d3 stuff
    var countiesAndStates; //topojson
    var dates = [];
    var covidData = {};
    var form;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        var div = document.createElement("div");
        div.style.height = "100%";
        div.style.textAlign = "center";
        parent.appendChild(div);
        me.el = div;

        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        innerDiv.style.display = "inline-block";
        div.appendChild(innerDiv);

        createMap(innerDiv);
        createForm(innerDiv);
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
        dates = [];
        covidData = {};

        getCountiesAndStates(function(topo_data){
            getData("Distinct_Dates_In_Covid_Cases", function(csv){
                var rows = csv.split("\n");
                for (var i=1; i<rows.length; i++){
                    dates.push(rows[i]);
                }


                var week = "";
                for (var i=0; i<7; i++){
                    if (i>0) week+=",";
                    week+=dates[i];
                }


                var countyData = {};
                getData("Covid_Cases_By_County?dates=" + week, function(data){
                    var rows = parseCSV(data);
                    var header = rows[0]; //["county", "date", "total", "new", "type"]
                    for (var i=1; i<rows.length; i++){
                        var col = rows[i];
                        var fips = col[0];
                        var date = col[1];
                        var total = parseInt(col[2]);
                        var newCases = parseInt(col[3]);
                        var type = col[4];
                        var countyData = covidData[fips];
                        if (!countyData){
                            countyData = {};
                            covidData[fips] = countyData;
                        }

                        if (!countyData[date]) countyData[date] = {};
                        countyData[date][type] = {
                            total: total,
                            newCases: newCases
                        };
                    }

                    form.setValue("type", "new_cases_7_day_average");
                });

            });
        });
    };


  //**************************************************************************
  //** onUpdate
  //**************************************************************************
  /** Fired whenever the view is updated by the user
   */
    this.onUpdate = function(){};


  //**************************************************************************
  //** createMap
  //**************************************************************************
    var createMap = function(parent){
        var div = document.createElement("div");
        div.className = "dashboard-item";
        parent.appendChild(div);

        svg = d3
        .select(div)
        .append("svg")
        .attr("width", 1000)
        .attr("height", 640);

        path = d3.geoPath();
    };


  //**************************************************************************
  //** createForm
  //**************************************************************************
    var createForm = function(parent){
        var div = document.createElement("div");
        div.className = "dashboard-item";
        div.style.width = "250px";
        div.style.height = "85px";
        parent.appendChild(div);

        form = new javaxt.dhtml.Form(div, {
            style: config.style.form,
            items: [
                {
                    name: "type",
                    label: "",
                    type: "radio",
                    alignment: "vertical",
                    options: [
                        {
                            label: "Weekly new cases",
                            value: "new_cases_7_day_average"
                        },
                        {
                            label: "Weekly new deaths",
                            value: "new_deaths_7_day_average"
                        }
                        /*
                        {
                            label: "Population",
                            value: "population"
                        }
                        */
                    ]
                }
            ]
        });
        form.onChange = function(formInput, value){
            if (value=="new_cases_7_day_average") title = "New COVID Cases - 7 Day Average";
            if (value=="new_deaths_7_day_average") title = "New COVID Deaths - 7 Day Average";
            //if (value=="population") title = "US Population";
            update(value);
        };
    };


    var colorScale = {
        "new_cases_7_day_average": d3.scaleQuantize([0, 4], d3.schemeReds[9]),
        "new_deaths_7_day_average": d3.scaleQuantize([0, 2.1], d3.schemeReds[9]),
        "population": d3.scaleQuantize([3, 7], d3.schemeReds[9]),
    };


    var labels = {
        new_cases_7_day_average: " new cases",
        new_deaths_7_day_average: " new deaths",
        population: " pop."
    };


  //**************************************************************************
  //** callout
  //**************************************************************************
    var callout = function(g, value) {
        if (!value) return g.style("display", "none");

        g.style("display", null)
          .style("pointer-events", "none")
          .style("font", "10px sans-serif");

        var path = g
          .selectAll("path")
          .data([null])
          .join("path")
          .attr("fill", "white")
          .attr("stroke", "black");

        var text = g
          .selectAll("text")
          .data([null])
          .join("text")
          .call(function(text) {
            text.selectAll("tspan")
              .data((value + "").split("/\n/"))
              .join("tspan")
              .attr("x", 0)
              .attr("y", function(d, i) {
                return i * 1.1 + "em";
              })
              .style("font-weight", function(_, i) {
                return i ? null : "bold";
              })
              .text(function(d) {
                return d;
              });
          });

        var x = text.node().getBBox().x;
        var y = text.node().getBBox().y;
        var w = text.node().getBBox().width;
        var h = text.node().getBBox().height;

        text.attr(
          "transform",
          "translate(" + -w / 2 + "," + (15 - y) + ")"
        );
        path.attr(
          "d",
          "M" +
            (-w / 2 - 10) +
            ",5H-5l5,-5l5,5H" +
            (w / 2 + 10) +
            "v" +
            (h + 20) +
            "h-" +
            (w + 20) +
            "z"
        );
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(selectedColumn){
        var topo_data = countiesAndStates;


        var data = new Map();
        for (var fips in covidData) {
            if (covidData.hasOwnProperty(fips)){
                var countyData = covidData[fips];

                var total = 0;
                for (var date in countyData) {
                    if (countyData.hasOwnProperty(date)){
                        var entry;
                        if (selectedColumn=="new_cases_7_day_average"){
                            entry=countyData[date]['Confirmed'];
                        }
                        else if (selectedColumn=="new_deaths_7_day_average"){
                            entry=countyData[date]['Deaths'];
                        }
                        if (entry){
                            if (!isNaN(entry.newCases)) total+=entry.newCases;
                        }
                    }
                }

                data.set(parseInt(fips), total>0 ? total/7 : 0);
            }
        }
        //console.log(data);


        /*
        d3.csv("data/new_cases_and_deaths_by_county.csv")
          .then(function(arr) {
              //Array contains json entries like this:
              //{idx: "0", FIPS: "1001.0", new_cases_7_day_average: "48.42857142857143", new_deaths_7_day_average: "0.14285714285714285", population: "55869.0"}

              var data = new Map(arr.map(function(d) {
                  return [parseInt(d.FIPS), +d[selectedColumn]];
              }));
          console.log(data);
        });
        */


      //Create map
        var map = svg.append("g");


      //Add counties
        var counties = map.selectAll("path")
          .data(
            topojson.feature(
              topo_data,
              topo_data.objects.counties
            ).features
          )
          .join("path")
          .attr("fill", function(d) {
              var v = data.get(parseInt(d.id));
              if (v==null || v<0) v = 0;
              else v = Math.log10(1+v);
              return colorScale[selectedColumn](v);
          })
          .attr("d", path);


      //Add state boundaries
        map
          .append("path")
          .attr("fill", "none")
          .attr("stroke", "white")
          .attr("d", path(
              topojson.mesh(
                topo_data,
                topo_data.objects.states,
                function(a, b) {
                  return a !== b;
                }
              )
            )
          );



      //Add tooltip
        var tooltip = svg.append("g");
        var states = new Map(
            topo_data.objects.states.geometries.map(function(d) {
                return [d.id, d.properties];
            })
        );
        counties
          .on("mouseover", function(d) {
            tooltip.call(
              callout,
              Math.round(data.get(parseInt(d.id))) + labels[selectedColumn] + "/\n/" +
              d.properties.name + ", " + states.get(d.id.slice(0, 2)).name
            );
            d3.select(this)
              .attr("stroke", "yellow")
              .raise();
          })
          .on("mousemove", function() {
            tooltip.attr(
              "transform",
              "translate(" +
                d3.mouse(this)[0] +
                "," +
                d3.mouse(this)[1] +
                ")"
            );
          })
          .on("mouseout", function() {
            tooltip.call(callout, null);
            d3.select(this)
              .attr("stroke", null)
              .lower();
          });


      //Notify update
        me.onUpdate();
    };


  //**************************************************************************
  //** getCountiesAndStates
  //**************************************************************************
  /** Returns topjson dataset representing counties and states in the USA
   */
    var getCountiesAndStates = function(callback){
        if (countiesAndStates){
            callback.apply(null, [countiesAndStates]);
        }
        else{
            d3.json("data/counties-albers-10m.json")
              .then(function(topo_data) {
                  countiesAndStates = topo_data;
                  callback.apply(null, [countiesAndStates]);
            });
        }
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