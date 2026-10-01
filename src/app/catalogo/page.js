import { Suspense } from 'react';
import CatalogoClient from './CatalogoClient';

export const metadata = {
  title: 'Catálogo — Mario A. Guerrisi',
  description: 'Instrumentos musicales y accesorios. Buscá, filtrá y mirá la disponibilidad al instante.',
};

export default function CatalogoPage() {
  return (
    <Suspense fallback={null}>
      <CatalogoClient />
    </Suspense>
  );
}
