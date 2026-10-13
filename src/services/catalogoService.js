import { apiFetch } from '@/services/apiClient';

const UNIDAD_SIN_MODELO = 'Sin especificar';

function mapArticuloFromApi(a) {
  return {
    id: a.id,
    codigoInterno: a.codigo_interno,
    descripcion: a.descripcion,
    modelo: a.modelo && a.modelo !== UNIDAD_SIN_MODELO ? a.modelo : '',
    codigoEan13: a.codigo_ean13,
    precio: a.precio_actual,
    categoria: a.categoria?.nombre ?? '',
    categoriaId: a.categoria?.id ?? null,
    marca: a.marca?.nombre ?? '',
    marcaId: a.marca?.id ?? null,
    paisOrigen: a.pais_origen?.nombre ?? '',
    disponibilidad: a.disponibilidad,
    unidadesDisponibles: a.unidades_disponibles,
  };
}

export async function obtenerCatalogo(params, { signal } = {}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.categoria) sp.set('categoria', params.categoria);
  if (params.marca) sp.set('marca', params.marca);
  if (params.pais) sp.set('pais', params.pais);
  if (params.orden) sp.set('orden', params.orden);
  if (params.stock && params.stock !== 'con') sp.set('stock', params.stock);
  if (params.pagina > 1) sp.set('pagina', String(params.pagina));

  const json = await apiFetch(`/catalogo?${sp.toString()}`, { signal });
  return {
    items: json.items.map(mapArticuloFromApi),
    total: json.total,
    pagina: json.pagina,
    porPagina: json.por_pagina,
    totalPaginas: json.total_paginas,
    actualizadoEn: json.actualizado_en,
  };
}

export async function obtenerFiltrosCatalogo({ signal } = {}) {
  return apiFetch('/catalogo/filtros', { signal });
}