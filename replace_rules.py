import re

with open('firestore.rules', 'r') as f:
    content = f.read()

replacement = """
      // SSOT Zero-Trust Lock: Prevent denormalization of identity fields into placements
      function hasNoDenormalizedFields() {
        return !request.resource.data.keys().hasAny(['studentName', 'studentEmail', 'major', 'studentMajor', 'name', 'firstName', 'lastName']);
      }

      // Allow creation
      allow create: if request.auth != null && hasNoDenormalizedFields();

      // Restrict update: do not allow the client to update the 'status' field directly.
      allow update: if request.auth != null && hasNoDenormalizedFields()
"""

content = re.sub(
    r'      // Allow creation\n      allow create: if request\.auth != null;\n\n      // Restrict update:[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n      allow update: if request\.auth != null\n                    && \(isAdmin\(\) \|\| !request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasAny\(\[\'status\'\]\)\);',
    replacement + '                    && (isAdmin() || !request.resource.data.diff(resource.data).affectedKeys().hasAny([\'status\']));',
    content
)

with open('firestore.rules', 'w') as f:
    f.write(content)
