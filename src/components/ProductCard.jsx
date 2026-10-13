'use client';

import { useState } from 'react';
import AutoProductImage from '@/components/AutoProductImage';
import { formatearMonto } from '@/utils/format';
import { useCart } from '@/context/CartContext';

const DISPONIBILIDAD = {
  en_stock: { clase: 'badge-green', texto: () => 'En stock' },
  ultimas: { clase: 'badge-amber', texto: (n) => (n === 1 ? 'Última unidad' : `Últimas ${n} unidades`) },
  sin_stock: { clase: 'badge-red', texto: () => 'Sin stock' },
};

export default function ProductCard({ articulo }) {
  const { carrito, agregarAlCarrito, modificarCantidad, eliminarDelCarrito } = useCart();
  const [agregadoReciente, setAgregadoReciente] = useState(false);

  const disp = DISPONIBILIDAD[articulo.disponibilidad] ?? DISPONIBILIDAD.sin_stock;
  const titulo = articulo.descripcion;
  const consultaImagen = [articulo.marca, articulo.modelo || articulo.descripcion].filter(Boolean).join(' ');

  const itemEnCarrito = carrito.find((i) => i.id === articulo.id);
  const cantidadEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;

  const esSinStock = articulo.disponibilidad === 'sin_stock';
  const esUltimas = articulo.disponibilidad === 'ultimas';
  const topeAlcanzado = esUltimas && cantidadEnCarrito >= articulo.unidadesDisponibles;

  const handleAgregar = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (esSinStock) return;
    agregarAlCarrito(articulo);
    setAgregadoReciente(true);
    setTimeout(() => {
      setAgregadoReciente(false);
    }, 1500);
  };

  const handleDecrementar = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (cantidadEnCarrito <= 1) {
      eliminarDelCarrito(articulo.id);
    } else {
      modificarCantidad(articulo.id, cantidadEnCarrito - 1);
    }
  };

  const handleIncrementar = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (topeAlcanzado) return;
    modificarCantidad(articulo.id, cantidadEnCarrito + 1);
  };

  return (
    <article className="product-card">
      <div className="product-thumb">
        {articulo.categoria && <span className="thumb-tag">{articulo.categoria}</span>}
        <AutoProductImage query={consultaImagen} alt={`${articulo.marca} ${titulo}`} />
      </div>
      <div className="product-body">
        <div className="product-brand">{articulo.marca}</div>
        <h2 className="product-name line-clamp-2">{titulo}</h2>
        {articulo.modelo && <div className="product-model">Modelo {articulo.modelo}</div>}
        <div className="product-meta-row">
          <span className="product-price">{formatearMonto(articulo.precio)}</span>
          <span className={`badge ${disp.clase}`}>
            <span className="badge-dot"></span>
            {disp.texto(articulo.unidadesDisponibles)}
          </span>
        </div>

        <div className="product-card-actions" onClick={(e) => e.stopPropagation()}>
          {cantidadEnCarrito > 0 ? (
            <div className="qty-selector" aria-label={`Cantidad de ${titulo} en el carrito`}>
              <button
                type="button"
                className="qty-btn"
                onClick={handleDecrementar}
                aria-label="Disminuir cantidad"
              >
                −
              </button>
              <span className="qty-val">{cantidadEnCarrito}</span>
              <button
                type="button"
                className="qty-btn"
                onClick={handleIncrementar}
                disabled={topeAlcanzado}
                title={topeAlcanzado ? `Máximo disponible (${articulo.unidadesDisponibles})` : 'Aumentar cantidad'}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`btn btn-sm ${agregadoReciente ? 'btn-success' : 'btn-primary'}`}
              disabled={esSinStock}
              onClick={handleAgregar}
              aria-live="polite"
            >
              {esSinStock ? 'Sin stock' : agregadoReciente ? '¡Agregado!' : 'Agregar al carrito'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card" aria-hidden="true">
      <div className="product-thumb">
        <div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
      </div>
      <div className="product-body">
        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
        <div className="skeleton skeleton-text" style={{ width: '85%' }} />
        <div className="skeleton skeleton-text" style={{ width: '55%' }} />
        <div className="skeleton skeleton-text" style={{ width: '35%', height: 18, marginTop: 6 }} />
      </div>
    </div>
  );
}