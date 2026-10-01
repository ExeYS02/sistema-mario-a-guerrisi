'use client';

import { useEffect } from 'react';

// Registra el service worker (PWA). Solo en producción: en `next dev` el
// caché del SW molestaría al desarrollar.
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('No se pudo registrar el service worker', e));
  }, []);
  return null;
}
