import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { dni } = await request.json();
    if (!dni || !/^\d{7,9}$/.test(String(dni))) {
      return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: cliente } = await db
      .from('clientes')
      .select('email, telefono, estado')
      .eq('dni', Number(dni))
      .maybeSingle();

    if (!cliente) {
      return NextResponse.json({ existe: false });
    }

    if (cliente.estado === false) {
      return NextResponse.json({ error: 'Cuenta deshabilitada' }, { status: 403 });
    }

    // Determinamos qué dato pedir para el desafío de seguridad
    const tipoValidacion = cliente.email ? 'email' : 'telefono';
    
    return NextResponse.json({ existe: true, tipoValidacion });
  } catch (error) {
    console.error('Error en identificar:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}