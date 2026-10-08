import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { mensajeError } from '@/server/errores';
import { esUuid } from '@/server/services/catalogoService';
import {
  CheckoutError,
  MINUTOS_RESERVA,
  normalizarCarrito,
  ipDeRequest,
  reservarVentaWeb,
  cancelarVentaWeb,
} from '@/server/services/checkoutService';

export const dynamic = 'force-dynamic';

// POST /api/checkout
// 1) Valida el stock real contra la base central y lo reserva por MINUTOS_RESERVA
//    (HU-34). Si no alcanza, responde 409 y NO se genera el link de pago.
// 2) Recién con la reserva hecha crea la preferencia de Mercado Pago (HU-35).
// Precios, subtotal y envío se recalculan en la base: del navegador solo se toman
// los ids, las cantidades y el total que el cliente vio (para detectar cambios de precio).
export async function POST(request) {
  let ventaId = null;
  try {
    const { carrito, cliente, tipoEntrega, total } = await request.json();

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.error('[POST /api/checkout] Falta MERCADOPAGO_ACCESS_TOKEN');
      return NextResponse.json({ error: 'La pasarela de pago no está configurada.' }, { status: 500 });
    }
    if (!esUuid(cliente?.id)) {
      return NextResponse.json({ error: 'Debés identificarte como cliente para pagar.' }, { status: 400 });
    }
    const items = normalizarCarrito(carrito);

    // El cliente se relee de la base: no se confía en los datos que manda el navegador.
    const db = getSupabaseAdmin();
    const { data: clienteDb, error: errCliente } = await db
      .from('clientes')
      .select('id, razon_social, email, estado')
      .eq('id', cliente.id)
      .maybeSingle();
    if (errCliente) throw new Error(errCliente.message);
    if (!clienteDb || !clienteDb.estado) {
      return NextResponse.json({ error: 'El cliente no existe o está inactivo.' }, { status: 400 });
    }

    // Validación + reserva atómica
    const reserva = await reservarVentaWeb({
      clienteId: clienteDb.id,
      items,
      tipoEntrega,
      totalEsperado: total,
      ip: ipDeRequest(request),
    });

    if (!reserva.ok) {
      if (reserva.codigo === 'STOCK_INSUFICIENTE') {
        return NextResponse.json(
          { error: 'Stock insuficiente para completar la compra.', codigo: reserva.codigo, faltantes: reserva.faltantes },
          { status: 409 }
        );
      }
      if (reserva.codigo === 'PRECIOS_ACTUALIZADOS') {
        return NextResponse.json(
          { error: 'Los precios se actualizaron. Revisá el total antes de pagar.', codigo: reserva.codigo, total: reserva.total, items: reserva.items },
          { status: 409 }
        );
      }
      throw new Error(`Respuesta inesperada de crear_venta_web: ${JSON.stringify(reserva)}`);
    }

    ventaId = reserva.venta_id;

    // Mercado Pago: items con los precios de la base
    const itemsMP = reserva.items.map((it) => ({
      id: it.articulo_id,
      title: it.descripcion,
      quantity: it.cantidad,
      unit_price: Number(it.precio_unitario),
      currency_id: 'ARS',
    }));
    if (Number(reserva.costo_envio) > 0) {
      itemsMP.push({ id: 'ENVIO', title: 'Costo de Envío', quantity: 1, unit_price: Number(reserva.costo_envio), currency_id: 'ARS' });
    }

    const host = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';
    const ahora = Date.now();
    // El link de pago vence junto con la reserva de stock.
    const aIso = (ms) => new Date(ms).toISOString().replace('Z', '+00:00');

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const prefResult = await new Preference(client).create({
      body: {
        items: itemsMP,
        external_reference: ventaId,
        payer: {
          name: clienteDb.razon_social,
          email: clienteDb.email || 'test_user@testuser.com',
        },
        back_urls: {
          success: `${host}/carrito/success`,
          failure: `${host}/carrito/failure`,
          pending: `${host}/carrito/pending`,
        },
        auto_return: 'approved',
        notification_url: `${host}/api/webhooks/mercadopago`,
        expires: true,
        expiration_date_from: aIso(ahora),
        expiration_date_to: aIso(ahora + MINUTOS_RESERVA * 60_000),
      },
    });

    return NextResponse.json({ init_point: prefResult.init_point, venta_id: ventaId, minutos_reserva: MINUTOS_RESERVA });
  } catch (err) {
    // Si ya se reservó stock y falló algo después (p. ej. Mercado Pago), se libera.
    if (ventaId) {
      await cancelarVentaWeb(ventaId, 'Error al iniciar el pago').catch((e) =>
        console.error('[POST /api/checkout] No se pudo liberar la reserva', ventaId, e)
      );
    }
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    console.error('[POST /api/checkout]', err);
    return NextResponse.json({ error: mensajeError('No pudimos iniciar el pago. Probá de nuevo en unos segundos.', err) }, { status: 500 });
  }
}
