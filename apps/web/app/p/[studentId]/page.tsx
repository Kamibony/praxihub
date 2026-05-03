import ClientPage from './ClientPage';

export const dynamicParams = true;

export async function generateStaticParams() {
  return [{ studentId: 'fallback' }];
}

export default function Page() {
  return <ClientPage />;
}
