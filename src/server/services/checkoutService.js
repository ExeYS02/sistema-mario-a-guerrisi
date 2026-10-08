import 'server-only';
import net from 'node:net';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { esUuid } from '@/server/services/catalogoService';
import { ENVIO_FIJO, ENVIO_PORCENTAJE } from '@/utils/envio';

// Servicio de checkout web (HU-34 / HU-35).
// La validación de stock, la reserva temporal y la creación de la venta ocurren
// en UNA sola transacción de Postgres (RPC crear_venta_web), porque el cliente JS
// de Supabase no permite transacciones multi-paso. Ver
// docs/database/migracion_hu34_reserva_web.sql

// Usuario "sistema web" que figura como autor de las ventas del e-commerce.
export const USUARIO_WEB_ID = '00000000-0000-0000-0000-000000000001';
// Tiempo que se retiene el stock mientras el cliente paga (HU-34, criterio 3).
export const MINUTOS_RESERVA = 10;

const MAX_LINEAS = 50;
const MAX_CANTIDAD = 999;

export class CheckoutError extends Error {
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.status = status;
    this.extra = extra;
  }
}

// Del carrito del navegador solo se toma id y cantidad: precio y total se
// recalculan siempre en la base.
export function normalizarCarrito(carrito) {
  if (!Array.isArray(carrito) || carrito.length === 0) {
    throw new CheckoutError(400, 'El carrito está vacío.');
  }
  if (carrito.length > MAX_LINEAS) {
    throw new CheckoutError(400, `El carrito admite hasta ${MAX_LINEAS} artículos distintos.`);
  }
  return carrito.map((it) => {
    const cantidad = Number(it?.cantidad);
    if (!esUuid(it?.id) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
      throw new CheckoutError(400, 'El carrito contiene un artículo o una cantidad inválida.');
    }
    return { articuloId: it.id, cantidad };
  });
}

// x-forwarded-for puede traer una lista ("ip1, ip2"): se toma la primera y se
// valida, porque ventas.ip_origen es de tipo inet y rechaza cualquier otra cosa.
export function ipDeRequest(request) {
  const primera = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return net.isIP(primera) ? primera : '127.0.0.1';
}

// Valida stock + reserva + crea venta/detalle/envío de forma atómica.
// Devuelve el jsonb de la función: { ok:true, ... } | { ok:false, codigo, ... }
export async function reservarVentaWeb({ clienteId, items, tipoEntrega, totalEsperado, ip }) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc('crear_venta_web', {
    p_cliente_id: clienteId,
    p_items: items,
    p_tipo_entrega: tipoEntrega === 'envio' ? 'envio a domicilio' : 'retiro',
    p_ip: ip,
    p_usuario_id: USUARIO_WEB_ID,
    p_total_esperado: Number.isFinite(Number(totalEsperado)) ? Number(totalEsperado) : null,
    p_envio_fijo: ENVIO_FIJO,
    p_envio_pct: ENVIO_PORCENTAJE,
    p_minutos_reserva: MINUTOS_RESERVA,
  });
  if (error) throw new Error(`crear_venta_web: ${error.message}`);
  return data;
}

// Libera la reserva y cancela la venta (pago rechazado o falla al generar el pago).
export async function cancelarVentaWeb(ventaId, motivo) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc('cancelar_venta_web', { p_venta_id: ventaId, p_motivo: motivo });
  if (error) throw new Error(`cancelar_venta_web: ${error.message}`);
  return data === true;
}

// Pago aprobado: descuenta stock real, confirma la venta y registra el pago.
// Idempotente. Devuelve el texto de resultado de la función SQL.
export async function confirmarVentaWeb(ventaId, monto) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc('confirmar_venta_web', {
    p_venta_id: ventaId,
    p_monto: monto,
    p_metodo: 'Mercado Pago',
  });
  if (error) throw new Error(`confirmar_venta_web: ${error.message}`);
  return data;
}
