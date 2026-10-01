'use client';

// Selects de filtro reutilizados en escritorio (barra) y en móvil (modal).
export function SelectCampo({ etiqueta, valor, onChange, opciones, todas = 'Todas' }) {
  // todas === null -> sin opción vacía (ej. Ordenar)
  return (
    <label className="select-field">
      {etiqueta}:
      <select value={valor} onChange={(e) => onChange(e.target.value)} aria-label={etiqueta}>
        {todas !== null && <option value="">{todas}</option>}
        {opciones.map((o) => (
          <option key={o.id ?? o.valor} value={o.id ?? o.valor}>{o.nombre ?? o.texto}</option>
        ))}
      </select>
    </label>
  );
}

export const OPCIONES_ORDEN = [
  { valor: 'novedades', texto: 'Novedades' },
  { valor: 'precio_asc', texto: 'Menor precio' },
  { valor: 'precio_desc', texto: 'Mayor precio' },
  { valor: 'nombre', texto: 'Nombre (A-Z)' },
];
