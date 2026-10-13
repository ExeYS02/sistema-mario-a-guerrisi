'use client';

import { useState } from 'react';

const LIMITE_LISTA = 8;

export default function CatalogoSidebar({
  filtros,
  maestros,
  onCambiarFiltro,
  onLimpiar,
  hayFiltros,
}) {
  const [expandido, setExpandido] = useState({
    stock: true,
    categoria: true,
    marca: true,
    pais: true,
  });

  const [verMasMarcas, setVerMasMarcas] = useState(false);
  const [verMasPaises, setVerMasPaises] = useState(false);

  const toggleGrupo = (grupo) => {
    setExpandido((prev) => ({ ...prev, [grupo]: !prev[grupo] }));
  };

  const categorias = maestros?.categorias || [];
  const marcas = maestros?.marcas || [];
  const paises = maestros?.paises || [];

  const marcasVisibles = verMasMarcas ? marcas : marcas.slice(0, LIMITE_LISTA);
  const paisesVisibles = verMasPaises ? paises : paises.slice(0, LIMITE_LISTA);

  const stockActual = filtros.stock || 'con';

  return (
    <aside className="catalogo-sidebar" aria-label="Filtros del catálogo">
      <div className="catalogo-sidebar-header">
        <h2 className="sidebar-title">Filtros</h2>
        {hayFiltros && (
          <button
            type="button"
            className="btn-limpiar-link"
            onClick={onLimpiar}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* 1. Disponibilidad */}
      <div className="filter-group">
        <button
          type="button"
          className="filter-group-header"
          aria-expanded={expandido.stock}
          onClick={() => toggleGrupo('stock')}
        >
          <span>Disponibilidad</span>
          <span className={`accordion-icon ${expandido.stock ? 'open' : ''}`}>
            ▾
          </span>
        </button>

        {expandido.stock && (
          <div className="filter-group-body">
            <button
              type="button"
              className={`filter-option ${stockActual === 'con' ? 'active' : ''}`}
              onClick={() => onCambiarFiltro('stock', 'con')}
            >
              <span>Con stock</span>
            </button>
            <button
              type="button"
              className={`filter-option ${stockActual === 'sin' ? 'active' : ''}`}
              onClick={() => onCambiarFiltro('stock', 'sin')}
            >
              <span>Sin stock</span>
            </button>
            <button
              type="button"
              className={`filter-option ${stockActual === 'todos' ? 'active' : ''}`}
              onClick={() => onCambiarFiltro('stock', 'todos')}
            >
              <span>Todos</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Categorías */}
      <div className="filter-group">
        <button
          type="button"
          className="filter-group-header"
          aria-expanded={expandido.categoria}
          onClick={() => toggleGrupo('categoria')}
        >
          <span>Categorías</span>
          <span className={`accordion-icon ${expandido.categoria ? 'open' : ''}`}>
            ▾
          </span>
        </button>

        {expandido.categoria && (
          <div className="filter-group-body">
            <button
              type="button"
              className={`filter-option ${!filtros.categoria ? 'active' : ''}`}
              onClick={() => onCambiarFiltro('categoria', '')}
            >
              <span>Todas</span>
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`filter-option ${filtros.categoria === c.id ? 'active' : ''}`}
                onClick={() => onCambiarFiltro('categoria', c.id)}
              >
                <span>{c.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Marca */}
      <div className="filter-group">
        <button
          type="button"
          className="filter-group-header"
          aria-expanded={expandido.marca}
          onClick={() => toggleGrupo('marca')}
        >
          <span>Marca</span>
          <span className={`accordion-icon ${expandido.marca ? 'open' : ''}`}>
            ▾
          </span>
        </button>

        {expandido.marca && (
          <div className="filter-group-body">
            <button
              type="button"
              className={`filter-option ${!filtros.marca ? 'active' : ''}`}
              onClick={() => onCambiarFiltro('marca', '')}
            >
              <span>Todas</span>
            </button>
            {marcasVisibles.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`filter-option ${filtros.marca === m.id ? 'active' : ''}`}
                onClick={() => onCambiarFiltro('marca', m.id)}
              >
                <span>{m.nombre}</span>
              </button>
            ))}
            {marcas.length > LIMITE_LISTA && (
              <button
                type="button"
                className="btn-ver-mas"
                onClick={() => setVerMasMarcas((prev) => !prev)}
              >
                {verMasMarcas ? 'Ver menos' : `Ver más (${marcas.length - LIMITE_LISTA})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Origen */}
      <div className="filter-group">
        <button
          type="button"
          className="filter-group-header"
          aria-expanded={expandido.pais}
          onClick={() => toggleGrupo('pais')}
        >
          <span>Origen</span>
          <span className={`accordion-icon ${expandido.pais ? 'open' : ''}`}>
            ▾
          </span>
        </button>

        {expandido.pais && (
          <div className="filter-group-body">
            <button
              type="button"
              className={`filter-option ${!filtros.pais ? 'active' : ''}`}
              onClick={() => onCambiarFiltro('pais', '')}
            >
              <span>Todos</span>
            </button>
            {paisesVisibles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`filter-option ${filtros.pais === p.id ? 'active' : ''}`}
                onClick={() => onCambiarFiltro('pais', p.id)}
              >
                <span>{p.nombre}</span>
              </button>
            ))}
            {paises.length > LIMITE_LISTA && (
              <button
                type="button"
                className="btn-ver-mas"
                onClick={() => setVerMasPaises((prev) => !prev)}
              >
                {verMasPaises ? 'Ver menos' : `Ver más (${paises.length - LIMITE_LISTA})`}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}