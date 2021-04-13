if(!bluewave) var bluewave={};

//******************************************************************************
//**  Screenshot
//******************************************************************************
/**
 *   Used to generate screenshots of html components. Based on html2canvas
 *
 ******************************************************************************/

bluewave.Screenshot = function(parent, config) {

    var me = this;
    var canvas;
    var base64image;
    var type = "image/png";

  //**************************************************************************
  //** Constructor
  //**************************************************************************
    var init = function(){

        if (!config.style) config.style = javaxt.dhtml.style.default;

        var callback = function(){
            if (config.onReady) config.onReady.apply(me, []);
        };

        html2canvas(parent).then((_canvas) => {
            canvas = _canvas;
            callback();
        });
    };


  //**************************************************************************
  //** getImage
  //**************************************************************************
  /** Returns a Base64 encoded PNG image
   */
    this.getImage = function(){
        if (!canvas) return null;
        if (!base64image) base64image = canvas.toDataURL(type);
        return base64image;
    };


  //**************************************************************************
  //** showSaveOptions
  //**************************************************************************
    this.showSaveOptions = function(config){


      //Create save options
        var options =
        [
            {
                label: "Download Image",
                value: "download"
            },
            {
                label: "Copy to Clipboard",
                value: "clipboard"
            }

        ];

        var user = document.user;
        if (user && user.accessLevel>=3){
            options.push({
                label: "Save/Update Homepage",
                value: "save"
            });
        }



      //Create window
        var win = new javaxt.dhtml.Window(document.body, {
            width: 450,
            valign: "top",
            modal: true,
            resizable: false,
            style: config.style.window
        });



      //Create table
        var table = createTable();
        var tbody = table.firstChild;
        var tr, td;

        tr = document.createElement("tr");
        tr.className = "screenshot-confirmation";
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.innerHTML = '<i class="far fa-check-circle"></i>';
        tr.appendChild(td);
        td = document.createElement("td");
        td.innerHTML = "Image Ready!";
        tr.appendChild(td);

        tr = document.createElement("tr");
        tbody.appendChild(tr);
        td = document.createElement("td");
        td.colSpan = 2;
        td.style.height = "100%";
        tr.appendChild(td);

        var div = win.getBody();
        div.appendChild(table);




      //Create form
        var form = new javaxt.dhtml.Form(td, {
            style: config.style.form,
            items: [
                {
                    group: "Image Options",
                    items: [
                        {
                            name: "action",
                            label: "",
                            type: "radio",
                            alignment: "vertical",
                            options: options
                        }
                    ]
                }
            ],

            buttons: [
                {
                    name: "Cancel",
                    onclick: function(){
                        win.destroy();
                    }
                },
                {
                    name: "OK",
                    onclick: function(){


                        var action = form.getData().action;
                        if (action=="download"){
                            win.destroy();
                        }
                        else if (action=="clipboard"){
                            win.destroy();
                        }
                        else if (action=="save"){

                            if (config.beforeSave) config.beforeSave.apply(me,[]);

                            var formData = new FormData();
                            var data = me.getImage();
                            data = data.substring(("data:" + type + ";base64,").length);
                            var blob = base64ToBlob(data, type);
                            formData.append("image", blob);
                            formData.set("name", config.name);
                            formData.set("className", config.className);

                            var request = new XMLHttpRequest();
                            request.open('POST', 'dashboard/thumbnail', true);
                            request.onreadystatechange = function(){
                                if (request.readyState === 4) {
                                    if (request.status===200){
                                        win.destroy();
                                        if (config.onSave) config.onSave.apply(me,[]);
                                    }
                                    else{
                                        if (config.onError) config.onError.apply(me,[request]);
                                    }
                                }
                            };
                            request.send(formData);
                        }
                    }
                }
            ]

        });


        form.setValue("action", "download");
        win.show();
    };


  //**************************************************************************
  //** destroy
  //**************************************************************************
    this.destroy = function(){
        base64image = null;
        canvas = null;
    };



  //**************************************************************************
  //** base64ToBlob
  //**************************************************************************
    var base64ToBlob = function(base64, mime) {

        mime = mime || '';
        var sliceSize = 1024;
        var byteChars = window.atob(base64);
        var byteArrays = [];

        for (var offset = 0, len = byteChars.length; offset < len; offset += sliceSize) {
            var slice = byteChars.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, {type: mime});
    };


  //**************************************************************************
  //** Utils
  //**************************************************************************
    var createTable = javaxt.dhtml.utils.createTable;
    var post = javaxt.dhtml.utils.post;

    init();
};