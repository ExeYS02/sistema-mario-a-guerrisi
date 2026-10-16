import Link from 'next/link';

export const metadata = {
  title: 'Pago no completado | Mario A. Guerrisi',
};

export default function ErrorPage() {
  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h1>No pudimos completar el pago</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2rem' }}>
          No se realizó ningún cobro. Tu carrito sigue como lo dejaste, podés intentarlo de nuevo.
        </p>
        <Link href="/carrito" className="btn btn-primary">Volver al carrito</Link>
      </div>
    </main>
  );
}