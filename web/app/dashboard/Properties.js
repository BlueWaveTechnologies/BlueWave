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
        createForm(tr.addColumn({
            width: "100%",
            paddingRight: "7px"
        }));


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


      //Update preview
        preview.update(dashboard);


      //Update ID
        form.setValue("id", dashboard.id);


      //Update name
        var nameField = form.findField("name");
        if (nameField.resetColor) nameField.resetColor();

        var name = dashboard.name;
        if (name) form.setValue("name", name);


      //Update description
        var description;
        if (dashboard.info){
            description = dashboard.info.description;
        }
        else{
            description = dashboard.description;
        }
        if (description) form.setValue("description", description);


      //Update thumbnail
        if (dashboard.thumbnail){
            form.setValue("thumbnail", dashboard.thumbnail);
        }
    };


  //**************************************************************************
  //** validate
  //**************************************************************************
  /** Used to check if the form contains errors
   */
    this.validate = function(callback){
        if (!callback) return;

        var inputs = me.getProperties();
        var name = inputs.name;
        if (!name) {
            warn("Name is required", form.findField("name"));
            callback.apply(me, [false]);
            return;
        }

        var id = parseInt(inputs.id);
        get("dashboards?fields=id,name",{
            success: function(dashboards) {

                var isValid = true;
                for (var i in dashboards){
                    var dashboard = dashboards[i];
                    if (dashboard.name.toLowerCase()===name.toLowerCase()){
                        if (dashboard.id!==id){
                            isValid = false;
                            break;
                        }
                    }
                }

                if (!isValid){
                    warn("Name is not unique", form.findField("name"));
                }

                callback.apply(me, [isValid]);
            },
            failure: function(request){
                alert(request);
                callback.apply(me, [false]);
            }
        });


        return inputs;
    };


  //**************************************************************************
  //** getProperties
  //**************************************************************************
    this.getProperties = function(){
        var inputs = form.getData();

        var name = inputs.name;
        if (name) name = name.trim();
        if (!name && name.length===0){
            delete inputs.name;
        }

        var description = inputs.description;
        if (description) description = description.trim();
        if (!description && description.length===0){
            delete inputs.description;
        }

        var thumbnail = inputs.thumbnail;
        if (!thumbnail) delete inputs.thumbnail;

        return inputs;
    };


  //**************************************************************************
  //** createForm
  //**************************************************************************
    var createForm = function(parent){

      //Create spacer
        createElement("div", parent, {
            width: "425px"
        });


      //Create form panel
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
                            type: createUploadPanel()
                        }

                    ]
                },
                {
                    name: "id",
                    label: "id",
                    type: "hidden"
                }
            ]
        });


      //Update thumbnail area
        var input = form.findField("thumbnail");
        var row = input.row;
        var cols = [];
        for (var i=0; i<row.childNodes.length; i++){
            cols.push(row.childNodes[i]);
        }
        row.removeChild(cols[0]);
        row.removeChild(cols[1]);
        cols[2].colSpan = "3";
        cols[2].style.padding = "0";
        cols[2].style.textAlign = "center";



      //Watch for changes in the form
        form.onChange = function(input, value){
            if (input.name==="name") preview.setTitle(value);
            if (input.name==="description") preview.setDescription(value);
            if (input.name==="thumbnail") preview.setImage(value);
            //preview.update(me.getProperties());
        };
    };


  //**************************************************************************
  //** createUploadPanel
  //**************************************************************************
    var createUploadPanel = function(){

      //Create div with enough height to match the preview panel
        var div = createElement("div", {
            width: "100%",
            height: "345px"
        });


      //Create thumbnailEditor
        var thumbnailEditor = new javaxt.dhtml.ThumbnailEditor(div, {
            thumbnailWidth: 285,
            thumbnailHeight: 255,
            mask: false,
            style: {
                uploadArea: "dashboard-upload-area"
            }
        });


      //Update vertical position of the thumbnailEditor
        thumbnailEditor.el.className = "middle";


      //Create form input
        var input = {
            el: div,
            getValue: function(){
                return thumbnailEditor.getImage();
            },
            setValue: function(src){
                console.log(src);
            },
            onChange: function(){}
        };


      //Watch for changes to the thumbnailEditor and relay it to the form input
        thumbnailEditor.onChange = function(){
            input.onChange();
        };


      //Return form input
        return input;
    };


  //**************************************************************************
  //** createPreview
  //**************************************************************************
    var createPreview = function(parent){

      //Create spacer
        createElement("div", parent, {
            width: "400px"
        });



        var div = createElement("div", "dashboard-homepage nobackground");
        div.style.height = "100%";
        div.style.textAlign = "center";
        div.style.overflowY = "auto";


      //Create dashboard card
        preview = new bluewave.dashboard.CardView(createElement("div", div, {
            height: "100%"
        }));



      //Create form with a "Preview" groupbox
        new javaxt.dhtml.Form(parent, {
            style: config.style.form,
            items: [
                {
                    group: "Preview",
                    items: [
                        {
                            name: "preview",
                            type: {
                                el: div,
                                getValue: function(){},
                                setValue: function(){}
                            }
                        }
                    ]
                }
            ]
        });


        div.parentNode.previousSibling.style.padding = "0 0 0 0";
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var merge = javaxt.dhtml.utils.merge;
    var createElement = javaxt.dhtml.utils.createElement;
    var createTable = javaxt.dhtml.utils.createTable;
    var warn = bluewave.utils.warn;
    var get = bluewave.utils.get;


    init();
};