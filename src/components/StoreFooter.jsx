'use client';

import { TIENDA_CONFIG } from '@/config/tienda';

export default function StoreFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-container">
        <div className="site-footer-contact">
          <h2 className="site-footer-brand">{TIENDA_CONFIG.razonSocial}</h2>

          <div className="site-footer-info-grid">
            <div className="site-footer-item">
              <span className="site-footer-label">Teléfono / WhatsApp</span>
              <div className="site-footer-links-group">
                <a href={TIENDA_CONFIG.telefonoHref} className="site-footer-link">
                  {TIENDA_CONFIG.telefono}
                </a>
                <span className="site-footer-sep">|</span>
                <a
                  href={TIENDA_CONFIG.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-footer-link site-footer-wa"
                >
                  WhatsApp
                </a>
              </div>
            </div>

            <div className="site-footer-item">
              <span className="site-footer-label">Correo electrónico</span>
              <a href={TIENDA_CONFIG.emailHref} className="site-footer-link">
                {TIENDA_CONFIG.email}
              </a>
            </div>

            <div className="site-footer-item site-footer-item-wide">
              <span className="site-footer-label">Ubicaciones en Salta</span>
              <div className="site-footer-locations">
                {TIENDA_CONFIG.ubicaciones.map((u) => (
                  <a
                    key={u.id}
                    href={u.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-footer-map-link"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="site-footer-pin-icon">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {u.direccion}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="site-footer-bottom">
          <p>© {year} {TIENDA_CONFIG.nombre}. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}