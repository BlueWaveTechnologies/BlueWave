
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
        // margin : {top: 10, right: 10, bottom: 10, left: 10},
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
        console.log("clear function ran")
        if (treeMapArea) treeMapArea.selectAll("*").remove();
    };



  //**************************************************************************
  //** setDataHierarchy
  //**************************************************************************
  // modify data so it fits into the format for d3.hierarchy
    var setDataHierarchy = function(data){

        if (config.groupBy !== null){
            groupNames = [] // populate this by filtering through the config-set dataset 'groupBy' column to seperate records into unique values of this column
            data.forEach((d)=>{
                group = d[config.groupBy]
                groupNames.push(group)
            });

            function onlyUnique(value, index, self) { // returns only unique values from an array
                return self.indexOf(value) === index;
            }
    
    
            var groupsToUse = groupNames.filter(onlyUnique);
        }

      //Update value fields in the data
        data.forEach((d)=>{
            var value = d[config.value];
            d[config.value] = parseFloat(value);
        });




        dataHierarchy = 
        {"children":
            [],

        "name":"all"}

        const customFilter = (object, key, value) => {
            if (Array.isArray(object)) {
              for (const obj of object) {
                const result = customFilter(obj, key, value);
                if (result) {
                  return obj;
                }
              }
            } else {
              if (object.hasOwnProperty(key) && object[key] === value) {
                return object;
              }
              for (const k of Object.keys(object)) {
                if (typeof object[k] === "object") {
                  const o = customFilter(object[k], key, value);
                  if (o !== null && typeof o !== 'undefined')
                    return o;
                }
              }
              return null;
            }
          }


        if (config.groupBy !== null){

            groupsToUse.forEach((g)=> {
                dataHierarchy["children"].push({"name": g, "children":[], "colname":"level2"})
                objectToInsertTo = customFilter(dataHierarchy["children"], 'name', g)

                data.forEach((d)=>{
                    userValue = d[config.key]
                    groupByValue = d[config.groupBy]
                    value = d[config.value]

                    if (g === groupByValue){
                        // check whether this user already exists - if he does then accumulate values with pre-existing record
                        if (typeof(customFilter(objectToInsertTo["children"],"name", userValue)) !== "undefined"){
                            userRecord = customFilter(objectToInsertTo["children"],"name", userValue) 
                            userRecord["value"] = userRecord["value"] + value
                        }
                        else {    // create new user record 
                            objectToInsertTo["children"].push({"name": userValue,"group": groupByValue, "colname":"level3","value":value})
                        }
                    }
                })
            })
        }

        else{
            dataHierarchy["children"].push({"name": "", "children":[], "colname":"level2"})
            objectToInsertTo = customFilter(dataHierarchy["children"], 'name', "")

            data.forEach((d)=>{
                userValue = d[config.key]
                value = d[config.value]
                groupByValue = ""
                // check whether this user already exists - if he does then accumulate values with pre-existing record
                if (typeof(customFilter(objectToInsertTo["children"],"name", userValue)) !== "undefined"){
                    userRecord = customFilter(objectToInsertTo["children"],"name", userValue) 
                    userRecord["value"] = userRecord["value"] + value
                }

                else {    // create new user record 
                    objectToInsertTo["children"].push({"name": userValue,"group": groupByValue, "colname":"level3","value":value})
                }
                
            })

        }
        return dataHierarchy
    }



  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){

        me.clear();

        config = merge(chartConfig, defaultConfig);

        var data = setDataHierarchy(data);

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
        

        // set the dimensions of the graph
        var
        width = parent.offsetWidth - chartConfig.margin.left - chartConfig.margin.right,
        height = parent.offsetHeight - chartConfig.margin.top - chartConfig.margin.bottom;


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
        if (typeof(groupNames) !== "undefined"){
            var color = d3.scaleOrdinal()
                .domain(groupNames)
                .range(chartConfig.colors)   
        }
        else{
            var color = d3.scaleOrdinal()
                .range(chartConfig.colors)
        }

        // opacity scale
        var opacity = d3.scaleLinear()
            .domain([10, 30])
            .range([.5,1])

        // add rectangles
        treeMapArea
            .selectAll("rect")
            .data(root.leaves())
            .enter()
            .append("rect")
            .attr('x', function (d) { return d.x0; })
            .attr('y', function (d) { return d.y0; })
            .attr('width', function (d) { return d.x1 - d.x0; })
            .attr('height', function (d) { return d.y1 - d.y0; })
            .style("stroke", "black")
            .style("fill", function(d){ return color(d.parent.data.name)} )
            .style("opacity", function(d){ return opacity(d.data.value)})

        // add text labels
        treeMapArea
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
        treeMapArea
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
        treeMapArea
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
        treeMapArea
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