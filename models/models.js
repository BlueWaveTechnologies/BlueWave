var package = "bluewave.app";
var schema = "application";
var jts = "org.locationtech.jts";
var models = {

  //**************************************************************************
  //** Contact
  //**************************************************************************
  /** Used to represent an individual. */

    Contact: {
        fields: [
            {name: 'firstName',    type: 'string'},
            {name: 'lastName',     type: 'string'},
            {name: 'fullName',     type: 'string'},
            {name: 'gender',       type: 'string'},
            {name: 'dob',          type: 'string'},
            {name: 'info',         type: 'json'}
        ]
    },


  //**************************************************************************
  //** User
  //**************************************************************************
    User: {
        fields: [
            {name: 'username',    type: 'string'},
            {name: 'password',    type: 'password'},
            {name: 'accessLevel', type: 'int'},
            {name: 'active',      type: 'boolean'},
            {name: 'contact',     type: 'Contact'},
            {name: 'auth',        type: 'json'},
            {name: 'info',        type: 'json'}
        ],
        constraints: [
            {name: 'username',      required: true,  length: 255,  unique: true},
            {name: 'password',      required: true},
            {name: 'accessLevel',   required: true},
            {name: 'active',        required: true}
        ],
        defaults: [
            {name: 'active',    value: true}
        ]
    },


  //**************************************************************************
  //** UserPreference
  //**************************************************************************
    UserPreference: {
        fields: [
            {name: 'key',         type: 'string'},
            {name: 'value',       type: 'string'},
            {name: 'user',        type: 'User'}
        ],
        constraints: [
            {name: 'key',       required: true,  length: 50},
            {name: 'value',     required: true},
            {name: 'user',      required: true, onDelete: 'cascade'}
        ]
    },


  //**************************************************************************
  //** UserActivity
  //**************************************************************************
    UserActivity: {
        fields: [
            {name: 'user',      type: 'User'},
            {name: 'hour',      type: 'int'},
            {name: 'minute',    type: 'int'},
            {name: 'count',     type: 'int'}
        ],
        constraints: [
            {name: 'user',      required: true, onDelete: 'cascade'},
            {name: 'hour',      required: true},
            {name: 'minute',    required: true},
            {name: 'count',     required: true}
        ]
    },


//  //**************************************************************************
//  //** UserGroup
//  //**************************************************************************
//    UserGroup: {
//        fields: [
//            {name: 'name',        type: 'string'},
//            {name: 'description', type: 'string'},
//            {name: 'active',      type: 'boolean'},
//            {name: 'info',        type: 'json'}
//        ],
//        hasMany: [
//            {model: 'User',       name: 'users'}
//        ],
//        constraints: [
//            {name: 'name',    required: true},
//            {name: 'active',  required: true}
//        ]
//    },


  //**************************************************************************
  //** Dashboard
  //**************************************************************************
    Dashboard: {
        fields: [
            {name: 'name',          type: 'string'},
            {name: 'className',     type: 'string'},
            {name: 'thumbnail',     type: 'binary'},
            {name: 'info',          type: 'json'}
        ],
        constraints: [
            {name: 'name',          required: true},
            {name: 'className',     required: true}
        ]
    },


  //**************************************************************************
  //** DashboardUser
  //**************************************************************************
    DashboardUser: {
        fields: [
            {name: 'user',        type: 'User'},
            {name: 'dashboard',   type: 'Dashboard'},
            {name: 'readOnly',    type: 'boolean'}
        ],
        constraints: [
            {name: 'user',          required: true, onDelete: 'cascade'},
            {name: 'dashboard',     required: true, onDelete: 'cascade'},
            {name: 'readOnly',      required: true}
        ],
        defaults: [
            {name: 'readOnly',      value: true}
        ]
    },


  //**************************************************************************
  //** DashboardGroup
  //**************************************************************************
    DashboardGroup: {
        fields: [
            {name: 'name',        type: 'string'},
            {name: 'description', type: 'string'},
            {name: 'user',        type: 'User'},
            {name: 'info',        type: 'json'}
        ],
        hasMany: [
            {model: 'Dashboard',       name: 'dashboards'}
        ],
        constraints: [
            {name: 'name',    required: true},
            {name: 'user',    required: true, onDelete: 'cascade'}
        ]
    },

  //**************************************************************************
  //** File
  //**************************************************************************
  /** Used to represent an individual file found in a directory
   */
    File: {
        fields: [
            {name: 'name',         type: 'string'},
            {name: 'path',         type: 'Path'},
            {name: 'type',         type: 'string'},
            {name: 'date',         type: 'date'},
            {name: 'size',         type: 'long'},
            {name: 'hash',         type: 'string'},
            {name: 'metadata',     type: 'json'}
        ],
        constraints: [
            {name: 'name',    required: true},
            {name: 'path',    required: true}
        ]
    },


  //**************************************************************************
  //** Path
  //**************************************************************************
  /** Used to represent an individual directory/path containing files.
   */
    Path: {
        fields: [
            {name: 'dir',    type: 'string'}
        ],
        constraints: [
            {name: 'dir',    required: true}
        ]
    },


  //**************************************************************************
  //** Document
  //**************************************************************************
    Document: {
        fields: [
            {name: 'title',        type: 'string'},
            {name: 'description',  type: 'string'},
            {name: 'file',         type: 'File'},
            {name: 'pageCount',    type: 'int'},
            {name: 'indexStatus',  type: 'string'},
            {name: 'info',         type: 'json'}
        ],
        constraints: [
            {name: 'file',    required: true}
        ]
    },


  //**************************************************************************
  //** DocumentComparison
  //**************************************************************************
    DocumentComparison: {
        fields: [
            {name: 'a',         type: 'Document'},
            {name: 'b',         type: 'Document'},
            {name: 'info',      type: 'json'}
        ],
        constraints: [
            {name: 'a',     required: true},
            {name: 'b',     required: true},
            {name: 'info',  required: true}
        ]
    }


};