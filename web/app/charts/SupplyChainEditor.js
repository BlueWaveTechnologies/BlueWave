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
                width: 475,
                valign: "top",
                modal: true,
                resizable: false,
                style: config.style.window
            });



            var companyList = new javaxt.dhtml.ComboBox(document.createElement("div"), {
                style: config.style.combobox,
                addNewOption: false,
                addNewOptionText: "Add Company...",
                scrollbar: true
            });


            companyList.onAddNewOption = function(){
                console.log("Add New Company!");
            };

            companyList.onMenuContext = function(text, value, el){

            };


            var facilityList = new javaxt.dhtml.ComboBox(document.createElement("div"), {
                style: config.style.combobox,
                addNewOption: false,
                addNewOptionText: "Add Facility...",
                scrollbar: true
            });


            var productList = new javaxt.dhtml.ComboBox(document.createElement("div"), {
                style: config.style.combobox,
                addNewOption: false,
                addNewOptionText: "Add Product...",
                scrollbar: true
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
                                type: "text"
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
                                    company = data.company = {
                                        name: companyName
                                    };
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
                                    facility = data.facility = {
                                        name: facilityName
                                    };
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
                                    product = data.product = {
                                        name: productName
                                    };
                                }
                            }

                            save(data, function(){

                                var node = nodeEditor.node;
                                node.name = companyName;

                                node.childNodes[0].getElementsByTagName("span")[0].innerHTML = companyName;
                                nodeEditor.close();
                            });
                        }
                    }
                ]
            });



            var cityField = form.findField("city");
            var countryField = form.findField("country");
            var feiField = form.findField("fei");
            form.disableField("fei");



            var lastSearch = 0;
            form.onChange = function(field){
                if (field.name==="company"){
                    var name = field.getText();
                    var value = field.getValue();
console.log(name, value);
                    if (value){ //user either selected an item in the list or typed in an exact match
                        var company = value;

                      //Update facility list
                        facilityList.clear();
                        var filter;
                        if (company.owner_operator_number){
                            filter = "owner_operator_number="+company.owner_operator_number;
                        }
                        else{
                            if (!isNaN(company.id)) filter = "companyID=" + company.id;
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
                                }
                            });
                        }
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
console.log(name, value);
                    if (value){ //user either selected an item in the list or typed in an exact match
                        var facility = value;

                        if (facility.fei_number){
                            form.disableField("city");
                            form.disableField("country");
                            feiField.setValue(facility.fei_number);
                        }
                        cityField.setValue(facility.city);
                        if (facility.iso_country_code==='US'){
                            countryField.setValue(facility.state_code);
                        }
                        else{
                            countryField.setValue(facility.iso_country_code);
                        }


                      //Update product fields
                        productList.clear();
                        var filter = "facilityID=" + facility.id;
                        if (facility.fei_number) filter = "fei="+facility.fei_number;
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


                                productList.showMenu();

                            }
                        });
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


            nodeEditor.update = function(node){
                nodeEditor.node = node;
                form.clear();
                if (companyList.resetColor) companyList.resetColor();
                if (facilityList.resetColor) facilityList.resetColor();
                if (productList.resetColor) productList.resetColor();
                if (node){
                    if (node.name){
                        var name = node.name;
                        var info = {
                            id: node.nodeID,
                            name: node.name,
                            city: node.city,
                            iso_country_code: node.country,
                            fei: node.fei
                        };

                        if (isNaN(info.id)) delete info.id;
                        for (var key in info.company) {
                            if (!info.company[key]) delete info.company[key];
                        }

                        companyList.add(name, info);
                        form.setValue("company", node.name);
                    }
                    if (node.city) form.setValue("city", node.city);
                    if (node.country) form.setValue("country", node.country);
                    if (node.fei) form.setValue("fei", node.fei);
                    if (node.notes) form.setValue("notes", node.notes);

                    if (node.fei){
                        form.disableField("city");
                        form.disableField("country");
                    }
                    else{
                        form.enableField("city");
                        form.enableField("country");
                    }
                }
            };
        }

        return nodeEditor;
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
  //** checkName
  //**************************************************************************
    var checkName = function(name, currentNode, callback){
        var isValid = true;

        if (!name) name = "";

        var currentNodeID = currentNode.id;
        var idx = currentNodeID.indexOf("drawflow_node");
        if (idx===0) currentNodeID = currentNodeID.substring("drawflow_node".length+1);


        var nodes = sankeyEditor.getNodes();
        for (var key in nodes) {
            if (nodes.hasOwnProperty(key)){
                var node = nodes[key];
                var nodeID = key;
                var nodeName = node.name;
                if (nodeID !== currentNodeID){
                    console.log(name, nodeName);
                    if (name.toLowerCase() === nodeName.toLowerCase()){
                        isValid = false;
                        break;
                    }
                }
            }
        }
        callback.apply(me, [isValid]);
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var warn = bluewave.utils.warn;
    var get = bluewave.utils.get;
    var post = javaxt.dhtml.utils.post;

    init();
};