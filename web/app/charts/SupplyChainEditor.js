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


            var form = new javaxt.dhtml.Form(nodeEditor.getBody(), {
                style: config.style.form,
                items: [
                    {
                        name: "company",
                        label: "Company",
                        type: companyList
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
                    },
                    {
                        name: "notes",
                        label: "Notes",
                        type: "textarea"
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

                            var companyName = null;
                            try{
                                companyName = data.company.company.name;
                                if (companyName) companyName = companyName.trim();
                            }
                            catch(e){}


                            if (companyName==null || companyName==="") {
                                warn("Company is required", companyList);
                                return;
                            }
                            waitmask.show();

                            var node = nodeEditor.node;
                            node.name = companyName;

                            checkName(companyName, nodeEditor.node, function(isValid){
                                waitmask.hide();
                                if (!isValid){
                                    warn("Name is not unique", companyList);
                                }
                                else{

                                    nodeEditor.close();

                                    if (node){
                                        node.city = data.city;
                                        node.country = data.country;
                                        node.notes = data.notes;
                                        node.fei = data.fei;
                                        node.childNodes[0].getElementsByTagName("span")[0].innerHTML = companyName;
                                    }
                                }
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
                if (field.label==="Company"){
                    var name = field.getText();
                    var value = field.getValue();

                    if (value){ //user either selected an item in the list or typed in an exact match
                        var company = value.company;
                        if (company.registration_number){
                            form.disableField("city");
                            form.disableField("country");
                            feiField.setValue(company.registration_number);
                        }
                        cityField.setValue(company.city);
                        if (company.iso_country_code==='US'){
                            countryField.setValue(company.state_code);
                        }
                        else{
                            countryField.setValue(company.iso_country_code);
                        }
                    }
                    else{
                        feiField.setValue("");
                        form.enableField("city");
                        form.enableField("country");
                        if (name.trim().length>0){

                            (function (name) {

                                bluewave.utils.get("SupplyChain/Companies?name="+name+"&limit=5",{
                                    success: function(arr){

                                        var currTime = new Date().getTime();
                                        if (currTime<lastSearch) return;
                                        lastSearch = currTime;

                                        companyList.removeAll();
                                        if (arr.length===0){
                                            companyList.add(name, {
                                                company: {
                                                    name: name
                                                }
                                            });
                                            companyList.setValue(name);
                                            form.enableField("city");
                                            form.enableField("country");
                                            //companyList.hideMenu();
                                        }
                                        else{
                                            for (var i=0; i<arr.length; i++){
                                                var result = arr[i];
                                                var company = result.company;
                                                companyList.add(company.name, result);
                                            }
                                            companyList.showMenu();
                                        }
                                    }
                                });
                            })(name);



                        }
                    }
                }
            };


            nodeEditor.update = function(node){
                nodeEditor.node = node;
                form.clear();
                if (companyList.resetColor) companyList.resetColor();
                if (node){
                    if (node.name){
                        var name = node.name;
                        var info = {
                            id: node.nodeID,
                            company: {
                                name: node.name,
                                city: node.city,
                                iso_country_code: node.country,
                                fei: node.fei
                            }
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

    init();
};