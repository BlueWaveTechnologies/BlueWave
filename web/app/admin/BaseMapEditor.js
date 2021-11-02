if(!bluewave) var bluewave={};

//******************************************************************************
//**  BaseMapEditor
//******************************************************************************
/**
 *   Window with a form used to create and edit Base Maps
 *
 ******************************************************************************/

 bluewave.BaseMapEditor = function(parent, config) {

     var me = this;
     var form, win;
     var baseMap = {};

    //**************************************************************************
    //** Constructor
    //**************************************************************************
    var init = function(){
        if (!config) config = {};
        if (!config.style) config.style = {};

        //Create form
        var div = document.createElement("div");
        form = new javaxt.dhtml.Form(div, {
            style: config.style.form,
            items: [
            ],
            buttons: [
                {
                    name: "Cancel",
                    onclick: function(){
                        form.clear();
                        win.close();
                        me.onCancel();
                    }
                },
                {
                    name: "Submit",
                    onclick: function(){

                        var values = form.getData();
//                        var username = values.username;
//                        if (username) username = username.trim();
//                        if (username==null || username==="") {
//                            warn("Username is required", form.findField("username"));
//                            return;
//                        }
//
//                        var password = values.password;
//                        if (password) password = password.trim();
//                        if (password==null || password==="") {
//                            warn("Password is required", form.findField("password"));
//                            return;
//                        }
//                        //TODO: Check password complexity?
//
//
//                        user.username = username;
//                        user.password = password;
//                        user.accessLevel = parseInt(values.accessLevel);
//                        user.active = values.active==="true";

                        me.onSubmit();
                    }
                }
            ]
        }

        //Create window
        if (parent===document.body){
            win = new javaxt.dhtml.Window(document.body, {
                width: 450,
                valign: "top",
                modal: true,
                resizable: false,
                body: div,
                style: config.style.window
            });
        }
        else{
            win = div;
            win.setTitle = function(){};
            win.show = function(){};
            win.hide = function(){};
            win.close = win.hide;
        }

      //Watch for enter key events
        form.el.addEventListener("keyup", function(e){
            if (e.keyCode===13){
                form.getButton("Submit").click();
            }
        });

      //Broadcast onChange events
        form.onChange = function(formInput, value){
            me.onChange(formInput.name, value);
        };


    };


  //**************************************************************************
  //** getValues
  //**************************************************************************
    this.getValues = function(){
        return baseMap;
    };


  //**************************************************************************
  //** setValue
  //**************************************************************************
    this.setValue = function(name, value){
        form.setValue(name, value);
    };



  //**************************************************************************
  //** update
  //**************************************************************************
    this.update = function(_map){
        form.clear();
        if (_map){
            baseMap = _map;
            for (var key in baseMap) {
                if (baseMap.hasOwnProperty(key)){
                    var value = baseMap[key];
                    form.setValue(key, value);
                }
            }
        }
    };


  //**************************************************************************
  //** clear
  //**************************************************************************
    this.clear = function(){
        user = {};
        form.clear();
    };


  //**************************************************************************
  //** setTitle
  //**************************************************************************
    this.setTitle = function(str){
        win.setTitle(str);
    };


  //**************************************************************************
  //** show
  //**************************************************************************
    this.show = function(){
        win.show();
    };


  //**************************************************************************
  //** hide
  //**************************************************************************
    this.hide = function(){
        win.hide(); //same as close
    };


  //**************************************************************************
  //** close
  //**************************************************************************
    this.close = function(){
        win.close();
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var warn = bluewave.utils.warn;

    this.onCancel = function(){};
    this.onSubmit = function(){};
    this.onChange = function(name, value){};
    init();
 }
