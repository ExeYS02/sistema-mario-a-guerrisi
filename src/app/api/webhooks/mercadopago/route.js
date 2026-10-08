import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { esUuid } from '@/server/services/catalogoService';
import { cancelarVentaWeb, confirmarVentaWeb } from '@/server/services/checkoutService';

export const dynamic = 'force-dynamic';

// Resultados de confirmar_venta_web que requieren intervención manual (reembolso/revisión).
const REQUIEREN_REVISION = new Set(['sin_stock_reembolsar', 'cancelada_reembolsar', 'monto_no_coincide']);

// Webhook de Mercado Pago (HU-35). Mercado Pago puede notificar varias veces el mismo
// pago, por eso todo el efecto sobre la venta ocurre en funciones SQL idempotentes.
// El estado del pago nunca se toma del cuerpo de la notificación: se consulta a la API
// de Mercado Pago con el id recibido, así una notificación falsa no puede aprobar nada.
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
    const topic = body?.type || body?.topic || url.searchParams.get('topic') || url.searchParams.get('type');

    if (topic !== 'payment' || !paymentId) {
      return new NextResponse('Ignorado', { status: 200 });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentData = await new Payment(client).get({ id: paymentId });
    const ventaId = paymentData.external_reference;
    const status = paymentData.status;

    if (!esUuid(ventaId)) {
      return new NextResponse('Sin external_reference válido', { status: 200 });
    }

    if (status === 'approved') {
      const resultado = await confirmarVentaWeb(ventaId, Number(paymentData.transaction_amount));
      if (REQUIEREN_REVISION.has(resultado)) {
        console.error(`[webhook MP] REQUIERE REVISIÓN MANUAL: venta ${ventaId}, pago ${paymentId} → ${resultado}`);
      } else if (resultado === 'no_existe') {
        console.error('[webhook MP] Venta inexistente para el pago', paymentId, ventaId);
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      // Se libera la reserva. No se descuenta stock real.
      await cancelarVentaWeb(ventaId, 'Pago rechazado por Mercado Pago');
    }
    // pending / in_process / authorized: la reserva sigue vigente hasta que venza.

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('[POST /api/webhooks/mercadopago]', err);
    // 500 => Mercado Pago reintenta (es seguro: las funciones son idempotentes).
    return new NextResponse('Error', { status: 500 });
  }
}
