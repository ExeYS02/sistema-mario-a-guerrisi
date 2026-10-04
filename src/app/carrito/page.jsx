import { Suspense } from 'react';
import CarritoClient from './CarritoClient';

export const metadata = {
  title: 'Carrito de compras — Mario A. Guerrisi',
  description: 'Gestiona los artículos seleccionados y continúa con tu compra.',
};

export default function CarritoPage() {
  return (
    <Suspense fallback={null}>
      <CarritoClient />
    </Suspense>
  );
}
