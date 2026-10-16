import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { mapArticuloFromApi } from '@/services/catalogoService';

function mezclarArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function mapearFilaApi(f) {
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
}

export async function obtenerDatosLanding() {
  const db = getSupabaseAdmin();

  let preferidos = [];
  let imperdibles = [];
  let estrella = [];
  let marcas = [];

  const [resCatalogo, resVentas, resMarcas] = await Promise.allSettled([
    db
      .from('v_articulos_catalogo')
      .select(`
        id, codigo_interno, descripcion, modelo, codigo_ean13, precio_actual, disponible, stock_minimo_total, fecha_hora_registro,
        categorias!inner(id, nombre), marcas!inner(id, nombre), paises_origen(id, nombre)
      `)
      .eq('estado', true)
      .eq('categorias.estado', true)
      .eq('marcas.estado', true)
      .gt('disponible', 0),
    db.from('v_articulos_mas_vendidos').select('articulo_id, total_vendido'),
    db
      .from('marcas')
      .select('id, nombre, articulos!inner(id, estado)')
      .eq('estado', true)
      .eq('articulos.estado', true)
      .order('nombre', { ascending: true }),
  ]);

  const articulosConStock = resCatalogo.status === 'fulfilled' && !resCatalogo.value.error ? resCatalogo.value.data || [] : [];
  if (resCatalogo.status === 'rejected' || resCatalogo.value?.error) {
    const errorReal = resCatalogo.reason || resCatalogo.value?.error;
    console.error('Error obteniendo productos con stock:', typeof errorReal === 'object' ? JSON.stringify(errorReal, null, 2) : errorReal);
  }

  const mapaVentas = new Map();
  if (resVentas.status === 'fulfilled' && !resVentas.value.error) {
    (resVentas.value.data || []).forEach((v) => mapaVentas.set(v.articulo_id, v.total_vendido || 0));
  } else {
    const errorVentas = resVentas.reason || resVentas.value?.error;
    console.error('Error obteniendo ranking de ventas:', typeof errorVentas === 'object' ? JSON.stringify(errorVentas, null, 2) : errorVentas);
  }

  // 1. PREFERIDOS (Top vendidos confirmados real, completado con azar si falta)
  if (articulosConStock.length > 0) {
    const copiaPref = [...articulosConStock];
    copiaPref.sort((a, b) => (mapaVentas.get(b.id) || 0) - (mapaVentas.get(a.id) || 0));

    let seleccionadosPref = copiaPref.slice(0, 10);
    if (seleccionadosPref.length < 10) {
      const idsPref = new Set(seleccionadosPref.map((x) => x.id));
      const sobrantes = articulosConStock.filter((x) => !idsPref.has(x.id));
      seleccionadosPref = [...seleccionadosPref, ...mezclarArray(sobrantes).slice(0, 10 - seleccionadosPref.length)];
    }

    if (seleccionadosPref.length >= 3) {
      preferidos = seleccionadosPref.map(mapearFilaApi).map(mapArticuloFromApi);
    }
  }

  const idsPreferidos = new Set(preferidos.map((p) => p.id));

  // 2. IMPERDIBLES (Novedades por fecha_hora_registro desc, excluyendo Preferidos)
  if (articulosConStock.length > 0) {
    const copiaImp = articulosConStock.filter((a) => !idsPreferidos.has(a.id));
    copiaImp.sort((a, b) => new Date(b.fecha_hora_registro) - new Date(a.fecha_hora_registro));

    const seleccionadosImp = copiaImp.slice(0, 10);
    if (seleccionadosImp.length >= 3) {
      imperdibles = seleccionadosImp.map(mapearFilaApi).map(mapArticuloFromApi);
    }
  }

  const idsExcluidosEstrella = new Set([
    ...preferidos.map((p) => p.id),
    ...imperdibles.map((i) => i.id),
  ]);

  // 3. ESTRELLA (Al azar entre los restantes con stock)
  if (articulosConStock.length > 0) {
    const candidatosEstrella = articulosConStock.filter((a) => !idsExcluidosEstrella.has(a.id));
    const seleccionadosEstrella = mezclarArray(candidatosEstrella).slice(0, 10);

    if (seleccionadosEstrella.length >= 3) {
      estrella = seleccionadosEstrella.map(mapearFilaApi).map(mapArticuloFromApi);
    }
  }

  // 4. MARCAS (Marcas activas que tengan artículos activos)
  if (resMarcas.status === 'fulfilled' && !resMarcas.value.error) {
    const marcasMap = new Map();
    (resMarcas.value.data || []).forEach((m) => {
      if (!marcasMap.has(m.id)) {
        marcasMap.set(m.id, { id: m.id, nombre: m.nombre });
      }
    });
    marcas = Array.from(marcasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else {
    const errorMarcas = resMarcas.reason || resMarcas.value?.error;
    console.error('Error obteniendo carrusel de marcas:', typeof errorMarcas === 'object' ? JSON.stringify(errorMarcas, null, 2) : errorMarcas);
  }

  return {
    estrella,
    imperdibles,
    preferidos,
    marcas,
  };
}