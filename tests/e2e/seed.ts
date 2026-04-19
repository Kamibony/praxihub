
import { db, auth } from './setup-firebase-admin';

export async function clearFirestore() {
  const res = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/demo-project/databases/(default)/documents`, {
    method: 'DELETE'
  });
  if (!res.ok) console.error("Failed to clear Firestore");
}

export async function clearAuth() {
  const res = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/demo-project/accounts`, {
    method: 'DELETE'
  });
  if (!res.ok) console.error("Failed to clear Auth");
}

export async function seedAdminUser() {
  await auth.createUser({ uid: 'admin123', email: 'admin@praxihub.cz' });
  await db.collection('users').doc('admin123').set({
    role: 'coordinator',
    researchConsent: true,
    email: 'admin@praxihub.cz',
    createdAt: new Date().toISOString()
  });
}

export async function seedStudentUser() {
  await auth.createUser({ uid: 'student123', email: 'student@praxihub.cz' });
  await db.collection('users').doc('student123').set({
    role: 'student',
    researchConsent: true,
    email: 'student@praxihub.cz',
    active_placement_id: 'placement123',
    createdAt: new Date().toISOString()
  });

  await db.collection('placements').doc('placement123').set({
    studentId: 'student123',
    status: 'EVALUATION',
    organization_name: 'Mock Company s.r.o.',
    createdAt: new Date().toISOString(),
    start_date: '2023-01-01',
    end_date: '2023-01-31',
    organization_ico: '12345678'
  });
}

export async function seedMentorAndLog() {
  await auth.createUser({ uid: 'mentor123', email: 'mentor@praxihub.cz' });
  await db.collection('users').doc('mentor123').set({
    role: 'institution',
    researchConsent: true,
    email: 'mentor@praxihub.cz',
    companyIco: '87654321',
    createdAt: new Date().toISOString()
  });

  await auth.createUser({ uid: 'student-log-123', email: 'student-log@praxihub.cz' });
  await db.collection('users').doc('student-log-123').set({
    role: 'student',
    researchConsent: true,
    email: 'student-log@praxihub.cz',
    active_placement_id: 'placement-log' // Relational mapping for frontend UI fallback if needed
  });

  // Ensure the date is in the future or present to be picked up properly if orderBy plays tricks
  const createdAtLog = new Date();
  createdAtLog.setHours(createdAtLog.getHours() + 1);

  await db.collection('placements').doc('placement-log').set({
    studentId: 'student-log-123',
    mentorId: 'mentor123',
    status: 'APPROVED',
    organization_name: 'Mock Company s.r.o.',
    organization_email: 'mentor@praxihub.cz',
    organization_ico: '87654321',
    studentEmail: 'student-log@praxihub.cz',
    createdAt: createdAtLog.toISOString(),
    approvedAt: createdAtLog.toISOString()
  });
}

export async function seedClosedPlacementForCommission() {
  const oldDate = new Date();
  oldDate.setFullYear(oldDate.getFullYear() - 1);

  await db.collection('placements').doc('placement-closed').set({
    studentId: 'student123', // Same student, so make sure createdAt is OLDER than placement123
    mentorId: 'mentor123',
    status: 'CLOSED',
    organization_name: 'Commission Co',
    studentName: 'Test Student',
    studentEmail: 'student@praxihub.cz',
    major: 'KPV',
    yearOfStudy: '3',
    semester: 'Letní',
    createdAt: oldDate.toISOString()
  });
}
