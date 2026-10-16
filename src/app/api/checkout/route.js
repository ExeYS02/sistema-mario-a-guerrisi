import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { requerirClienteId } from '@/server/services/authClienteService';
import { reservarVentaWeb, normalizarCarrito, ipDeRequest } from '@/server/services/checkoutService';

export async function POST(request) {
  try {
    // 1. Validar identidad del cliente
    const cliente = await requerirClienteId(request);
    
    // 2. Leer body
    const body = await request.json();
    const { items, tipoEntrega, totalEsperado } = body;

    // 3. Normalizar carrito (solo tomamos ID y cantidad; el precio lo calcula la base)
    const carritoNormalizado = normalizarCarrito(items);
    const ip = ipDeRequest(request);

    // 4. Invocar función SQL atómica (reserva de stock + creación de la venta)
    const resultado = await reservarVentaWeb({
      clienteId: cliente.id,
      items: carritoNormalizado,
      tipoEntrega,
      totalEsperado,
      ip
    });

    if (!resultado.ok) {
      // Retornar 409 Conflict si no hay stock suficiente o el precio cambió
      return NextResponse.json(
        { error: resultado.mensaje || 'Error en la reserva', detalle: resultado.detalle },
        { status: 409 }
      );
    }

    // 5. Crear preferencia en Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preference = new Preference(client);
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    const prefData = await preference.create({
      body: {
        items: [
          {
            id: 'VTA-WEB',
            title: 'Compra en Mario A. Guerrisi',
            quantity: 1,
            unit_price: Number(resultado.total),
            currency_id: 'ARS'
          }
        ],
        external_reference: resultado.venta_id,
        back_urls: {
          success: `${baseUrl}/checkout/exito`,
          failure: `${baseUrl}/checkout/error`,
          pending: `${baseUrl}/checkout/pendiente`
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/webhooks/mercadopago`
      }
    });

    // 6. Devolver el init_point al frontend
    return NextResponse.json({ init_point: prefData.init_point });

  } catch (error) {
    console.error('Checkout POST error:', error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}