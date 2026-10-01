import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/health - verifica que Next y la conexión a Supabase funcionan
export async function GET() {
  try {
    const { error } = await getSupabaseAdmin().from('roles').select('id').limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, mensaje: 'Next.js y base de datos conectados' });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
