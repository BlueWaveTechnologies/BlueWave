if(!bluewave) var bluewave={};
bluewave.utils = {


  //**************************************************************************
  //** get
  //**************************************************************************
  /** Used to execute http GET requests and generate json from the response
   */
    get: function(url, config){
        var get = javaxt.dhtml.utils.get;
        get(url,{
            success: function(response){
                var s = response.substring(0,1);
                if (s=="{" || s=="["){
                    var json = JSON.parse(response);
                    if (json.cols && json.rows){ //conflate response

                        var rows = json.rows;
                        var cols = {};
                        for (var i=0; i<json.cols.length; i++){
                            cols[json.cols[i]] = i;
                        }
                        for (var i=0; i<rows.length; i++){
                            var row = rows[i];
                            var obj = {};
                            for (var col in cols) {
                                if (cols.hasOwnProperty(col)){
                                    obj[col] = row[cols[col]];
                                }
                            }
                            rows[i] = obj;
                        }

                        json = rows;
                    }
                    response = json;
                }
                if (config.success) config.success.apply(this, [response]);
            },
            failure: function(request){
                if (config.failure) config.failure.apply(this, [request]);
            }
        });
    },


  //**************************************************************************
  //** getData
  //**************************************************************************
  /** Used to get data from the "data/" service url. If running standalone,
   *  returns static json data from the "data" directory in the web folder.
   *  If reunning as a service, returns data from the REST endpoint.
   */
    getData: function(name, callback){
        if (!bluewave.data) bluewave.data = {};

        var url = "data/" + name;
        var get = javaxt.dhtml.utils.get;
        var update = function(json){
            if (callback) callback.apply(this, [json]);
        };

        get(url,{
            success: function(text){
                if (text.indexOf("{")==0 || text.indexOf("[")==0){
                    update(JSON.parse(text));
                }
                else{
                    update(text);
                }
            },
            failure: function(){
                var idx = name.indexOf("?");
                if (idx>-1) name = name.substring(0, idx);

              //Load static file
                if (bluewave.data[name]){
                    update(bluewave.data[name]);
                }
                else{
                    var script = document.createElement("script");
                    script.setAttribute("type", "text/javascript");
                    script.setAttribute("src", url+".js?_=" + new Date().getTime());
                    script.onload = function() {
                        update(bluewave.data[name]);
                    };
                    var head = document.getElementsByTagName("head")[0];
                    head.appendChild(script);
                }
            }
        });
    },


  //**************************************************************************
  //** addOverflow
  //**************************************************************************
    addOverflow: function(parent, config){
      //Set default config options
        var defaultConfig = {
            style: {
                //iscroll: gypsy.style.table.iscroll
            }
        };


      //Clone the config so we don't modify the original config object
        var clone = {};
        javaxt.dhtml.utils.merge(clone, config);


      //Merge clone with default config
        javaxt.dhtml.utils.merge(clone, defaultConfig);
        config = clone;


      //Create divs
        var div = document.createElement("div");
        div.style.position = "relative";
        div.style.width = "100%";
        div.style.height = "100%";
        parent.appendChild(div);

        var overflowDiv = document.createElement("div");
        overflowDiv.style.position = "absolute";
        overflowDiv.style.width = "100%";
        overflowDiv.style.height = "100%";
        overflowDiv.style.overflow = "hidden";
        div.appendChild(overflowDiv);


        var innerDiv = document.createElement("div");
        innerDiv.style.position = "relative";
        innerDiv.style.width = "100%";
        innerDiv.style.height = "100%";
        overflowDiv.appendChild(innerDiv);


      //Create response
        var ret = {
            outerDiv: div,
            innerDiv: innerDiv,
            update: function(){},
            scrollToElement: function(el){
                el.scrollIntoView(false);
            }
        };


      //Add iScroll if available
        if (typeof IScroll !== 'undefined'){

            javaxt.dhtml.utils.onRender(overflowDiv, function(){
                overflowDiv.style.overflowY = 'hidden';
                var iscroll = new IScroll(overflowDiv, {
                    scrollbars: config.style.iscroll ? "custom" : true,
                    mouseWheel: true,
                    fadeScrollbars: false,
                    hideScrollbars: false
                });
                if (config.style.iscroll) {
                    javaxt.dhtml.utils.setStyle(iscroll, config.style.iscroll);
                }


              //Create custom update function to return to the client so they
              //can update iscroll as needed (e.g. after adding/removing elements)
                ret.update = function(){
                    var h = 0;
                    for (var i=0; i<ret.innerDiv.childNodes.length; i++){
                        var el = ret.innerDiv.childNodes[i];
                        h = Math.max(javaxt.dhtml.utils.getRect(el).bottom, h);
                    }
                    h = h - (javaxt.dhtml.utils.getRect(ret.innerDiv).top);
                    ret.innerDiv.style.height = h + "px";
                    iscroll.refresh();
                };
                ret.update();


              //Create custom scrollToElement function
                ret.scrollToElement = function(el){
                    overflowDiv.scrollTop = 0;
                    iscroll.scrollToElement(el);
                };


                ret.iscroll = iscroll;
                if (config.onRender) config.onRender.apply(this, [ret]);
            });

        }
        else{
            overflowDiv.style.overflowY = 'scroll';
        }



        return ret;
    },


  //**************************************************************************
  //** warn
  //**************************************************************************
  /** Used to display a warning/error message over a given form field.
   */
    warn: function(msg, field){
        var tr = field.row;
        var td;
        if (tr){
            td = tr.childNodes[2];
        }else{
            td = field.el.parentNode;
        }
        if(td == null){
            td = field.el.parentNode;
        }
        var getRect = javaxt.dhtml.utils.getRect;
        var rect = getRect(td);

        var inputs = td.getElementsByTagName("input");
        if (inputs.length==0) inputs = td.getElementsByTagName("textarea");
        if (inputs.length>0){
            inputs[0].blur();
            var cls = "form-input-error";
            if (inputs[0].className){
                if (inputs[0].className.indexOf(cls)==-1) inputs[0].className += " " + cls;
            }
            else{
                inputs[0].className = cls;
            }
            rect = getRect(inputs[0]);
            field.resetColor = function(){
                if (inputs[0].className){
                    inputs[0].className = inputs[0].className.replace(cls,"");
                }
            };
        }

        var callout = javaxt.express.formError;
        if (!callout){
            callout = new javaxt.dhtml.Callout(document.body,{
                style:{
                    panel: "error-callout-panel",
                    arrow: "error-callout-arrow"
                }
            });
            javaxt.express.formError = callout;
        }

        callout.getInnerDiv().innerHTML = msg;

        var x = rect.x + (rect.width/2);
        var y = rect.y;
        callout.showAt(x, y, "above", "center");
    },


  //**************************************************************************
  //** createButton
  //**************************************************************************
    createButton: function(toolbar, btn){

        if (btn.icon){
            btn.style.icon = "toolbar-button-icon " + btn.icon;
            delete btn.icon;
        }


        if (btn.menu===true){
            btn.style.arrow = "toolbar-button-menu-icon";
            btn.style.menu = "menu-panel";
            btn.style.select = "panel-toolbar-menubutton-selected";
        }

        return new javaxt.dhtml.Button(toolbar, btn);
    },


  //**************************************************************************
  //** createSpacer
  //**************************************************************************
    createSpacer: function(toolbar){
        var spacer = document.createElement('div');
        spacer.className = "toolbar-spacer";
        toolbar.appendChild(spacer);
    },


  //**************************************************************************
  //** createToggleButton
  //**************************************************************************
    createToggleButton: function(parent, config){
        var div = document.createElement("div");
        div.className = "toggle-button-bar noselect";
        parent.appendChild(div);


        for (var i=0; i<config.options.length; i++){
            var btn = document.createElement("div");
            btn.className = "toggle-button";
            if (config.options[i]==config.defaultValue) btn.className+="-active";
            btn.innerHTML = config.options[i];
            var onClick = function(btn){
                if (btn.className==="toggle-button-active") return;
                for (var i=0; i<div.childNodes.length; i++){
                    div.childNodes[i].className = "toggle-button";
                }
                btn.className="toggle-button-active";
                if (config.onChange) config.onChange.apply(btn, [btn.innerHTML]);
            };
            btn.onclick = function(){
                onClick(this);
            };
            div.appendChild(btn);
        }

        div.setValue = function(val){
            for (var i=0; i<div.childNodes.length; i++){
                var btn = div.childNodes[i];
                if (btn.innerText===val){
                    onClick(btn);
                    break;
                }
            }
        };

        div.getValue = function(){
            for (var i=0; i<div.childNodes.length; i++){
                var btn = div.childNodes[i];
                if (btn.className==="toggle-button-active"){
                    return btn.innerText;
                }
            }
            return null;
        };

        return div;
    },


  //**************************************************************************
  //** createDashboardItem
  //**************************************************************************
    createDashboardItem: function(parent, config){

      //Set default config options
        var defaultConfig = {
            width: 360,
            height: 260,
            title: "",
            subtitle: "",
            settings: false,
            waitmask: false
        };


      //Merge config with default config
        javaxt.dhtml.utils.merge(config, defaultConfig);

        var width = config.width+"";
        var height = config.height+"";
        if (width.indexOf("%")===-1) width = parseInt(width) + "px";
        if (height.indexOf("%")===-1) height = parseInt(height) + "px";


        var div = document.createElement("div");
        div.className = "dashboard-item";
        div.style.width = width;
        div.style.height = height;
        div.style.position = "relative";
        parent.appendChild(div);

        var settings;
        if (config.settings===true){
            settings = document.createElement("div");
            settings.className = "dashboard-item-settings noselect";
            settings.innerHTML = '<i class="fas fa-cog"></i>';
            div.appendChild(settings);
        }


        var table = javaxt.dhtml.utils.createTable();
        var tbody = table.firstChild;
        var tr;

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        var title = document.createElement("td");
        title.className = "chart-title noselect";
        title.innerHTML = config.title;
        tr.appendChild(title);

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        var subtitle = document.createElement("td");
        subtitle.className = "chart-subtitle noselect";
        subtitle.innerHTML = config.subtitle;
        tr.appendChild(subtitle);

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        var innerDiv = document.createElement("td");
        innerDiv.style.height = "100%";
        innerDiv.style.position = "relative";
        tr.appendChild(innerDiv);

        div.appendChild(table);

        var waitmask;
        if (config.waitmask){
            waitmask = new javaxt.express.WaitMask(div);
        }

        return {
            el: div,
            title: title,
            subtitle: subtitle,
            innerDiv: innerDiv,
            settings: settings,
            waitmask: waitmask
        };
    },


  //**************************************************************************
  //** addTextEditor
  //**************************************************************************
    addTextEditor: function(div, callback){
        var setTitle = function(title){
            if (callback) callback.apply(div,[title]);
        };

        div.onclick = function(e){
            if (this.childNodes[0].nodeType===1) return;
            e.stopPropagation();
            var currText = this.innerText;
            this.innerHTML = "";
            var input = document.createElement("input");
            input.className = "form-input";
            input.type = "text";
            input.value = currText;
            input.onkeydown = function(event){
                var key = event.keyCode;
                if (key === 9 || key === 13) {
                    setTitle(this.value);
                }
            };
            this.appendChild(input);
            input.focus();
        };

        document.body.addEventListener('click', function(e) {
            var input = div.childNodes[0];
            var className = e.target.className;
            if (input.nodeType === 1 && className != "form-input") {
                setTitle(input.value);
            };
        });
    },


  //**************************************************************************
  //** createProductList
  //**************************************************************************
    createProductList: function(tr, style){
        var td = document.createElement("td");
        td.style.width = "65px";
        td.innerHTML = "Product:";
        tr.appendChild(td);
        td = document.createElement("td");
        td.style.width = "200px";
        tr.appendChild(td);
        var combobox = new javaxt.dhtml.ComboBox(td, {
            style: style,
            readOnly: true
        });

        var options = [
        "CBK - Continuous ventilator, facility use",
        "JRC - Micro pipette",
        "LXG - Equipment, laboratory, general purposes, labeled or promoted specifically for medical use, pipette tips only",
        "PPM - General purpose reagents for in vitro diagnostic tests, including pipette tips4",
        "JJH - Clinical sample concentrator",
        "NSU - Instrumentation for clinical multiplex test system",
        "OOI - Real time nucleic acid amplification system",
        "KXG - Absorbent tipped applicator",
        "JSM - Transport culture medium",
        "LIO - Microbiological specimen collection and transport device",
        "QBD - Microbial nucleic acid storage and stabilization device",
        "FXX - Surgical mask",
        "MSH - Surgical respirator",
        "LYY - Latex, non-powered patient examination glove",
        "LYZ - Vinyl patient examination glove",
        "LZA - Polymer, non-powdered patient examination glove, includes nitrile gloves",
        "LZC - Specialty, non-powdered patient examination glove, includes nitrile gloves",
        "FME - Examination gown",
        "FYA - Surgical gown",
        "OEA - Non-surgical isolation gown, Level 2 only",
        "BZD - Non-continuous ventilator",
        "NOU - Continuous ventilator, home use"
        ];

        for (var i in options){
            var option = options[i];
            var productCode = option.substring(0, option.indexOf(" "));
            combobox.add(option, productCode);
        }

        return combobox;
    },


  //**************************************************************************
  //** createSlider
  //**************************************************************************
  /** Creates a custom form input using a text field
   */
    createSlider: function(inputName, form, endCharacter = "", min=0, max=100, interval=5){

      //Add row under the given input
        var input = form.findField(inputName);
        var row = input.row.cloneNode(true);
        var cols = row.childNodes;
        for (var i=0; i<cols.length; i++){
            cols[i].innerHTML = "";
        }
        input.row.parentNode.insertBefore(row, input.row.nextSibling);
        row.style.height = "20px";


      //Add slider to the last column of the new row
        var slider = document.createElement("input");
        cols[2].appendChild(slider);
        slider.type = "range";
        slider.className = "dashboard-slider";
        min = parseInt(min);
        if (min<0) min = 0;
        max = parseInt(max);
        if (max<min) max = 100;

        interval = parseInt(interval);
        if (interval<1) interval = 1;
        max = Math.ceil(max/interval);

        slider.setAttribute("min", min+1);
        slider.setAttribute("max", max+1);
        slider.onchange = function(){
            var val = (this.value-1)*interval;
            input.setValue(val);
        };

        var isNumber = javaxt.dhtml.utils.isNumber;
        var round = javaxt.dhtml.utils.round;


        var setValue = input.setValue;
        input.setValue = function(val){
            val = parseFloat(val);
            setValue(val + `${endCharacter}`);
            slider.value = round(val/interval)+1;
        };

        var getValue = input.getValue;
        input.getValue = function(){
            var val = parseFloat(getValue());
            if (isNumber(val)) return round(val, 0);
            else return 0;
        };

        input.row.getElementsByTagName("input")[0].addEventListener('input', function(e) {
            var val = parseFloat(this.value);
            if (isNumber(val)){
                if (val<0) val = 0;
                //if (val>=94) val = 100;

                input.setValue(val);
            }
        });

        return slider;
    },


  //**************************************************************************
  //** createColorOptions
  //**************************************************************************
  /** Creates a custom form input using a combobox
   */
    createColorOptions: function(inputName, form, onClick){

        var colorField = form.findField(inputName);
        var colorPreview = colorField.getButton();
        colorPreview.className = colorPreview.className.replace("pulldown-button-icon", "");
        colorPreview.style.boxShadow = "none";
        colorPreview.setColor = function(color){
            colorPreview.style.backgroundColor =
            colorPreview.style.borderColor = color;
        };
        colorField.setValue = function(color){
            //color = getHexColor(getColor(color));
            colorPreview.setColor(color);
            colorField.getInput().value = color;
            form.onChange(colorField, color);
        };
        colorField.getValue = function(){
            return colorField.getInput().value;
        };
        colorPreview.onclick = function(){
            if (onClick) onClick.apply(this,[colorField]);
        };
    },


  //**************************************************************************
  //** updateExtents
  //**************************************************************************
  /** Adds 2 transparent points to the given map layer. Used to circumvent a
   *  rendering bug in OpenLayers.
   */
    updateExtents: function(layer){
        var source = layer.getSource();
        if (source instanceof ol.source.Vector){
            var style = new ol.style.Style({
                fill: new ol.style.Fill({
                    color: ol.color.asString([0,0,0,0])
                })
            });
            source.addFeature(new ol.Feature({
                geometry: new ol.geom.Point([-20026376.39, -20048966.10]),
                style: style
            }));
            source.addFeature(new ol.Feature({
                geometry: new ol.geom.Point([20026376.39, 20048966.10]),
                style: style
            }));
        }
    },


  //**************************************************************************
  //** parseCSV
  //**************************************************************************
  /** Used to parse a csv file. Returns a 2D array. Each entry in the array
   *  represents a row in the csv file. Each row has an array representing
   *  cell values.
   */
    parseCSV: function(csv, delimiter){
        delimiter = (delimiter || ",");
        var isCSV = delimiter===",";

        var getColumns = function(row){
            var cols = [];
            var insideDoubleQuotes = false;
            var str = "";
            var c;

            for (var i=0; i<row.length; i++){

                c = row.substring(i,i+1);

                if (c===("\"") && isCSV){
                    if (!insideDoubleQuotes) insideDoubleQuotes = true;
                    else insideDoubleQuotes = false;
                }

                if (c===(delimiter) && !insideDoubleQuotes){
                    cols.push(getValue(str));
                    str = "";
                }
                else{
                    str += c;
                }
            }

          //Add last column
            cols.push(getValue(str));


            return cols;
        };


        var getValue = function(str){

            var col = str.trim();
            if (col.length===0) col = null;
            if (col!==null){
                if (col.startsWith("\"") && col.endsWith("\"")){
                    col = col.substring(1, col.length-1).trim();
                    if (col.length===0) col = null;
                }
            }
            return col;
        };

        var data = [];
        var rows = csv.split(/\r?\n/);
        for (var i=0; i<rows.length; i++){
            var row = rows[i];
            if (row.indexOf(delimiter)>-1)
            data.push(getColumns(row));
        }
        return data;
    },


  //**************************************************************************
  //** getColorPalette
  //**************************************************************************
    getColorPalette: function(fixedColors){
        if (fixedColors===true)
        return [

          //darker
            "#6699CC", //blue
            "#98DFAF", //green
            "#FF3C38", //red
            "#FF8C42", //orange
            "#933ed5", //purple
            "#bebcc1", //gray

          //lighter
            "#9DBEDE",
            "#C6EDD3",
            "#FF8280",
            "#FFB586",
            "#cda5eb",
            "#dedde0"
        ];


        return [
            ...[
              "#C6EDD3",
              "#98DFAF",
              "#FF8280",
              "#FF3C38",
              "#FFB586",
              "#FF8C42",
              "#9DBEDE",
              "#6699CC",
              "#999999"
            ],
            ...d3.schemeCategory10
        ];

    },


  //**************************************************************************
  //** createColorPicker
  //**************************************************************************
  /** Returns a panel used to select a color from the list of standard colors
   *  or to define a new color using a color wheel
   */
    createColorPicker: function(parent, config){
        if (!config) config = {};
        if (!config.style) config.style = javaxt.dhtml.style.default;

        var colorPicker = {
            onChange: function(c){},
            setColor: function(c){},
            colorWheel: null
        };



        var table = javaxt.dhtml.utils.createTable();
        var tbody = table.firstChild;
        var tr, td;

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);


        var checkbox = document.createElement("div");
        checkbox.innerHTML = '<i class="fas fa-check"></i>';


        var div = document.createElement("div");
        div.className = "color-picker-header";
        div.innerHTML = "Theme Colors";
        td.appendChild(div);
        bluewave.utils.getColorPalette(true).forEach((c)=>{
            div = document.createElement("div");
            div.className = "color-picker-option";
            div.style.backgroundColor = c;
            div.onclick = function(){
                if (checkbox.parentNode === this) return;
                if (checkbox.parentNode) checkbox.parentNode.removeChild(checkbox);
                this.appendChild(checkbox);
                colorPicker.onChange(new iro.Color(this.style.backgroundColor).hexString);
            };
            td.appendChild(div);
        });



        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);

        var div = document.createElement("div");
        div.className = "color-picker-header noselect";
        div.innerHTML = "Custom Colors";
        td.appendChild(div);

        var createNewColor = function(){

            div = document.createElement("div");
            div.className = "color-picker-option";
            div.onclick = function(){
                if (checkbox.parentNode === this) return;
                if (this.innerHTML === ""){
                    if (checkbox.parentNode) checkbox.parentNode.removeChild(checkbox);
                    this.appendChild(checkbox);
                    colorPicker.onChange(new iro.Color(this.style.backgroundColor).hexString);
                    return;
                }

                if (!colorPicker.colorWheel){

                    var callout = new javaxt.dhtml.Callout(document.body,{
                        style: {
                            panel: "color-picker-callout-panel",
                            arrow: "color-picker-callout-arrow"
                        }
                    });

                    var innerDiv = callout.getInnerDiv();
                    innerDiv.style.padding = "5px";
                    innerDiv.style.backgroundColor = "#fff";
                    var cp = new iro.ColorPicker(innerDiv, {
                      width: 280,
                      height: 280,
                      anticlockwise: true,
                      borderWidth: 1,
                      borderColor: "#fff",
                      css: {
                        "#output": {
                          "background-color": "$color"
                        }
                      }
                    });

                    colorPicker.colorWheel = callout;
                    colorPicker.colorWheel.getColor = function(){
                        return cp.color.hexString;
                    };

                    cp.on("color:change", function(c){
                        var div = colorPicker.colorWheel.target;
                        div.innerHTML = "";
                        div.style.backgroundColor = colorPicker.colorWheel.getColor();
                    });

                }


                var div = this;
                var rect = javaxt.dhtml.utils.getRect(div);
                var x = rect.x + rect.width + 5;
                var y = rect.y + (rect.height/2);
                colorPicker.colorWheel.target = div;
                colorPicker.colorWheel.showAt(x, y, "right", "middle");
                colorPicker.colorWheel.onHide = function(){
                    if (table.getElementsByClassName("color-picker-new-option").length>0) return;
                    createNewColor();
                };

            };
            td.appendChild(div);
            var innerDiv = document.createElement("div");
            innerDiv.className = "color-picker-new-option";
            innerDiv.innerHTML = "<i class=\"fas fa-plus\"></i>";
            div.appendChild(innerDiv);

        };

        createNewColor();

        parent.appendChild(table);
        return colorPicker;
    },


  //**************************************************************************
  //** createColorPickerCallout
  //**************************************************************************
  /** Returns a callout with a color picker
   */
    createColorPickerCallout: function(config){

      //Create popup
        var popup = new javaxt.dhtml.Callout(document.body,{
            style: {
                panel: "color-picker-callout-panel",
                arrow: "color-picker-callout-arrow"
            }
        });
        var innerDiv = popup.getInnerDiv();


      //Create title div
        var title = "Select Color";
        var titleDiv = document.createElement("div");
        titleDiv.className = "window-header";
        titleDiv.innerHTML = "<div class=\"window-title\">" + title + "</div>";
        innerDiv.appendChild(titleDiv);


      //Create content div
        var contentDiv = document.createElement("div");
        contentDiv.style.padding = "0 15px 15px";
        contentDiv.style.width = "325px";
        contentDiv.style.backgroundColor = "#fff";
        innerDiv.appendChild(contentDiv);


        var table = javaxt.dhtml.utils.createTable();
        var tbody = table.firstChild;
        var tr = document.createElement('tr');
        tbody.appendChild(tr);



        var td = document.createElement('td');
        tr.appendChild(td);
        var cp = bluewave.utils.createColorPicker(td, config);

        popup.onHide = function(){
            if (cp.colorWheel && cp.colorWheel.isVisible()){
                cp.colorWheel.hide();
                popup.show();
            }
        };


        popup.onChange = function(color){};
        popup.setColor = function(color){
            cp.setColor(color);
        };

        cp.onChange = function(color){
            popup.onChange(color);
        };

        contentDiv.appendChild(table);
        return popup;
    },


  //**************************************************************************
  //** getNaturalBreaks
  //**************************************************************************
  /** Used to classify data using Jenks natural breaks optimization
   *  @param data An array of numbers
   *  @param n_classes Number of classes
   *  @return Array of values or null
   */
    getNaturalBreaks: function(data, n_classes) {


        // Adjust n_classes to reflect data
        var numDistinctVals = [...new Set(data)].length;
        n_classes = Math.min(n_classes, numDistinctVals-1);


        // Compute the matrices required for Jenks breaks. These matrices
        // can be used for any classing of data with `classes <= n_classes`
        function getMatrices(data, n_classes) {

            // in the original implementation, these matrices are referred to
            // as `LC` and `OP`
            //
            // * lower_class_limits (LC): optimal lower class limits
            // * variance_combinations (OP): optimal variance combinations for all classes
            var lower_class_limits = [],
                variance_combinations = [],
                // loop counters
                i, j,
                // the variance, as computed at each step in the calculation
                variance = 0;

            // Initialize and fill each matrix with zeroes
            for (i = 0; i < data.length + 1; i++) {
                var tmp1 = [], tmp2 = [];
                for (j = 0; j < n_classes + 1; j++) {
                    tmp1.push(0);
                    tmp2.push(0);
                }
                lower_class_limits.push(tmp1);
                variance_combinations.push(tmp2);
            }

            for (i = 1; i < n_classes + 1; i++) {
                lower_class_limits[1][i] = 1;
                variance_combinations[1][i] = 0;
                // in the original implementation, 9999999 is used but
                // since Javascript has `Infinity`, we use that.
                for (j = 2; j < data.length + 1; j++) {
                    variance_combinations[j][i] = Infinity;
                }
            }

            for (var l = 2; l < data.length + 1; l++) {

                // `SZ` originally. this is the sum of the values seen thus
                // far when calculating variance.
                var sum = 0,
                    // `ZSQ` originally. the sum of squares of values seen
                    // thus far
                    sum_squares = 0,
                    // `WT` originally. This is the number of
                    w = 0,
                    // `IV` originally
                    i4 = 0;

                // in several instances, you could say `Math.pow(x, 2)`
                // instead of `x * x`, but this is slower in some browsers
                // introduces an unnecessary concept.
                for (var m = 1; m < l + 1; m++) {

                    // `III` originally
                    var lower_class_limit = l - m + 1,
                        val = data[lower_class_limit - 1];

                    // here we're estimating variance for each potential classing
                    // of the data, for each potential number of classes. `w`
                    // is the number of data points considered so far.
                    w++;

                    // increase the current sum and sum-of-squares
                    sum += val;
                    sum_squares += val * val;

                    // the variance at this point in the sequence is the difference
                    // between the sum of squares and the total x 2, over the number
                    // of samples.
                    variance = sum_squares - (sum * sum) / w;

                    i4 = lower_class_limit - 1;

                    if (i4 !== 0) {
                        for (j = 2; j < n_classes + 1; j++) {
                            // if adding this element to an existing class
                            // will increase its variance beyond the limit, break
                            // the class at this point, setting the lower_class_limit
                            // at this point.
                            if (variance_combinations[l][j] >=
                                (variance + variance_combinations[i4][j - 1])) {
                                lower_class_limits[l][j] = lower_class_limit;
                                variance_combinations[l][j] = variance +
                                    variance_combinations[i4][j - 1];
                            }
                        }
                    }
                }

                lower_class_limits[l][1] = 1;
                variance_combinations[l][1] = variance;
            }

            // return the two matrices. for just providing breaks, only
            // `lower_class_limits` is needed, but variances can be useful to
            // evaluage goodness of fit.
            return {
                lower_class_limits: lower_class_limits,
                variance_combinations: variance_combinations
            };
        }



        // the second part of the jenks recipe: take the calculated matrices
        // and derive an array of n breaks.
        function breaks(data, lower_class_limits, n_classes) {

            var k = data.length - 1,
                kclass = [],
                countNum = n_classes;

            // the calculation of classes will never include the upper and
            // lower bounds, so we need to explicitly set them
            kclass[n_classes] = data[data.length - 1];
            kclass[0] = data[0];

            // the lower_class_limits matrix is used as indexes into itself
            // here: the `k` variable is reused in each iteration.
            while (countNum > 1) {
                kclass[countNum - 1] = data[lower_class_limits[k][countNum] - 2];
                k = lower_class_limits[k][countNum] - 1;
                countNum--;
            }

            return kclass;
        }

        if (n_classes > data.length) {
            return null;
        }

        // sort data in numerical order, since this is expected
        // by the matrices function
        data = data.slice().sort(function (a, b) { return a - b; });

        // get our basic matrices
        var matrices = getMatrices(data, n_classes),
            // we only need lower class limits here
            lower_class_limits = matrices.lower_class_limits;

        // extract n_classes out of the computed matrices
        var arr = [];
        try{
            arr = breaks(data, lower_class_limits, n_classes);
            arr.unshift(0);
            arr = [...new Set(arr)];
        }
        catch(e){
            console.log(e);
        }
        return arr;
    },


  //**************************************************************************
  //** resizeCanvas
  //**************************************************************************
  /** Fast image resize/resample algorithm using Hermite filter. Credit:
   *  https://stackoverflow.com/a/18320662/
   */
    resizeCanvas: function(canvas, width, height, resize_canvas) {
        var width_source = canvas.width;
        var height_source = canvas.height;
        width = Math.round(width);
        height = Math.round(height);

        var ratio_w = width_source / width;
        var ratio_h = height_source / height;
        var ratio_w_half = Math.ceil(ratio_w / 2);
        var ratio_h_half = Math.ceil(ratio_h / 2);

        var ctx = canvas.getContext("2d");
        var img = ctx.getImageData(0, 0, width_source, height_source);
        var img2 = ctx.createImageData(width, height);
        var data = img.data;
        var data2 = img2.data;

        for (var j = 0; j < height; j++) {
            for (var i = 0; i < width; i++) {
                var x2 = (i + j * width) * 4;
                var weight = 0;
                var weights = 0;
                var weights_alpha = 0;
                var gx_r = 0;
                var gx_g = 0;
                var gx_b = 0;
                var gx_a = 0;
                var center_y = (j + 0.5) * ratio_h;
                var yy_start = Math.floor(j * ratio_h);
                var yy_stop = Math.ceil((j + 1) * ratio_h);
                for (var yy = yy_start; yy < yy_stop; yy++) {
                    var dy = Math.abs(center_y - (yy + 0.5)) / ratio_h_half;
                    var center_x = (i + 0.5) * ratio_w;
                    var w0 = dy * dy; //pre-calc part of w
                    var xx_start = Math.floor(i * ratio_w);
                    var xx_stop = Math.ceil((i + 1) * ratio_w);
                    for (var xx = xx_start; xx < xx_stop; xx++) {
                        var dx = Math.abs(center_x - (xx + 0.5)) / ratio_w_half;
                        var w = Math.sqrt(w0 + dx * dx);
                        if (w >= 1) {
                            //pixel too far
                            continue;
                        }
                        //hermite filter
                        weight = 2 * w * w * w - 3 * w * w + 1;
                        var pos_x = 4 * (xx + yy * width_source);
                        //alpha
                        gx_a += weight * data[pos_x + 3];
                        weights_alpha += weight;
                        //colors
                        if (data[pos_x + 3] < 255)
                            weight = weight * data[pos_x + 3] / 250;
                        gx_r += weight * data[pos_x];
                        gx_g += weight * data[pos_x + 1];
                        gx_b += weight * data[pos_x + 2];
                        weights += weight;
                    }
                }
                data2[x2] = gx_r / weights;
                data2[x2 + 1] = gx_g / weights;
                data2[x2 + 2] = gx_b / weights;
                data2[x2 + 3] = gx_a / weights_alpha;
            }
        }
        //clear and resize canvas
        if (resize_canvas === true) {
            canvas.width = width;
            canvas.height = height;
        } else {
            ctx.clearRect(0, 0, width_source, height_source);
        }

        //draw
        ctx.putImageData(img2, 0, 0);
    },


  //**************************************************************************
  //** base64ToBlob
  //**************************************************************************
    base64ToBlob: function(base64, mime) {

        mime = mime || '';
        var sliceSize = 1024;
        var byteChars = window.atob(base64);
        var byteArrays = [];

        for (var offset = 0, len = byteChars.length; offset < len; offset += sliceSize) {
            var slice = byteChars.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, {type: mime});
    },


  //**************************************************************************
  //** initChart
  //**************************************************************************
    initChart: function(parent, callback, scope){
        var svg;
        if (parent instanceof d3.selection){
            svg = parent;
        }
        else if (parent instanceof SVGElement) {
            svg = d3.select(parent);
        }
        else{
            svg = d3.select(parent).append("svg");
            javaxt.dhtml.utils.onRender(parent, function(){
                var width = parent.offsetWidth;
                var height = parent.offsetHeight;
                svg.attr("width", width);
                svg.attr("height", height);
            });
        }

        var g = svg.append("g");
        if (callback) callback.apply(scope,[svg, g]);
    },


  //**************************************************************************
  //** drawGridlines
  //**************************************************************************
    drawGridlines: function(svg, xScale, yScale, height, width, xGrid, yGrid){

        if(xGrid){
            svg.append("g")
            .attr("class", "grid")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xScale)
            .tickSize(-height)
            .tickFormat("")
            );
        }

        if(yGrid){
            svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat("")
            );
        }
    },


  //**************************************************************************
  //** drawLabels
  //**************************************************************************
    drawLabels: function(svg, xLabel, yLabel, height, width, margin, xLabelName, yLabelName){
        //Add X-axis label
        if(xLabel){
            svg.append("text")
            .attr("x", width/2)
            .attr("y", height+margin.bottom - 2)
            .style("text-anchor", "middle")
            .text(xLabelName);
        }

        //Add Y-axis label
        if(yLabel){
            svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", 0 - (height/2))
            .attr("y", 0 - margin.left)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text(yLabelName);
        }

    }

};