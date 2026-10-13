'use client';

export default function LandingBeneficios() {
  const BENEFICIOS = [
    {
      id: 'retiro',
      titulo: 'Retiro en el local',
      subtitulo: 'Caseros 1056 o Galería Margalef',
      icono: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'envio',
      titulo: 'Envío a domicilio',
      subtitulo: 'Entregas en Salta Capital',
      icono: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      id: 'mercadopago',
      titulo: 'Pagá online con Mercado Pago',
      subtitulo: 'Checkout rápido y seguro',
      icono: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
    {
      id: 'stock',
      titulo: 'Stock actualizado al instante',
      subtitulo: 'Sincronizado con nuestro sistema',
      icono: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
        </svg>
      ),
    },
  ];

  return (
    <section className="landing-beneficios" aria-label="Beneficios de la tienda">
      <div className="landing-beneficios-grid">
        {BENEFICIOS.map((b) => (
          <div key={b.id} className="landing-beneficio-card">
            <div className="landing-beneficio-icon">{b.icono}</div>
            <div className="landing-beneficio-info">
              <h3 className="landing-beneficio-title">{b.titulo}</h3>
              <p className="landing-beneficio-sub">{b.subtitulo}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}