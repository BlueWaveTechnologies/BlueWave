if(!bluewave) var bluewave={};
if(!bluewave.charts) bluewave.charts={};

//******************************************************************************
//**  SupplyChainEditor
//******************************************************************************
/**
 *   Panel used to create supply chain charts
 *
 ******************************************************************************/

bluewave.charts.SupplyChainEditor = function(parent, config) {

    var me = this;
    var defaultConfig = {
        nodes: [
            {
                icon: "fas fa-fill-drip",
                label: "Raw Material"
            },
            {
                icon: "fas fa-industry",
                label: "Manufacturer"
            },
            {
                icon: "fas fa-store-alt",
                label: "Distributor"
            },
            {
                icon: "fas fa-hospital-user",
                label: "End User"
            }
        ],
        hidePreview: true
    };
    var sankeyEditor;
    var nodeEditor;
    var waitmask;
    var companyList, facilityList, productList, productTypes;
    var nodeMenu;
    var colorPicker;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

      //Clone the config so we don't modify the original config object
        var clone = {};
        merge(clone, config);


      //Merge clone with default config
        merge(clone, defaultConfig);
        config = clone;


      //Update config as needed
        if (!config.style) config.style = javaxt.dhtml.style.default;
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;
        

        config.renderers = {
            drawflowNodes: createDrawflowNode
        };


        sankeyEditor = new bluewave.charts.SankeyEditor(parent, config);
        sankeyEditor.getNodeEditor = getNodeEditor;
        sankeyEditor.onChange = function(){
            me.onChange();
        };
        sankeyEditor.onContextMenu = function(node){
            showMenu(node);
        };
        // function connected to sankeyEditor - generate updated nodes for rendering
        sankeyEditor.onNodeImport = function(node,props){
            updateDrawflowNode(node,props);
        };
    };


  //**************************************************************************
  //** onChange
  //**************************************************************************
    this.onChange = function(){};


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(sankeyConfig){
        sankeyEditor.update(sankeyConfig);
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        sankeyEditor.clear();
    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){
        return sankeyEditor.getConfig();
    };


  //**************************************************************************
  //** getChart
  //**************************************************************************
    this.getChart = function(){
        return sankeyEditor.getEditor();
    };


  //**************************************************************************
  //** onSave
  //**************************************************************************
  /** Called whenever nodes are created/updated in the graph
   */
    this.onSave = function(){};


  //**************************************************************************
  //** getNodeEditor
  //**************************************************************************
    var getNodeEditor = function(){
        if (!nodeEditor){

            nodeEditor = new javaxt.dhtml.Window(document.body, {
                title: "Edit Node",
                width: 550,
                height: 776, //required because of the overflow...
                valign: "top",
                modal: true,
                resizable: true,
                shrinkToFit: true,
                style: config.style.window
            });


            var div = document.createElement("div");
            div.style.position = "relative";
            div.style.height = "100%";
            div.style.overflowY = "auto";
            nodeEditor.getBody().appendChild(div);

            var innerDiv = document.createElement("div");
            innerDiv.style.position = "absolute";
            innerDiv.style.width = "100%";
            innerDiv.style.height = "100%";
            div.appendChild(innerDiv);


            companyList = createCombobox();
            facilityList = createCombobox();
            productList = createCombobox();
            productTypes = createCombobox();

            var countryList = createCombobox();

            var states = [];
            getData("states_albers_usa", function(data) {
                var arr = data.objects.states.geometries;
                for (var i=0; i<arr.length; i++){
                    var state = arr[i];
                    states.push(state.properties);
                }
            });

            var countries = [];
            getData("countries", function(data) {
                var arr = data.objects.countries.geometries;
                for (var i=0; i<arr.length; i++){
                    var country = arr[i];
                    countries.push(country.properties);
                }
            });



            var form = new javaxt.dhtml.Form(innerDiv, {
                style: config.style.form,
                items: [
                    {
                        group: "Company",
                        items: [
                            {
                                name: "company",
                                label: "Name",
                                type: companyList
                            }
                        ]
                    },
                    {
                        group: "Facility",
                        items: [
                            {
                                name: "facility",
                                label: "Name",
                                type: facilityList
                            },
                            {
                                name: "city",
                                label: "City",
                                type: "text"
                            },
                            {
                                name: "country",
                                label: "State/Country",
                                type: countryList
                            },
                            {
                                name: "fei",
                                label: "FEI",
                                type: "text"
                            }
                        ]
                    },
                    {
                        group: "Product",
                        items: [
                            {
                                name: "productType",
                                label: "Type",
                                type: productTypes
                            },
                            {
                                name: "productName",
                                label: "Name",
                                type: productList
                            },
                            {
                                name: "inventory",
                                label: "Inventory",
                                type: "text"
                            },
                            {
                                name: "capacity",
                                label: "Capacity",
                                type: "text"
                            },
                            {
                                name: "leadTime",
                                label: "Lead Time",
                                type: "text"
                            }
                        ]
                    },
                    {
                        group: "Notes",
                        items: [
                            {
                                name: "notes",
                                label: "",
                                type: "textarea"
                            }
                        ]
                    }
                ],
                buttons: [
                    {
                        name: "Cancel",
                        onclick: function(){
                            nodeEditor.close();
                            form.clear();
                        }
                    },
                    {
                        name: "Submit",
                        onclick: function(){
                            var data = form.getData();


                          //Validate company
                            var companyName = null;
                            try{companyName = data.company.name.trim(); } catch(e){}
                            if (companyName==null || companyName==="") {
                                try{companyName = companyList.getText().trim(); } catch(e){}
                                if (companyName==null || companyName==="") {
                                    warn("Company is required", companyList);
                                    return;
                                }
                            }
                            if (!data.company) data.company = {};
                            data.company.name = companyName;



                          //Validate facility
                            var facilityName = null;
                            try{facilityName = data.facility.name.trim(); } catch(e){}
                            if (facilityName==null || facilityName==="") {
                                try{facilityName = facilityList.getText().trim(); } catch(e){}
                                if (facilityName==null || facilityName==="") {
                                    warn("Facility is required", facilityList);
                                    return;
                                }
                            }
                            if (!data.facility) data.facility = {};
                            data.facility.name = facilityName;
                            data.facility.city = cityField.getValue();

                            var country = countryList.getValue();
                            if (country){
                                data.facility.state = countryList.getValue().state;
                                data.facility.country = countryList.getValue().country;
                            }
                            else{
                                warn("State/Country is required", countryList);
                                return;
                            }


                          //Validate product
                            var productName = null;
                            try{productName = productList.getText().trim(); } catch(e){}
                            if (productName==null || productName==="") {
                                warn("Product is required", productList);
                                return;
                            }

                            var productType = productTypes.getValue();
                            if (productType && productType.length>0){
                                data.product = productType[0];
                                if (!data.product.name) data.product.name = productName;
                                else{
                                    if (data.product.name!==productName){
                                        data.product.name = productName;
                                    }
                                }
                            }
                            else{
                                data.product = {};
                                data.product.name = productName;
                                data.product.type = productTypes.getText();
                            }



                          //Save data
                            save(data, function(companyID, facilityID, productID, notes){
                                var node = nodeEditor.node;
                                node.name = companyName;
                                node.companyID = companyID;
                                node.facilityID = facilityID;
                                node.productID = productID;
                                node.notes = notes;
                                node.country = data.country.country;
                                node.state = data.country.state;
                                
                                var overlayDiv = node.getElementsByClassName("drawflow-node-overlay")[0];

                                addShowHide(overlayDiv);
                                overlayDiv.hide();

                                node.getElementsByClassName("drawflow-node-title")[0].getElementsByTagName("span")[0].innerHTML = companyName;
                                node.getElementsByClassName("drawflow-node-facility-name")[0].innerHTML = "<b>Facility:</b> "+ facilityName;
                                node.getElementsByClassName("drawflow-node-product-name")[0].innerHTML = "<b>Product:</b> "+productName;

                                overlayDiv.show()
                                nodeEditor.close();
                                me.onSave();
                            });
                        }
                    }
                ]
            });



            var cityField = form.findField("city");
            var feiField = form.findField("fei");
            form.disableField("fei");



            var lastSearch = 0;
            form.onChange = function(field){
                if (field.name==="company"){
                    var name = field.getText();
                    var value = field.getValue();

                    if (value){ //user either selected an item in the list or typed in an exact match
                        var company = value;
                        updateFacilities(company);
                    }
                    else{

                        if (name.trim().length>0){
                            (function (name) {

                                get("SupplyChain/Companies?name="+encodeURIComponent(name)+"&limit=50",{
                                    success: function(arr){

                                        var currTime = new Date().getTime();
                                        if (currTime<lastSearch) return;
                                        lastSearch = currTime;

                                        companyList.removeAll();
                                        if (arr.length===0){
                                            companyList.hideMenu();
                                            form.enableField("city");
                                            form.enableField("country");
                                        }
                                        else{

                                          //Create a unique list of companies
                                            var uniqueCompanies = {};
                                            for (var i=0; i<arr.length; i++){
                                                var company = arr[i];
                                                var companyName = company.name.trim();

                                              //Update company name as needed
                                                if (companyName.lastIndexOf(")")===companyName.length-1){
                                                    var idx = companyName.lastIndexOf("(");
                                                    if (idx>0) companyName = companyName.substring(0, idx).trim();
                                                }
                                                company.name = companyName;

                                              //Create unique key for the company using either the node ID or
                                              //the owner_operator_number (R&L)
                                                var key = company.owner_operator_number;
                                                if (isNaN(key)) key = -i;
                                                key +="";

                                                var _company = uniqueCompanies[key];
                                                if (!_company){
                                                    _company = company;
                                                    uniqueCompanies[key] = company;
                                                }

                                                if (companyName.length<_company.name.length){
                                                    uniqueCompanies[key] = company;
                                                }
                                            }


                                          //Sort company names alphabetically
                                            var companyNames = [];
                                            for (var key in uniqueCompanies) {
                                                if (uniqueCompanies.hasOwnProperty(key)){
                                                    var company = uniqueCompanies[key];
                                                    companyNames.push(company.name);
                                                }
                                            }
                                            companyNames.sort();



                                          //Update dropdown
                                            for (var i=0; i<companyNames.length; i++){
                                                var companyName = companyNames[i];
                                                for (var key in uniqueCompanies) {
                                                    if (uniqueCompanies.hasOwnProperty(key)){
                                                        var company = uniqueCompanies[key];
                                                        if (company.name === companyName){
                                                            companyList.add(company.name, company);
                                                            break;
                                                        }
                                                    }
                                                }
                                            }

                                            companyList.showMenu();
                                        }
                                    }
                                });
                            })(name);
                        }
                    }
                }
                else if (field.name==="facility"){
                    var name = field.getText();
                    var value = field.getValue();

                    if (value){ //user either selected an item in the list or typed in an exact match
                        var facility = value;
                        updateFacility(facility);
                        updateProducts(facility);
                    }
                    else{
                        feiField.setValue("");
                        form.enableField("city");
                        form.enableField("country");

                    }
                }
                else if (field.name==="productType"){
                    var name = field.getText();
                    var value = field.getValue();

                    if (value){ //user either selected an item in the list or typed in an exact match
                        productList.clear();
                        var products = value;
                        for (var i=0; i<products.length; i++){
                            var product = products[i];
                            var productName = product.name;
                            productList.add(productName, productName);
                        }
                        if (products.length===1) productList.setValue(productName);
                    }
                    else{

                        if (name.trim().length>0){
                            (function (name) {

                                get("SupplyChain/Products?name="+encodeURIComponent(name)+"&limit=50",{
                                    success: function(arr){

                                        var currTime = new Date().getTime();
                                        if (currTime<lastSearch) return;
                                        lastSearch = currTime;


                                        for (var i=0; i<arr.length; i++){
                                            var product = arr[i];
                                            var productCode = product.product_code;
                                            var productType = product.device_name;
                                            var text = productCode + " - " + productType;
                                            productTypes.add(text, []);
                                        }

                                    }
                                });
                            })(name);
                        }

                    }
                }
                else if (field.name==="productName"){
                    var name = field.getText();
                    var value = field.getValue();
                    if (value){
                        var products = productTypes.getValue();
                        for (var i=0; i<products.length; i++){
                            var product = products[i];
                            if (product.name === name){
                                if (product.inventory) form.setValue("inventory", product.inventory);
                                if (product.capacity) form.setValue("capacity", product.capacity);
                                if (product.leadTime) form.setValue("leadTime", product.leadTime);
                                break;
                            }
                        }
                    }
                }
                else if (field.name==="country"){
                    var name = field.getText();
                    var value = field.getValue();
                    if (value){ //user either selected an item in the list or typed in an exact match

                    }
                    else{
                        countryList.removeAll();
                        for (var i=0; i<states.length; i++){
                            var state = states[i];
                            if (state.name.indexOf(name)===0 || state.code.indexOf(name)===0){
                                countryList.add(state.name, {
                                    state: state.code,
                                    country: 'US'
                                });
                            }
                        }

                        for (var i=0; i<countries.length; i++){
                            var country = countries[i];
                            var countryCode = country.code;
                            if (!countryCode) countryCode = "";
                            if (country.name.indexOf(name)===0 || countryCode.indexOf(name)===0){
                                countryList.add(country.name, {
                                    country: countryCode
                                });
                            }
                        }
                    }
                }
            };



            var updateFacility = function(facility){
                if (facility.fei_number){
                    form.disableField("city");
                    form.disableField("country");
                    feiField.setValue(facility.fei_number);
                }
                cityField.setValue(facility.city);

                countryList.removeAll();
                var countryCode = facility.country;
                if (!countryCode) countryCode = facility.iso_country_code;


                var val;
                if (countryCode==='US'){

                    var stateCode = facility.state;
                    if (!stateCode) stateCode = facility.state_code;


                    for (var i=0; i<states.length; i++){
                        var state = states[i];

                        countryList.add(state.name, {
                            state: state.code,
                            country: 'US'
                        });

                        if (state.code===stateCode){
                            val = state.name;
                        }
                    }
                }
                else{
                    for (var i=0; i<countries.length; i++){
                        var country = countries[i];
                        countryList.add(country.name, {country: country.code});

                        if (country.code===countryCode){
                            val = country.name;
                        }
                    }
                }

                countryList.setValue(val);
            };


            nodeEditor.update = function(node){
                nodeEditor.node = node;
                form.clear();
                companyList.clear();
                facilityList.clear();
                productList.clear();
                if (companyList.resetColor) companyList.resetColor();
                if (facilityList.resetColor) facilityList.resetColor();
                if (productList.resetColor) productList.resetColor();
                if (node){
                    get("SupplyChain/Company?id="+node.companyID,{
                        success: function(company){
                            companyList.clear();
                            companyList.add(company.name, company);
                            companyList.setValue(company.name, true);

                            updateFacilities(company, function(){

                                var facility;
                                node.facilityID = parseFloat(node.facilityID);
                                var options = facilityList.getOptions();
                                for (var i=0; i<options.length; i++){
                                    var option = options[i];
                                    if (option.value.id===node.facilityID){
                                        facility = option.value;
                                        facilityList.setValue(option.text, true);
                                        updateFacility(facility);
                                        break;
                                    }
                                }


                                updateProducts(facility, function(){
                                    node.productID = parseFloat(node.productID);
                                    var options = productTypes.getOptions();
                                    for (var i=0; i<options.length; i++){
                                        var option = options[i];
                                        var products = option.value;
                                        for (var j=0; j<products.length; j++){
                                            var product = products[j];
                                            if (product.id===node.productID){
                                                productTypes.setValue(option.text);
                                                productList.setValue(product.name);
                                                break;
                                            }
                                        }
                                    }
                                });
                            });
                        }
                    });
                    if (node.notes){
                        form.setValue("notes", node.notes);
                    }
                }
            };
        }

        return nodeEditor;
    };


  //**************************************************************************
  //** updateFacilities
  //**************************************************************************
  /** Used to update the facility list
   *  @param callback If no callback is given, will automatically pick a
   *  facility from the list - triggering updates to the product lists
   */
    var updateFacilities = function(company, callback){
        facilityList.clear();

        var filter = "";
        if (!isNaN(company.id)){
            filter = "companyID=" + company.id;
        }
        else{
            if (company.owner_operator_number){
                filter = "owner_operator_number="+company.owner_operator_number;
            }
        }

        if (filter){
            get("SupplyChain/Facilities?"+filter,{
                success: function(arr){
                    for (var i=0; i<arr.length; i++){
                        var facility = arr[i];
                        var facilityName = facility.name;
                        if (!facilityName) facilityName = "Facility " + facility.id;
                        facilityList.add(facilityName, facility);
                    }
                    if (arr.length===1 && !callback) facilityList.setValue(facilityName);
                    if (callback) callback.apply(me, []);
                }
            });
        }
    };


  //**************************************************************************
  //** updateProducts
  //**************************************************************************
    var updateProducts = function(facility, callback){
        productList.clear();
        productTypes.clear();
        if (!facility) return;

        var filter = "";
        if (!isNaN(facility.id)){
            filter = "facilityID=" + facility.id;
        }
        else{
            if (facility.fei_number) filter = "fei="+facility.fei_number;
        }

        get("SupplyChain/Products?"+filter,{
            success: function(arr){

              //Group products by product code
                var products = {};
                for (var i=0; i<arr.length; i++){
                    var product = arr[i];
                    var productID = product.id;
                    var productName = product.name;
                    var productType = product.type ? product.type : product.device_name;
                    var productCode = product.code ? product.code : product.product_code;

                    product = {
                        id: productID,
                        name: productName ? productName : "N/A",
                        type: productType,
                        code: productCode,
                        inventory: product.inventory,
                        capacity: product.capacity,
                        leadTime: product.leadTime
                    };


                    var key = productCode;
                    if (!key) key = productType;
                    if (!key) key = "N/A";
                    var val = products[key];
                    if (!val) {
                        val = [];
                        products[key] = val;
                    }
                    val.push(product);
                }


              //Populate list of productTypes
                for (var key in products) {
                    if (products.hasOwnProperty(key)){
                        var arr = products[key];
                        var type = arr[0].type;
                        var text;
                        if (key && type){
                            if (key===type) text = key;
                            else text = key + " - " + type;
                        }
                        else{
                            if (key) text = key;
                            else{
                                if(type) text = type;
                                else text = "N/A";
                            }
                        }
                        productTypes.add(text, arr);
                    }
                }
                if (productTypes.getOptions().length===1) productTypes.setValue(text);
                if (callback) callback.apply(me, []);
            }
        });
    };


  //**************************************************************************
  //** save
  //**************************************************************************
    var save = function(data, callback){
        waitmask.show();


        var company = {
            id: data.company.id,
            name: data.company.name,
            sourceID: data.company.owner_operator_number
        };


        post("SupplyChain/Company", JSON.stringify(company), {
            success: function(companyID){


                var facility = {
                    id: data.facility.id,
                    name: data.facility.name,
                    city: data.facility.city,
                    state: data.facility.state,
                    country: data.facility.country,
                    companyID: companyID,
                    sourceID: data.facility.fei_number
                };


                post("SupplyChain/Facility", JSON.stringify(facility), {
                    success: function(facilityID){


                        var product = {
                            id: data.product.id,
                            name: data.product.name,
                            type: data.product.type,
                            code: data.product.code,
                            inventory: data.inventory,
                            capacity: data.capacity,
                            leadTime: data.leadTime,
                            facilityID: facilityID
                        };


                        post("SupplyChain/Product", JSON.stringify(product), {
                            success: function(productID){

                                waitmask.hide();
                                if (callback) callback.apply(me, [companyID, facilityID, productID, data.notes]);

                            },
                            failure: function(request){
                                waitmask.hide();
                                alert(request);
                            }
                        });

                    },
                    failure: function(request){
                        waitmask.hide();
                        alert(request);
                    }
                });


            },
            failure: function(request){
                waitmask.hide();
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** createCombobox
  //**************************************************************************
    var createCombobox = function(){
        return new javaxt.dhtml.ComboBox(document.createElement("div"), {
            style: config.style.combobox,
            scrollbar: true
        });
    };
    

  //**************************************************************************
  //** createDrawflowNode
  //**************************************************************************
    var createDrawflowNode = function(node){

        var div = document.createElement("div");

        // title to overlay
        var title = document.createElement("div");
        title.className = "drawflow-node-title";
        title.innerHTML = "<i class=\"" + node.icon + "\"></i><span>" + node.name + "</span>";
        div.appendChild(title);


        // body element overlay background
        var overlayDiv = document.createElement("div");
        overlayDiv.className = "drawflow-node-overlay";
        addShowHide(overlayDiv);
        overlayDiv.hide();


        // product name to overlay
        var productName = document.createElement("div");
        productName.className = "drawflow-node-product-name";
        productName.innerHTML = "<span>" + node.productName + "</span>";
        overlayDiv.appendChild(productName);


        // facility name to overlay
        var facilityName = document.createElement("div");
        facilityName.className = "drawflow-node-facility-name";
        facilityName.innerHTML = "<span>" + node.facilityName + "</span>";
        overlayDiv.appendChild(facilityName);

        var body = document.createElement("div");
        body.className = "drawflow-node-body";
        var content = node.content;
        if (content){
            if (typeof content === "string"){
                body.innerHTML = content;
            }
            else{
                body.appendChild(content);
            }
            body.appendChild(overlayDiv);
        }

        div.appendChild(body);
        return div;
    };


  //**************************************************************************
  //** updateDrawflowNode
  //**************************************************************************
    // update the dom elements of selected node
    // selective updating
      var updateDrawflowNode = function(node,props){

       // layer 1
        var wrapper = node.getElementsByClassName("drawflow-node-body")[0];



        // layer 2 - overlay text
        var overlayDiv;
        var array = node.getElementsByClassName("drawflow-node-overlay");
        if (array.length === 1){
            overlayDiv = array[0];
        }
        else{
            overlayDiv = document.createElement("div");
            overlayDiv.className = "drawflow-node-overlay";
            wrapper.appendChild(overlayDiv);
        }


        ////////////////////////// update facility name ///////////////////////

        var facilityDiv = null;
        var array = node.getElementsByClassName("drawflow-node-facility-name")
        // when div is present in current node DOM object, set facilityDiv to this object
        if(array.length == 1){
            var facilityDiv = array[0]
            overlayDiv.appendChild(facilityDiv)
        }
        else {
            // create new div to display facility name
            var facilityDiv = document.createElement("div")
            facilityDiv.className = "drawflow-node-facility-name"
            overlayDiv.appendChild(facilityDiv)
        }
        // add phase-in/out effects during div update
        addShowHide(facilityDiv);


        // if div is empty or set as undefined then hide the element and update
        if (String(facilityDiv) === ("undefined"|"")){
            // hide the element from user view
            facilityDiv.hide()
            // update when needed 
            // get facility name from database (use facilityID to resolve)
            get("SupplyChain/Facility?id="+props.facilityID, {
                success: function(facility){
                    facilityDiv.innerHTML = "<b>Facility:</b> "+facility.name;
                    facilityDiv.show();
                }
            })
        }

        // if the div is not empty or is set as a defined value -> it is current, don't hide/update
        else {
            // up-to-date nodes won't do any processing
            // console.log("node" + props.name + "facility up to date")
        }


   
        ////////////////////////// update product name ///////////////////////

        var productDiv = null;
        var array = node.getElementsByClassName("drawflow-node-product-name")
        if(array.length == 1){
            productDiv = array[0]
            overlayDiv.appendChild(productDiv)
        }
        else {
            productDiv = document.createElement("div")
            productDiv.className = "drawflow-node-product-name"
            overlayDiv.appendChild(productDiv)
        }

        addShowHide(productDiv);
        // if div is empty or set as undefined then hide the element and update
        if (String(productDiv) === ("undefined"|"")){
            // hide the element from user view
            productDiv.hide();
            // update when needed 
            // get facility name from database (use facilityID to resolve)
            get("SupplyChain/Product?id="+props.productID, {
                success: function(product){
                    productDiv.innerHTML = "<b>Product:</b> " + product.name;
                    productDiv.show();
                }
            });
        }
        
        // if the div is not empty or is set as a defined value -> it is current, don't hide/update
        else {
            // up-to-date nodes won't do any processing
            // console.log("node" + props.name + "product up to date")
        }
    };
    
    
  //**************************************************************************
  //** showMenu
  //**************************************************************************
    var showMenu = function(node){
        var menu = getNodeMenu(node);
        sankeyEditor.showMenu(menu, node);
    };
    
    
  //**************************************************************************
  //** getNodeMenu
  //**************************************************************************
    var getNodeMenu = function(node){
        if (!nodeMenu){
            var div = document.createElement("div");
            div.className = "app-menu";
            div.appendChild(createMenuOption("Edit Color", "edit", function(){
                var node = nodeMenu.node;
                getColorPicker().onChange = function(c){
                    node.style.backgroundColor = c.hexString;
                };
            }));
            nodeMenu = div;
        }
        nodeMenu.node = node;
        return nodeMenu;
    };
    
    
  //**************************************************************************
  //** getColorPicker
  //**************************************************************************
    var getColorPicker = function(){
        if (!colorPicker){
            colorPicker = new javaxt.dhtml.Window(document.body, {
                title: "Edit Node",
                width: 340,
                modal: false,
                style: config.style.window
            });
            
            var cp = new iro.ColorPicker(colorPicker.getBody(), {
              width: 320,
              height: 320,
              anticlockwise: true,
              borderWidth: 1,
              borderColor: "#fff",
              css: {
                "#output": {
                  "background-color": "$color"
                }
              }
            });
            
            cp.on("color:change", function(c){
                colorPicker.onChange(c);
            });
            
            colorPicker.onChange = function(){};
        }
        colorPicker.show();
        return colorPicker;
    };
    

  //**************************************************************************
  //** createMenuOption
  //**************************************************************************
    var createMenuOption = function(label, icon, onClick){
        var div = document.createElement("div");
        div.className = "app-menu-item noselect";
        if (icon && icon.length>0){
            div.innerHTML = '<i class="fas fa-' + icon + '"></i>' + label;
        }
        else{
            div.innerHTML = label;
        }
        div.label = label;
        div.onclick = function(){
            sankeyEditor.getCallout().hide();
            onClick.apply(this, [label]);
        };
        addShowHide(div);
        return div;
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var warn = bluewave.utils.warn;
    var get = bluewave.utils.get;
    var post = javaxt.dhtml.utils.post;
    var getData = bluewave.utils.getData;
    var addShowHide = javaxt.dhtml.utils.addShowHide;

    init();
};