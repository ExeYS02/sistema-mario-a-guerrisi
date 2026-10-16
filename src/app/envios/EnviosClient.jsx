'use client';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiFetchAuth } from '@/services/apiClient';
import { formatearFecha } from '@/utils/format';

const BADGE_ESTADO = {
  'Pendiente': 'badge-amber',
  'En Camino': 'badge-blue',
  'Entregado': 'badge-green',
  'Cancelado': 'badge-red',
};

const TABS = [
  { id: 'todos', label: 'Todos', coincide: () => true },
  { id: 'curso', label: 'En curso', coincide: (e) => e.estado === 'Pendiente' || e.estado === 'En Camino' },
  { id: 'entregados', label: 'Entregados', coincide: (e) => e.estado === 'Entregado' },
  { id: 'cancelados', label: 'Cancelados', coincide: (e) => e.estado === 'Cancelado' },
];

// 'YYYY-MM-DD' se interpreta como UTC y en Argentina mostraría el día anterior,
// por eso las fechas "date" se formatean a mano.
function formatearFechaDate(valor) {
  if (!valor) return '—';
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [anio, mes, dia] = texto.split('-');
    return `${dia}/${mes}/${anio}`;
  }
  return formatearFecha(texto);
}

function llegadaEstimada(envio) {
  if (envio.estado === 'Cancelado' || envio.estado === 'Entregado') return '—';
  if (envio.fecha_estimada) return formatearFechaDate(envio.fecha_estimada);
  const base = new Date(envio.fecha_hora_registro);
  if (Number.isNaN(base.getTime())) return '—';
  base.setDate(base.getDate() + (envio.tipo === 'retiro' ? 1 : 7));
  return formatearFecha(base.toISOString());
}

function etiquetaTipo(tipo) {
  return tipo === 'retiro' ? 'Retiro en sucursal' : 'Envío a domicilio';
}

function resumenProductos(envio) {
  const items = envio.envios_detalle || [];
  if (items.length === 0) return { principal: '—', extra: '' };
  const principal = items[0].articulos?.descripcion || 'Artículo';
  const extra = items.length > 1 ? `+${items.length - 1} más` : `${items[0].cantidad} unidad${items[0].cantidad === 1 ? '' : 'es'}`;
  return { principal, extra };
}

function IconoCaja() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  );
}

function IconoLupa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconoChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function EstadoBadge({ estado }) {
  return (
    <span className={`badge ${BADGE_ESTADO[estado] || 'badge-gray'}`}>
      <span className="badge-dot"></span>
      {estado}
    </span>
  );
}

function DetalleArticulos({ envio }) {
  const items = envio.envios_detalle || [];
  return (
    <ul className="envio-detalle-list">
      {items.map((det, i) => (
        <li key={i}>
          <span className="envio-qty">{det.cantidad}x</span>
          <span>{det.articulos?.descripcion || 'Artículo'}</span>
        </li>
      ))}
    </ul>
  );
}

export default function EnviosClient() {
  const { cliente, isHydrated, abrirLogin } = useAuth();
  const [envios, setEnvios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(() => {
    if (!cliente) return;
    setLoading(true);
    setError('');
    apiFetchAuth('/envios', cliente.id)
      .then((data) => setEnvios(Array.isArray(data) ? data : (data?.envios ?? [])))
      .catch((err) => setError(err.message || 'No pudimos cargar tus envíos.'))
      .finally(() => setLoading(false));
  }, [cliente]);

  useEffect(() => {
    if (isHydrated && cliente) {
      cargar();
    } else {
      setEnvios([]);
    }
  }, [isHydrated, cliente, cargar]);

  const contadores = useMemo(() => {
    const resultado = {};
    TABS.forEach((t) => {
      resultado[t.id] = envios.filter(t.coincide).length;
    });
    return resultado;
  }, [envios]);

  const visibles = useMemo(() => {
    const tabActiva = TABS.find((t) => t.id === tab) || TABS[0];
    const texto = busqueda.trim().toLowerCase();
    return envios
      .filter(tabActiva.coincide)
      .filter((e) => {
        if (!texto) return true;
        const comprobante = (e.ventas?.numero_comprobante || '').toLowerCase();
        const productos = (e.envios_detalle || [])
          .map((d) => (d.articulos?.descripcion || '').toLowerCase())
          .join(' ');
        return comprobante.includes(texto) || productos.includes(texto);
      });
  }, [envios, tab, busqueda]);

  const limpiarFiltros = () => {
    setTab('todos');
    setBusqueda('');
  };

  if (!isHydrated) return null;

  if (!cliente) {
    return (
      <div className="empty-state">
        <IconoCaja />
        <h2>Ingresá para ver tus envíos</h2>
        <p>Necesitamos saber quién sos para mostrarte el estado de tus compras y retiros.</p>
        <button className="btn btn-primary" onClick={abrirLogin} style={{ marginTop: 8 }}>
          Ingresar
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <IconoCaja />
        <h2 style={{ color: 'var(--crit)' }}>No pudimos cargar tus envíos</h2>
        <p>{error}</p>
        <button className="btn btn-outline" onClick={cargar} style={{ marginTop: 8 }}>
          Reintentar
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="table-panel" aria-busy="true">
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  if (envios.length === 0) {
    return (
      <div className="empty-state">
        <IconoCaja />
        <h2>Todavía no tenés envíos</h2>
        <p>Cuando hagas una compra, vas a poder seguir su estado desde acá.</p>
        <Link href="/catalogo" className="btn btn-primary" style={{ marginTop: 8 }}>
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-rail envios-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="tab-btn-badge">{contadores[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="catalog-toolbar" style={{ marginBottom: 14 }}>
        <div className="search-input">
          <IconoLupa />
          <input
            type="text"
            placeholder="Buscar por comprobante o producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar envíos"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="empty-state">
          <IconoCaja />
          <h2>No encontramos envíos</h2>
          <p>Ningún envío coincide con los filtros seleccionados.</p>
          <button className="btn btn-outline" onClick={limpiarFiltros} style={{ marginTop: 8 }}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          <p className="envios-resumen">
            {visibles.length} envío{visibles.length === 1 ? '' : 's'}
          </p>

          {/* Desktop: grilla */}
          <div className="table-panel envios-table-wrap">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>Comprobante</th>
                    <th>Productos</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Llegada estimada</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((envio) => {
                    const { principal, extra } = resumenProductos(envio);
                    const expandido = abierto === envio.id;
                    return (
                      <Fragment key={envio.id}>
                        <tr>
                          <td>
                            <button
                              className={`icon-btn envio-chevron ${expandido ? 'open' : ''}`}
                              aria-label={expandido ? 'Ocultar artículos' : 'Ver artículos'}
                              aria-expanded={expandido}
                              onClick={() => setAbierto(expandido ? null : envio.id)}
                            >
                              <IconoChevron />
                            </button>
                          </td>
                          <td className="cell-mono">
                            {envio.ventas?.numero_comprobante || 'Procesando'}
                          </td>
                          <td className="cell-strong">
                            {principal}
                            <div className="cell-sub">{extra}</div>
                          </td>
                          <td>{etiquetaTipo(envio.tipo)}</td>
                          <td className="envio-fecha">{formatearFecha(envio.fecha_hora_registro)}</td>
                          <td className="envio-fecha">{llegadaEstimada(envio)}</td>
                          <td><EstadoBadge estado={envio.estado} /></td>
                        </tr>
                        {expandido && (
                          <tr className="envio-detalle-row">
                            <td colSpan={7}>
                              <DetalleArticulos envio={envio} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: tarjetas apiladas */}
          <div className="envios-cards">
            {visibles.map((envio) => (
              <div key={envio.id} className="envio-card">
                <div className="envio-card-top">
                  <span className="cell-mono">{envio.ventas?.numero_comprobante || 'Procesando'}</span>
                  <EstadoBadge estado={envio.estado} />
                </div>
                <div className="envio-card-meta">
                  <span>{etiquetaTipo(envio.tipo)}</span>
                  <span className="envio-fecha">{formatearFecha(envio.fecha_hora_registro)}</span>
                </div>
                <DetalleArticulos envio={envio} />
                <div className="envio-card-llegada">
                  <span>Llegada estimada</span>
                  <strong className="envio-fecha">{llegadaEstimada(envio)}</strong>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}