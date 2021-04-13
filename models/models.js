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
            {name: 'auth',        type: 'json'}
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
    }

};