// Validación y normalización de los datos de contacto de un cliente.
// Se usa en el servidor (alta y modificación) y en el formulario del carrito,
// así las reglas son las mismas en los dos lados.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[0-9+()\-\s]{6,30}$/;

export const LIMITES_CLIENTE = { nombre: 120, email: 120, direccion: 200 };

// Devuelve { valores, errores }. `valores` ya viene recortado (trim);
// `errores` es un objeto { campo: 'mensaje' } vacío si todo está bien.
export function validarDatosCliente({ razon_social, email, telefono, direccion }) {
  const valores = {
    razon_social: String(razon_social ?? '').trim(),
    email: String(email ?? '').trim(),
    telefono: String(telefono ?? '').trim(),
    direccion: String(direccion ?? '').trim(),
  };
  const errores = {};

  if (!valores.razon_social) errores.razon_social = 'Ingresá tu nombre completo.';
  else if (valores.razon_social.length > LIMITES_CLIENTE.nombre) errores.razon_social = `Máximo ${LIMITES_CLIENTE.nombre} caracteres.`;

  if (valores.email && (!EMAIL_RE.test(valores.email) || valores.email.length > LIMITES_CLIENTE.email)) {
    errores.email = 'El email no es válido.';
  }
  if (valores.telefono && !TEL_RE.test(valores.telefono)) {
    errores.telefono = 'El teléfono no es válido (usá solo números, +, - y paréntesis).';
  }
  if (valores.direccion.length > LIMITES_CLIENTE.direccion) {
    errores.direccion = `Máximo ${LIMITES_CLIENTE.direccion} caracteres.`;
  }
  return { valores, errores };
}
