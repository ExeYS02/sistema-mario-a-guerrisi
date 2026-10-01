# Sistema para la tienda de música Mario A. Guerrisi

Una sola aplicación **Next.js** (App Router, JavaScript) + Supabase. Sin Vite y sin servidor Express aparte.

## Estructura
| Ruta | Equivale en el ERP a |
|---|---|
| `src/app/` (páginas) | `erp-front/src/pages` + `App.jsx` (el router es el sistema de carpetas) |
| `src/app/api/<modulo>/route.js` | `erp-backend/routes` + `controllers` |
| `src/server/services/` | `erp-backend/services` (lógica de negocio, solo servidor) |
| `src/services/` | `erp-front/src/services` (llaman a `/api/...`) |
| `src/lib/supabaseClient.js` / `supabaseAdmin.js` (`getSupabaseAdmin()`) | `supabaseClient.js` (anon) / `erp-backend/config/supabase.js` (service key) |
| `src/components`, `src/utils`, `src/hooks` | igual que en `erp-front` |
| `docs/database/` | scripts SQL y esquema |

## Instalación
Requisitos: Node.js 20.9+ y npm.

```bash
npm install
npm run dev                  # http://localhost:3000  (API: http://localhost:3000/api/health)
```
Otros: `npm run build`, `npm run start`, `npm run lint`.

## Base de datos
En un proyecto de Supabase nuevo, ejecutar en el SQL Editor y en este orden:
`ddl_bdd_sprint1.sql` → `trigger_sprint1.sql` → `ddl_hu11_proveedores.sql` →
`migracion_proveedores_campos_adicionales.sql` → `migracion_pos_sprint3.sql` → `rpc_stock_venta.sql`.
`schema_actual.sql` es solo referencia.

## Seguridad
`.env.local` no se sube a git. `SUPABASE_SERVICE_KEY` solo se usa en `src/lib/supabaseAdmin.js` (marcado `server-only`).

## HU-32 — Catálogo web responsivo (PWA)

- **Pantalla:** `/catalogo` (la raíz `/` redirige ahí). Búsqueda con debounce, filtros por categoría/marca/origen, orden, vista grilla/lista y paginación. Los filtros viven en la URL (se pueden compartir). En móvil los selectores pasan a un modal "Filtros".
- **API:** `GET /api/catalogo` y `GET /api/catalogo/filtros` → `src/server/services/catalogoService.js`. Devuelve solo artículos activos y la **disponibilidad** (`en_stock` / `ultimas` / `sin_stock`) calculada como `cantidad − cantidad_reservada` por depósito activo; nunca el stock físico exacto.
- **Sincronización con el ERP:** el catálogo se lee siempre de la base central (sin caché) y el cliente lo vuelve a pedir cada 30 s mientras la pestaña está visible, al volver a la pestaña y al recuperar conexión.
- **PWA:** `src/app/manifest.js`, íconos en `public/icons/` y service worker `public/sw.js` (se registra solo en producción). Para probarlo: `npm run build && npm run start`, abrir `http://localhost:3000` en Chrome y usar "Instalar app".
- **Base de datos:** ejecutar una vez `docs/database/migracion_catalogo_sprint4.sql` en el SQL Editor de Supabase (índices para que la búsqueda responda rápido).
- **Nota:** las variables `NEXT_PUBLIC_*` se incorporan en el build; si cambiás `.env.local`, volvé a correr `npm run build`.
