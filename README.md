# BlueWave

Web application used to create charts and dashboards using a graph database.


# Technology Stack

- JavaScript/HTML front end
- Java back end
- H2 relational database
- Neo4J graph database

# Prerequisites
In order to run BlueWave you will need the following:

- Java 11 installed
- Neo4J graph database with the [bluewave-neo4j-plugin](https://github.com/BlueWaveTechnologies/bluewave-neo4j-plugin)


# Command Line Interface

The BlueWave application is accessed via command line (aka terminal).
All command line options require an external `config.json` file.


## Starting the Server
To start the server, open a terminal and run the following:
```console
cd /path/to/project/
java -jar target/bluewave-2.0.0.jar -config ../config.json
```
Note that you will need a user account to login. If this is the first time
you are starting the server, stop the server and create an admin account via
the command line.

## Create User Account

To create a new user, open a terminal and run the following:
```console
cd /path/to/project/
java -jar target/bluewave-2.0.0.jar -config ../config.json -addUser john -accessLevel 5
```
In this example, we will create a new user with a login username called `john` with level 5 access (admin rights).
The application will prompt the user for a password. Note that you can add, edit, and delete users via the web application
once the server is up and running.


# Config.json
The web app requires a config.json file to start. At a minimum, the config.json
file should include connection information to the neo4j database

```javascript
{
    "database": {
        "driver": "H2",
        "maxConnections": 25,
        "path": "data/database",
        "schema": "models/Database.sql"
    },
    "graph": {
        "host": "localhost:7687",
        "username": "neo4j",
        "password": "password"
    },
    "webserver": {
        "webDir": "web/",
        "jobDir": "temp/",
        "port": 8080
    }
}
```


# Branding

The BlueWave application name and logos can be updated to suit your needs. To do
so, you will need to add a "branding" section to the "webserver" config where you
can specify the app name and specify a path to a custom stylesheet. Example:
```javascript
{
    "webserver" : {
        "webDir" : "/bluewave/app/web",
        "branding" : {
            "appName" : "Rogue Wave",
            "appStyle" : "branding/rogue/main.css"
        }
    }
}
```

Note that the path to the stylesheet is relative to the "webDir". In the stylesheet
you can override default styles like the "app-header-icon".



