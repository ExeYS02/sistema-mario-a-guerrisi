'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

const ESTADOS_COMPRA_GENERADA = ['approved', 'pending', 'in_process'];

export default function ExitoClient({ estado, pagoId }) {
  const { vaciarCarrito } = useCart();
  const compraGenerada = ESTADOS_COMPRA_GENERADA.includes(estado);
  const aprobado = estado === 'approved';

  useEffect(() => {
    if (compraGenerada) vaciarCarrito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compraGenerada]);

  if (!compraGenerada) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h1>No encontramos información del pago</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2rem' }}>
          Si realizaste una compra, revisá el estado en "Tus envíos".
        </p>
        <Link href="/envios" className="btn btn-primary">Ver mis envíos</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>{aprobado ? '¡Gracias por tu compra!' : 'Estamos procesando tu pago'}</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 0.5rem' }}>
        {aprobado
          ? 'Tu pago fue aprobado. En unos instantes vas a ver tu pedido en "Tus envíos".'
          : 'Tu pago está pendiente de acreditación. Cuando se confirme, vas a ver tu pedido en "Tus envíos".'}
      </p>
      {pagoId && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          N.º de pago: <strong>{pagoId}</strong>
        </p>
      )}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/envios" className="btn btn-primary">Ver mis envíos</Link>
        <Link href="/catalogo" className="btn">Seguir comprando</Link>
      </div>
    </div>
  );
}