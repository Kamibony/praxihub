import re

with open('tests/e2e/admin-payroll.spec.ts', 'r') as f:
    content = f.read()

# Seed students for SSOT since denormalized major is no longer used
student_seeds = """
    // Seed students for SSOT
    await db.collection('users').doc('student1').set({ role: 'STUDENT', major: 'UPV' });
    await db.collection('users').doc('student2').set({ role: 'STUDENT', major: 'KPV' });

    // Seed Placements and their time logs
"""
content = content.replace('    // Seed Placements and their time logs\n', student_seeds)

with open('tests/e2e/admin-payroll.spec.ts', 'w') as f:
    f.write(content)
