# Project BlueWave

Web application used visualize supply chain shortages and fraud analysis.

# Technology Stack

- JavaScript/HTML front end
- Java back end
- H2 relational database
- Neo4J graph database


# Start the Server

To start the server, open a console and run the following:
```console
cd /path/to/project/
java -jar target/bluewave-1.0.0.jar -config ../config.json
```
Note that you will need a user account to login. If this is the first time
you are starting the server, stop the server and create an admin account via
the command line.


# Config.json
The web app requires a config.json file to start. At a minimum, the config.json
file should include connection information to the neo4j database

```javascript
{
    "database" : {
        "driver" : "H2",
        "path" : "data/database",
        "schema" : "models/Database.sql",
        "maxConnections" : 25
    },

    "graph" : {
        "host" : "localhost:7687",
        "username" : "neo4j",
        "password" : "password"
    },

    "ldap" : {
        "host" : "localhost:389",
        "domain" : "my.domain.com"
    },

    "webserver" : {
        "webDir" : "web",
        "logDir" : "",
        "jobDir" : "temp",
        "keystore" : "",
        "keypass" : "",
        "port": 8080
    },

    "google" : {
        "maps": {
            "account": "peter.borissow@kartographia.com",
            "key" : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        }
    }
}
```


# Create User Account via Command Line

To create a new user, open a console and run the following:
```console
cd /path/to/project/
java -jar target/bluewave-1.0.0.jar -config ../config.json -addUser john -accessLevel 5
```