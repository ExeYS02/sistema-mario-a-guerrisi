import Link from 'next/link';

export const metadata = { title: 'Sin conexión — Mario A. Guerrisi' };

export default function Offline() {
  return (
    <div className="store-container">
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 1l22 22M16.7 11.1A10.9 10.9 0 0 1 19 12.6M5 12.6a10.9 10.9 0 0 1 5.2-2.5M8.5 16.1a6 6 0 0 1 7 0M12 20h.01M10.7 5.1A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.7-2.9" />
        </svg>
        <h1>Sin conexión</h1>
        <p>No pudimos conectarnos. Revisá tu internet y volvé a intentar.</p>
        <Link href="/catalogo" className="btn btn-primary">Reintentar</Link>
      </div>
    </div>
  );
}
