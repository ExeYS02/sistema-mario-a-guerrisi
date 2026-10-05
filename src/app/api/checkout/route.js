import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { carrito, cliente, tipoEntrega, total, subtotalProductos, costoEnvio } = body;

    if (!carrito || carrito.length === 0 || !cliente) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const USUARIO_SISTEMA_ID = '00000000-0000-0000-0000-000000000001';

    // 1. Encontrar el artículo principal (el de mayor subtotal o el primero)
    const articuloPrincipal = carrito[0];

    // 2. Buscar el depósito con más stock para este artículo
    const { data: existencias, error: stockErr } = await db
      .from('existencias')
      .select('deposito_id, cantidad, cantidad_reservada')
      .eq('articulo_id', articuloPrincipal.id);

    if (stockErr) {
      console.error('Error al obtener existencias:', stockErr);
      return NextResponse.json({ error: 'Error al verificar stock' }, { status: 500 });
    }

    let depositoOficialId = null;
    let maxStock = -1;
    
    if (existencias && existencias.length > 0) {
      for (const e of existencias) {
        const disponible = e.cantidad - e.cantidad_reservada;
        if (disponible > maxStock) {
          maxStock = disponible;
          depositoOficialId = e.deposito_id;
        }
      }
    }

    // Si no hay depósito con stock, usar un depósito por defecto si es posible, o tomar el primero
    if (!depositoOficialId && existencias && existencias.length > 0) {
      depositoOficialId = existencias[0].deposito_id;
    }

    if (!depositoOficialId) {
      // Búsqueda de cualquier depósito activo como fallback extremo
      const { data: fallbackDep } = await db.from('depositos').select('id').eq('estado', true).limit(1).single();
      if (!fallbackDep) {
        return NextResponse.json({ error: 'No hay depósitos configurados en el sistema.' }, { status: 500 });
      }
      depositoOficialId = fallbackDep.id;
    }

    // 3. Crear Venta Pendiente
    const { data: venta, error: ventaErr } = await db
      .from('ventas')
      .insert({
        deposito_id: depositoOficialId,
        usuario_id: USUARIO_SISTEMA_ID,
        cliente_id: cliente.id,
        estado: 'Pendiente',
        total: total,
        ip_origen: request.headers.get('x-forwarded-for') || '127.0.0.1',
      })
      .select('id, numero_comprobante')
      .single();

    if (ventaErr) {
      console.error('Error al crear venta:', ventaErr);
      return NextResponse.json({ error: 'Error al registrar la venta.' }, { status: 500 });
    }

    // 4. Crear Detalle de Venta
    const ventasDetalleInserts = carrito.map(item => ({
      venta_id: venta.id,
      articulo_id: item.id,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      importe_linea: item.precio * item.cantidad
    }));

    const { error: detalleErr } = await db.from('ventas_detalle').insert(ventasDetalleInserts);
    if (detalleErr) console.error('Error al crear detalle de venta:', detalleErr); // Non-blocking for now

    // 5. Crear Envío
    const { data: envio, error: envioErr } = await db
      .from('envios')
      .insert({
        venta_id: venta.id,
        cliente_id: cliente.id,
        tipo: tipoEntrega === 'retiro' ? 'retiro' : 'envio a domicilio',
        estado: 'Pendiente'
      })
      .select('id')
      .single();

    if (envioErr) {
      console.error('Error al crear envío:', envioErr);
    } else {
      // 6. Crear Detalle de Envío
      const enviosDetalleInserts = carrito.map(item => ({
        envio_id: envio.id,
        articulo_id: item.id,
        cantidad: item.cantidad
      }));
      await db.from('envios_detalle').insert(enviosDetalleInserts);
    }

    // 7. Configurar Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preference = new Preference(client);

    const itemsMP = carrito.map(item => ({
      id: item.id,
      title: item.descripcion,
      quantity: item.cantidad,
      unit_price: Number(item.precio),
      currency_id: 'ARS'
    }));

    if (costoEnvio > 0) {
      itemsMP.push({
        id: 'ENVIO',
        title: 'Costo de Envío',
        quantity: 1,
        unit_price: Number(costoEnvio),
        currency_id: 'ARS'
      });
    }

    const host = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';

    const prefResult = await preference.create({
      body: {
        items: itemsMP,
        external_reference: venta.id,
        payer: {
          name: cliente.razon_social,
          email: cliente.email || 'test_user@testuser.com',
        },
        back_urls: {
          success: `${host}/carrito/success`,
          failure: `${host}/carrito/failure`,
          pending: `${host}/carrito/pending`
        },
        auto_return: 'approved',
        notification_url: `${host}/api/webhooks/mercadopago`
      }
    });

    return NextResponse.json({ init_point: prefResult.init_point });

  } catch (err) {
    console.error('[POST /api/checkout]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
