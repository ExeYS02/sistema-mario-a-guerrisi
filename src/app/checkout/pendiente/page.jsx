import ExitoClient from '../exito/ExitoClient';

export const metadata = {
  title: 'Pago pendiente | Mario A. Guerrisi',
};

export default function PendientePage() {
  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <ExitoClient estado="pending" pagoId="" />
    </main>
  );
}