import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Cliente para el SERVIDOR (Route Handlers). Usa la Service Role Key, que
// ignora RLS. 'server-only' hace fallar el build si alguien lo importa desde
// un componente del navegador, así la clave nunca se filtra al cliente.
// Se crea de forma perezosa (al primer uso) para que `next build` no exija
// las variables de entorno.
let cliente = null;

export function getSupabaseAdmin() {
  if (cliente) return cliente;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local');
  }

  cliente = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cliente;
}
