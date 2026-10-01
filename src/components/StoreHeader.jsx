'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Header de la tienda (patrón del design system: marca a la izquierda, navegación a la derecha).
export default function StoreHeader() {
  const pathname = usePathname();
  const enCatalogo = pathname?.startsWith('/catalogo');

  return (
    <header className="store-header">
      <div className="store-header-inner">
        <Link href="/catalogo" className="store-brand" aria-label="Mario A. Guerrisi - ir al catálogo">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-name">Mario A. Guerrisi</span>
            <span className="brand-sub">Instrumentos musicales</span>
          </span>
        </Link>

        <nav className="store-nav" aria-label="Principal">
          <Link href="/catalogo" className={`store-nav-link ${enCatalogo ? 'active' : ''}`} aria-current={enCatalogo ? 'page' : undefined}>
            Catálogo
          </Link>
        </nav>
      </div>
    </header>
  );
}
