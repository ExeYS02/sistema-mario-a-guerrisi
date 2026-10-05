import Link from 'next/link';

export default function PendingPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1 style={{ color: 'orange', marginBottom: '1rem' }}>Pago Pendiente</h1>
      <p>Tu pago está en revisión. Te avisaremos cuando se acredite.</p>
      <Link href="/catalogo" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '2rem' }}>
        Volver al Catálogo
      </Link>
    </div>
  );
}
