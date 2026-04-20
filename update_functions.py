import re

with open("functions/index.js", "r") as f:
    content = f.read()

# Replace userObj.hours with userObj.migratedHours, and ensure Number() wrapping in placement creation/update
# "migratedHours: userObj.hours || existingPlacementDoc.data().migratedHours || 0," -> "migratedHours: Number(userObj.migratedHours) || existingPlacementDoc.data().migratedHours || 0,"
# "migratedHours: userObj.hours || 0," -> "migratedHours: Number(userObj.migratedHours) || 0,"

content = content.replace("migratedHours: userObj.hours || existingPlacementDoc.data().migratedHours || 0,", "migratedHours: Number(userObj.migratedHours) || existingPlacementDoc.data().migratedHours || 0,")
content = content.replace("migratedHours: userObj.hours || 0,", "migratedHours: Number(userObj.migratedHours) || 0,")

with open("functions/index.js", "w") as f:
    f.write(content)

print("Updated functions/index.js")
