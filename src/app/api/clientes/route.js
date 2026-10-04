import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const dni = sp.get('dni');

    if (!dni || dni.length !== 8) {
      return NextResponse.json({ error: 'DNI inválido' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('clientes')
      .select('*')
      .eq('dni', parseInt(dni, 10))
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ cliente: null });
    }

    return NextResponse.json({ cliente: data });
  } catch (err) {
    console.error('[GET /api/clientes]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { razon_social, dni, email, telefono, direccion } = body;

    if (!razon_social || !dni) {
      return NextResponse.json({ error: 'Razón social y DNI son obligatorios' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('clientes')
      .insert({
        razon_social,
        dni: parseInt(dni, 10),
        email: email || null,
        telefono: telefono || '',
        direccion: direccion || ''
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cliente: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/clientes]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
