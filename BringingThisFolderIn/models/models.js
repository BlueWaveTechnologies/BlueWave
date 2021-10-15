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
            {name: 'user',      required: true}
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
    }

};