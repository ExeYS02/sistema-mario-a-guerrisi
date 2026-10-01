// Utilidades de validación y formateo de CUIT (Clave Única de Identificación Tributaria - Argentina)
// Usado por HU-11 (Gestión de Proveedores) para validar el formato exigido por el criterio de aceptación 1.

// Deja solo dígitos
export function limpiarCuit(valor) {
  return String(valor || '').replace(/\D/g, '');
}

// Aplica la máscara XX-XXXXXXXX-X a medida que se escribe
export function formatearCuit(valor) {
  const digits = limpiarCuit(valor).slice(0, 11);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 10);
  const p3 = digits.slice(10, 11);

  let resultado = p1;
  if (p2) resultado += `-${p2}`;
  if (p3) resultado += `-${p3}`;
  return resultado;
}

// Prefijos de tipo de contribuyente reconocidos por AFIP
const PREFIJOS_VALIDOS = ['20', '23', '24', '27', '30', '33', '34'];

// Multiplicadores del algoritmo módulo 11 usado para el dígito verificador del CUIT
const MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Valida el formato argentino de un CUIT (11 dígitos + dígito verificador módulo 11).
 * Devuelve { valido, estado, mensaje } donde estado es uno de:
 * 'vacio' | 'incompleto' | 'invalido' | 'valido'
 */
export function validarCuit(valorCrudo) {
  const digits = limpiarCuit(valorCrudo);

  if (digits.length === 0) {
    return { valido: false, estado: 'vacio', mensaje: '' };
  }

  if (digits.length !== 11) {
    return {
      valido: false,
      estado: 'incompleto',
      mensaje: 'El CUIT debe tener 11 dígitos, con el formato XX-XXXXXXXX-X.',
    };
  }

  if (!PREFIJOS_VALIDOS.includes(digits.slice(0, 2))) {
    return {
      valido: false,
      estado: 'invalido',
      mensaje: 'El prefijo del CUIT no corresponde a un tipo de contribuyente válido (persona física o jurídica).',
    };
  }

  const nums = digits.split('').map(Number);
  const suma = MULTIPLICADORES.reduce((acc, m, i) => acc + m * nums[i], 0);
  const resto = suma % 11;
  let verificadorEsperado = 11 - resto;
  if (verificadorEsperado === 11) verificadorEsperado = 0;

  if (verificadorEsperado === 10 || verificadorEsperado !== nums[10]) {
    return {
      valido: false,
      estado: 'invalido',
      mensaje: 'El dígito verificador no coincide. Revisá el CUIT ingresado.',
    };
  }

  return { valido: true, estado: 'valido', mensaje: 'CUIT válido.' };
}
