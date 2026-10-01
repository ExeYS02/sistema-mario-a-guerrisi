import { createClient } from '@supabase/supabase-js';

// Cliente para el NAVEGADOR (clave pública / anon). Respeta RLS.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
