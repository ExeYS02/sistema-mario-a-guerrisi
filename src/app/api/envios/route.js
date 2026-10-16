import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requerirClienteId } from '@/server/services/authClienteService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Lee el header X-Cliente-Id de forma segura
    const clienteSesion = await requerirClienteId(request);
    const db = getSupabaseAdmin();

    const { data, error } = await db
      .from('envios')
      .select(`
        *,
        ventas ( numero_comprobante ),
        envios_detalle (
          cantidad,
          articulos ( descripcion )
        )
      `)
      .eq('cliente_id', clienteSesion.id)
      .order('fecha_hora_registro', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ envios: data || [] });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}