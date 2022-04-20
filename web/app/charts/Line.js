if(!bluewave) var bluewave={};
if(!bluewave.chart) bluewave.chart={};

//******************************************************************************
//**  Line
//******************************************************************************
/**
 *   Used to represent a line in a chart
 *
 ******************************************************************************/

bluewave.chart.Line = function(config) {
    var me = this;
    var defaultConfig = {
        color: "#6699CC",
        opacity: 1,
        width: 1,
        style: "solid",
        fill: {
            color: "#6699CC",
            startOpacity: 0,
            endOpacity: 0
        },
        point: {
            color: "#6699CC",
            radius: 0
        },
        label: "",
        smoothing: "none",
        smoothingValue: 0
    };

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config){
            config = defaultConfig;
            return;
        }

        var chartConfig = config;
        config = defaultConfig;
        me.setConfig(chartConfig);
    };


  //**************************************************************************
  //** Setters
  //**************************************************************************

    this.setColor = function(color){
        color = getColor(color);
        if (color) config.color = color;
    };

    this.setOpacity = function(opacity){
        opacity = getOpacity(opacity);
        if (!isNaN(opacity)) config.opacity = opacity;
    };

    this.setWidth = function(width){
        width = parseFloat(width);
        if (!isNaN(width)){
            if (width>0) config.width = width;
        }
    };

    this.setStyle = function(style){
        if (!style) return;
        style = (style+"").toLowerCase();
        if (style==="solid"|| style==="dashed"|| style==="dotted"){
            config.style = style;
        }
    };

    this.setFill = function(fill){
        if (!fill){
            delete config.fill;
        }
        else{
            var color = getColor(fill.color);
            if (color) config.fill.color = color;
            var opacity = getOpacity(fill.startOpacity);
            if (!isNaN(opacity)) config.fill.startOpacity = opacity;
            var opacity = getOpacity(fill.endOpacity);
            if (!isNaN(opacity)) config.fill.endOpacity = opacity;
        }
    };

    this.setPoint = function(point){
        if (!point){
            delete config.point;
        }
        else{
            var color = getColor(point.color);
            if (color) config.point.color = color;
            var radius = parseFloat(point.radius);
            if (!isNaN(radius)){
                if (radius>0) config.point.radius = radius;
            }
        }
    };

    this.setLabel = function(label){
        config.label = label;
    };

    this.setSmoothing = function(smoothing){
        if (!smoothing) return;
        smoothing = (smoothing+"").toLowerCase();

        switch (smoothing) {
            case "spline":
            case "simple spline":
                smoothing = "spline";
                break;
            case "moving average":
            case "movingaverage":
                smoothing = "movingAverage";
                break;
            case "kernel density estimation":
            case "kde":
                smoothing = "kde";
                break;
            case "curvenatural":
                smoothing = "curveNatural";
                break;
            default:
                smoothing = "none";
                break;
        }
        config.smoothing = smoothing;
    };

    this.setSmoothingValue = function(smoothingValue){
        smoothingValue = parseFloat(smoothingValue);
        if (isNaN(smoothingValue) || smoothingValue<0) {}
        else config.smoothingValue = smoothingValue;
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
  /** Returns the line properties
   */
    this.getConfig = function () {
        return config;
    };



  //**************************************************************************
  //** setConfig
  //**************************************************************************
    this.setConfig = function(chartConfig){
        for (var key in chartConfig) {
            if (chartConfig.hasOwnProperty(key)){
                var method = "set" + key.substring(0,1).toUpperCase() + key.substring(1);
                if (me[method]) me[method].apply(me, [chartConfig[key]]);
            }
        }
    };


  //**************************************************************************
  //** Getters
  //**************************************************************************
    this.getColor = () => config.color;
    this.getWidth = () => config.width;
    this.getStyle = () => config.style;
    this.getFill = () => config.fill;
    this.getPoint = () => config.point;
    this.getLabel = () => config.label;
    this.getSmoothing = () => config.smoothing;
    this.getSmoothingValue = () => config.smoothingValue;


  //**************************************************************************
  //** clone
  //**************************************************************************
  /** Returns a copy of this line*/
    this.clone = function(){
        let copy = Object.assign({},config);
        return new bluewave.chart.Line(copy);
    };


    var getColor = function(color){
        //TODO: validate color
        return color;
    };

    var getOpacity = function(opacity){
        opacity = parseFloat(opacity);
        if (isNaN(opacity)) return null;
        if (opacity<0 || opacity>1) return null;
        return opacity;
    };

    init();
};