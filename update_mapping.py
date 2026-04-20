import re

with open("apps/web/components/VisualMappingImport.tsx", "r") as f:
    content = f.read()

# Replace 'hours' with 'migratedHours' in the mapping state
content = content.replace("hours: -1,", "migratedHours: -1,")

# Replace in the auto-guessing
content = content.replace("newMapping.hours = i;", "newMapping.migratedHours = i;")

# Replace in generating the report
content = content.replace("if (mapping.hours !== -1) mappedRow.hours = Number(row[mapping.hours]) || 0;", "if (mapping.migratedHours !== -1) mappedRow.migratedHours = Number(row[mapping.migratedHours]) || 0;")

# Replace in the select dropdown
content = content.replace("select value={mapping.hours} onChange={(e) => handleMappingChange('hours', e.target.value)}", "select value={mapping.migratedHours} onChange={(e) => handleMappingChange('migratedHours', e.target.value)}")


with open("apps/web/components/VisualMappingImport.tsx", "w") as f:
    f.write(content)

print("Updated VisualMappingImport.tsx")
