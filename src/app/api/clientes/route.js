import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { esUuid } from '@/server/services/catalogoService';
import { validarDatosCliente } from '@/utils/validacionCliente';

export const dynamic = 'force-dynamic';

const UNIQUE_VIOLATION = '23505';

export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const dni = sp.get('dni');

    if (!dni || !/^\d{8}$/.test(dni)) {
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

    return NextResponse.json({ cliente: data ?? null });
  } catch (err) {
    console.error('[GET /api/clientes]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Alta de cliente nuevo
export async function POST(request) {
  try {
    const body = await request.json();
    const dni = String(body?.dni ?? '');

    if (!/^\d{8}$/.test(dni)) {
      return NextResponse.json({ error: 'El DNI debe tener 8 dígitos.' }, { status: 400 });
    }
    const { valores, errores } = validarDatosCliente(body);
    if (Object.keys(errores).length > 0) {
      return NextResponse.json({ error: Object.values(errores)[0], errores }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('clientes')
      .insert({
        razon_social: valores.razon_social,
        dni: parseInt(dni, 10),
        email: valores.email || null,
        telefono: valores.telefono,
        direccion: valores.direccion,
      })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return NextResponse.json({ error: 'Ya existe un cliente registrado con ese DNI.' }, { status: 409 });
      }
      console.error('[POST /api/clientes]', error);
      return NextResponse.json({ error: 'No pudimos registrar al cliente.' }, { status: 500 });
    }

    return NextResponse.json({ cliente: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/clientes]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Modificación de los datos de un cliente ya registrado.
// Solo se pueden cambiar nombre, email, teléfono y dirección: el DNI/CUIT, el
// estado y el id nunca se toman del cuerpo. Se exige que `dni` coincida con el
// del cliente identificado, como chequeo mínimo contra ids equivocados.
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id } = body ?? {};
    const dni = String(body?.dni ?? '');

    if (!esUuid(id) || !/^\d{7,8}$/.test(dni)) {
      return NextResponse.json({ error: 'Datos de cliente inválidos.' }, { status: 400 });
    }
    const { valores, errores } = validarDatosCliente(body);
    if (Object.keys(errores).length > 0) {
      return NextResponse.json({ error: Object.values(errores)[0], errores }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('clientes')
      .update({
        razon_social: valores.razon_social,
        email: valores.email || null,
        telefono: valores.telefono,
        direccion: valores.direccion,
      })
      .eq('id', id)
      .eq('dni', parseInt(dni, 10))
      .eq('estado', true)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[PUT /api/clientes]', error);
      return NextResponse.json({ error: 'No pudimos guardar los cambios.' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'No se encontró el cliente a modificar.' }, { status: 404 });
    }

    return NextResponse.json({ cliente: data });
  } catch (err) {
    console.error('[PUT /api/clientes]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
