import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const POR_PAGINA_DEFAULT = 12;
export const POR_PAGINA_MAX = 48;

const ORDENES = {
  novedades: { col: 'fecha_hora_registro', asc: false },
  precio_asc: { col: 'precio_actual', asc: true },
  precio_desc: { col: 'precio_actual', asc: false },
  nombre: { col: 'descripcion', asc: true },
};

export const ORDENES_VALIDOS = Object.keys(ORDENES);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// ---- Maestros activos (categorías, marcas, países) con caché corta en memoria ----
const TTL_MS = 60_000;
let cacheMaestros = { en: 0, datos: null };

export async function obtenerFiltros() {
  if (cacheMaestros.datos && Date.now() - cacheMaestros.en < TTL_MS) return cacheMaestros.datos;
  const db = getSupabaseAdmin();
  const [cat, mar, pai] = await Promise.all([
    db.from('categorias').select('id, nombre').eq('estado', true).order('nombre'),
    db.from('marcas').select('id, nombre').eq('estado', true).order('nombre'),
    db.from('paises_origen').select('id, nombre').eq('estado', true).order('nombre'),
  ]);
  const falla = [['categorias', cat], ['marcas', mar], ['paises_origen', pai]].find(([, r]) => r.error);
  if (falla) throw new Error(`Tabla ${falla[0]}: ${falla[1].error.message}`);
  const datos = { categorias: cat.data, marcas: mar.data, paises: pai.data };
  cacheMaestros = { en: Date.now(), datos };
  return datos;
}

const normalizar = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const limpiarPalabra = (s) => s.replace(/[,()%*\\"'.:]/g, '').trim();

function palabrasDeBusqueda(q) {
  return String(q ?? '').split(/\s+/).map(limpiarPalabra).filter(Boolean).slice(0, 4);
}

export async function listarCatalogo({
  q = '',
  categoriaId = null,
  marcaId = null,
  paisId = null,
  orden = 'novedades',
  stock = 'con',
  pagina = 1,
  porPagina = POR_PAGINA_DEFAULT,
}) {
  const db = getSupabaseAdmin();
  const ord = ORDENES[orden] ?? ORDENES.novedades;
  const modoStock = ['con', 'sin', 'todos'].includes(stock) ? stock : 'con';
  const limite = Math.min(Math.max(porPagina, 1), POR_PAGINA_MAX);
  const desde = (Math.max(pagina, 1) - 1) * limite;

  let query = db
    .from('v_articulos_catalogo')
    .select(
      'id, codigo_interno, descripcion, modelo, codigo_ean13, precio_actual, disponible, stock_minimo_total, ' +
      'categorias!inner(id, nombre), marcas!inner(id, nombre), paises_origen(id, nombre)',
      { count: 'exact' }
    )
    .eq('estado', true)
    .eq('categorias.estado', true)
    .eq('marcas.estado', true);

  if (esUuid(categoriaId)) query = query.eq('categoria_id', categoriaId);
  if (esUuid(marcaId)) query = query.eq('marca_id', marcaId);
  if (esUuid(paisId)) query = query.eq('pais_origen', paisId);

  if (modoStock === 'con') {
    query = query.gt('disponible', 0);
  } else if (modoStock === 'sin') {
    query = query.lte('disponible', 0);
  }

  const palabras = palabrasDeBusqueda(q);
  if (palabras.length) {
    const { categorias, marcas } = await obtenerFiltros();
    for (const p of palabras) {
      const np = normalizar(p);
      const condiciones = [
        `descripcion.ilike.%${p}%`,
        `modelo.ilike.%${p}%`,
        `codigo_interno.ilike.%${p}%`,
        `codigo_ean13.ilike.%${p}%`,
      ];
      const marcaIds = marcas.filter((m) => normalizar(m.nombre).includes(np)).map((m) => m.id);
      const catIds = categorias.filter((c) => normalizar(c.nombre).includes(np)).map((c) => c.id);
      if (marcaIds.length) condiciones.push(`marca_id.in.(${marcaIds.join(',')})`);
      if (catIds.length) condiciones.push(`categoria_id.in.(${catIds.join(',')})`);
      query = query.or(condiciones.join(','));
    }
  }

  if (modoStock === 'todos') {
    query = query.order('tiene_stock', { ascending: false });
  }

  query = query
    .order(ord.col, { ascending: ord.asc })
    .order('id', { ascending: true })
    .range(desde, desde + limite - 1);

  const { data: filas, count, error } = await query;
  if (error) throw new Error(error.message);

  const items = (filas || []).map((f) => {
    const disp = f.disponible ?? 0;
    const min = f.stock_minimo_total ?? 0;
    let disponibilidad = 'en_stock';
    let unidades_disponibles = null;

    if (disp <= 0) {
      disponibilidad = 'sin_stock';
    } else if (min > 0 && disp <= min) {
      disponibilidad = 'ultimas';
      unidades_disponibles = disp;
    }

    return {
      id: f.id,
      codigo_interno: f.codigo_interno,
      descripcion: f.descripcion,
      modelo: f.modelo,
      codigo_ean13: f.codigo_ean13,
      precio_actual: Number(f.precio_actual),
      categoria: f.categorias,
      marca: f.marcas,
      pais_origen: f.paises_origen,
      disponibilidad,
      unidades_disponibles,
    };
  });

  const total = count ?? 0;

  return {
    items,
    total,
    pagina: Math.max(pagina, 1),
    por_pagina: limite,
    total_paginas: Math.max(Math.ceil(total / limite), 1),
    actualizado_en: new Date().toISOString(),
  };
}