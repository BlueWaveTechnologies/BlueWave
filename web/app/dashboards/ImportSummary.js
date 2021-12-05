if(!bluewave) var bluewave={};
if(!bluewave.dashboards) bluewave.dashboards={};

//******************************************************************************
//**  ImportSummary
//******************************************************************************
/**
 *   Used to render ports of entry
 *
 ******************************************************************************/

bluewave.dashboards.ImportSummary = function(parent, config) {

    var me = this;
    var initializing = true;
    var title = "Import Summary";
    var grid;
    var data = [];
    var countryOptions, productOptions, establishmentOptions; //dropdowns
    var slider, thresholdInput;
    var lineChart, barChart, scatterChart;
    var waitmask;
    
    
  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){
        if (!config.waitmask) config.waitmask = new javaxt.express.WaitMask(document.body);
        waitmask = config.waitmask;        
        

      //Create main table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td, div;

      //Create toolbar
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        tr.appendChild(td);
        createToolbar(td);


      //Create grid
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.width = "100%";
        td.style.height = "100%";
        tr.appendChild(td);
        createGrid(td);


      //Create charts
        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.style.height = "350px";
        tr.appendChild(td);
        createCharts(td);


        parent.appendChild(table);
        me.el = table;                        
    };


  //**************************************************************************
  //** getTitle
  //**************************************************************************
    this.getTitle = function(){
        return title;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        data = [];
        grid.clear();
        establishmentOptions.setValue("Manufacturer", true);
        countryOptions.setValue("TH", true); //Select Thailand by default for demo purposes
        productOptions.setValue("All", true);
    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(){
        var onReady = function(){
            me.clear();
            update();
        };
        
        if (initializing){
            var timer;

            var checkStatus = function(){
                if (initializing){
                    timer = setTimeout(checkStatus, 100);
                }
                else{
                    clearTimeout(timer);
                    onReady();
                }
            };

            timer = setTimeout(checkStatus, 100);
        }
        else{
            onReady();
        }                
    };

    
  //**************************************************************************
  //** resize
  //**************************************************************************
    this.resize = function(){
        
    };    
    
    
  //**************************************************************************
  //** update
  //**************************************************************************
    var update = function(){
        
        
        console.log("update!");
        waitmask.show(500);
        
        
        var establishment = establishmentOptions.getValue();
        var country = countryOptions.getValue();
        var threshold = parseFloat(thresholdInput.value);
        if (isNaN(threshold)) threshold = "";

        data = [];
        get("import/summary?country=" + country + "&establishment=" + establishment + "&threshold=" + threshold, {
            success: function(csv){            
                var rows = parseCSV(csv, ",");
                for (var i=1; i<rows.length; i++){ //skip header
                    var col = rows[i];
                    data.push({
                        name: col[0],
                        totalShipments: parseFloat(col[1]),
                        totalValue: parseFloat(col[2]),
                        totalQuantity: parseFloat(col[3])
                    });
                }

                data.sort(function(a,b){
                    return b.totalShipments-a.totalShipments;
                });
                

              //Update main table
                grid.update(data);
                
                
                
              //Update line chart
                getData("Imports_Per_Day", function(csv){
                    var lineData = [];
                    parseCSV(csv, ",").forEach((row)=>{
                        var date = new Date(row[0]).getTime();
                        var count = parseFloat(row[1]);                           
                        lineData.push({
                            date: date,
                            count: count
                        });
                    });
                    
                    lineData.sort(function(a,b){
                        return b.date-a.date;
                    });                    
                    
                    lineData.forEach((d)=>{
                        var date = new Date(d.date);
                        d.date = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();
                    });
                    
                    lineChart.update({
                        xAxis: "date",
                        yAxis: "count"
                    },[lineData]);
                });                

                
                
              //Update bar chart
                var lineData = [];
                for (var i=0; i<Math.min(10,data.length); i++){
                    var d = data[i];
                    lineData.push({
                        name: "fei_"+d.name,
                        quantity: d.totalShipments
                    });
                }
                barChart.update({
                    xAxis: "name",
                    yAxis: "quantity"
                }, [lineData]);


//                scatterChart.update({
//                    xAxis: "name",
//                    yAxis: "totalShipments"
//                },[d3.csvParse(csv)]);





                waitmask.hide();
            },
            failure: function(request){
                waitmask.hide();
                alert(request);
            }
        });
    };


  //**************************************************************************
  //** createToolbar
  //**************************************************************************
    var createToolbar = function(parent){

        var div = document.createElement("div");
        div.className = "dashboard-toolbar";
        parent.appendChild(div);


        var table = createTable();
        table.style.width = "";
        div.appendChild(table);
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;
        
        var paddingLeft = "15px";
        var createDropdown = function(label, width){            
            td = document.createElement("td");            
            td.innerHTML = label + ":";
            tr.appendChild(td);
            if (td.previousSibling) td.style.paddingLeft = paddingLeft;
            td = document.createElement("td");
            if (isNaN(width)) width = 200;
            td.style.width = width + "px";
            tr.appendChild(td);  
            td.style.paddingLeft = "7px";
            return new javaxt.dhtml.ComboBox(td, {
                style: config.style.combobox,
                readOnly: true
            });
        };
        
        
      //Create entity dropdown
        establishmentOptions = createDropdown("Entity Type", 160);
        ["Manufacturer","Shipper","Importer","Consignee","DII"].forEach((n)=>{
            establishmentOptions.add(n, n);
        });
        establishmentOptions.setValue("Manufacturer");
        establishmentOptions.onChange = function(name, value){
            update();
        };

        
      //Create country dropdown
        countryOptions = createDropdown("Country of Origin", 80);
        countryOptions.add("Any", "");
        countryOptions.setValue("Any");
        countryOptions.onChange = function(name, value){
            update();
        };        
      
        
      //Create product dropdown 
        productOptions = createDropdown("Product Code", 100);
        productOptions.add("All", "");
        productOptions.setValue("All");
        productOptions.onChange = function(name, value){

        };
        
        
      //Create slider
        td = document.createElement("td");   
        td.style.paddingLeft = paddingLeft;
        td.innerHTML = "Outlier Filter:";
        tr.appendChild(td);                  
        td = document.createElement("td");
        td.style.width = "175px";
        td.style.padding = "0 10px";
        tr.appendChild(td);
        slider = document.createElement("input");
        slider.type = "range";
        slider.className = "dashboard-slider";
        slider.style.width = "100%";
        slider.setAttribute("min", 1);
        slider.setAttribute("max", 7);
        slider.value = 1;
        slider.getValue = function(){
            var val = this.value-1;
            return val;
        };
        slider.onchange = function(){ 
            var val = this.getValue();
            if (val>0){ 
                val = (val/2)+""; 
                if (val.indexOf(".")===-1) val += ".0";
                thresholdInput.value = val + "z";
            }
            else{
                thresholdInput.value = "";
            }
            update();
        };
        td.appendChild(slider);     
        td = document.createElement("td");
        td.style.width = "40px";
        tr.appendChild(td);
        thresholdInput = document.createElement("input");
        thresholdInput.className = "form-input";
        thresholdInput.style.width = "100%";
        td.appendChild(thresholdInput);

        
        
        
      //Get data and populate the dropdowns
        waitmask.show(500);
        getData("Imports_Products", function(csv){

            var productCodes = [];
            var uniqueCountries = {};

          //Parse csv
            var rows = parseCSV(csv, ",");
            for (var i=1; i<rows.length; i++){ //skip header
                var col = rows[i];
                var productCode = col[0];
                var productCount = parseFloat(col[1]);
                var countries = getArray(col[2]);

                productCodes.push(productCode);
                for (var j=0; j<countries.length; j++){
                    uniqueCountries[countries[j]] = true;
                }
            }
            
            
          //Update productOptions
            productCodes.sort();
            for (var i=0; i<productCodes.length; i++){
                var productCode = productCodes[i];
                productOptions.add(productCode, productCode);
            }
            
            
          //Update countryOptions
            var arr = [];
            for (var country in uniqueCountries) {
                if (uniqueCountries.hasOwnProperty(country)){
                    arr.push(country);
                }   
            }
            arr.sort();
            for (var i=0; i<arr.length; i++){
                var country = arr[i];
                countryOptions.add(country, country);
            }


            initializing = false;

            //waitmask.hide();
        });        
    };


  //**************************************************************************
  //** createGrid
  //**************************************************************************
    var createGrid = function(parent){

      //Create grid control
        grid = new javaxt.dhtml.DataGrid(parent, {
            style: config.style.table,
            columns: [
                {header: 'Name', width:'100%'},
                {header: 'Reported Quantity', width:'150px', align:'right'},
                {header: 'Reported Value', width:'150px', align:'right'},
                {header: 'Total Shipments', width:'150px', align:'right'}
            ],
            update: function(row, d){
                row.set('Name', d.name);
                row.set('Reported Quantity', formatNumber(d.totalQuantity));
                row.set('Reported Value', "$"+formatNumber(d.totalValue));
                row.set('Total Shipments', formatNumber(d.totalShipments));
            }
        });


      //TODO: Update header
        var headerRow = grid.el.getElementsByClassName("table-header")[0];
        
        
      //Add custom update method
        grid.update = function(){
            grid.clear();
            grid.load(data);     
        };        
    };


  //**************************************************************************
  //** createCharts
  //**************************************************************************
    var createCharts = function(parent){

      //Create table
        var table = createTable();
        parent.appendChild(table);
        var tbody = table.firstChild;
        var tr = document.createElement("tr");
        tbody.appendChild(tr);
        var td;
        

      //Create line chart
        td = document.createElement("td");       
        td.style.height = "100%";
        td.style.width = "34%";
        td.style.padding = "10px";
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createLineChart(td);
        

      //Create bar chart
        td = document.createElement("td"); 
        td.style.height = "100%";
        td.style.width = "33%";
        td.style.padding = "10px 0px";        
        td.style.overflow = "hidden";
        tr.appendChild(td);
        createBarChart(td);
        
        
      //Create scatter chart
        td = document.createElement("td");       
        td.style.height = "100%";
        td.style.width = "33%";
        td.style.padding = "10px";
        td.style.overflow = "hidden";
        tr.appendChild(td);        
        createScatterChart(td);
    };
    
    
  //**************************************************************************
  //** createLineChart
  //**************************************************************************    
    var createLineChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            title: "Shipment History",
            width: "100%",
            height: "360px"
        });
        dashboardItem.el.style.margin = "0px";
        dashboardItem.el.style.display = "table";
        lineChart = new bluewave.charts.LineChart(dashboardItem.innerDiv,{});
    };
    
    
  //**************************************************************************
  //** createBarChart
  //**************************************************************************    
    var createBarChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            title: "Top Shipments",
            width: "100%",
            height: "360px"
        });
        dashboardItem.el.style.margin = "0px";
        dashboardItem.el.style.display = "table";
        barChart = new bluewave.charts.BarChart(dashboardItem.innerDiv,{});
    };
    
    
  //**************************************************************************
  //** createScatterChart
  //**************************************************************************    
    var createScatterChart = function(parent){
        var dashboardItem = createDashboardItem(parent,{
            title: "Quantity vs Exams",
            width: "100%",
            height: "360px"
        });
        dashboardItem.el.style.margin = "0px";
        dashboardItem.el.style.display = "table";
        scatterChart = new bluewave.charts.ScatterChart(dashboardItem.innerDiv,{});
    };    
    

  //**************************************************************************
  //** getArray
  //**************************************************************************
    var getArray = function(str){
        str = str.substring(1);
        return str.substring(0, str.length-1).split(", ");
    };
    
    
  //**************************************************************************
  //** numberWithCommas
  //**************************************************************************
    const formatNumber = (x) => {
        if (x!==null && typeof x !== "string") x+="";
        return x.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };    
    
    
  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var onRender = javaxt.dhtml.utils.onRender;
    var get = bluewave.utils.get;
    var getData = bluewave.utils.getData;
    var parseCSV = bluewave.utils.parseCSV;
    var createDashboardItem = bluewave.utils.createDashboardItem;


    init();
};