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
`migracion_proveedores_campos_adicionales.sql` → `migracion_pos_sprint3.sql` → `rpc_stock_venta.sql` →
`migracion_catalogo_sprint4.sql` → `migracion_hu34_reserva_web.sql`.
`schema_actual.sql` es solo referencia. Para verificar HU-34 en la base: `test_hu34_reserva_web.sql` (corre en una transacción y hace ROLLBACK).

## Seguridad
`.env.local` no se sube a git. `SUPABASE_SERVICE_KEY` solo se usa en `src/lib/supabaseAdmin.js` (marcado `server-only`).

## HU-32 — Catálogo web responsivo (PWA)

- **Pantalla:** `/catalogo` (la raíz `/` redirige ahí). Búsqueda con debounce, filtros por categoría/marca/origen, orden, vista grilla/lista y paginación. Los filtros viven en la URL (se pueden compartir). En móvil los selectores pasan a un modal "Filtros".
- **API:** `GET /api/catalogo` y `GET /api/catalogo/filtros` → `src/server/services/catalogoService.js`. Devuelve solo artículos activos y la **disponibilidad** (`en_stock` / `ultimas` / `sin_stock`) calculada como `cantidad − cantidad_reservada` por depósito activo; nunca el stock físico exacto.
- **Sincronización con el ERP:** el catálogo se lee siempre de la base central (sin caché) y el cliente lo vuelve a pedir cada 30 s mientras la pestaña está visible, al volver a la pestaña y al recuperar conexión.
- **PWA:** `src/app/manifest.js`, íconos en `public/icons/` y service worker `public/sw.js` (se registra solo en producción). Para probarlo: `npm run build && npm run start`, abrir `http://localhost:3000` en Chrome y usar "Instalar app".
- **Base de datos:** ejecutar una vez `docs/database/migracion_catalogo_sprint4.sql` en el SQL Editor de Supabase (índices para que la búsqueda responda rápido).
- **Nota:** las variables `NEXT_PUBLIC_*` se incorporan en el build; si cambiás `.env.local`, volvé a correr `npm run build`.

## HU-34 — Validación de stock y reserva temporal (checkout web)

- **Flujo:** carrito → "Continuar con el pago" → `POST /api/checkout`. El servidor llama a la función SQL `crear_venta_web`, que en **una sola transacción** bloquea las filas de `existencias`, valida `cantidad − cantidad_reservada`, **reserva** el stock, y crea `ventas` (Pendiente, vence en 10 min) + `ventas_detalle` + `envios`. Solo si la reserva salió bien se genera el link de Mercado Pago (que vence junto con la reserva).
- **Sin stock:** responde `409` con el detalle por artículo (`solicitado` / `disponible`). El carrito muestra el motivo y permite "Ajustar al stock disponible". No se genera link de pago.
- **Precios:** nunca se toman del navegador. Precio, subtotal y costo de envío se recalculan en la base (`articulos.precio_actual`, fórmula en `src/utils/envio.js`). Si el total que vio el cliente ya no coincide, responde `409 PRECIOS_ACTUALIZADOS` con el total vigente.
- **Una reserva por cliente:** un nuevo checkout reemplaza la reserva Pendiente anterior del mismo cliente (así no se bloquea a sí mismo si volvió atrás desde Mercado Pago).
- **Liberación:** pago rechazado → webhook → `cancelar_venta_web`; vencimiento → job `liberar_ventas_pendientes_vencidas` (pg_cron cada 5 min) y además se ejecuta al crear cada checkout, por lo que la reserva dura 10 min reales.
- **Confirmación (HU-35):** webhook de Mercado Pago → `confirmar_venta_web` (idempotente): descuenta stock real, libera la reserva, asigna `numero_comprobante` (`VTA-00001`…), pasa a Confirmada y registra el pago. Si el pago se aprueba **después** de vencida la reserva, intenta reservar de nuevo; si ya no hay stock, deja la venta marcada `…reembolsar` y lo registra en el log del servidor (el reembolso es manual).
- **Variables de entorno necesarias:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_BASE_URL` (URL pública, p. ej. de ngrok, para `back_urls` y `notification_url`).

## Modificación de datos del cliente

Una vez identificado el cliente (DNI + código), la tarjeta "Información del Cliente" tiene **Modificar mis datos** (también aparece "Agregar dirección" en Opciones de Entrega cuando no hay dirección, y es obligatoria para envío a domicilio). Llama a `PUT /api/clientes`: solo actualiza nombre, email, teléfono y dirección (el DNI, CUIT, estado e id nunca se toman del cuerpo). Las reglas de validación están en `src/utils/validacionCliente.js` y se usan igual en el formulario y en el servidor.
