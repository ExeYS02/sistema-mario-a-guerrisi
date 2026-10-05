'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';

export default function SuccessPage() {
  const { vaciarCarrito, setCliente } = useCart();

  useEffect(() => {
    vaciarCarrito();
    setCliente(null);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1 style={{ color: 'green', marginBottom: '1rem' }}>¡Pago Exitoso!</h1>
      <p>Tu compra ha sido procesada correctamente.</p>
      <Link href="/catalogo" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '2rem' }}>
        Volver al Catálogo
      </Link>
    </div>
  );
}
