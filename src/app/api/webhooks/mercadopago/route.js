import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const body = await request.json();

    // Extraer datos del webhook (el formato puede variar según si es topic o type)
    let paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
    const topic = body?.type || body?.topic || url.searchParams.get('topic') || url.searchParams.get('type');

    if (topic !== 'payment' || !paymentId) {
      return new NextResponse('Ignorado', { status: 200 });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const payment = new Payment(client);
    
    const paymentData = await payment.get({ id: paymentId });
    const ventaId = paymentData.external_reference;
    const status = paymentData.status;

    if (!ventaId) {
      return new NextResponse('Sin external_reference', { status: 200 });
    }

    const db = getSupabaseAdmin();

    // Idempotencia: Verificar estado actual de la venta
    const { data: ventaActual, error: errVenta } = await db
      .from('ventas')
      .select('id, estado')
      .eq('id', ventaId)
      .single();

    if (errVenta || !ventaActual) {
      console.error('Venta no encontrada para webhook:', ventaId);
      return new NextResponse('Venta no encontrada', { status: 404 });
    }

    if (ventaActual.estado === 'Confirmada') {
      // Ya fue procesado previamente
      return new NextResponse('Ya procesado', { status: 200 });
    }

    if (status === 'approved') {
      // 1. Actualizar estado a Confirmada
      await db.from('ventas').update({ estado: 'Confirmada' }).eq('id', ventaId);

      // 2. Descontar Stock
      const { data: detalles } = await db.from('ventas_detalle').select('articulo_id, cantidad').eq('venta_id', ventaId);
      
      if (detalles && detalles.length > 0) {
        for (const det of detalles) {
          // Buscar existencias de este artículo en todos los depósitos
          const { data: exist } = await db
            .from('existencias')
            .select('id_art_x_dep, cantidad, cantidad_reservada')
            .eq('articulo_id', det.articulo_id)
            .order('cantidad', { ascending: false });

          if (exist && exist.length > 0) {
            // Descontar del depósito con más stock (el primero de la lista ordenada)
            const objetivo = exist[0];
            const nuevaCantidad = Math.max(0, objetivo.cantidad - det.cantidad);
            await db.from('existencias')
              .update({ cantidad: nuevaCantidad })
              .eq('id_art_x_dep', objetivo.id_art_x_dep);
          }
        }
      }

      // 3. Registrar Pago en pagos_venta
      await db.from('pagos_venta').insert({
        venta_id: ventaId,
        metodo: 'Mercado Pago',
        monto: paymentData.transaction_amount
      });

    } else if (status === 'rejected' || status === 'cancelled') {
      // Si se rechaza, cancelamos la venta. No se toca el stock.
      await db.from('ventas').update({ estado: 'Cancelada', motivo_cancelacion: 'Pago rechazado por Mercado Pago' }).eq('id', ventaId);
      await db.from('envios').update({ estado: 'Cancelado' }).eq('venta_id', ventaId);
    }

    return new NextResponse('OK', { status: 200 });

  } catch (err) {
    console.error('[POST /api/webhooks/mercadopago]', err);
    return new NextResponse('Error', { status: 500 });
  }
}
