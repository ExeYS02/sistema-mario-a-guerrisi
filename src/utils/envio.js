// Fórmula del costo de envío a domicilio (única fuente de verdad).
// La usan el carrito (para mostrar el total) y el servidor (para cobrar):
// $30.000 fijos + 3% del subtotal de productos, redondeado a centavos.
export const ENVIO_FIJO = 30000;
export const ENVIO_PORCENTAJE = 0.03;

export function calcularCostoEnvio(subtotalProductos) {
  return ENVIO_FIJO + Math.round(subtotalProductos * ENVIO_PORCENTAJE * 100) / 100;
}
