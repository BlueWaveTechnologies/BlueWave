if(!bluewave) var bluewave={};

//******************************************************************************
//**  UserEditor
//******************************************************************************
/**
 *   Window with a form used to create and edit users
 *
 ******************************************************************************/

bluewave.UserEditor = function(parent, config) {

    var me = this;
    var form, win;
    var user = {};

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
                {
                    group: "Credentials",
                    items: [
                        {
                            name: "username",
                            label: "Username",
                            type: "text",
                            required: true
                        },
                        {
                            name: "password",
                            label: "Password",
                            type: "password",
                            required: true
                        },
                        {
                            name: "active",
                            label: "Active",
                            type: "radio",
                            alignment: "horizontal",
                            options: [
                                {
                                    label: "True",
                                    value: true
                                },
                                {
                                    label: "False",
                                    value: false
                                }
                            ]
                        }
                    ]
                },
                {
                    group: "Contact",
                    items: [
                        {
                            name: "fullName",
                            label: "Name",
                            type: "text",
                            required: false
                        },
                        {
                            name: "email",
                            label: "Email",
                            type: "text",
                            required: false
                        },
                        {
                            name: "phone",
                            label: "Phone",
                            type: "text",
                            required: false
                        }
                    ]
                },
                {
                    group: "Permissions",
                    items: [
                        {
                            name: "accessLevel",
                            label: "", //Permissions
                            type: "radio",
                            alignment: "vertical",
                            options: [
                                {
                                    label: "Administrator", //Create users, manage settings, etc
                                    value: 5
                                },
                                {
                                    label: "Advanced", //Create dashboards
                                    value: 4
                                },
                                {
                                    label: "Contributor", //Create rules
                                    value: 3
                                },
                                {
                                    label: "Browser", //Read-Only access to dashboards
                                    value: 2
                                },
                                {
                                    label: "Custom", //Super limited custom account
                                    value: 1
                                }
                            ]
                        }
                    ]
                }
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
                        var username = values.username;
                        if (username) username = username.trim();
                        if (username==null || username==="") {
                            warn("Username is required", form.findField("username"));
                            return;
                        }

                        var password = values.password;
                        if (password) password = password.trim();
                        if (password==null || password==="") {
                            warn("Password is required", form.findField("password"));
                            return;
                        }
                        //TODO: Check password complexity?


                        user.username = username;
                        user.password = password;
                        user.accessLevel = parseInt(values.accessLevel);
                        user.active = values.active==="true";

                        me.onSubmit();
                    }
                }
            ]

        });




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
        return user;
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
    this.update = function(_user){
        form.clear();
        if (_user){
            user = _user;
            for (var key in user) {
                if (user.hasOwnProperty(key)){
                    var value = user[key];
                    form.setValue(key, value);
                }
            }

            var contact = user.contact;
            if (contact){

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


    this.onCancel = function(){};
    this.onSubmit = function(){};
    this.onChange = function(name, value){};


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


    init();
};