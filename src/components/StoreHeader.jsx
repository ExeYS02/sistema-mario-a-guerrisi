'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';

// Header de la tienda (patrón del design system: marca a la izquierda, navegación a la derecha).
export default function StoreHeader() {
  const pathname = usePathname();
  const enCatalogo = pathname?.startsWith('/catalogo');
  const { totalArticulos, total } = useCart();

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

        <nav className="store-nav" aria-label="Principal" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            href="/carrito" 
            className={`store-nav-link ${pathname?.startsWith('/carrito') ? 'active' : ''}`} 
            aria-current={pathname?.startsWith('/carrito') ? 'page' : undefined} 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.2', padding: '0.5rem 1rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Carrito de compras
              {totalArticulos > 0 && <span>({totalArticulos})</span>}
            </div>
            {totalArticulos > 0 && (
              <span style={{ fontSize: '0.8em', color: 'inherit', opacity: 0.8 }}>
                Total: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </Link>
          
          <Link 
            href="/catalogo" 
            className={`store-nav-link ${enCatalogo ? 'active' : ''}`} 
            aria-current={enCatalogo ? 'page' : undefined}
          >
            Catálogo
          </Link>
          <Link 
            href="/envios" 
            className={`store-nav-link ${pathname?.startsWith('/envios') ? 'active' : ''}`} 
            aria-current={pathname?.startsWith('/envios') ? 'page' : undefined}
          >
            Tus envíos
          </Link>
        </nav>
      </div>
    </header>
  );
}



