'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCatalogo } from '@/hooks/useCatalogo';
import { useDebounce } from '@/hooks/useDebounce';
import { obtenerFiltrosCatalogo } from '@/services/catalogoService';
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard';
import Paginacion from '@/components/Paginacion';
import Modal from '@/components/Modal';
import CatalogoSidebar from '@/components/CatalogoSidebar';
import { SelectCampo, OPCIONES_ORDEN } from '@/components/CatalogoFiltros';

function formatearHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function CatalogoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Parámetros de la URL
  const qParam = searchParams.get('q') || '';
  const catParam = searchParams.get('categoria') || '';
  const marcaParam = searchParams.get('marca') || '';
  const paisParam = searchParams.get('pais') || '';
  const stockParam = searchParams.get('stock') || 'con';
  const ordenParam = searchParams.get('orden') || 'novedades';
  const paginaParam = Number(searchParams.get('pagina')) || 1;

  // Búsqueda local con debounce
  const [busqueda, setBusqueda] = useState(qParam);
  const busquedaDebounced = useDebounce(busqueda, 300);

  // Vista Grilla/Lista
  const [vista, setVista] = useState('grilla');

  // Modal para móviles
  const [modalFiltrosAbierto, setModalFiltrosAbierto] = useState(false);

  // Maestros
  const [maestros, setMaestros] = useState({ categorias: [], marcas: [], paises: [] });

  useEffect(() => {
    let cancelado = false;
    obtenerFiltrosCatalogo()
      .then((data) => {
        if (!cancelado) setMaestros(data);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  // Sincronizar input local si la URL cambia por navegación (ej. botón atrás)
  useEffect(() => {
    setBusqueda(qParam);
  }, [qParam]);

  // Actualizador central de URL
  const actualizarUrl = (nuevosParams) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(nuevosParams).forEach(([clave, valor]) => {
      if (valor === '' || valor === null || valor === undefined) {
        params.delete(clave);
      } else if (clave === 'stock' && valor === 'con') {
        params.delete('stock');
      } else if (clave === 'orden' && valor === 'novedades') {
        params.delete('orden');
      } else if (clave === 'pagina' && Number(valor) <= 1) {
        params.delete('pagina');
      } else {
        params.set(clave, String(valor));
      }
    });

    const queryString = params.toString();
    const nuevaUrl = queryString ? `/catalogo?${queryString}` : '/catalogo';

    startTransition(() => {
      router.push(nuevaUrl, { scroll: false });
    });
  };

  // Disparar búsqueda con debounce
  useEffect(() => {
    if (busquedaDebounced !== qParam) {
      actualizarUrl({ q: busquedaDebounced, pagina: 1 });
    }
  }, [busquedaDebounced]);

  const queryCatalogo = {
    q: qParam,
    categoria: catParam,
    marca: marcaParam,
    pais: paisParam,
    stock: stockParam,
    orden: ordenParam,
    pagina: paginaParam,
  };

  const { items, total, pagina, totalPaginas, actualizadoEn, cargando, error, recargar } =
    useCatalogo(queryCatalogo);

  const hayFiltrosActivos =
    Boolean(qParam) ||
    Boolean(catParam) ||
    Boolean(marcaParam) ||
    Boolean(paisParam) ||
    (stockParam && stockParam !== 'con');

  const contadorFiltrosActivos =
    (catParam ? 1 : 0) +
    (marcaParam ? 1 : 0) +
    (paisParam ? 1 : 0) +
    (stockParam && stockParam !== 'con' ? 1 : 0);

  const handleCambiarFiltro = (clave, valor) => {
    actualizarUrl({ [clave]: valor, pagina: 1 });
  };

  const handleLimpiarFiltros = () => {
    setBusqueda('');
    actualizarUrl({
      q: '',
      categoria: '',
      marca: '',
      pais: '',
      stock: 'con',
      pagina: 1,
    });
  };

  const catActiva = maestros.categorias.find((c) => c.id === catParam)?.nombre;
  const marcaActiva = maestros.marcas.find((m) => m.id === marcaParam)?.nombre;
  const paisActivo = maestros.paises.find((p) => p.id === paisParam)?.nombre;

  return (
    <div className="catalogo-container">
      <div className="catalogo-layout">
        {/* Sidebar en escritorio */}
        <div className="catalogo-sidebar-desktop">
          <CatalogoSidebar
            filtros={{
              stock: stockParam,
              categoria: catParam,
              marca: marcaParam,
              pais: paisParam,
            }}
            maestros={maestros}
            onCambiarFiltro={handleCambiarFiltro}
            onLimpiar={handleLimpiarFiltros}
            hayFiltros={hayFiltrosActivos}
          />
        </div>

        {/* Área principal de resultados */}
        <main className="catalogo-main">
          {/* Buscador general */}
          <div className="catalogo-search">
            <input
              type="search"
              className="search-input"
              placeholder="Buscar por instrumento, marca, modelo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar en el catálogo"
            />
          </div>

          {/* Barra superior de herramientas */}
          <div className="catalogo-toolbar">
            <div className="toolbar-left">
              <button
                type="button"
                className="btn btn-outline btn-sm mobile-filter-btn"
                onClick={() => setModalFiltrosAbierto(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filtros {contadorFiltrosActivos > 0 && `(${contadorFiltrosActivos})`}
              </button>

              <div className="results-info">
                <span className="results-count">
                  {cargando ? 'Buscando...' : `${total} ${total === 1 ? 'resultado' : 'resultados'}`}
                </span>
                {actualizadoEn && (
                  <span className="results-updated">
                    Actualizado {formatearHora(actualizadoEn)}
                  </span>
                )}
              </div>
            </div>

            <div className="toolbar-right">
              <SelectCampo
                etiqueta="Ordenar por"
                valor={ordenParam}
                onChange={(v) => handleCambiarFiltro('orden', v)}
                opciones={OPCIONES_ORDEN}
                todas={null}
              />

              <div className="view-toggle" role="group" aria-label="Vista del catálogo">
                <button
                  type="button"
                  className={`toggle-btn ${vista === 'grilla' ? 'active' : ''}`}
                  onClick={() => setVista('grilla')}
                  aria-label="Vista de cuadrícula"
                  title="Grilla"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${vista === 'lista' ? 'active' : ''}`}
                  onClick={() => setVista('lista')}
                  aria-label="Vista de lista"
                  title="Lista"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Chips de filtros activos */}
          {hayFiltrosActivos && (
            <div className="active-chips">
              {qParam && (
                <span className="chip">
                  Búsqueda: {qParam}
                  <button type="button" className="chip-remove" onClick={() => { setBusqueda(''); handleCambiarFiltro('q', ''); }} aria-label="Quitar filtro búsqueda">✕</button>
                </span>
              )}
              {stockParam && stockParam !== 'con' && (
                <span className="chip">
                  Disponibilidad: {stockParam === 'sin' ? 'Sin stock' : 'Todos'}
                  <button type="button" className="chip-remove" onClick={() => handleCambiarFiltro('stock', 'con')} aria-label="Quitar filtro disponibilidad">✕</button>
                </span>
              )}
              {catActiva && (
                <span className="chip">
                  Categoría: {catActiva}
                  <button type="button" className="chip-remove" onClick={() => handleCambiarFiltro('categoria', '')} aria-label="Quitar filtro categoría">✕</button>
                </span>
              )}
              {marcaActiva && (
                <span className="chip">
                  Marca: {marcaActiva}
                  <button type="button" className="chip-remove" onClick={() => handleCambiarFiltro('categoria', '')} aria-label="Quitar filtro marca">✕</button>
                </span>
              )}
              {paisActivo && (
                <span className="chip">
                  Origen: {paisActivo}
                  <button type="button" className="chip-remove" onClick={() => handleCambiarFiltro('pais', '')} aria-label="Quitar filtro origen">✕</button>
                </span>
              )}
              <button type="button" className="btn-limpiar-chips" onClick={handleLimpiarFiltros}>
                Limpiar todos
              </button>
            </div>
          )}

          {/* Cartel de error */}
          {error && (
            <div className="error-box">
              <p>{error}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={recargar}>
                Reintentar
              </button>
            </div>
          )}

          {/* Grilla / Lista de productos */}
          <div className={vista === 'lista' ? 'product-list' : 'product-grid'}>
            {cargando
              ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : items.map((art) => <ProductCard key={art.id} articulo={art} />)}
          </div>

          {/* Estado vacío */}
          {!cargando && !error && items.length === 0 && (
            <div className="empty-catalog">
              <p className="empty-title">No encontramos instrumentos con los filtros seleccionados.</p>
              {stockParam === 'con' && (
                <div className="empty-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleCambiarFiltro('stock', 'todos')}
                  >
                    Ver también los sin stock
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Paginación */}
          {!cargando && totalPaginas > 1 && (
            <Paginacion
              pagina={pagina}
              totalPaginas={totalPaginas}
              onCambiar={(p) => handleCambiarFiltro('pagina', p)}
            />
          )}
        </main>
      </div>

      {/* Modal responsivo de filtros en móviles */}
      <Modal
        isOpen={modalFiltrosAbierto}
        onClose={() => setModalFiltrosAbierto(false)}
        title="Filtros del catálogo"
      >
        <CatalogoSidebar
          filtros={{
            stock: stockParam,
            categoria: catParam,
            marca: marcaParam,
            pais: paisParam,
          }}
          maestros={maestros}
          onCambiarFiltro={(k, v) => handleCambiarFiltro(k, v)}
          onLimpiar={handleLimpiarFiltros}
          hayFiltros={hayFiltrosActivos}
        />
        <div className="modal-apply-wrapper">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => setModalFiltrosAbierto(false)}
          >
            Ver {total} resultados
          </button>
        </div>
      </Modal>
    </div>
  );
}