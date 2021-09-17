if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  LineChart
//******************************************************************************
/**
 *   Panel used to create line charts
 *
 ******************************************************************************/

bluewave.charts.LineChart = function(parent, config) {

    var me = this;
    var defaultConfig = {
        margin: {
            top: 15,
            right: 5,
            bottom: 65,
            left: 82
        }
    };
    var svg, plotArea;
    var xAxis, yAxis;
    var axisWidth, axisHeight;
    var x, y, xBand, yBand;
    var timeAxis;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        config = merge(config, defaultConfig);


        if (parent instanceof d3.selection){
            svg = parent;
        }
        else if (parent instanceof SVGElement) {
            svg = d3.select(parent);
        }
        else{
            svg = d3.select(parent).append("svg");
            onRender(parent, function(){
                var width = parent.offsetWidth;
                var height = parent.offsetHeight;
                svg.attr("width", width);
                svg.attr("height", height);
            });
        }

        plotArea = svg.append("g");
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        if (plotArea) plotArea.selectAll("*").remove();
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(chartConfig, data){
        me.clear();

        var parent = svg.node().parentNode;
        onRender(parent, function(){

            var width = parent.offsetWidth;
            var height = parent.offsetHeight;
            var margin = config.margin;
            axisHeight = height - margin.top - margin.bottom;
            axisWidth = width - margin.left - margin.right;
            var plotHeight = height - margin.top - margin.bottom;
            var plotWidth = width - margin.left - margin.right;
            plotArea
                .attr("width", plotWidth)
                .attr("height", plotHeight)
                .attr(
                    "transform",
                    "translate(" + margin.left + "," + (margin.top) + ")"
                );



             // Setup:
            // Check that axis exist and are populated
            let xKey;
            let yKey;
            let xKey2;
            let yKey2;
            let group;

            if(chartConfig.xAxis===null || chartConfig.yAxis===null){
                return;
            }else{
                xKey = chartConfig.xAxis;
                yKey = chartConfig.yAxis;
                group = chartConfig.group;
            }

            if(chartConfig.xAxis2 !==null && chartConfig.yAxis2 !==null){
                xKey2 = chartConfig.xAxis2;
                yKey2 = chartConfig.yAxis2;
            }
            //set default values if not instantiated
            if (chartConfig.lineColor==null) chartConfig.lineColor = "#6699CC";
            if (chartConfig.lineWidth==null) chartConfig.lineWidth = 1.5;
            if (chartConfig.opacity==null) chartConfig.opacity = .95;
            if (chartConfig.gridLines==null) chartConfig.gridLines = false;
            if (chartConfig.startOpacity==null) chartConfig.startOpacity = 0;
            if (chartConfig.endOpacity==null) chartConfig.endOpacity = 0;


            var data1 = data[0];
            var data2 = data[1];
            dataSets = data
            data = data1;

            // if (data2!==null && data2!==undefined && xKey2 && yKey2){
            //     data = mergeToAxis(data1,data2,xKey,xKey2,xKey,yKey,yKey2,yKey);
            // }
            // data = d3.merge(dataSets)

            // for (let i=0; i<dataSets.length; i++){
            //         let xKey = chartConfig[`xAxis${i+1}`];
            //         let xKey2 = chartConfig[`xAxis${i+2}`];
            //         let yKey = chartConfig[`yAxis${i+1}`];
            //         let yKey2 = chartConfig[`yAxis${i+2}`];
            //         console.log(xKey2, xKey2, yKey2, yKey2)

            //         if (dataSets[i+1]!==null && dataSets[i+1]!==undefined && xKey2 && yKey2){
            //         data = mergeToAxis(dataSets[0],dataSets[i+1],xKey,xKey2,xKey,yKey,yKey2,yKey);
            //         dataSets[0] = data;
            //         console.log("yes")
            //      }

            // }
            // console.log(data)



            if (group!==null && group!==undefined){

                let groupData = d3.nest()
                    .key(function(d){return d[group];})
                    .entries(data);

                displayAxis(xKey,yKey,data);


                plotArea
                    .selectAll(".line")
                    .data(groupData)
                    .enter()
                    .append("path")
                    .attr("fill", "none")
                    .attr("stroke", chartConfig.lineColor)
                    .attr("stroke-width", chartConfig.lineWidth)
                    .attr("opacity", chartConfig.opacity)
                    .attr(
                        "d",function(d){
                        return d3
                            .line()
                            .x(function (d) {
                                return x(d[xKey]);
                            })
                            .y(function (d) {
                                return y(parseFloat(d[yKey]));
                            })(d.values);
                        }
                    );

            }
            else{

//TODO merge axis of all data sets
                var mergedData = d3.merge(dataSets);

                var data1 = d3.nest()
                    .key(function(d){return d[xKey];})
                    .rollup(function(d){
                        return d3.max(d,function(g){
                            return g[yKey];
                        });
                }).entries(mergedData);

                displayAxis("key","value", data1);

                // let xType = typeOfAxisValue();

                //Draw line for each data set
                for (let i=0; i<dataSets.length; i++){
                    if (chartConfig.hasOwnProperty(`xAxis${i+1}`) && chartConfig.hasOwnProperty(`yAxis${i+1}`)){
                        xKey = chartConfig[`xAxis${i+1}`];
                        yKey = chartConfig[`yAxis${i+1}`];
                        if(!xKey || !yKey) continue;
                    }
                    
                var sumData = d3.nest()
                    .key(function(d){return d[xKey];})
                    .rollup(function(d){
                        return d3.sum(d,function(g){
                            return g[yKey];
                        });
                }).entries(dataSets[i]);

                let keyType = typeOfAxisValue(sumData[0].key);

                    plotArea
                        .append("path")
                        .datum(sumData)
                        .attr("fill", "none")
                        .attr("stroke", chartConfig.lineColor)
                        .attr("stroke-width", chartConfig.lineWidth)
                        .attr("opacity", chartConfig.opacity)
                        .attr(
                            "d",d3.line()
                            .x(function(d){
                                if(keyType==="date"){
                                    return x(new Date(d.key));
                                }else{
                                    return x(d.key);
                                }
                            })
                            .y(function(d){
                                return y(d["value"]);
                            })
                        );





              //define and fill area under line      
                    plotArea
                        .append("path")
                        .datum(sumData)
                        .attr("class", "line-area")
                        .attr(
                            "d", d3.area()
                            .x(function(d){
                                if(keyType==="date"){
                                    return x(new Date(d.key));
                                }else{
                                    return x(d.key);
                                }
                            })
                            .y0(plotHeight)
                            .y1(function(d){
                                return y(d["value"])
                            })
                        );

                //Add linear gradient
                    plotArea
                        .append("defs")
                        .append("linearGradient")
                        .attr("id", "fill-gradient")
                        .attr("x1", "0%").attr("y1", "0%")
                        .attr("x2", "0%").attr("y2", "100%")
                        .selectAll("stop")
                        .data([
                            {offset: "0%", color: chartConfig.lineColor, opacity: chartConfig.startOpacity},
                            // {offset: "20%", color: chartConfig.lineColor,
                                //  opacity: Math.max(chartConfig.startOpacity/2, chartConfig.endOpacity)},
                            {offset: "100%", color: chartConfig.lineColor, opacity: chartConfig.endOpacity}
                            ])
                        .enter().append("stop")
                        .attr("offset", (d) => d.offset )
                        .attr("stop-color", (d) => d.color )
                        .attr("stop-opacity", (d) => d.opacity );
                        
                


                //Draw grid lines if option is checked
                if(chartConfig.gridLines === true){
                   drawGridlines(plotArea, x, y, axisHeight, axisWidth);
                }

                
            }
            }


            var lines = plotArea.selectAll("path").data(data);
            lines.on("click", function(){
                me.onClick(this);
            });

            lines.on("dblclick", function(){
                me.onDblClick(this);
            });

        });
    };


  //**************************************************************************
  //** onClick
  //**************************************************************************
    this.onClick = function(line){};
    this.onDblClick = function(line){};


  //**************************************************************************
  //** displayAxis
  //**************************************************************************
    var displayAxis = function(xKey,yKey,chartData){
        let axisTemp = createAxisScale(xKey,'x',chartData);
        x = axisTemp.scale;
        xBand = axisTemp.band;

        axisTemp = createAxisScale(yKey,'y',chartData);
        y = axisTemp.scale;
        yBand = axisTemp.band;


        if (xAxis) xAxis.selectAll("*").remove();
        if (yAxis) yAxis.selectAll("*").remove();

        xAxis = plotArea
            .append("g")
            .attr("transform", "translate(0," + axisHeight + ")")
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        yAxis = plotArea
            .append("g")
            .call(d3.axisLeft(y));
    };


  //**************************************************************************
  //** typeOfAxisValue
  //**************************************************************************
     var typeOfAxisValue = function(value) {
        let dataType;

        const validNumberRegex = /^[\+\-]?\d*\.?\d+(?:[Ee][\+\-]?\d+)?$/;
        switch (typeof value) {
            case "string":
                if(value.match(validNumberRegex)){
                    dataType =  "number";
                }else if (Date.parse(value)){
                    dataType =  "date";
                }else{
                    dataType = "string";
                }
                break;
            case "number":
                dataType = "number";
                break;
            case "object":
                dataType = "date";
                break;
            default:
                break;
        }
        return dataType;
    };


  //**************************************************************************
  //** createAxisScale
  //**************************************************************************
    var createAxisScale = function(key,axisName,chartData){
        let scale;
        let band;
        let type = typeOfAxisValue(chartData[0][key]);
        let max = 0;
        let timeRange;
        let axisRange;
        let axisRangePadded;
        if(axisName === "x"){
            axisRange = [0,axisWidth];
            axisRangePadded = [10,axisWidth-10];
        }else{
            axisRange = [axisHeight,0];
            axisRangePadded = [axisHeight-10,10];
        }

        switch (type) {
            case "string":
                scale = d3
                .scaleBand()
                .domain(
                    chartData.map(function (d) {
                        return d[key];
                    })
                )
                .range(axisRange)
                .padding(0.2);
                break;
            case "date":

                timeRange = [new Date(chartData[0][key]),new Date(chartData[chartData.length-1][key])];
                chartData.map((val) => {
                    val[key] = new Date(val[key]);
                    return val;
                });

                scale = d3
                    .scaleTime()
                    .domain(timeRange)
                    .rangeRound(axisRangePadded);

                band = d3
                    .scaleBand()
                    .domain(d3.timeDay.range(...scale.domain()))
                    .rangeRound(axisRangePadded)
                    .padding(0.2);

                timeAxis = axisName;
                break;
            default:

                chartData.forEach((val) => {
                    let curVal = parseFloat(val[key]);
                    if (curVal > max) {
                        max = curVal;
                    }
                });

                scale = d3
                    .scaleLinear()
                    .domain([0, max])
                    .range(axisRange);
                break;
        }
        return {
            scale,
            band
        };
    };


  //**************************************************************************
  //** mergeToAxis
  //**************************************************************************
    const mergeToAxis = (data1,data2,xKey1,xKey2,newXKey,yKey1,yKey2,newYKey)=>{
        let mergedArray = [];
        data1.forEach(val=>{
          let updatedVal = {...val,[newXKey]:val[xKey1],[newYKey]:val[yKey1]};
          mergedArray.push(updatedVal);
        });
        if(data2===null || data2 === undefined){
          return mergedArray;
        }
        data2.forEach(val=>{
          let updatedVal = {...val,[newXKey]:val[xKey2],[newYKey]:val[yKey2]}
          mergedArray.push(updatedVal);
        });
        return mergedArray;
    };



  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var onRender = javaxt.dhtml.utils.onRender;
    var isArray = javaxt.dhtml.utils.isArray;
    var getColor = d3.scaleOrdinal(bluewave.utils.getColorPalette());
    var drawGridlines = bluewave.utils.drawGridlines;

    init();
};