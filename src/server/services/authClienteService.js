import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Valida que el request contenga un UUID válido en el header X-Cliente-Id
// y que corresponda a un cliente activo en la base de datos.
export async function requerirClienteId(request) {
  const clienteId = request.headers.get('X-Cliente-Id');
  
  if (!clienteId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clienteId)) {
    const error = new Error('No autorizado. Token/ID inválido o ausente.');
    error.status = 401;
    throw error;
  }

  const db = getSupabaseAdmin();
  const { data: cliente, error } = await db
    .from('clientes')
    .select('id, razon_social, dni, email, telefono, direccion, estado')
    .eq('id', clienteId)
    .single();

  if (error || !cliente) {
    const err = new Error('Cliente no encontrado');
    err.status = 401;
    throw err;
  }

  if (cliente.estado === false) {
    const err = new Error('Tu cuenta está deshabilitada');
    err.status = 403;
    throw err;
  }

  return cliente;
}