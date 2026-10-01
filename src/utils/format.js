// Helpers de formato compartidos por las páginas de Compras/Tesorería
// (HU-11, HU-12, HU-14, HU-23, HU-24). Centralizados acá para no repetir la
// misma función en cada page como pasaba antes de HU-12.

export function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatearFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatearFecha(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatearMonto(valor) {
  return `$${Number(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Input type="date" trabaja en formato YYYY-MM-DD; los ISO de Postgres
// (timestamp o date) hay que recortarlos para poder precargarlos en un input.
export function isoToInputDate(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

export function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
