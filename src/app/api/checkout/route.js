import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requerirClienteId } from '@/server/services/authClienteService';

export async function GET(request) {
  try {
    const clienteSesion = await requerirClienteId(request);
    const db = getSupabaseAdmin();
    
    const { data, error } = await db
      .from('envios')
      .select(`
        id, tipo, estado, fecha_estimada, fecha_hora_registro,
        ventas!inner(total, numero_comprobante),
        envios_detalle(cantidad, articulos(descripcion))
      `)
      .eq('cliente_id', clienteSesion.id)
      .order('fecha_hora_registro', { ascending: false });

    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}