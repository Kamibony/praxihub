with open('apps/web/components/VisualMappingImport.tsx', 'r') as f:
    content = f.read()

content = content.replace('{!importing && ✅}', '{!importing && "✅"}')
content = content.replace('{!importing && ➡️}', '{!importing && "➡️"}') # Just in case

with open('apps/web/components/VisualMappingImport.tsx', 'w') as f:
    f.write(content)
