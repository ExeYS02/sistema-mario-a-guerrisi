'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function StoreHeader() {
  const ruta = usePathname();
  const { totalArticulos, total } = useCart();
  const { cliente, isHydrated, abrirLogin, cerrarSesion } = useAuth();

  return (
    <header className="store-header">
      <div className="store-header-inner">
        
        {/* LOGO AREA RESTAURADA */}
        <div className="logo-area">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
          </div>
          <div className="logo-text">
            <h1>
              <Link href="/">Mario A. Guerrisi</Link>
            </h1>
            <span className="logo-subtitle">INSTRUMENTOS MUSICALES</span>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="nav-links">
          <Link href="/" className={ruta === '/' ? 'active' : ''}>Inicio</Link>
          <Link href="/catalogo" className={ruta === '/catalogo' ? 'active' : ''}>Catálogo</Link>
          <Link href="/envios" className={ruta === '/envios' ? 'active' : ''}>Tus envíos</Link>
        </nav>

        {/* ACCIONES (AUTH + CARRITO) */}
        <div className="header-actions">
          <div className="auth-section">
            {!isHydrated ? (
               <span className="auth-loading">Cargando...</span>
            ) : cliente ? (
              <div className="auth-user-menu">
                <span className="auth-greeting">Hola, {cliente.razon_social.split(' ')[0]}</span>
                <button className="btn-link text-danger" style={{ fontSize: '0.85rem' }} onClick={cerrarSesion}>Salir</button>
              </div>
            ) : (
              <button className="btn-link" style={{ fontWeight: 600, color: '#ef4444' }} onClick={abrirLogin}>
                Ingresar
              </button>
            )}
          </div>

          <Link href="/carrito" className="cart-area" aria-label="Ver carrito">
            <div className="cart-text-group">
              <span className="cart-title">
                Carrito de compras ({totalArticulos})
              </span>
              <span className="cart-total">
                Total: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </Link>
        </div>

      </div>
    </header>
  );
}