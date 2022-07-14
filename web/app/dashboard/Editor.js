if(!bluewave) var bluewave={};
if(!bluewave.dashboard) bluewave.dashboard={};

//******************************************************************************
//**  Dashboard Editor
//******************************************************************************
/**
 *   Panel used to edit dashboard properties
 *
 ******************************************************************************/

bluewave.dashboard.Editor = function(parent, config) {

    var me = this;
    var defaultConfig = {};
    var form;
    var preview;


  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config) config = {};
        config = merge(config, defaultConfig);

        var table = createTable(parent);
        var tr = table.addRow();
        var td;

        td = tr.addColumn();
        td.style.width = "100%";
        td.style.paddingRight = "7px";
        createForm(td);

        td = tr.addColumn();
        createPreview(td);

        me.el = table;
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        form.clear();
        preview.clear();
    };



  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(dashboard){
        me.clear();
        preview.update(dashboard);
    };


  //**************************************************************************
  //** submit
  //**************************************************************************
    this.submit = function(){
        var inputs = form.getData();
        var name = inputs.name;
        if (name) name = name.trim();
        if (name==null || name==="") {
            warn("Name is required", form.findField("name"));
            return;
        }
    };


  //**************************************************************************
  //** createForm
  //**************************************************************************
    var createForm = function(parent){

        var spacer = document.createElement("div");
        spacer.style.width = "425px";
        parent.appendChild(spacer);

        var uploadPanel = createUploadPanel();

        form = new javaxt.dhtml.Form(parent, {
            style: config.style.form,
            items: [
                {
                    group: "General",
                    items: [

                        {
                            name: "name",
                            label: "Name",
                            type: "text"
                        },
                        {
                            name: "description",
                            label: "Description",
                            type: "textarea"
                        }

                    ]
                },
                {
                    group: "Thumbnail",
                    items: [
                        {
                            name: "thumbnail",
                            type: uploadPanel
                        }

                    ]
                }
            ]
        });
    };


  //**************************************************************************
  //** createUploadPanel
  //**************************************************************************
    var createUploadPanel = function(){

        var div = document.createElement("div");
        div.style.width = "100%";
        div.style.height = "334px";

        return {
            el: div,
            getValue: function(){

            },
            setValue: function(){

            }
        };
    };


  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(parent){

        var spacer = document.createElement("div");
        spacer.style.width = "350px";
        parent.appendChild(spacer);


        var div = document.createElement("div");
        div.className = "dashboard-homepage";
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";



        var innerDiv = document.createElement("div");
        innerDiv.style.height = "100%";
        div.appendChild(innerDiv);





        preview = new bluewave.dashboard.Preview(innerDiv);



        var formInput = {
            el: div,
            getValue: function(){

            },
            setValue: function(){

            }
        };



        var f =
        new javaxt.dhtml.Form(parent, {
            style: config.style.form,
            items: [
                {
                    group: "Preview",
                    items: [
                        {
                            name: "preview",
                            type: formInput
                        }

                    ]
                }
            ]
        });

        formInput.el.parentNode.previousSibling.style.padding = "0 0 0 0";
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createTable = javaxt.dhtml.utils.createTable;
    var warn = bluewave.utils.warn;



    init();
};