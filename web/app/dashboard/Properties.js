if(!bluewave) var bluewave={};
if(!bluewave.dashboard) bluewave.dashboard={};

//******************************************************************************
//**  Dashboard Properties
//******************************************************************************
/**
 *   Panel used to edit dashboard properties
 *
 ******************************************************************************/

bluewave.dashboard.Properties = function(parent, config) {

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


      //Create form
        var td = tr.addColumn({
            width: "100%",
            paddingRight: "7px"
        });
        createForm(td);


      //Create preview
        createPreview(tr.addColumn());

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
        if (!dashboard) dashboard = {};

        
        preview.update(dashboard);


        var nameField = form.findField("name");
        if (nameField.resetColor) nameField.resetColor();

        var name = dashboard.name;
        if (name) form.setValue("name", name);

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

      //Create spacer
        createElement("div", parent, {
            width: "425px"
        });


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

        var div = createElement("div", {
            width: "100%",
            height: "334px"
        });

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

      //Create spacer
        createElement("div", parent, {
            width: "350px"
        });



        var div = createElement("div", "dashboard-homepage");
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";


        var innerDiv = createElement("div", div, {
            height: "100%"
        });


        preview = new bluewave.dashboard.CardView(innerDiv);



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
    var createElement = javaxt.dhtml.utils.createElement;
    var createTable = javaxt.dhtml.utils.createTable;
    var warn = bluewave.utils.warn;



    init();
};