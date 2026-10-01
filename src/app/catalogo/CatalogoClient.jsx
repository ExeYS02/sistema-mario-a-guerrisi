'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard';
import Paginacion from '@/components/Paginacion';
import { SelectCampo, OPCIONES_ORDEN } from '@/components/CatalogoFiltros';
import { useCatalogo, useEnLinea } from '@/hooks/useCatalogo';
import { useDebounce } from '@/hooks/useDebounce';
import { obtenerFiltrosCatalogo } from '@/services/catalogoService';

const ORDENES = OPCIONES_ORDEN.map((o) => o.valor);

export default function CatalogoClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const enLinea = useEnLinea();

  // ---- Estado en la URL (se puede compartir, y "atrás" funciona) ----
  const qUrl = searchParams.get('q') ?? '';
  const params = useMemo(() => {
    const orden = searchParams.get('orden');
    return {
      q: searchParams.get('q') ?? '',
      categoria: searchParams.get('categoria') ?? '',
      marca: searchParams.get('marca') ?? '',
      pais: searchParams.get('pais') ?? '',
      orden: ORDENES.includes(orden) ? orden : 'novedades',
      pagina: Math.max(parseInt(searchParams.get('pagina') ?? '1', 10) || 1, 1),
    };
  }, [searchParams]);

  const actualizar = (cambios, { push = false } = {}) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(cambios).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    if (!('pagina' in cambios)) sp.delete('pagina'); // al cambiar filtros se vuelve a la página 1
    const url = sp.toString() ? `${pathname}?${sp}` : pathname;
    (push ? router.push : router.replace)(url, { scroll: push });
  };

  // ---- Búsqueda con debounce (menos pedidos, resultados más rápidos) ----
  const [texto, setTexto] = useState(qUrl);
  const textoDebounced = useDebounce(texto, 300);
  const ultimoQ = useRef(qUrl);
  useEffect(() => {
    if (textoDebounced.trim() === ultimoQ.current) return;
    ultimoQ.current = textoDebounced.trim();
    actualizar({ q: textoDebounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoDebounced]);
  // Si la URL cambia desde afuera (botón "atrás", limpiar filtros), se refleja en el input
  useEffect(() => {
    if (qUrl !== ultimoQ.current) { ultimoQ.current = qUrl; setTexto(qUrl); }
  }, [qUrl]);

  // ---- Datos ----
  const { items, total, totalPaginas, actualizadoEn, cargando, error, recargar } = useCatalogo(params);
  const [maestros, setMaestros] = useState({ categorias: [], marcas: [], paises: [] });
  useEffect(() => {
    obtenerFiltrosCatalogo().then(setMaestros).catch(() => {});
  }, []);

  // ---- UI ----
  const [vista, setVista] = useState('grilla');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const filtrosActivos = [params.marca, params.pais, params.categoria].filter(Boolean).length;
  const hayFiltros = filtrosActivos > 0 || params.q || params.orden !== 'novedades';

  const limpiar = () => { setTexto(''); ultimoQ.current = ''; router.replace(pathname, { scroll: false }); };
  const horaAct = actualizadoEn ? new Date(actualizadoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

  const selectores = (
    <>
      <SelectCampo etiqueta="Marca" valor={params.marca} onChange={(v) => actualizar({ marca: v })} opciones={maestros.marcas} />
      <SelectCampo etiqueta="Origen" valor={params.pais} onChange={(v) => actualizar({ pais: v })} opciones={maestros.paises} />
      <SelectCampo etiqueta="Ordenar" valor={params.orden} onChange={(v) => actualizar({ orden: v === 'novedades' ? '' : v })} opciones={OPCIONES_ORDEN} todas={null} />
    </>
  );

  return (
    <div className="store-container page-transition">
      <h1 className="store-title">Catálogo</h1>
      <p className="store-subtitle">Instrumentos y accesorios con disponibilidad actualizada.</p>

      {!enLinea && (
        <div className="modal-notice" role="status" style={{ marginBottom: 14 }}>
          Sin conexión. Te mostramos el último catálogo guardado: precios y disponibilidad pueden haber cambiado.
        </div>
      )}

      {/* Barra de herramientas */}
      <div className="catalog-toolbar">
        <div className="search-input">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            inputMode="search"
            placeholder="Buscar por nombre, marca, modelo o código…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar productos"
          />
        </div>

        <div className="filtros-desktop">{selectores}</div>

        <button type="button" className="btn btn-outline filtros-movil-btn" onClick={() => setFiltrosAbiertos(true)}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filtros{filtrosActivos > 0 && <span className="count-badge">{filtrosActivos}</span>}
        </button>

        <div className="view-toggle" role="group" aria-label="Tipo de vista">
          <button type="button" className={vista === 'grilla' ? 'active' : ''} onClick={() => setVista('grilla')} aria-pressed={vista === 'grilla'}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            <span className="view-toggle-label">Grilla</span>
          </button>
          <button type="button" className={vista === 'lista' ? 'active' : ''} onClick={() => setVista('lista')} aria-pressed={vista === 'lista'}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span className="view-toggle-label">Lista</span>
          </button>
        </div>
      </div>

      {/* Categorías */}
      {maestros.categorias.length > 0 && (
        <div className="category-rail" role="group" aria-label="Categorías">
          <button type="button" className={`category-chip ${!params.categoria ? 'active' : ''}`} onClick={() => actualizar({ categoria: '' })}>Todas</button>
          {maestros.categorias.map((c) => (
            <button key={c.id} type="button" className={`category-chip ${params.categoria === c.id ? 'active' : ''}`} onClick={() => actualizar({ categoria: c.id })}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Resumen de resultados */}
      <div className="results-summary" aria-live="polite">
        <span>{cargando ? 'Buscando…' : `${total} ${total === 1 ? 'producto' : 'productos'}`}</span>
        {horaAct && !cargando && !error && <span className="results-updated">Actualizado {horaAct}</span>}
      </div>

      {/* Resultados */}
      {error ? (
        <div className="empty-state" role="alert">
          <h2>No pudimos cargar el catálogo</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-primary" onClick={recargar}>Reintentar</button>
        </div>
      ) : cargando ? (
        <div className={`product-grid ${vista === 'lista' ? 'is-list' : ''}`}>
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>No encontramos productos</h2>
          <p>Probá con otras palabras o quitá algún filtro.</p>
          {hayFiltros && <button type="button" className="btn btn-outline" onClick={limpiar}>Limpiar filtros</button>}
        </div>
      ) : (
        <div className={`product-grid ${vista === 'lista' ? 'is-list' : ''}`}>
          {items.map((a) => <ProductCard key={a.id} articulo={a} />)}
        </div>
      )}

      {!cargando && !error && (
        <Paginacion pagina={params.pagina} totalPaginas={totalPaginas} onCambiar={(p) => actualizar({ pagina: p > 1 ? String(p) : '' }, { push: true })} />
      )}

      {/* Filtros en móvil (Modal del design system) */}
      <Modal
        isOpen={filtrosAbiertos}
        onClose={() => setFiltrosAbiertos(false)}
        title="Filtros"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => { limpiar(); setFiltrosAbiertos(false); }}>Limpiar</button>
            <button type="button" className="btn btn-primary" onClick={() => setFiltrosAbiertos(false)}>Ver {total} {total === 1 ? 'resultado' : 'resultados'}</button>
          </>
        }
      >
        <div className="filtros-modal">{selectores}</div>
      </Modal>
    </div>
  );
}
