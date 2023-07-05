''' this script is for recreating HTML files run in github actions  '''

from os.path import dirname
import os

mainLocation = os.path.dirname(os.getcwd())+"/BlueWave/web/"
newLocation = os.path.dirname(os.getcwd())+"/BlueWave/compiledProjectDirectory/"

itemsToRemove = [
'src="app'
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

        # add the BlueWave file reference
        if '<!-- BlueWave Application -->' in line:
            
            f.write('<script src="bluewave.js"></script>\n')

