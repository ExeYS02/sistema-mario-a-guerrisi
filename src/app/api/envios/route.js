import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('cliente_id');

  if (!clienteId) {
    return NextResponse.json({ error: 'Falta cliente_id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: envios, error } = await supabase
      .from('envios')
      .select(`
        *,
        ventas (
          numero_comprobante,
          estado
        ),
        envios_detalle (
          cantidad,
          articulo_id,
          articulos (
            descripcion,
            modelo
          )
        )
      `)
      .eq('cliente_id', clienteId)
      .order('fecha_hora_registro', { ascending: false });

    if (error) throw error;

    // Aplanar los datos de 'ventas' para el frontend que espera 'numero_comprobante' y 'venta_estado'
    const enviosMapeados = envios.map(envio => {
      return {
        ...envio,
        numero_comprobante: envio.ventas?.numero_comprobante || 'N/A',
        venta_estado: envio.ventas?.estado || 'Desconocido',
      };
    });

    return NextResponse.json(enviosMapeados);
  } catch (err) {
    console.error('[GET /api/envios]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
