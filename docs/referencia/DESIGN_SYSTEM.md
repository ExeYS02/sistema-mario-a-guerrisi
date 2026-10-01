# Sistema de Diseño — ERP Guerrisi

> Documento de referencia visual para todo el equipo (frontend **y** backend)
> de cara al próximo sprint. El objetivo es que cualquiera que arme o toque
> una pantalla —cree un endpoint nuevo, arme un mock, o construya una vista—
> use los mismos colores, componentes y estructura que el resto del sistema,
> sin tener que adivinarlos mirando pantalla por pantalla.
>
> Todo lo que describe este documento **ya existe y está en uso** en
> `erp-front/src/index.css` y en las páginas de `erp-front/src/pages/`. No es
> una propuesta a futuro: es lo que ya construimos, puesto en un solo lugar.
> Cuando se agregue un componente nuevo reutilizable, este documento debería
> actualizarse en el mismo PR.

---

## 1. Principios

1. **Una sola fuente de verdad visual**: todos los colores, radios y
   tipografías salen de las variables definidas en `:root` en
   `erp-front/src/index.css`. Nunca se escribe un color a mano (`#E33141`,
   `rgb(...)`) directamente en un componente — se usa `var(--red)`, etc.
2. **Componer, no reinventar**: antes de escribir una clase CSS nueva, revisar
   si ya existe algo parecido en este documento (una tabla, una tarjeta de
   KPI, un badge de estado). El 90% de las pantallas del sistema se arman
   combinando siempre los mismos 10-12 bloques.
3. **El topbar ya dice en qué pantalla estás**: ninguna página repite el
   nombre de la pestaña como título propio (ver sección 8). Si hace falta un
   botón de acción arriba de todo, se lo acomoda dentro de la fila de tabs o
   de filtros — nunca solo, en una fila vacía.
4. **Los mocks se ven idénticos a lo real**: una pantalla conectada a
   Supabase y una que todavía usa un `service` mock en memoria tienen que
   ser visualmente indistinguibles. Loading, vacío y error se resuelven
   siempre con el mismo patrón (sección 9).

---

## 2. Fundamentos visuales (design tokens)

Todo vive en `erp-front/src/index.css`, dentro de `:root`. No dupliques estos
valores: importá la variable.

### 2.1 Color

| Variable | Valor | Uso |
|---|---|---|
| `--red` | `#E33141` | Color de marca. Acción primaria, activo/seleccionado, foco. |
| `--red-dark` | `#C21F2E` | Hover de botones primarios. |
| `--red-soft` | `#FDEAEC` | Fondos suaves relacionados a `--red` (avatares, notificaciones no leídas). |
| `--black` | `#111111` | Texto de alto énfasis, sidebar. |
| `--ink` | `#1C1C1E` | Texto de cuerpo por defecto. |
| `--gray-900` a `--gray-50` | escala de grises | Jerarquía de texto secundario, bordes, fondos de tabla/hover. |
| `--white` | `#FFFFFF` | Fondos de tarjetas, tablas, modales. |
| `--green` / `--green-soft` | `#1E9E5A` / `#E7F7EE` | Estado positivo: activo, pagado, recibido, normal. |
| `--amber` / `--amber-soft` | `#C97A0E` / `#FDF1DF` | Estado de alerta media: reposición, por agotarse, pendiente. |
| `--crit` / `--crit-soft` | `#D22E3C` / `#FCE7E8` | Estado crítico: sin stock, mora, cancelado, bloqueado. |
| `--blue` / `--blue-soft` | `#2B6CD4` / `#EAF1FD` | Estado informativo/neutro: en curso, parcial, ajuste positivo. |
| `--purple` / `--purple-soft` | `#7B4FCB` / `#F1EBFB` | Categoría adicional (hoy: transferencias de stock). |

**Regla de semántica de color** (aplica a badges, textos de KPI, bordes de
tarjeta): verde = resuelto/positivo, ámbar = atención/en curso, rojo =
crítico/bloqueante, azul = informativo/neutro. No se usan estos colores para
otra cosa (por ejemplo, no usar rojo para un botón secundario).

### 2.2 Radios, sombras y tipografía

```css
--radius-sm: 6px;   /* chips pequeños, botones de ícono */
--radius-md: 10px;  /* inputs, banners */
--radius-lg: 14px;  /* tarjetas, paneles, tablas, modal */

--shadow-sm: 0 1px 2px rgba(17, 17, 17, 0.06);   /* tarjetas y paneles en reposo */
--shadow-md: 0 10px 32px rgba(17, 17, 17, 0.14); /* dropdowns, elementos flotantes */

--font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
```

Escala tipográfica en uso (no hay una escala formal declarada, pero **estos
son los tamaños reales que aparecen en el código** — usar estos, no valores
intermedios):

| Tamaño | Uso |
|---|---|
| 10–11px | Labels en mayúscula (headers de tabla, `.detail-info-item .label`), badges |
| 11.5–12.5px | Texto secundario, descripciones, `.cell-sub` |
| 13–13.5px | Texto de cuerpo estándar (celdas de tabla, inputs, botones) |
| 14–16px | Títulos de tarjeta/panel (`.panel-header h3`, `.modal-header h3`) |
| 18–19px | Título de página en el topbar (`.topbar-title`) |
| 21–26px | Cifras grandes (`.stat-value`, `.detail-title`, `.detail-price`) |

### 2.3 Iconografía

Todos los íconos son **SVG inline escritos a mano**, estilo
[Feather Icons](https://feathericons.com/): `viewBox="0 0 24 24"`, `fill="none"`,
`strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`. No hay
una librería de íconos instalada (no usar `lucide-react` ni similares acá:
mantené la consistencia con el estilo a mano).

```jsx
<svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M12 5v14M5 12h14" />
</svg>
```

El color del ícono se hereda con `stroke: currentColor` o se fija con
`stroke: var(--gray-700)` / `var(--red)` según el contenedor (ver `.btn-primary svg`,
`.icon-btn svg`, `.stat-icon.tint-* svg`).

---

## 3. Layout global

La app tiene tres piezas fijas que **nunca se repiten dentro de una página**:

- **`.sidebar`** (`App.jsx`): navegación fija a la izquierda, agrupada por
  `.nav-group` con su `.nav-group-label` (ej. "Compras", "Tesorería").
- **`.topbar`**: título (`.topbar-title`) + subtítulo (`.topbar-subtitle`) de
  la pestaña actual, tomados de `ROUTE_INFO` en `App.jsx`; más notificaciones
  y menú de usuario a la derecha.
- **`.content`**: contenedor de cada página, con padding fijo
  (`26px 28px 60px 28px`). Todo lo que arma cada `page.jsx` va acá adentro.

**Cada página nueva arranca así**, sin nada más arriba:

```jsx
function MiPagina() {
  return (
    <div>
      {/* 1. Banner de confirmación (si aplica) */}
      {/* 2. Fila de tabs / filtros / acción (ver sección 8) */}
      {/* 3. KPIs (si aplica) */}
      {/* 4. Contenido principal: tabla, tarjetas, formulario */}
      {/* 5. Modales (siempre al final del archivo) */}
    </div>
  );
}
```

---

## 4. Botones

```jsx
<button className="btn btn-primary">Acción principal</button>
<button className="btn btn-outline">Acción secundaria</button>
<button className="btn btn-outline btn-sm">Acción chica</button>
<button className="icon-btn"><svg>...</svg></button>
```

| Clase | Cuándo usarla |
|---|---|
| `.btn-primary` | Una sola por bloque: la acción principal de la pantalla (crear, guardar, confirmar). Fondo `--red`. |
| `.btn-outline` | Acciones secundarias (cancelar, exportar, ver detalle). |
| `.btn-sm` | Botones dentro de filas de tabla o espacios chicos. |
| `.icon-btn` | Botón cuadrado solo-ícono (36×38px). Dentro de `.row-actions` se reduce a 30px automáticamente. |
| `.btn-outline` con `color: var(--red)` / `borderColor: var(--red)` inline | Única excepción manual: acciones destructivas secundarias (cancelar cotización, cancelar orden). No existe todavía una clase `.btn-danger` — si hace falta más de una vez más, vale la pena crearla en vez de seguir repitiendo el estilo inline. |

Un botón siempre lleva ícono + texto cuando es una acción de alta ("+ Nuevo
proveedor", "+ Registrar movimiento"); las acciones de navegación ("Ver
ficha", "Ver detalle") van sin ícono.

---

## 5. Badges de estado

```jsx
<span className="badge badge-green">
  <span className="badge-dot"></span>
  Activo
</span>
```

Variantes: `badge-green`, `badge-amber`, `badge-red`, `badge-blue`,
`badge-gray`. Siempre con `<span className="badge-dot">` adentro — es lo que
dibuja el puntito de color y (en rojo) la animación de pulso para estados
críticos.

Mapeo ya usado en el sistema (mantenerlo al agregar un estado nuevo):

| Estado | Badge |
|---|---|
| Activo / Normal / Pagada / Recibida / Aprobada / Respondida | `badge-green` |
| Reposición / Pendiente / Por agotarse | `badge-amber` |
| Crítico / Mora / Cancelada / Bloqueado | `badge-red` |
| Enviada / Parcial / En curso | `badge-blue` |
| Inactivo / sin dato | `badge-gray` |

Para tipos de movimiento de stock existe una variante propia, **no** uses
`badge` para esto: `.type-pill` con `.type-entrada`, `.type-salida`,
`.type-ajuste-pos`, `.type-ajuste-neg`, `.type-transferencia`.

---

## 6. Filtros y barras de herramientas

Hay dos contenedores casi idénticos, elegí uno y sé consistente dentro de la
misma página:

- **`.catalog-toolbar`**: para páginas con listados que se filtran (selects +
  buscador). Es el más usado en las pantallas nuevas (Cotizaciones, Cuentas
  por Pagar, Notas de Crédito/Débito, Límites de Crédito).
- **`.filter-bar`**: variante usada históricamente en Inventario y
  Movimientos. Visualmente igual a `.catalog-toolbar` (mismo padding/borde),
  se mantiene por compatibilidad — para pantallas nuevas preferí
  `.catalog-toolbar`.

```jsx
<div className="catalog-toolbar">
  <div className="search-input">
    <svg>...(lupa)...</svg>
    <input type="text" placeholder="Buscar..." />
  </div>

  <div className="select-field">
    Estado:
    <select>
      <option value="todos">Todos</option>
    </select>
  </div>

  {/* Si la pantalla tiene una acción de alta, va acá, empujada a la derecha: */}
  <button className="btn btn-primary" style={{ marginLeft: 'auto' }}>
    + Nueva acción
  </button>
</div>
```

`.select-field` es el contenedor con borde para un `<select>` o un
`<input type="date">` suelto (le sacás el borde propio del input con
`style={{ border: 'none', outline: 'none', background: 'transparent' }}` para
que se vea integrado). `.search-input` es específicamente para buscador de
texto con lupa.

---

## 7. Tablas

Estructura estándar para **cualquier** listado del sistema:

```jsx
<div className="table-panel">
  <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={N} style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>Cargando…</td></tr>
        ) : items.length === 0 ? (
          <tr><td colSpan={N} style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>No se encontraron registros.</td></tr>
        ) : (
          items.map((item) => (
            <tr key={item.id}>
              <td className="cell-strong">{item.nombre}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</div>
```

- `.cell-strong`: dato principal de la fila (nombre, razón social).
- `.cell-sub`: línea secundaria chica debajo del dato principal (ej. "Alta:
  09/09/2026"), suele ir en fuente monoespaciada si es una fecha/código.
- `.cell-mono`: valores tipo código (N° de orden, CUIT, SKU) en fuente
  monoespaciada.
- `.row-actions`: contenedor flex para agrupar botones de acción al final de
  la fila (`btn-sm` + `icon-btn`).
- Una fila puede tintarse con `style={{ background: 'var(--crit-soft)' }}`
  cuando necesita alerta visual inmediata (ej. cuentas en mora) — es el único
  caso donde se pisa el hover de fila con un color de fondo fijo.

---

## 8. Encabezado de página: **no repetir el título de la pestaña**

Esto es una regla fija a partir de este sprint. El topbar ya muestra el
título y subtítulo de la pantalla (`ROUTE_INFO` en `App.jsx`), así que
ninguna página vuelve a poner un `<h2>` con el mismo nombre.

**Antes** (patrón viejo, no reproducir en pantallas nuevas):

```jsx
<div className="section-heading">
  <div>
    <h2>Cuentas por Pagar</h2>
    <span className="desc">Obligaciones con proveedores...</span>
  </div>
  <button className="btn btn-primary">Nueva acción</button>
</div>
```

**Ahora**: si la página tiene un botón de acción arriba de todo, se lo integra
a la primera fila de control que exista (tabs, filtros o pestañas de
depósito) en vez de crear una fila propia solo para el título:

```jsx
// Con fila de filtros (Notas de Crédito/Débito, Cotizaciones):
<div className="catalog-toolbar">
  <div className="select-field">Tipo: <select>...</select></div>
  <button className="btn btn-primary" style={{ marginLeft: 'auto' }}>+ Nueva nota</button>
</div>

// Con pestañas de selección (Inventario):
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
  <div className="warehouse-tabs" style={{ marginBottom: 0 }}>
    {/* tabs de depósito */}
  </div>
  <button className="btn btn-primary">Transferir stock</button>
</div>
```

Si la página **no tiene ningún botón ni fila de control propia** (ej. Límites
de Crédito antes de sus KPIs), directamente no se agrega ningún contenedor:
el padding de `.content` ya deja el espacio correcto antes del primer bloque
de contenido.

> ⚠️ **Pendiente detectado**: `Alertas_de_stock.jsx` y `Depositos.jsx`
> todavía tienen el patrón viejo (`section-heading` con `h2` duplicando el
> nombre de la pestaña) y no se tocaron en la limpieza de este sprint. Si se
> vuelve a entrar a esas pantallas, aplicar el mismo criterio de esta
> sección. `Alertas_de_stock.jsx` fue una exclusión explícita del equipo
> (se decidió dejarla como estaba); `Depositos.jsx` quedó pendiente de
> revisión.

---

## 9. Estados de carga, vacío y error

Mismo criterio en toda la app, no inventar variantes nuevas:

- **Cargando**: fila o bloque centrado, texto gris (`color: 'var(--gray-500)'`)
  con "Cargando [lo que sea]…".
- **Vacío**: mismo estilo, mensaje explicando qué filtro está devolviendo
  cero resultados ("No se encontraron proveedores para los filtros
  seleccionados.").
- **Confirmación de acción exitosa**: `.confirm-banner` (verde), aparece
  arriba de todo en la página y se autodescarta con un `setTimeout` (4–5s).
  Nunca usar `alert()` del navegador para confirmar algo que salió bien.
- **Error de validación o de servidor**: sí se usa `alert(error.message)`
  como salida rápida para errores inesperados de un submit. Es una decisión
  consciente de simplicidad para este proyecto — no reemplazarlo por un
  sistema de toasts de error sin discutirlo primero en el equipo.
- **Aviso informativo dentro de un formulario** (ej. "toda nota debe
  vincularse a un comprobante"): `.modal-notice` (fondo ámbar).

```jsx
{toast && (
  <div className="confirm-banner">
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
    <span>{toast}</span>
  </div>
)}
```

---

## 10. Tarjetas de KPI

```jsx
<div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
  <div className="stat-card">
    <div className="stat-value">{total}</div>
    <div className="stat-label">Descripción corta</div>
  </div>
</div>
```

Ajustá `gridTemplateColumns` a la cantidad real de tarjetas (`repeat(3, 1fr)`,
`repeat(4, 1fr)`). Si una tarjeta necesita ícono con color semántico, agregar
`.stat-card-top` + `.stat-icon.tint-{red|black|amber|green}` (ver
`Cuentas_por_pagar.jsx` para el ejemplo completo con ícono).

---

## 11. Pestañas (tabs)

Dos variantes, no intercambiables:

- **`.tab-rail` / `.tab-btn`**: para alternar entre **vistas o flujos
  distintos** dentro de una misma pantalla (ej. "Cotizaciones" vs "Órdenes de
  Compra"). Soporta un contador con `.tab-btn-badge`.
- **`.warehouse-tabs` / `.warehouse-tab`**: para alternar el **mismo
  contenido filtrado por una dimensión** (ej. depósito). Look de botón/chip,
  no de pestaña subrayada.

```jsx
<div className="tab-rail">
  <button className={`tab-btn ${activeTab === 'a' ? 'active' : ''}`}>
    Vista A
    {contador > 0 && <span className="tab-btn-badge">{contador} en curso</span>}
  </button>
</div>
```

---

## 12. Modal

Componente único: `erp-front/src/components/Modal.jsx`. No se arma un modal
a mano con `position: fixed` en una página — siempre se usa este componente.

```jsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Título de la acción"
  wide   // opcional: 660px. Usar cuando el formulario tiene 2 columnas.
  xwide  // opcional: 920px. Usar cuando hay una tabla adentro (detalle de OC, cotización).
  footer={
    <>
      <button className="btn btn-outline" onClick={() => setIsOpen(false)}>Cancelar</button>
      <button className="btn btn-primary" onClick={handleSubmit}>Guardar</button>
    </>
  }
>
  {/* contenido: normalmente un <form> con .form-row / .form-field */}
</Modal>
```

Dentro del modal, formularios siempre con:

```jsx
<div className="form-row">           {/* grid de 2 columnas, 14px de gap */}
  <div className="form-field">        {/* 1 columna */}
    <label>Campo<span className="req">*</span></label>
    <input type="text" />
  </div>
  <div className="form-field full">   {/* ocupa las 2 columnas */}
    <label>Campo ancho</label>
    <textarea />
  </div>
</div>
```

El botón primario del footer siempre queda **deshabilitado** hasta que el
formulario sea válido (`disabled={!isFormValid}`), nunca se valida recién al
hacer submit.

---

## 13. Ficha / vista de detalle

Para mostrar datos de un registro puntual (ficha de proveedor, detalle de
orden de compra, detalle de producto), usar `.detail-info-grid`:

```jsx
<div className="detail-info-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
  <div className="detail-info-item">
    <div className="label">Proveedor</div>
    <div className="value">{nombre}</div>
  </div>
</div>
```

Para una barra de progreso/uso (ej. % de utilización de crédito, comparación
de stock entre depósitos): `.bar-track` + `.bar-fill` (o `.compare-bar-track`
/ `.compare-bar-fill` en la vista de detalle de producto — visualmente
equivalentes, mismo patrón, nombres distintos por historia del proyecto).

---

## 14. Patrones de datos (frontend ↔ backend)

Esto es lo que más le importa a quien trabaje del lado del backend este
sprint:

- **Nombres de campo**: la base de datos y el backend usan `snake_case`
  (`razon_social`, `condicion_pago`). El frontend siempre trabaja en
  `camelCase` (`razonSocial`, `condicionPago`) puertas adentro de cada
  `service.js`. La conversión se hace en **una sola capa**: las funciones
  `mapFromApi()` / `mapToApi()` al principio de cada archivo de servicio
  (ver `erp-front/src/services/supplierService.js` como referencia). Los
  componentes de página **nunca** ven `snake_case`.
- **Servicios mock vs. reales**: mientras un endpoint no existe todavía, se
  crea un `services/xService.js` con exactamente la misma firma de funciones
  que va a tener la versión real (mismos nombres, mismos parámetros, misma
  forma de respuesta), simulando los datos en memoria. Cuando el backend
  entrega el endpoint, se reemplaza el cuerpo de esas funciones por `fetch` —
  la página (`.jsx`) no debería necesitar ningún cambio. Este patrón ya se
  usó en `purchasingService.js`, `cxpService.js`, `creditNotesService.js` y
  `clientsService.js`; están comentados al inicio de cada archivo indicando
  qué falta conectar.
- **Errores**: toda función de servicio que falla lanza un `Error` con
  `.message` legible para mostrar directo en un `alert()` o en un banner —
  nunca un objeto de error crudo de Supabase/Postgres.

---

## 15. Checklist para armar una pantalla nueva

Antes de abrir un PR con una pantalla nueva, repasar:

- [ ] ¿Agregué la ruta en `App.jsx` (`ROUTE_INFO` + `<Route>` + link en el
      sidebar dentro del `.nav-group` que corresponda)?
- [ ] ¿El título de la pestaña vive **solo** en `ROUTE_INFO` (topbar), no lo
      repetí como `<h2>` dentro de la página? (sección 8)
- [ ] ¿Los filtros están en `.catalog-toolbar` y el botón de alta, si existe,
      está integrado ahí mismo con `marginLeft: 'auto'` en vez de solo?
- [ ] ¿La tabla sigue la estructura de la sección 7 (loading / vacío /
      datos, `cell-strong`/`cell-sub`/`cell-mono`)?
- [ ] ¿Los estados usan los badges y colores semánticos de la sección 5, y
      no un color inventado?
- [ ] ¿Los modales usan el componente `Modal.jsx` (no un `div` armado a
      mano) con `.form-row`/`.form-field` adentro?
- [ ] ¿Los íconos son SVG inline estilo Feather (sección 2.3), sin sumar una
      librería de íconos nueva?
- [ ] Si el servicio de datos todavía es un mock: ¿tiene el comentario de
      cabecera explicando qué falta conectar, igual que los servicios de
      Compras/Tesorería existentes?

---

## 16. Deuda de diseño detectada (para priorizar en el sprint)

Relevado al armar este documento — no bloquea nada, pero conviene que el
equipo lo tenga anotado:

1. **`Depositos.jsx`** usa clases (`warehouse-card`, `warehouse-grid`,
   `warehouse-icon`, `warehouse-stat-row`) que **no existen** en
   `index.css`. Hoy se renderiza sin estilo. Hay que escribir esas reglas o,
   más simple, migrar esa vista a `.stat-card` / `.table-panel` ya
   existentes.
2. **`Usuarios.jsx`** y **`Configuracion.jsx`** son stubs escritos en HTML
   plano dentro del JSX (usan el atributo `class` en vez de `className`, y
   siguen el patrón viejo de título repetido). Funcionan de casualidad
   porque los navegadores aplican `class` igual, pero conviene reescribirlos
   como componentes reales apenas se empiece a construir esas historias.
3. **`.filter-bar` vs `.catalog-toolbar`**: son visualmente idénticas y
   coexisten por historia del proyecto. No es urgente unificarlas, pero para
   pantallas nuevas usar siempre `.catalog-toolbar`.
