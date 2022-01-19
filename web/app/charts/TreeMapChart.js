
const logger = {
    log() {          // Generic method logging all arguments.
        console.log(...arguments);
        return this;
    },
    
    logMsg(msg) {    // Logging just a simple msg.
        console.log(msg);
        return this;
    },
    
    logSel() {       // Log the selection.
        console.log(this);
        return this;
    },
    
    logAttr(name) {  // Log the attributes with "name" for all selected elements.
        this.each(function(d, i) {
        let attr = d3.select(this).attr(name);
        console.log(`Node ${i}: ${name}=${attr}`);
        });
        return this;
    },

    logText(name) {  // Log the text attached to this object
        this.each(function(d, i) {
            let text = d3.select(this).text();
            console.log(`Node ${name}: ${name}=${text}`);
        });
        return this;
        },
    
    logData() {      // Log the data bound to this selection.
        console.log(this.data());
        return this;
    },
    
    logNodeData() {  // Log datum per node.
        this.each(function(d, i) {
        console.log(`Node ${i}: ${d}`);
        });
        return this;
    }
    };
    
    // this assigns the d3.selection "class like thing" to have the logging attribute capabilities
    Object.assign(d3.selection.prototype, logger);


if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  TreeMapChart
//******************************************************************************
/**
 *   Panel used to create tree map charts
 *
 ******************************************************************************/

bluewave.charts.TreeMapChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin : {top: 10, right: 10, bottom: 10, left: 10},
        // dayLabel: true,
        // yearLabel: true,
        key: "name",
        value: "value",
        groupBy: null, 
        colors: [ "#402D54", "#D18975", "#8FD175"], //first set of colors
        // showTooltip: false
    };
    var svg, treeMapArea;



  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        me.setConfig(config);

        initChart(parent, function(s, g){
            svg = s;
            treeMapArea = g;
        });

    };


  //**************************************************************************
  //** setConfig
  //**************************************************************************
    this.setConfig = function(chartConfig){
        if (!chartConfig) config = defaultConfig;
        else config = merge(chartConfig, defaultConfig);

    };

  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (treeMapArea) treeMapArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){

        me.clear();

        config = merge(chartConfig, defaultConfig);

        var parent = svg.node().parentNode;
        onRender(parent, function(){
            renderChart(data);
        });
    };


  //**************************************************************************
  //** renderChart
  //**************************************************************************
    var renderChart = function(data){

        var chartConfig = config;
        console.log(data)

        if (config.groupBy !== null){
            groupNames = [] // populate this by filtering through the config-set dataset 'groupBy' column to seperate records into unique values of this column
            data.forEach((d)=>{
                group = d[config.groupBy]
                console.log(group)
                groupNames.push(group)
            });
        }

      //Update value fields in the data
        data.forEach((d)=>{
            var value = d[config.value];
            console.log(value)
            d[config.value] = parseFloat(value);
        });


        // //Create an array of names and values
        var names = [];
        var values = [];
        data.forEach((d)=>{
            var name = d[config.key];
            var value = d[config.value];
            names.push(name);
            values.push(value);

        });

        console.log("listed named, then listed values, and then listed groups")
        console.log(names)
        console.log(values)
        console.log(groupNames)

        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }

        var data = // base structure expected for d3.hierarchy
        {"children":
            [
                {"name":"boss1",
                "children":
                [
                    {"name":"mister_a","group":"A","value":28,"colname":"level3"},
                    {"name":"mister_b","group":"A","value":19,"colname":"level3"},
                    {"name":"mister_c","group":"C","value":18,"colname":"level3"},
                    {"name":"mister_d","group":"C","value":19,"colname":"level3"}
                ],
                "colname":"level2"},
                {"name":"boss2",
                "children":
                [
                    {"name":"mister_e","group":"C","value":14,"colname":"level3"},
                    {"name":"mister_f","group":"A","value":11,"colname":"level3"},
                    {"name":"mister_g","group":"B","value":15,"colname":"level3"},
                    {"name":"mister_h","group":"B","value":16,"colname":"level3"}
                ],
                "colname":"level2"},
                {"name":"boss3",
                "children":
                [
                    {"name":"mister_i","group":"B","value":10,"colname":"level3"},
                    {"name":"mister_j","group":"A","value":13,"colname":"level3"},
                    {"name":"mister_k","group":"A","value":13,"colname":"level3"},
                    {"name":"mister_l","group":"D","value":25,"colname":"level3"},
                    {"name":"mister_m","group":"D","value":16,"colname":"level3"},
                    {"name":"mister_n","group":"D","value":28,"colname":"level3"}
                ],
                "colname":"level2"}
            ],
        "name":"CEO"}


        var namesToUse = names.filter(onlyUnique);
        var groupsToUse = groupNames.filter(onlyUnique);
        console.log(namesToUse)
        console.log(groupsToUse)
        data.forEach((d)=>{

        })

        return 

        // data = // modify data so it fits into the format for hierarchy

        // set the dimensions of the graph
        var
        width = parent.offsetWidth - config.margin.left - config.margin.right,
        height = parent.offsetHeight - config.margin.top - config.margin.bottom;


        // Give the data to this cluster layout:
        var root = d3.hierarchy(data).sum(function(d){ return d.value}) // Here the size of each leave is given in the 'value' field in input data

        // Use d3.treemap to compute the position of each element of the hierarchy
        d3.treemap()
            .size([width, height])
            .paddingTop(28)
            .paddingRight(7)
            .paddingInner(3)      // Padding between each rectangle
            //.paddingOuter(6)
            //.padding(20)
            (root)

        // color scale
        var color = d3.scaleOrdinal()
            .domain(groupNames)
            .range(config.colors)   

        // opacity scale
        var opacity = d3.scaleLinear()
            .domain([10, 30])
            .range([.5,1])

        console.log(root)
        console.log(root.leaves())
        // add rectangles
        svg
            .selectAll("rect")
            .data(root.leaves())
            .logData()
            .enter()
            .append("rect")
            .attr('x', function (d) { return d.x0; })
            .attr('y', function (d) { return d.y0; })
            .attr('width', function (d) { return d.x1 - d.x0; })
            .attr('height', function (d) { return d.y1 - d.y0; })
            .style("stroke", "black")
            // .logMsg(data.parent.data.name)
            .style("fill", function(d){ return color(d.parent.data.name)} )
            .style("opacity", function(d){ return opacity(d.data.value)})

        // add text labels
        svg
            .selectAll("text")
            .data(root.leaves())
            .enter()
            .append("text")
            .attr("x", function(d){ return d.x0+5})    // +10 to adjust position (more right)
            .attr("y", function(d){ return d.y0+20})    // +20 to adjust position (lower)
            .text(function(d){ return d.data.name})
            .attr("font-size", "19px")
            .attr("fill", "white")

        // add text labels
        svg
            .selectAll("vals")
            .data(root.leaves())
            .enter()
            .append("text")
            .attr("x", function(d){ return d.x0+5})    // +10 to adjust position (more right)
            .attr("y", function(d){ return d.y0+35})    // +20 to adjust position (lower)
            .text(function(d){ return d.data.value })
            .attr("font-size", "11px")
            .attr("fill", "white")

        // Add title for each group
        svg
            .selectAll("titles")
            .data(root.descendants().filter(function(d){return d.depth==1}))
            .enter()
            .append("text")
            .attr("x", function(d){ return d.x0})
            .attr("y", function(d){ return d.y0+21})
            .text(function(d){ return d.data.name })
            .attr("font-size", "19px")
            .attr("fill",  function(d){ return color(d.data.name)} )

        // Add title for each group
        svg
            .append("text")
            .attr("x", 0)
            .attr("y", 14)    // +20 to adjust position (lower)
            .attr("font-size", "19px")
            .attr("fill",  "grey" )


    }
  //**************************************************************************
  //** Utils
  //**************************************************************************
   var merge = javaxt.dhtml.utils.merge;
   var onRender = javaxt.dhtml.utils.onRender;
   var initChart = bluewave.chart.utils.initChart;
   var getColorRange = bluewave.chart.utils.getColorRange;
   var getNaturalBreaks = bluewave.chart.utils.getNaturalBreaks;
   var getHighestElements = javaxt.dhtml.utils.getHighestElements;


   init();


}