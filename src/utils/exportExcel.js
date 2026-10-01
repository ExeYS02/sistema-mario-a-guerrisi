import XLSX from 'xlsx-js-style';

/**
 * Genera un archivo Excel con formato de tabla profesional, bordes y estilos visuales
 * @param {Array<Object>} items - Lista de artículos formateados
 * @param {string} fileName - Nombre del archivo a descargar
 */
export const exportToExcel = (items, fileName = 'Reporte_Reposicion.xlsx') => {
  if (!items || items.length === 0) {
    throw new Error('No hay datos para exportar.');
  }

  const today = new Date();
  const fechaFormateada = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  const totalActual = items.reduce((acc, curr) => acc + (Number(curr.stockActual) || 0), 0);
  const totalSugerido = items.reduce((acc, curr) => acc + (Number(curr.sugerido) || 0), 0);

  // Paleta de estilos
  const borderThin = {
    top: { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
    left: { style: 'thin', color: { rgb: 'D1D5DB' } },
    right: { style: 'thin', color: { rgb: 'D1D5DB' } },
  };

  const styleTitle = {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '991B1B' } }, // Rojo institucional
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };

  const styleSub = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '4B5563' } },
    alignment: { vertical: 'center' },
  };

  const styleHeader = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F2937' } }, // Gris grafito
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: borderThin,
  };

  const styleCell = (isZebra, align = 'left', isCrit = false) => ({
    font: { 
      name: 'Calibri', 
      sz: 10, 
      bold: isCrit, 
      color: { rgb: isCrit ? '991B1B' : '111827' } 
    },
    fill: { fgColor: { rgb: isCrit ? 'FEE2E2' : isZebra ? 'F9FAFB' : 'FFFFFF' } },
    alignment: { vertical: 'center', horizontal: align },
    border: borderThin,
  });

  const styleTotal = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '111827' } },
    fill: { fgColor: { rgb: 'E5E7EB' } },
    alignment: { vertical: 'center', horizontal: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '9CA3AF' } },
      bottom: { style: 'double', color: { rgb: '111827' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } },
    },
  };

  // Matriz de celdas
  const wsData = [
    // Fila 0: Membrete de la empresa
    [
      { v: '  MARIO A. GUERRISI - INSTRUMENTOS MUSICALES', s: styleTitle },
      { v: '', s: styleTitle },
      { v: '', s: styleTitle },
      { v: '', s: styleTitle },
      { v: '', s: styleTitle },
      { v: '', s: styleTitle },
      { v: '', s: styleTitle },
      { v: '', s: styleTitle },
    ],
    // Fila 1: Título del informe
    [
      { v: 'INFORME DE REPOSICIÓN DE STOCK Y PRODUCTOS CRÍTICOS', s: styleSub },
      '', '', '', '', '', '',
    ],
    // Fila 2: Metadatos
    [
      { v: `Fecha de emisión: ${fechaFormateada}`, s: { font: { sz: 9, italic: true, color: { rgb: '6B7280' } } } },
      '', '', '', '', '',
      { v: `Total de ítems: ${items.length}`, s: { font: { sz: 9, bold: true, color: { rgb: '374151' } }, alignment: { horizontal: 'right' } } },
      '',
    ],
    // Fila 3: Espacio
    [],
    // Fila 4: Encabezados de tabla
    [
      { v: 'CÓDIGO', s: styleHeader },
      { v: 'PRODUCTO / ARTÍCULO', s: styleHeader },
      { v: 'STOCK ACTUAL', s: styleHeader },
      { v: 'MÍNIMO', s: styleHeader },
      { v: 'MÁXIMO', s: styleHeader },
      { v: 'REPOSICIÓN SUGERIDA', s: styleHeader },
      { v: 'DEPÓSITO / ALCANCE', s: styleHeader },
      { v: 'PRIORIDAD', s: styleHeader },
    ],
  ];

  // Filas de datos
  items.forEach((item, idx) => {
    const isZebra = idx % 2 === 1;
    const isCrit = item.prioridad === 'Crítico';

    wsData.push([
      { v: item.codigo, s: styleCell(isZebra, 'center') },
      { v: item.nombre, s: styleCell(isZebra, 'left') },
      { v: item.stockActual, s: styleCell(isZebra, 'right') },
      { v: item.stockMin, s: styleCell(isZebra, 'right') },
      { v: item.stockMax, s: styleCell(isZebra, 'right') },
      { v: item.sugerido, s: styleCell(isZebra, 'right', isCrit) },
      { v: item.deposito, s: styleCell(isZebra, 'left') },
      { v: item.prioridad, s: styleCell(isZebra, 'center', isCrit) },
    ]);
  });

  // Fila de separación y fila de totales
  wsData.push([]);
  wsData.push([
    { v: 'TOTALES CONSOLIDADOS', s: styleTotal },
    { v: '', s: styleTotal },
    { v: totalActual, s: { ...styleTotal, alignment: { horizontal: 'right' } } },
    { v: '', s: styleTotal },
    { v: '', s: styleTotal },
    { v: totalSugerido, s: { ...styleTotal, alignment: { horizontal: 'right' } } },
    { v: '', s: styleTotal },
    { v: '', s: styleTotal },
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Combinación de celdas (Merges)
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Título banner
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Subtítulo
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }, // Fecha
    { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } }, // Cantidad de ítems
    { s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 1 } }, // 'TOTALES' ocupa cols 0 y 1
  ];

  // Ancho óptimo de columnas
  worksheet['!cols'] = [
    { wch: 18 }, // Código
    { wch: 45 }, // Producto
    { wch: 16 }, // Stock Actual
    { wch: 14 }, // Mínimo
    { wch: 14 }, // Máximo
    { wch: 22 }, // Reposición Sugerida
    { wch: 22 }, // Depósito
    { wch: 16 }, // Prioridad
  ];

  // Altura de filas
  worksheet['!rows'] = [
    { hpt: 30 }, // Título
    { hpt: 20 }, // Subtítulo
    { hpt: 18 }, // Fecha
    { hpt: 8 },  // Espacio
    { hpt: 26 }, // Encabezado tabla
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reposición de Stock');

  const finalName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, finalName);
};