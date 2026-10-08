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
// 2) ReciÃ©n con la reserva hecha crea la preferencia de Mercado Pago (HU-35).
// Precios, subtotal y envÃ­o se recalculan en la base: del navegador solo se toman
// los ids, las cantidades y el total que el cliente vio (para detectar cambios de precio).
export async function POST(request) {
  let ventaId = null;
  try {
    const { carrito, cliente, tipoEntrega, total } = await request.json();

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.error('[POST /api/checkout] Falta MERCADOPAGO_ACCESS_TOKEN');
      return NextResponse.json({ error: 'La pasarela de pago no estÃ¡ configurada.' }, { status: 500 });
    }
    if (!esUuid(cliente?.id)) {
      return NextResponse.json({ error: 'DebÃ©s identificarte como cliente para pagar.' }, { status: 400 });
    }
    const items = normalizarCarrito(carrito);

    // El cliente se relee de la base: no se confÃ­a en los datos que manda el navegador.
    const db = getSupabaseAdmin();
    const { data: clienteDb, error: errCliente } = await db
      .from('clientes')
      .select('id, razon_social, email, estado')
      .eq('id', cliente.id)
      .maybeSingle();
    if (errCliente) throw new Error(errCliente.message);
    if (!clienteDb || !clienteDb.estado) {
      return NextResponse.json({ error: 'El cliente no existe o estÃ¡ inactivo.' }, { status: 400 });
    }

    // ValidaciÃ³n + reserva atÃ³mica
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
          { error: 'Los precios se actualizaron. RevisÃ¡ el total antes de pagar.', codigo: reserva.codigo, total: reserva.total, items: reserva.items },
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
      itemsMP.push({ id: 'ENVIO', title: 'Costo de EnvÃ­o', quantity: 1, unit_price: Number(reserva.costo_envio), currency_id: 'ARS' });
    }

    let frontendHost = 'http://localhost:3000';
    try {
      let originStr = request.headers.get('origin') || request.headers.get('referer');
      if (originStr && originStr !== 'null') frontendHost = new URL(originStr).origin;
    } catch (e) {}
    const webhookHost = process.env.NEXT_PUBLIC_BASE_URL || frontendHost;
    
    const ahora = Date.now();
    // El link de pago vence junto con la reserva de stock.
    const aIso = (ms) => new Date(ms).toISOString().replace('Z', '+00:00');

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const bodyPayload = {
      items: itemsMP,
      external_reference: ventaId,
      payer: {
        name: clienteDb.razon_social,
        email: clienteDb.email || 'test_user@testuser.com',
      },
      back_urls: {
        success: webhookHost + '/carrito/success',
        failure: webhookHost + '/carrito/failure',
        pending: webhookHost + '/carrito/pending',
      },
      auto_return: 'approved',
      notification_url: webhookHost + '/api/webhooks/mercadopago',
      expires: true,
      expiration_date_from: aIso(ahora),
      expiration_date_to: aIso(ahora + MINUTOS_RESERVA * 60_000),
    };
    console.log('--- MP PAYLOAD ---', JSON.stringify(bodyPayload, null, 2));
    const prefResult = await new Preference(client).create({ body: bodyPayload });

    return NextResponse.json({ init_point: prefResult.init_point, venta_id: ventaId, minutos_reserva: MINUTOS_RESERVA });
  } catch (err) {
    // Si ya se reservÃ³ stock y fallÃ³ algo despuÃ©s (p. ej. Mercado Pago), se libera.
    if (ventaId) {
      await cancelarVentaWeb(ventaId, 'Error al iniciar el pago').catch((e) =>
        console.error('[POST /api/checkout] No se pudo liberar la reserva', ventaId, e)
      );
    }
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    console.error('[POST /api/checkout]', err);
    return NextResponse.json({ error: mensajeError('No pudimos iniciar el pago. ProbÃ¡ de nuevo en unos segundos.', err) }, { status: 500 });
  }
}





