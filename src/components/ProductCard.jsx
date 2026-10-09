import AutoProductImage from '@/components/AutoProductImage';
import { formatearMonto } from '@/utils/format';

const DISPONIBILIDAD = {
  en_stock: { clase: 'badge-green', texto: () => 'En stock' },
  ultimas: { clase: 'badge-amber', texto: (n) => (n === 1 ? 'Última unidad' : `Últimas ${n} unidades`) },
  sin_stock: { clase: 'badge-red', texto: () => 'Sin stock' },
};

// Tarjeta de producto del catálogo (patrón del design system).
// `onAgregar` es opcional: el botón aparece recién cuando exista el carrito (HU-33).
export default function ProductCard({ articulo, onAgregar }) {
  const disp = DISPONIBILIDAD[articulo.disponibilidad] ?? DISPONIBILIDAD.sin_stock;
  const titulo = articulo.descripcion;
  const consultaImagen = [articulo.marca, articulo.modelo || articulo.descripcion].filter(Boolean).join(' ');

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
        {onAgregar && (
          <div className="product-card-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={articulo.disponibilidad === 'sin_stock'}
              onClick={() => onAgregar(articulo)}
            >
              Agregar al carrito
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card" aria-hidden="true">
      <div className="product-thumb"><div className="skeleton" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} /></div>
      <div className="product-body">
        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
        <div className="skeleton skeleton-text" style={{ width: '85%' }} />
        <div className="skeleton skeleton-text" style={{ width: '55%' }} />
        <div className="skeleton skeleton-text" style={{ width: '35%', height: 18, marginTop: 6 }} />
      </div>
    </div>
  );
}
