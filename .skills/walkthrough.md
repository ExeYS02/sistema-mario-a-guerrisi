# Implementación del Carrito de Compras - Walkthrough

Se completó la creación del carrito de compras adaptado a la experiencia de un e-commerce, incluyendo el persistido de datos globales, la validación de clientes en dos pasos, y la lógica de cálculo de envíos a domicilio.

## Avances Realizados

### 1. Opciones de Entrega y Cálculos
- Se agregó el campo de selección para elegir el tipo de entrega: "Retirar del local" o "Envío a domicilio".
- Si se selecciona "Envío a domicilio", se mostrará la dirección del cliente (o un aviso si no tiene dirección).
- El cálculo de costo de envío se definió como `$30.000 + (3% de la suma de los subtotales)`. Este monto se agrega automáticamente al total de la compra de forma interactiva.
- El costo total con envío se propaga a todo el sistema, por lo que el botón del menú superior ("Carrito de compras") también se actualiza para mostrar el importe final con recargo si se selecciona el envío.

### 2. Estado Global del Carrito
- Se creó `CartContext` (`src/context/CartContext.jsx`) para almacenar el estado global del carrito y el cliente seleccionado.
- Esto permite que los productos agregados no se pierdan al navegar hacia otras pantallas como el "Catálogo".
- A pedido, la persistencia se maneja exclusivamente en el estado de memoria de React (Frontend) en lugar de usar LocalStorage, logrando así que los datos se limpien de forma segura cada vez que se inicie o se recargue forzosamente la aplicación.

### 3. Actualización del Header y Alineación
- El botón de "Carrito de compras" en el menú principal ahora muestra dinámicamente la cantidad de artículos `(N)` de forma alineada, y el precio total (`Total: $X.XXX,XX`) se encuentra dentro de los mismos márgenes y proporciones del botón.
- Los botones del carrito y del catálogo se muestran perfectamente alineados en su eje central vertical.

### 4. Validación de Identidad del Cliente (2 Pasos)
- Se actualizó el módulo de clientes en `CarritoClient.jsx`. Al ingresar un DNI válido, se abre un **Modal de Confirmación en dos pasos**:
  - **Paso 1**: Se muestra la pregunta `¿Deseas identificarte como "[razon_social]", DNI "[dni]"?` junto a los botones "Cancelar" y "Continuar". Al cancelar, el modal se cierra y la barra de búsqueda se limpia automáticamente, previniendo que el modal se vuelva a disparar (solucionando el bug de encierro).
  - **Paso 2**: Si se presiona "Continuar", se despliega la interfaz de verificación (seis recuadros de un dígito) con el código estático de prueba `123456`.
- Una vez verificado, el buscador de clientes desaparece y se muestra la tarjeta de datos del cliente, junto a un botón "Cambiar cliente" que revierte el estado para buscar uno nuevo.

### 5. Navegación y Vistas Base
- Se integró `StoreHeader.jsx` agregando el enlace al "Carrito de compras" junto al "Catálogo".
- Se diseñó el layout principal (`src/app/carrito/page.jsx` y `src/app/carrito/CarritoClient.jsx`) utilizando una estructura dividida (productos a la izquierda, información del cliente a la derecha).

### 6. Buscador de Artículos
- Se implementó un buscador compacto (similar a una barra de búsqueda) para disminuir el espacio ocupado, evitando la sobrecarga visual de un POS clásico.
- El buscador se conecta al catálogo general utilizando `obtenerCatalogo`, heredando automáticamente la lógica de stock total unificado (suma de depósitos).

### 7. Módulo de Cliente y APIs
- Se generaron las rutas del servidor `GET` y `POST` en `src/app/api/clientes/route.js` para buscar clientes en Supabase y registrar perfiles temporales si no existen, preparándolo para el checkout final.
