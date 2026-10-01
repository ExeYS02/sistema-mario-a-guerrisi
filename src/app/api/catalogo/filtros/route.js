import { NextResponse } from 'next/server';
import { mensajeError } from '@/server/errores';
import { obtenerFiltros } from '@/server/services/catalogoService';

export const dynamic = 'force-dynamic';

// GET /api/catalogo/filtros -> categorías, marcas y países de origen activos
export async function GET() {
  try {
    const datos = await obtenerFiltros();
    return NextResponse.json(datos, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch (err) {
    console.error('[GET /api/catalogo/filtros]', err);
    return NextResponse.json({ error: mensajeError('No pudimos cargar los filtros.', err) }, { status: 500 });
  }
}
