if(!bluewave) var bluewave={};
if(!bluewave.editor) bluewave.editor={};

//******************************************************************************
//**  QueryEditor
//******************************************************************************
/**
 *   Panel used to query for data
 *
 ******************************************************************************/

bluewave.editor.QueryEditor = function(parent, config) {

    var me = this;
    var defaultConfig = {
        style: {
            table: javaxt.dhtml.style.default.table,
            toolbar: javaxt.dhtml.style.default.toolbar,
            toolbarButton: javaxt.dhtml.style.default.toolbarButton,
            toolbarIcons: {
                run: "fas fa-play",
                cancel: "fas fa-stop"
            }
        }
    };

    var waitmask;
    var dbView;
    var timer;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);
        waitmask = config.waitmask;

        var div = createElement("div", parent, {
            height: "100%",
            overflow: "hidden",
            borderRadius: "0 0 5px 5px"
        });


        dbView = new javaxt.express.DBView(div, {
            style: config.style,
            waitmask: waitmask,
            queryLanguage: "cypher",
            queryService: "query/job/",
            getTables: function(){},
            onTreeClick: function(item){
                var cql = "MATCH (n:" + item.name + ")\n";
                var properties = item.node.properties;
                if (properties && properties.length>0){
                    cql += "RETURN\n";
                    //cql += "   ID(n) as node_id,\n";
                    for (var i=0; i<properties.length; i++){
                        if (i>0) cql +=",\n";
                        cql += "   n." + properties[i] + " as " + properties[i];
                    }
                }
                else{
                    cql += "RETURN ID(n) as id, properties(n) as " + item.name + " limit 10";
                }
                this.getComponents().editor.setValue(cql);
            }
        });


//
//
//        dbView.show = function(){
//            win.show();
//            waitmask.show(500);
//            getNodes(dbView.getComponents().tree);
//
//            if (!timer){
//                timer = setInterval(function(){
//                    if (win.isOpen()){
//                        getNodes(dbView.getComponents().tree);
//                    }
//                }, 15*1000);
//            }
//        };
//
//        dbView.hide = function(){
//            win.hide();
//        };
//
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){

    };


  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(node){
        me.clear();


      //Clone the config so we don't modify the original config object
        var clone = {};
        merge(clone, node.config);


      //Merge clone with default config
        merge(clone, config.chart);
        var nodeConfig = clone;

        console.log(nodeConfig);


        if (!timer){
            timer = true;
            getNodes(dbView.getComponents().tree, function(){
                timer = setInterval(function(){
                    getNodes(dbView.getComponents().tree);
                }, 15*1000);
            });
        }

    };


  //**************************************************************************
  //** getConfig
  //**************************************************************************
    this.getConfig = function(){

        var config = {
            query: dbView.getQuery()
        };


        var grid = dbView.getComponents().grid;
        if (grid) config.columns = grid.getConfig().columns;


        return config;
    };


  //**************************************************************************
  //** getNodes
  //**************************************************************************
    var getNodes = function(tree, callback){
        get("graph/properties", {
            success: function(nodes){
                if (waitmask) waitmask.hide();

              //Clear current
                tree.el.innerHTML = "";

              //Sort nodes alphabetically
                nodes.sort(function(a, b){
                    return a.name.localeCompare(b.name);
                });

              //Add nodes to the tree
                tree.addNodes(nodes);

                if (callback) callback.apply(me, [nodes]);
            },
            failure: function(request){
                if (waitmask) waitmask.hide();
                //alert(request);
            }
        });
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createElement = javaxt.dhtml.utils.createElement;
    var get = bluewave.utils.get;

    init();
};