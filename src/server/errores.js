import 'server-only';

// En desarrollo se devuelve el motivo real del error para poder diagnosticar;
// en producción solo el mensaje amable (el detalle queda en el log del servidor).
export function mensajeError(amable, err) {
  return process.env.NODE_ENV === 'production' ? amable : `${amable} [${err.message}]`;
}
