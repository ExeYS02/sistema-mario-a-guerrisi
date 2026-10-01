import { NextResponse } from 'next/server';
import { mensajeError } from '@/server/errores';
import { listarCatalogo, ORDENES_VALIDOS, POR_PAGINA_DEFAULT } from '@/server/services/catalogoService';

export const dynamic = 'force-dynamic';

// GET /api/catalogo?q=&categoria=&marca=&pais=&orden=&pagina=&por_pagina=
// Sin caché: precio y stock deben verse actualizados en menos de 1 minuto (HU-32, criterio 2).
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const orden = sp.get('orden');
    const resultado = await listarCatalogo({
      q: (sp.get('q') ?? '').slice(0, 80),
      categoriaId: sp.get('categoria'),
      marcaId: sp.get('marca'),
      paisId: sp.get('pais'),
      orden: ORDENES_VALIDOS.includes(orden) ? orden : 'novedades',
      pagina: parseInt(sp.get('pagina') ?? '1', 10) || 1,
      porPagina: parseInt(sp.get('por_pagina') ?? String(POR_PAGINA_DEFAULT), 10) || POR_PAGINA_DEFAULT,
    });
    return NextResponse.json(resultado, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[GET /api/catalogo]', err);
    return NextResponse.json({ error: mensajeError('No pudimos cargar el catálogo. Probá de nuevo en unos segundos.', err) }, { status: 500 });
  }
}
