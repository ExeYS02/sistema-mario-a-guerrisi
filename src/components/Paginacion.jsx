'use client';

// Paginación con botones del design system. Muestra: 1 … actual-1 actual actual+1 … última
function rangoPaginas(actual, total) {
  const set = new Set([1, total, actual - 1, actual, actual + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('…' + n);
    out.push(n);
  });
  return out;
}

export default function Paginacion({ pagina, totalPaginas, onCambiar }) {
  if (totalPaginas <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginación del catálogo">
      <button type="button" className="btn btn-outline btn-sm" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        Anterior
      </button>
      <div className="pagination-pages">
        {rangoPaginas(pagina, totalPaginas).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="pagination-gap" aria-hidden="true">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${p === pagina ? 'btn-primary' : 'btn-outline'}`}
              aria-current={p === pagina ? 'page' : undefined}
              aria-label={`Página ${p}`}
              onClick={() => onCambiar(p)}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button type="button" className="btn btn-outline btn-sm" disabled={pagina >= totalPaginas} onClick={() => onCambiar(pagina + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
