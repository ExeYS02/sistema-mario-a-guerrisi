# Plan de Implementación: Módulo "Tus Envíos"

## Descripción del Objetivo
Crear una nueva sección accesible desde el menú principal que permita a los clientes consultar el estado de sus pedidos y envíos de manera autogestionada. El sistema utilizará la misma validación de identidad (DNI + Código) que el carrito de compras y mostrará tarjetas informativas con el cruce de datos entre `ventas`, `envios` y `envios_detalle`.

---

> [!NOTE] Aclaración Importante sobre el Error Anterior
> Viendo detenidamente tu captura de la consola, el error muestra un fragmento de código (línea 100: `await new Preference(client).create({ body: { ... }`) que **ya no existe en el archivo físico**. Esto significa que tu servidor de Next.js se quedó "congelado" ejecutando una versión antigua del código en memoria. 
> **Solución:** Antes de seguir, por favor detén la consola de Next.js (`Ctrl + C`) y vuelve a ejecutar `npm run dev`. Con ese simple reinicio, tomará los cambios que arreglan el error de la URL.

---

## Cambios Propuestos

### 1. Componente de Navegación (`StoreHeader.jsx`)
#### [MODIFY] `src/components/StoreHeader.jsx`
- Se añadirá un nuevo enlace "Tus envíos" junto a "Carrito de compras".
- Estará visualmente alineado y resaltará cuando la ruta actual sea `/envios`.

### 2. Contexto Global de Identidad
Actualmente el `CartContext` maneja el estado del `cliente`. Dado que ahora "Carrito" y "Envíos" compartirán la identidad, reestructuraremos o reutilizaremos la lógica para que, si el cliente se identifica en Envíos, también esté identificado en el Carrito (y viceversa).

### 3. Nueva Ruta API para Consultar Envíos
#### [NEW] `src/app/api/envios/route.js`
- **Manejo del Método `GET`:** Recibirá el `cliente_id` por parámetro.
- **Consulta a Supabase:** Realizará un join (o subconsultas) entre las tablas:
  - `envios` (para obtener estado, tipo, fecha estimada y registro).
  - `ventas` (para obtener numero_comprobante y estado).
  - `envios_detalle` + `articulos` (para listar los productos y cantidades).
- Se implementará la lógica de cálculo de fecha estimada (Retiro = +1 día, Domicilio = +7 días) en caso de que el campo `fecha_estimada` de la base de datos esté vacío (nulo).

### 4. Página Principal del Módulo
#### [NEW] `src/app/envios/page.jsx`
- Contendrá la lógica de verificación de identidad (reutilizando la estructura visual del modal de 2 pasos del carrito).
- Si no hay cliente, mostrará el buscador por DNI.
- Si hay cliente, realizará el `fetch` a `/api/envios` y mapeará los resultados.
- Diseño: Tarjetas (Cards) rectangulares limpias donde se detallará el número de comprobante, el estado global, y el listado de ítems con formato claro de fechas.

---

## Plan de Verificación
### Verificación Manual
1. Iniciar la aplicación y navegar a "Tus envíos" desde el header.
2. Ingresar el DNI de un cliente que tenga ventas previas (ej. el que usaste para la prueba de Mercado Pago).
3. Ingresar el código `123456`.
4. Verificar que aparezcan las tarjetas con la información estructurada, las fechas calculadas correctamente y los artículos listados.
