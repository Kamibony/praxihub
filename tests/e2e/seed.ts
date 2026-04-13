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
    role: 'admin',
    email: 'admin@praxihub.cz',
    createdAt: new Date().toISOString()
  });
}

export async function seedStudentUser() {
  await auth.createUser({ uid: 'student123', email: 'student@praxihub.cz' });
  await db.collection('users').doc('student123').set({
    role: 'student',
    email: 'student@praxihub.cz',
    createdAt: new Date().toISOString()
  });

  await db.collection('internships').doc('internship123').set({
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
    role: 'mentor',
    email: 'mentor@praxihub.cz',
    companyIco: '87654321',
    createdAt: new Date().toISOString()
  });

  await auth.createUser({ uid: 'student-log-123', email: 'student-log@praxihub.cz' });
  await db.collection('users').doc('student-log-123').set({
    role: 'student',
    email: 'student-log@praxihub.cz'
  });

  await db.collection('internships').doc('internship-log').set({
    studentId: 'student-log-123',
    mentorId: 'mentor123',
    status: 'APPROVED',
    organization_name: 'Mock Company s.r.o.',
    organization_email: 'mentor@praxihub.cz',
    organization_ico: '87654321',
    studentEmail: 'student-log@praxihub.cz',
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString()
  });
}
