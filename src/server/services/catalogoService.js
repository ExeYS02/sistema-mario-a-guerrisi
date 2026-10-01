import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Servicio de catálogo para la tienda web (HU-32).
// Lee el catálogo central (articulos + existencias) con la service key y devuelve
// solo lo que el cliente externo necesita: nunca el stock físico exacto.

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

// Quita caracteres que rompen la sintaxis de .or() de PostgREST y los comodines.
const limpiarPalabra = (s) => s.replace(/[,()%*\\"'.:]/g, '').trim();

function palabrasDeBusqueda(q) {
  return String(q ?? '').split(/\s+/).map(limpiarPalabra).filter(Boolean).slice(0, 4);
}

// ---- Disponibilidad ----
// disponible = cantidad - cantidad_reservada (por depósito activo, sumado).
function calcularDisponibilidad(filas) {
  let disponible = 0;
  let minimo = 0;
  for (const f of filas) {
    disponible += Math.max((f.cantidad ?? 0) - (f.cantidad_reservada ?? 0), 0);
    minimo += f.stock_minimo ?? 0;
  }
  if (disponible <= 0) return { disponibilidad: 'sin_stock', unidades_disponibles: null };
  if (minimo > 0 && disponible <= minimo) return { disponibilidad: 'ultimas', unidades_disponibles: disponible };
  return { disponibilidad: 'en_stock', unidades_disponibles: null };
}

export async function listarCatalogo({
  q = '', categoriaId = null, marcaId = null, paisId = null,
  orden = 'novedades', pagina = 1, porPagina = POR_PAGINA_DEFAULT,
}) {
  const db = getSupabaseAdmin();
  const ord = ORDENES[orden] ?? ORDENES.novedades;
  const limite = Math.min(Math.max(porPagina, 1), POR_PAGINA_MAX);
  const desde = (Math.max(pagina, 1) - 1) * limite;

  let query = db
    .from('articulos')
    .select(
      'id, codigo_interno, descripcion, modelo, codigo_ean13, precio_actual, ' +
      'categorias!inner(id, nombre), marcas!inner(id, nombre), paises_origen(id, nombre)',
      { count: 'exact' }
    )
    .eq('estado', true)
    .eq('categorias.estado', true)
    .eq('marcas.estado', true);

  if (esUuid(categoriaId)) query = query.eq('categoria_id', categoriaId);
  if (esUuid(marcaId)) query = query.eq('marca_id', marcaId);
  if (esUuid(paisId)) query = query.eq('pais_origen', paisId);

  // Búsqueda: cada palabra debe coincidir (AND) en descripción, modelo, códigos,
  // marca o categoría (OR). Marca y categoría se resuelven contra los maestros en caché.
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

  query = query
    .order(ord.col, { ascending: ord.asc })
    .order('id', { ascending: true }) // desempate estable entre páginas
    .range(desde, desde + limite - 1);

  const { data: filas, count, error } = await query;
  if (error) throw new Error(error.message);

  // Disponibilidad de los artículos de la página (una sola consulta)
  const ids = filas.map((f) => f.id);
  const porArticulo = new Map();
  if (ids.length) {
    const { data: ex, error: errEx } = await db
      .from('existencias')
      .select('articulo_id, cantidad, cantidad_reservada, stock_minimo, depositos!inner(estado)')
      .in('articulo_id', ids)
      .eq('depositos.estado', true);
    if (errEx) throw new Error(errEx.message);
    for (const e of ex) {
      if (!porArticulo.has(e.articulo_id)) porArticulo.set(e.articulo_id, []);
      porArticulo.get(e.articulo_id).push(e);
    }
  }

  const items = filas.map((f) => ({
    id: f.id,
    codigo_interno: f.codigo_interno,
    descripcion: f.descripcion,
    modelo: f.modelo,
    codigo_ean13: f.codigo_ean13,
    precio_actual: Number(f.precio_actual),
    categoria: f.categorias,
    marca: f.marcas,
    pais_origen: f.paises_origen,
    ...calcularDisponibilidad(porArticulo.get(f.id) ?? []),
  }));

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
