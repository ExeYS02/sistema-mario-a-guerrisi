import Link from 'next/link';

export default function FailurePage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1 style={{ color: 'red', marginBottom: '1rem' }}>Pago Rechazado</h1>
      <p>Ocurrió un problema al procesar tu pago. Por favor intenta nuevamente.</p>
      <Link href="/carrito" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '2rem' }}>
        Volver al Carrito
      </Link>
    </div>
  );
}
