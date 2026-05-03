import ClientPage from './ClientPage';

export const dynamicParams = true;

export async function generateStaticParams() {
  return [
    { studentId: 'fallback' },
    { studentId: 'student123' },
    { studentId: 'unknown-student-123' }
  ];
}

export default function Page() {
  return <ClientPage />;
}
