# used to create a template config for releases
from os.path import dirname
import os

outputLocation = os.path.dirname(os.getcwd())+"/BlueWave/compiledProjectDirectory/config.json"

config_contents = '''
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
        "password": "password",
        "localCache": "temp/graph",
        "localLog": "temp/graph/logs"
    },
    "webserver": {
        "webDir": "web/",
        "jobDir": "temp/",
        "port": 8080,
        "auth" : "DISABLED"
    }
}'''
with open(outputLocation, 'w') as f:
    f.write(config_contents)

