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
        nodes: {
            input: {
                icon: "fas fa-industry",
                label: "Manufacturer"
            },
            output: {
                icon: "fas fa-hospital-user",
                label: "End User"
            },
            distributor: {
                icon: "fas fa-store-alt",
                label: "Distributor"
            }
        }
    };
    var sankeyEditor;
    var nodeEditor;
    var waitmask;
    var companyList, facilityList, productList;


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

        sankeyEditor = new bluewave.charts.SankeyEditor(parent, config);
        sankeyEditor.getNodeEditor = getNodeEditor;
    };


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
        return sankeyEditor.getChart();
    };


  //**************************************************************************
  //** getNodeEditor
  //**************************************************************************
    var getNodeEditor = function(){
        if (!nodeEditor){

            nodeEditor = new javaxt.dhtml.Window(document.body, {
                title: "Edit Node",
                width: 550,
                valign: "top",
                modal: true,
                resizable: false,
                style: config.style.window
            });


            companyList = createCombobox();
            facilityList = createCombobox();
            productList = createCombobox();

            var countryList = createCombobox();

            var states = [];
            getData("states", function(data) {
                var arr = data.objects.states.geometries;
                for (var i=0; i<arr.length; i++){
                    var state = arr[i];
                    states.push(state.properties);
                }
            });

            var countries = [];
            getData("countries", function(data) {
                var arr = data.features;
                for (var i=0; i<arr.length; i++){
                    var country = arr[i];
                    countries.push(country.properties);
                }
            });



            var form = new javaxt.dhtml.Form(nodeEditor.getBody(), {
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
                                name: "product",
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
                            var company = data.company;
                            var facility = data.facility;
                            var product = data.product;


                            var companyName = null;
                            try{companyName = company.name.trim(); } catch(e){}
                            if (companyName==null || companyName==="") {
                                try{companyName = companyList.getText().trim(); } catch(e){}
                                if (companyName==null || companyName==="") {
                                    warn("Company is required", companyList);
                                    return;
                                }
                                else{
                                    data.company.name = companyName;
                                }
                            }


                            var facilityName = null;
                            try{facilityName = facility.name.trim(); } catch(e){}
                            if (facilityName==null || facilityName==="") {
                                try{facilityName = facilityList.getText().trim(); } catch(e){}
                                if (facilityName==null || facilityName==="") {
                                    warn("Facility is required", facilityList);
                                    return;
                                }
                                else{
                                    data.facility.name = facilityName;
                                }
                            }


                            var productName = null;
                            try{productName = product.name.trim(); } catch(e){}
                            if (productName==null || productName==="") {
                                try{productName = productList.getText().trim(); } catch(e){}
                                if (productName==null || productName==="") {
                                    warn("Product is required", productList);
                                    return;
                                }
                                else{
                                    data.product.name = productName;
                                }
                            }

                            save(data, function(companyID, facilityID, productID){

                                var node = nodeEditor.node;
                                node.name = companyName;
                                node.companyID = companyID;
                                node.facilityID = facilityID;
                                node.productID = productID;

                                node.childNodes[0].getElementsByTagName("span")[0].innerHTML = companyName;
                                nodeEditor.close();
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
                else if (field.name==="product"){
                    var name = field.getText();
                    var value = field.getValue();

                    if (value){ //user either selected an item in the list or typed in an exact match
                        var product = value;


                    }
                    else{

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
                if (facility.iso_country_code==='US'){
                    countryList.removeAll();
                    for (var i=0; i<states.length; i++){
                        var state = states[i];
                        countryList.add(state.name, state.code);
                    }
                    countryList.setValue(facility.state_code);
                }
                else{
                    countryList.removeAll();
                    for (var i=0; i<countries.length; i++){
                        var country = countries[i];
                        countryList.add(country.name, country.code);
                    }
                    countryList.setValue(facility.iso_country_code);
                }
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
                                    var product;
                                    node.productID = parseFloat(node.productID);
                                    var options = productList.getOptions();
                                    for (var i=0; i<options.length; i++){
                                        var option = options[i];
                                        if (option.value.id===node.productID){
                                            productList.setValue(option.text);
                                            product = option.value;
                                            break;
                                        }
                                    }
                                });
                            });
                        }
                    });
                }
            };
        }

        return nodeEditor;
    };


  //**************************************************************************
  //** updateFacilities
  //**************************************************************************
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
                    if (arr.length===1) facilityList.setValue(facilityName);
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

              //Generate list of products
                var products = {};
                for (var i=0; i<arr.length; i++){
                    var product = arr[i];
                    var productID = product.id;
                    var productName = product.name;
                    var productType = product.device_name;
                    var productCode = product.product_code;
                    var proprietaryName = product.proprietary_name;

                    if (typeof proprietaryName === "string"){
                        if (proprietaryName.indexOf("[")===0 && proprietaryName.lastIndexOf("]")===proprietaryName.length-1){
                            proprietaryName = proprietaryName.substring(1,proprietaryName.length-1);
                            if (proprietaryName.indexOf(",")===-1){
                                //productName = proprietaryName;
                            }
                            else{
                                var names = proprietaryName.split(",");
                                //productName = names[0];
                            }
                        }
                    }



                    if (!productName) productName = productType;
                    products[productName] = {
                        id: productID,
                        name: productName,
                        code: productCode,
                        regulation_number: product.regulation_number
                    };
                }


              //Sort product names alphabetically
                var productNames = [];
                for (var key in products) {
                    if (products.hasOwnProperty(key)){
                        var product = products[key];
                        productNames.push(product.name);
                    }
                }
                productNames.sort();


              //Update dropdown
                for (var i=0; i<productNames.length; i++){
                    var productName = productNames[i];
                    var product = products[productName];
                    if (product.code) productName += " (" + product.code + ")";
                    productList.add(productName, product);
                }
                if (productNames.length===1) productList.setValue(productName);
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
            sourceID: data.company.sourceID
        };

        if (data.company.owner_operator_number){
            delete company.id;
            company.sourceID = data.company.owner_operator_number;
        }

        post("SupplyChain/Company", JSON.stringify(company), {
            success: function(companyID){


                var facility = {
                    id: data.facility.id,
                    name: data.facility.name,
                    sourceID: data.facility.sourceID,
                    companyID: companyID
                };

                if (data.facility.fei_number){
                    delete facility.id;
                    facility.sourceID = data.facility.fei_number;
                }

                //if (facility.iso_country_code==='US'){


                post("SupplyChain/Facility", JSON.stringify(facility), {
                    success: function(facilityID){


                        var product = {
                            id: data.product.id,
                            name: data.product.name,
                            code: data.product.code,
                            facilityID: facilityID
                        };


                        if (data.product.regulation_number){
                            delete product.id;
                            product.sourceID = data.facility.regulation_number;
                        }

                        post("SupplyChain/Product", JSON.stringify(product), {
                            success: function(productID){

                                waitmask.hide();
                                if (callback) callback.apply(me, [companyID, facilityID, productID]);

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
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var warn = bluewave.utils.warn;
    var get = bluewave.utils.get;
    var post = javaxt.dhtml.utils.post;
    var getData = bluewave.utils.getData;

    init();
};