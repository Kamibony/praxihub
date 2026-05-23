import re

with open('tests/e2e/student-evaluation.spec.ts', 'r') as f:
    content = f.read()

# Since we delete the user entirely in the `seed`, creating it anew sometimes causes issues if we don't await properly, or it's racing.
# Better to use clearFirestore and clearAuth to ensure isolation.
content = content.replace("test.setTimeout(60000);\n\n    // Make sure we re-seed placement123 with EVALUATION state because maybe another test changed it", "test.setTimeout(60000);\n\n    const { clearFirestore, clearAuth } = require('./seed');\n    await clearFirestore();\n    await clearAuth();\n\n    // Make sure we re-seed placement123 with EVALUATION state because maybe another test changed it")
# Same for the second test
content = content.replace("test.setTimeout(60000);\n\n    // Make sure we re-seed placement123 with EVALUATION state because maybe another test changed it\n    const { db, auth } = require('./setup-firebase-admin');", "test.setTimeout(60000);\n\n    const { clearFirestore, clearAuth } = require('./seed');\n    await clearFirestore();\n    await clearAuth();\n\n    // Make sure we re-seed placement123 with EVALUATION state because maybe another test changed it\n    const { db, auth } = require('./setup-firebase-admin');")

with open('tests/e2e/student-evaluation.spec.ts', 'w') as f:
    f.write(content)
