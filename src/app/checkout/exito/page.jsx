import ExitoClient from './ExitoClient';

export const metadata = {
  title: 'Compra realizada | Mario A. Guerrisi',
};

export default async function ExitoPage({ searchParams }) {
  const params = await searchParams;
  const estado = String(params?.status || params?.collection_status || '').toLowerCase();
  const pagoId = String(params?.payment_id || params?.collection_id || '');

  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <ExitoClient estado={estado} pagoId={pagoId} />
    </main>
  );
}