''' this script is for recreating HTML files run in github actions  '''

# from beautifulsoup4 import BeautifulSoup as bs
from bs4 import BeautifulSoup as bs
import os
import re
import xml.etree.ElementTree as ET

# Remove the last segment of the path
base = os.path.dirname(os.path.abspath(__file__))


from os.path import dirname
import os
# print( os.path.dirname(os.getcwd()))

mainLocation = os.path.dirname(os.getcwd())+"/BlueWave/web/"
    # f = open(mainLocation, "r")
    # print(f.read())
newLocation = os.path.dirname(os.getcwd())+"/BlueWave/compiledProjectDirectory/"


# print(os.path.dirname(os.getcwd()))

itemsToRemove = [
'src="app', 
"<!-- Admin Modules -->",
 "<!-- Graph Stuff -->",
  "<!-- Misc -->",
 "<!-- Dashboard Creator -->",
 "Dashboards"
 ]

with open(mainLocation + "/main.html", "r") as f:
    lines = f.readlines()
with open(newLocation + "/web/main.html", "w") as f:
    for line in lines:
        writeLine = True
        for removeWord in itemsToRemove:
            if not removeWord in line:
                pass
            else:
                writeLine = False
        if writeLine == False:
            # the line contained one of the lines that's not allowed - do nothing
            pass
        else:
            # add the line to the new HTML file
            f.write(line)

        # add the BlueWave file reference just below the kartographia reference
        if '<script src="lib/kartographia/kartographia.js" type="text/javascript"></script>' in line:
            
            f.write('\n\n<!-- BlueWave-->\n')
            f.write('<script src="bluewave.js" type="text/javascript"></script>\n')

