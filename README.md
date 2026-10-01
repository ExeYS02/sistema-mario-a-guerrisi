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
