export default function manifest() {
  return {
    name: 'Mario A. Guerrisi - Instrumentos Musicales',
    short_name: 'Guerrisi Música',
    description: 'Tienda online de instrumentos musicales en Salta',
    start_url: '/',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#b91c1c',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}