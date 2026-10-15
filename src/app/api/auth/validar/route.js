import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { dni, respuesta } = await request.json();
    if (!dni || !respuesta) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data: cliente } = await db
      .from('clientes')
      .select('id, razon_social, dni, email, telefono, direccion, estado')
      .eq('dni', Number(dni))
      .maybeSingle();

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    if (cliente.estado === false) {
      return NextResponse.json({ error: 'Cuenta deshabilitada' }, { status: 403 });
    }

    // Normalización para evitar fallos por espacios accidentales o mayúsculas
    const resLimpia = String(respuesta).trim().toLowerCase();
    const emailLimpio = String(cliente.email || '').trim().toLowerCase();
    const telLimpio = String(cliente.telefono || '').trim().toLowerCase();

    if ((emailLimpio && emailLimpio === resLimpia) || (telLimpio && telLimpio === resLimpia)) {
      return NextResponse.json(cliente);
    }

    return NextResponse.json({ error: 'El dato de validación no coincide con nuestros registros.' }, { status: 401 });
  } catch (error) {
    console.error('Error en validar:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}