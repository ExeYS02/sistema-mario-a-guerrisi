/* Service worker de la tienda (HU-32 - PWA).
   - Estáticos de Next e íconos: cache-first (cambian de nombre en cada build).
   - /api/catalogo*: network-first; si no hay red, se muestra lo último que se vio.
   - Navegación: network-first; sin red cae a la última copia o a /offline.
   - Cualquier otra API (carrito, pagos, pedidos) NO se cachea nunca. */
const VERSION = 'guerrisi-v1';
const ESTATICOS = `${VERSION}-estaticos`;
const DINAMICOS = `${VERSION}-dinamicos`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ESTATICOS).then((c) => c.addAll(['/offline', '/icons/icon-192.png'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(ESTATICOS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, { fallbackOffline = false } = {}) {
  const cache = await caches.open(DINAMICOS);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (fallbackOffline) {
      const off = await caches.match('/offline');
      if (off) return off;
    }
    return new Response(JSON.stringify({ error: 'Sin conexión.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith('/api/catalogo')) {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/api/')) {
    return; // el resto de la API siempre va directo a la red
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, { fallbackOffline: true }));
  }
});
