# Implementación del Carrito de Compras - Walkthrough

Se completó la creación del carrito de compras adaptado a la experiencia de un e-commerce, incluyendo el persistido de datos globales, la validación de clientes en dos pasos, la lógica de cálculo de envíos a domicilio y finalmente la integración de la **Pasarela de Pagos (Mercado Pago)**.

## Avances Realizados

### 1. Pasarela de Pagos (Mercado Pago)
- Se instaló e integró el SDK oficial de `mercadopago`.
- En el frontend (`CarritoClient.jsx`), el botón "Continuar con el pago" verifica que exista un cliente y abre un modal de confirmación antes de redireccionar.
- Se desarrolló la ruta `/api/checkout/route.js`, la cual:
  - Crea un registro de la `venta` en Supabase con estado inicial **Pendiente**. (Asigna dinámicamente el depósito oficial con mayor stock y usa el UUID del usuario del sistema Web).
  - Registra los artículos en `ventas_detalle`.
  - Registra el método de entrega en las tablas `envios` y `envios_detalle`.
  - Genera la preferencia de pago de Mercado Pago (incluyendo el costo de envío si corresponde) usando el `venta_id` como `external_reference`.
  - Devuelve el `init_point` que envía al usuario directamente al checkout de Mercado Pago.
- Se agregaron las páginas de respuesta o `back_urls`: `/carrito/success`, `/carrito/failure` y `/carrito/pending`. La página de éxito se encarga de vaciar el carrito y deseleccionar al cliente.

### 2. Webhook y Descuento de Stock
- Se implementó la ruta `/api/webhooks/mercadopago/route.js` que se encarga de escuchar de manera asíncrona a Mercado Pago.
- Si recibe un pago "approved":
  - Verifica que no haya sido procesado antes (Idempotencia).
  - Cambia el estado de la venta a **Confirmada**.
  - Recorre los detalles de la venta y descuenta las cantidades precisas en la tabla `existencias`, siempre eligiendo de forma prioritaria el depósito con la cantidad más alta disponible.
  - Registra un nuevo asiento en la tabla `pagos_venta`.
- Si el pago es rechazado, la venta y el envío son marcados como **Cancelados**, sin perjudicar el stock de forma permanente.

### 3. Opciones de Entrega y Cálculos
- Se agregó el campo de selección para elegir el tipo de entrega: "Retirar del local" o "Envío a domicilio".
- Si se selecciona "Envío a domicilio", se mostrará la dirección del cliente (o un aviso si no tiene dirección).
- El cálculo de costo de envío se definió como `$30.000 + (3% de la suma de los subtotales)`. Este monto se agrega automáticamente al total de la compra de forma interactiva.
- El costo total con envío se propaga a todo el sistema, por lo que el botón del menú superior ("Carrito de compras") también se actualiza para mostrar el importe final con recargo si se selecciona el envío.

### 4. Estado Global del Carrito
- Se creó `CartContext` (`src/context/CartContext.jsx`) para almacenar el estado global del carrito y el cliente seleccionado.
- Esto permite que los productos agregados no se pierdan al navegar hacia otras pantallas como el "Catálogo".
- A pedido, la persistencia se maneja exclusivamente en el estado de memoria de React (Frontend) en lugar de usar LocalStorage, logrando así que los datos se limpien de forma segura cada vez que se inicie o se recargue forzosamente la aplicación.

### 5. Validación de Identidad del Cliente (2 Pasos)
- Al ingresar un DNI válido, se abre un **Modal de Confirmación en dos pasos**. 
- El sistema incluye una medida antiloop que limpia la caja de texto al presionar "Cancelar".
- Si avanza, presenta seis recuadros de un dígito para el código estático de prueba `123456`.

### 6. Módulo de Cliente y APIs
- Rutas del servidor `GET` y `POST` en `/api/clientes/route.js` para buscar clientes en Supabase y registrar perfiles temporales si no existen, preparándolo para el checkout final.
