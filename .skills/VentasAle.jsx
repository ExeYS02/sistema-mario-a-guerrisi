import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import { formatearMonto, formatearFechaHora } from '../utils/format';
import {
  listarDepositos,
  obtenerCatalogoPOS,
  crearVentaPendiente,
  obtenerVenta,
  agregarPago,
  confirmarVenta,
  cancelarVenta,
  buscarVentaPorComprobante,
  listarVentasConfirmadas,
} from '../services/ventaService';
import { buscarClientes, crearCliente } from '../services/clientsService';

const USUARIO_ACTUAL_ID = '00000000-0000-0000-0000-000000000001';

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_debito', label: 'Tarjeta de débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta de crédito' },
  { value: 'transferencia', label: 'Transferencia' },
];

// ── VALIDACIONES AFIP Y FORMATO ──────────────────────────────────────────────

function validarCUIT(cuit) {
  const limpio = String(cuit || '').replace(/\D/g, '');
  if (limpio.length !== 11) return false;

  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(limpio[i], 10) * factores[i];
  }

  const resto = suma % 11;
  let digitoVerificador = 11 - resto;
  if (digitoVerificador === 11) digitoVerificador = 0;
  if (digitoVerificador === 10) digitoVerificador = 9;

  return digitoVerificador === parseInt(limpio[10], 10);
}

function validarDNI(dni) {
  const limpio = String(dni || '').replace(/\D/g, '');
  return limpio.length >= 7 && limpio.length <= 8 && Number(limpio) >= 1000000;
}

function validarEmail(email) {
  if (!email || !email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validarTelefono(tel) {
  if (!tel || !tel.trim()) return true;
  const limpio = String(tel).replace(/\D/g, '');
  return limpio.length >= 8 && limpio.length <= 15;
}

// ── IMPRESIÓN OFICIAL AFIP ──────────────────────────────────────────────────
function imprimirFacturaHTML(venta, ultimoVuelto = null) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, habilitá las ventanas emergentes para imprimir la factura.');
    return;
  }

  const ptoVenta = '0001';
  const numComprobante = venta.numeroComprobante || 'VTA-00001';
  const numSolo = numComprobante.replace(/\D/g, '').padStart(8, '0');

  const fechaObj = new Date(venta.fechaHoraRegistro || venta.fechaHoraReserva || Date.now());
  const fechaEmision = `${String(fechaObj.getDate()).padStart(2, '0')}/${String(fechaObj.getMonth() + 1).padStart(2, '0')}/${fechaObj.getFullYear()}`;
  const horaEmision = `${String(fechaObj.getHours()).padStart(2, '0')}:${String(fechaObj.getMinutes()).padStart(2, '0')} hs`;

  const vtoCaeObj = new Date(fechaObj);
  vtoCaeObj.setDate(vtoCaeObj.getDate() + 10);
  const fechaVtoCae = `${String(vtoCaeObj.getDate()).padStart(2, '0')}/${String(vtoCaeObj.getMonth() + 1).padStart(2, '0')}/${fechaVtoCae.getFullYear()}`;

  const razonSocial = venta.cliente ? venta.cliente.razonSocial : 'Consumidor final';
  let docFormat = '—';
  if (venta.cliente) {
    if (venta.cliente.cuit && venta.cliente.cuit.length === 11) {
      const c = venta.cliente.cuit;
      docFormat = `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
    } else if (venta.cliente.dni) {
      docFormat = venta.cliente.dni;
    }
  }
  const domicilio = venta.cliente?.direccion || '—';
  const telefono = venta.cliente?.telefono || '—';
  const email = venta.cliente?.email || '—';

  const metodos = [...new Set((venta.pagos || []).map((p) => p.metodo || p))];
  const condicionVenta = metodos.length > 0 ? metodos.join(' / ') : 'Contado';

  const total = Number(venta.total) || 0;
  const netoGravado = total / 1.21;
  const ivaContenido = total - netoGravado;
  const caeSimulado = `7438${String(total).replace('.', '').slice(0, 4).padStart(4, '0')}9281`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${numComprobante}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 24px; color: #1f2937; font-size: 12px; line-height: 1.4; }
    .invoice-card { border: 1.5px solid #111; padding: 20px; max-width: 800px; margin: 0 auto; background: #fff; }
    .header { display: flex; justify-content: space-between; position: relative; border-bottom: 2px solid #111; padding-bottom: 16px; }
    .header-left { width: 44%; }
    .header-left h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #000; letter-spacing: -0.5px; }
    .header-left p { margin: 2px 0; font-size: 11px; color: #4b5563; }
    .header-center { position: absolute; left: 50%; transform: translateX(-50%); top: 0; text-align: center; }
    .box-letter { border: 2px solid #000; width: 44px; height: 44px; line-height: 44px; font-size: 26px; font-weight: 900; background: #fff; margin: 0 auto; }
    .box-code { font-size: 9px; font-weight: 700; margin-top: 3px; letter-spacing: 0.5px; }
    .header-right { width: 44%; text-align: right; }
    .header-right h2 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; }
    .header-right p { margin: 2px 0; font-size: 11px; color: #4b5563; }
    .client-box { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; border-bottom: 1px solid #e5e7eb; padding: 10px 14px; margin-bottom: 16px; background: #fafafa; border-radius: 4px; }
    .client-box p { margin: 3px 0; font-size: 11.5px; }
    .client-box strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f3f4f6; color: #374151; font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 8px 10px; border-top: 1px solid #111; border-bottom: 1px solid #111; }
    td { padding: 9px 10px; border-bottom: 1px solid #f3f4f6; font-size: 11.5px; }
    td.right, th.right { text-align: right; }
    td.center, th.center { text-align: center; }
    .mono { font-family: monospace; font-size: 11.5px; }
    .totals-area { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .totals-legal { font-size: 10.5px; color: #6b7280; max-width: 50%; }
    .totals-box { width: 45%; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 11.5px; }
    .total-row.main { background: #111; color: #fff; font-size: 14px; font-weight: 800; padding: 10px 12px; }
    .afip-footer { display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #111; padding-top: 14px; margin-top: 10px; }
    .afip-qr { display: flex; align-items: center; gap: 12px; }
    .afip-qr img { width: 75px; height: 75px; }
    .afip-brand { font-size: 13px; font-weight: 900; letter-spacing: -0.5px; color: #000; }
    .afip-cae-box { text-align: right; font-size: 11.5px; }
    .afip-cae-box strong { font-size: 12px; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div class="header-left">
        <h1>Mario A. Guerrisi</h1>
        <p><strong>Razón Social:</strong> Mario A. Guerrisi e Hijos S.R.L.</p>
        <p><strong>Dirección:</strong> San Juan 956, Salta Capital (CP 4400)</p>
        <p><strong>Teléfono:</strong> (0387) 573-0925</p>
        <p><strong>Email:</strong> atencion@marioaguerrisi.com</p>
        <p><strong>IVA:</strong> Responsable Inscripto</p>
      </div>

      <div class="header-center">
        <div class="box-letter">B</div>
        <div class="box-code">COD. 006</div>
      </div>

      <div class="header-right">
        <h2>FACTURA</h2>
        <p><strong>Punto de Venta:</strong> ${ptoVenta} &nbsp; <strong>Comp. Nro:</strong> ${numSolo}</p>
        <p><strong>Fecha de Emisión:</strong> ${fechaEmision} (${horaEmision})</p>
        <p><strong>CUIT:</strong> 30-76543210-9</p>
        <p><strong>Ingresos Brutos:</strong> 917-30765432109-1</p>
        <p><strong>Inicio de Actividades:</strong> 15/09/1959</p>
      </div>
    </div>

    <div class="client-box">
      <div>
        <p><strong>Cliente:</strong> ${razonSocial}</p>
        <p><strong>DNI / CUIT:</strong> ${docFormat}</p>
        <p><strong>Condición IVA:</strong> Consumidor Final</p>
        <p><strong>Domicilio:</strong> ${domicilio}</p>
      </div>
      <div>
        <p><strong>Teléfono:</strong> ${telefono}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Condición de Venta:</strong> ${condicionVenta}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="center" style="width: 8%;">Cant.</th>
          <th>Descripción</th>
          <th class="right" style="width: 18%;">Precio Unit.</th>
          <th class="right" style="width: 18%;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${(venta.items || []).map(it => `
          <tr>
            <td class="center mono">${it.cantidad}</td>
            <td><strong>${it.descripcion}</strong></td>
            <td class="right mono">$${Number(it.precioUnitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            <td class="right mono">$${(Number(it.cantidad) * Number(it.precioUnitario)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="totals-legal">
        <p><strong>Régimen de Transparencia Fiscal:</strong></p>
        <p>IVA 21% incluido estimado: $${ivaContenido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        <p>Neto gravado estimado: $${netoGravado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        ${ultimoVuelto && ultimoVuelto.vuelto > 0 ? `
          <p style="margin-top: 8px; font-weight: bold; color: #16a34a;">
            Operación en Efectivo: Entregó $${ultimoVuelto.entrego.toLocaleString('es-AR', { minimumFractionDigits: 2 })} — Vuelto: $${ultimoVuelto.vuelto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        ` : ''}
      </div>

      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal:</span>
          <span class="mono">$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="total-row main">
          <span>TOTAL:</span>
          <span class="mono">$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>

    <div class="afip-footer">
      <div class="afip-qr">
        <img 
          src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify({ ver:1, fecha:fechaEmision, cuit:30765432109, ptoVta:1, tipoCmp:6, nroCmp:numSolo, importe:total, cae:caeSimulado }))}" 
          alt="QR AFIP"
        />
        <div>
          <div class="afip-brand">ARCA / AFIP</div>
          <div style="font-size: 10px; color: #4b5563;">Comprobante Autorizado</div>
        </div>
      </div>

      <div class="afip-cae-box">
        <p style="margin: 2px 0;"><strong>CAE Nº:</strong> <span class="mono">${caeSimulado}</span></p>
        <p style="margin: 2px 0;"><strong>Fecha de Vto. de CAE:</strong> <span class="mono">${fechaVtoCae}</span></p>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
function Punto_de_Venta() {
  const [searchParams] = useSearchParams();
  const nroACobrar = searchParams.get('cobrar');

  const searchInputRef = useRef(null);
  const efectivoInputRef = useRef(null);

  const [depositos, setDepositos] = useState([]);
  const [activeDepositId, setActiveDepositId] = useState(null);

  const [catalogo, setCatalogo] = useState([]);
  const [catalogoLoading, setCatalogoLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState('todos'); // 'todos' | 'con_stock' | 'sin_stock'
  const [vistaModo, setVistaModo] = useState('lista'); // 'lista' | 'cuadricula'

  const [carrito, setCarrito] = useState([]);
  const [cliente, setCliente] = useState(null);

  // Descuentos
  const [descuentoPorc, setDescuentoPorc] = useState(0);
  const [descuentoCustom, setDescuentoCustom] = useState('');
  const [mostrarCustomDesc, setMostrarCustomDesc] = useState(false);

  // Modal Cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [mostrarAltaCliente, setMostrarAltaCliente] = useState(false);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({
    razonSocial: '', dni: '', cuit: '', email: '', telefono: '', direccion: '',
  });
  const [clientErrors, setClientErrors] = useState({});
  const [creandoCliente, setCreandoCliente] = useState(false);

  // Venta y Cobro
  const [venta, setVenta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState(null);

  // Formulario de Pago
  const [pagoForm, setPagoForm] = useState({
    metodo: 'efectivo',
    monto: '',
    pagaCon: '',
    marcaTarjeta: 'Visa',
    cuotas: '1',
    numeroCupon: '',
    bancoTransferencia: 'Mercado Pago',
    comprobanteTransf: '',
  });

  const [esPagoParcial, setEsPagoParcial] = useState(false);
  const [ultimoVuelto, setUltimoVuelto] = useState(null);

  // Ventas Pendientes y Búsqueda
  const [ventasPendientes, setVentasPendientes] = useState([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [modoPago, setModoPago] = useState(false);
  const [modoBuscarVenta, setModoBuscarVenta] = useState(false);
  const [textoBusquedaVenta, setTextoBusquedaVenta] = useState('');
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [buscandoVenta, setBuscandoVenta] = useState(false);
  const [isVentaBuscada, setIsVentaBuscada] = useState(false);

  // ── ESTADOS DERIVADOS ──────────────────────────────────────────────────────
  const enCobro = Boolean(venta && venta.estado === 'Pendiente');
  const confirmada = Boolean(venta && venta.estado === 'Confirmada');

  const subtotalBrutoCarrito = useMemo(() => {
    return carrito.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0);
  }, [carrito]);

  const porcentajeEfectivo = useMemo(() => {
    if (mostrarCustomDesc) {
      const num = Number(descuentoCustom) || 0;
      return Math.min(100, Math.max(0, num));
    }
    return descuentoPorc;
  }, [mostrarCustomDesc, descuentoCustom, descuentoPorc]);

  const montoDescuentoCalculado = useMemo(() => {
    if (porcentajeEfectivo <= 0) return 0;
    return (subtotalBrutoCarrito * porcentajeEfectivo) / 100;
  }, [subtotalBrutoCarrito, porcentajeEfectivo]);

  const totalCarritoConDescuento = useMemo(() => {
    return Math.max(0, subtotalBrutoCarrito - montoDescuentoCalculado);
  }, [subtotalBrutoCarrito, montoDescuentoCalculado]);

  const saldoPendiente = useMemo(() => {
    if (!venta) return 0;
    const totalPagado = (venta.pagos || []).reduce((acc, p) => acc + Number(p.monto), 0);
    return Math.max(0, Number(venta.total) - totalPagado);
  }, [venta]);

  const montoCobro = useMemo(() => {
    if (esPagoParcial && pagoForm.monto !== '') {
      return Number(pagoForm.monto) || 0;
    }
    return saldoPendiente;
  }, [esPagoParcial, pagoForm.monto, saldoPendiente]);

  const dineroEntregado = Number(pagoForm.pagaCon) || 0;

  const vueltoEfectivo = useMemo(() => {
    if (dineroEntregado > montoCobro && montoCobro > 0) {
      return dineroEntregado - montoCobro;
    }
    return 0;
  }, [dineroEntregado, montoCobro]);

  const faltaEfectivo = useMemo(() => {
    if (dineroEntregado > 0 && dineroEntregado < montoCobro) {
      return montoCobro - dineroEntregado;
    }
    return 0;
  }, [dineroEntregado, montoCobro]);

  const categorias = useMemo(() => {
    const set = new Set(catalogo.map((a) => a.categoria).filter(Boolean));
    return Array.from(set);
  }, [catalogo]);

  const countsStock = useMemo(() => {
    const conStock = catalogo.filter((a) => a.disponible > 0).length;
    const sinStock = catalogo.filter((a) => a.disponible <= 0).length;
    return { todos: catalogo.length, conStock, sinStock };
  }, [catalogo]);

  const catalogoFiltrado = useMemo(() => {
    const texto = searchTerm.trim().toLowerCase();
    return catalogo.filter((a) => {
      const coincideTexto =
        !texto || a.descripcion.toLowerCase().includes(texto) || (a.codigoEan13 || '').includes(texto);
      const coincideCategoria = categoriaFiltro === 'todas' || a.categoria === categoriaFiltro;

      let coincideDisponibilidad = true;
      if (filtroDisponibilidad === 'con_stock') coincideDisponibilidad = a.disponible > 0;
      else if (filtroDisponibilidad === 'sin_stock') coincideDisponibilidad = a.disponible <= 0;

      return coincideTexto && coincideCategoria && coincideDisponibilidad;
    });
  }, [catalogo, searchTerm, categoriaFiltro, filtroDisponibilidad]);

  const pendientesFiltradas = useMemo(() => {
    const q = textoBusquedaVenta.trim().toLowerCase();
    if (!q) return ventasPendientes;
    return ventasPendientes.filter(
      (v) =>
        (v.numeroComprobante || '').toLowerCase().includes(q) ||
        (v.cliente || '').toLowerCase().includes(q)
    );
  }, [ventasPendientes, textoBusquedaVenta]);

  // ── FUNCIÓN REUTILIZABLE: RECARGA DE CATÁLOGO (STOCK EN VIVO) ─────────────
  const cargarCatalogo = useCallback(() => {
    if (!activeDepositId) return;
    setCatalogoLoading(true);
    obtenerCatalogoPOS(activeDepositId)
      .then(setCatalogo)
      .catch((err) => {
        console.error('[POS] Error al cargar catálogo:', err);
        setCatalogo([]);
      })
      .finally(() => setCatalogoLoading(false));
  }, [activeDepositId]);

  const abrirPasarelaCobro = useCallback((ventaActiva) => {
    const totalPagado = (ventaActiva.pagos || []).reduce((acc, p) => acc + Number(p.monto), 0);
    const saldo = Math.max(0, Number(ventaActiva.total) - totalPagado);
    setModoPago(true);
    setEsPagoParcial(false);
    setPagoForm({
      metodo: 'efectivo',
      monto: saldo > 0 ? saldo.toFixed(2) : '',
      pagaCon: '',
      marcaTarjeta: 'Visa',
      cuotas: '1',
      numeroCupon: '',
      bancoTransferencia: 'Mercado Pago',
      comprobanteTransf: '',
    });
  }, []);

  const handleCerrarModalCliente = useCallback(() => {
    setIsClientModalOpen(false);
    setClientQuery('');
    setClientResults([]);
    setMostrarAltaCliente(false);
    setClientErrors({});
  }, []);

  const cargarPendientes = useCallback(async () => {
    setLoadingPendientes(true);
    try {
      const todas = await listarVentasConfirmadas();
      const pendientes = (todas || []).filter((v) => v.estado === 'Pendiente');
      setVentasPendientes(pendientes);
    } catch (err) {
      console.error('Error al cargar ventas pendientes:', err);
    } finally {
      setLoadingPendientes(false);
    }
  }, []);

  const handleIniciarCobro = useCallback(async () => {
    if (carrito.length === 0) return;
    setProcesando(true);

    const factorDescuento = subtotalBrutoCarrito > 0
      ? totalCarritoConDescuento / subtotalBrutoCarrito
      : 1;

    try {
      const nuevaVenta = await crearVentaPendiente({
        depositoId: activeDepositId,
        usuarioId: USUARIO_ACTUAL_ID,
        clienteId: cliente?.id || null,
        items: carrito.map((it) => {
          const precioConDescuento = Math.round((it.precioUnitario * factorDescuento) * 100) / 100;
          return {
            articuloId: it.articuloId,
            cantidad: it.cantidad,
            precioUnitario: precioConDescuento,
          };
        }),
      });
      setVenta(nuevaVenta);
      setModoPago(false);
      setIsVentaBuscada(false);
      setTextoBusquedaVenta(nuevaVenta.numeroComprobante || '');
      cargarPendientes();
      cargarCatalogo();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesando(false);
    }
  }, [carrito, subtotalBrutoCarrito, totalCarritoConDescuento, activeDepositId, cliente, cargarPendientes, cargarCatalogo]);

  // ── EFECTOS DE CICLO DE VIDA ───────────────────────────────────────────────

  useEffect(() => {
    listarDepositos().then((data) => {
      setDepositos(data);
      if (data.length > 0) setActiveDepositId(data[0].id);
    });
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  useEffect(() => {
    if (!nroACobrar) return;

    setBuscandoVenta(true);
    buscarVentaPorComprobante(nroACobrar)
      .then((v) => {
        setVenta(v);
        setCliente(v.cliente);
        setCarrito(v.items);
        setTextoBusquedaVenta(nroACobrar);
        setIsVentaBuscada(true);
        abrirPasarelaCobro(v);
        setToast(`Venta ${nroACobrar} cargada para cobro en caja.`);
      })
      .catch((err) => {
        setErrorBusqueda(err.message || 'No se pudo cargar la venta indicada.');
        setModoBuscarVenta(true);
      })
      .finally(() => setBuscandoVenta(false));
  }, [nroACobrar, abrirPasarelaCobro]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── ATAJOS DE TECLADO ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (!venta) {
          setIsClientModalOpen((prev) => !prev);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (!venta && carrito.length > 0 && !procesando) {
          handleIniciarCobro();
        } else if (enCobro && !modoPago) {
          abrirPasarelaCobro(venta);
        } else if (enCobro && modoPago && pagoForm.metodo === 'efectivo') {
          if (efectivoInputRef.current) {
            efectivoInputRef.current.focus();
          }
        }
      } else if (e.key === 'Escape') {
        if (isClientModalOpen) {
          handleCerrarModalCliente();
        } else if (modoBuscarVenta) {
          setModoBuscarVenta(false);
          setErrorBusqueda('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isClientModalOpen,
    modoBuscarVenta,
    venta,
    carrito,
    procesando,
    enCobro,
    modoPago,
    pagoForm.metodo,
    handleIniciarCobro,
    abrirPasarelaCobro,
    handleCerrarModalCliente,
  ]);

  // Manejo de Carrito
  const handleAgregarAlCarrito = (articulo) => {
    if (articulo.disponible <= 0) return;
    setCarrito((prev) => {
      const existente = prev.find((it) => it.articuloId === articulo.id);
      if (existente) {
        if (existente.cantidad >= articulo.disponible) return prev;
        return prev.map((it) =>
          it.articuloId === articulo.id ? { ...it, cantidad: it.cantidad + 1 } : it
        );
      }
      return [
        ...prev,
        {
          articuloId: articulo.id,
          descripcion: articulo.descripcion,
          cantidad: 1,
          precioUnitario: articulo.precioActual,
          disponible: articulo.disponible,
        },
      ];
    });
  };

  const handleCambiarCantidad = (articuloId, delta) => {
    setCarrito((prev) =>
      prev
        .map((it) => {
          if (it.articuloId !== articuloId) return it;
          const nuevaCantidad = Math.min(it.disponible, Math.max(0, it.cantidad + delta));
          return { ...it, cantidad: nuevaCantidad };
        })
        .filter((it) => it.cantidad > 0)
    );
  };

  const handleQuitarItem = (articuloId) => {
    setCarrito((prev) => prev.filter((it) => it.articuloId !== articuloId));
  };

  const handleVaciarCarrito = () => {
    if (carrito.length === 0) return;
    if (window.confirm('¿Deseas vaciar todos los productos del carrito?')) {
      setCarrito([]);
      setDescuentoPorc(0);
      setDescuentoCustom('');
      setMostrarCustomDesc(false);
    }
  };

  // Búsqueda de clientes
  useEffect(() => {
    if (!isClientModalOpen) return;
    const texto = clientQuery.trim();
    if (texto.length < 2) {
      setClientResults([]);
      return;
    }
    setClientSearchLoading(true);
    const t = setTimeout(() => {
      buscarClientes(texto)
        .then(setClientResults)
        .catch((err) => console.error(err))
        .finally(() => setClientSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [clientQuery, isClientModalOpen]);

  const handleSeleccionarCliente = (c) => {
    setCliente(c);
    setIsClientModalOpen(false);
    setClientQuery('');
    setClientResults([]);
    setMostrarAltaCliente(false);
    setNuevoClienteForm({ razonSocial: '', dni: '', cuit: '', email: '', telefono: '', direccion: '' });
    setClientErrors({});
  };

  const handleAbrirAltaCliente = () => {
    const texto = clientQuery.trim();
    const esNumero = /^\d+$/.test(texto);
    setNuevoClienteForm({
      razonSocial: esNumero ? '' : texto,
      dni: esNumero && texto.length <= 8 ? texto : '',
      cuit: esNumero && texto.length === 11 ? texto : '',
      email: '',
      telefono: '',
      direccion: '',
    });
    setClientErrors({});
    setMostrarAltaCliente(true);
  };

  const handleCrearCliente = async (e) => {
    e.preventDefault();
    const errores = {};

    const razonSocial = nuevoClienteForm.razonSocial.trim();
    const dni = nuevoClienteForm.dni.trim().replace(/\D/g, '');
    const cuit = nuevoClienteForm.cuit.trim().replace(/\D/g, '');
    const email = nuevoClienteForm.email.trim();
    const telefono = nuevoClienteForm.telefono.trim();
    const direccion = nuevoClienteForm.direccion.trim();

    if (!razonSocial || razonSocial.length < 3) {
      errores.razonSocial = 'El nombre o razón social debe tener al menos 3 caracteres.';
    }

    if (!dni && !cuit) {
      errores.documento = 'Debes ingresar al menos un DNI o un CUIT válido.';
    }

    if (dni && !validarDNI(dni)) {
      errores.dni = 'DNI inválido (debe tener entre 7 y 8 números).';
    }

    if (cuit && !validarCUIT(cuit)) {
      errores.cuit = 'CUIT inválido (no supera la verificación de AFIP).';
    }

    if (email && !validarEmail(email)) {
      errores.email = 'Formato de correo electrónico inválido.';
    }

    if (telefono && !validarTelefono(telefono)) {
      errores.telefono = 'Teléfono inválido (mínimo 8 dígitos).';
    }

    if (Object.keys(errores).length > 0) {
      setClientErrors(errores);
      return;
    }

    setClientErrors({});
    setCreandoCliente(true);
    try {
      const nuevo = await crearCliente({
        razonSocial,
        dni: dni || null,
        cuit: cuit || null,
        email: email || null,
        telefono,
        direccion,
      });
      handleSeleccionarCliente(nuevo);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreandoCliente(false);
    }
  };

  const handleCargarVenta = async (numeroAUsar = null) => {
    const nroFinal = (numeroAUsar || textoBusquedaVenta).trim();
    if (!nroFinal) return;

    setBuscandoVenta(true);
    setErrorBusqueda('');
    try {
      const v = await buscarVentaPorComprobante(nroFinal);
      setVenta(v);
      setCliente(v.cliente);
      setCarrito(v.items);
      setModoBuscarVenta(false);
      abrirPasarelaCobro(v);
      setIsVentaBuscada(true);
    } catch (error) {
      setErrorBusqueda(error.message || 'No se encontró la venta asociada al comprobante.');
    } finally {
      setBuscandoVenta(false);
    }
  };

  const handleAgregarPago = async (e) => {
    e.preventDefault();
    const monto = Number(montoCobro);

    if (!monto || monto <= 0) {
      alert('El monto a cobrar debe ser mayor a 0.');
      return;
    }

    if (monto > saldoPendiente + 0.01) {
      alert(`El monto ($${monto.toFixed(2)}) supera el saldo restante ($${saldoPendiente.toFixed(2)}).`);
      return;
    }

    if (pagoForm.metodo === 'efectivo') {
      if (dineroEntregado > 0 && dineroEntregado < monto) {
        alert(`El dinero entregado ($${dineroEntregado.toLocaleString('es-AR')}) no alcanza para cubrir $${monto.toLocaleString('es-AR')}.`);
        return;
      }
    }

    if (pagoForm.metodo === 'tarjeta_debito' || pagoForm.metodo === 'tarjeta_credito') {
      if (!pagoForm.numeroCupon || pagoForm.numeroCupon.trim().length < 3) {
        alert('Ingresá el número de cupón o terminal del comprobante de la tarjeta.');
        return;
      }
    }

    if (pagoForm.metodo === 'transferencia') {
      if (!pagoForm.comprobanteTransf || pagoForm.comprobanteTransf.trim().length < 4) {
        alert('Ingresá el número de comprobante u operación de la transferencia.');
        return;
      }
    }

    setProcesando(true);
    try {
      await agregarPago(venta.ventaId, { metodo: pagoForm.metodo, monto });
      const ventaActualizada = await obtenerVenta(venta.ventaId);
      setVenta(ventaActualizada);

      if (pagoForm.metodo === 'efectivo') {
        setUltimoVuelto({
          cobrado: monto,
          entrego: dineroEntregado > 0 ? dineroEntregado : monto,
          vuelto: vueltoEfectivo,
        });
      }

      const totalPagado = (ventaActualizada.pagos || []).reduce((acc, p) => acc + Number(p.monto), 0);
      const nuevoSaldo = Math.max(0, Number(ventaActualizada.total) - totalPagado);

      setPagoForm((prev) => ({
        ...prev,
        monto: nuevoSaldo > 0 ? nuevoSaldo.toFixed(2) : '',
        pagaCon: '',
        numeroCupon: '',
        comprobanteTransf: '',
      }));
      setEsPagoParcial(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarVenta = async () => {
    setProcesando(true);
    try {
      const ventaConfirmada = await confirmarVenta(venta.ventaId);
      setVenta(ventaConfirmada);
      setToast(`Venta confirmada — comprobante ${ventaConfirmada.numeroComprobante}`);
      cargarPendientes();
      cargarCatalogo();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleCancelarVenta = async () => {
    if (!window.confirm('¿Cancelar esta venta? Se liberará el stock reservado.')) return;
    setProcesando(true);
    try {
      await cancelarVenta(venta.ventaId);
      handleNuevaVenta();
      setToast('Venta cancelada y existencias liberadas.');
      cargarPendientes();
      cargarCatalogo();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleNuevaVenta = () => {
    setVenta(null);
    setCarrito([]);
    setCliente(null);
    setModoPago(false);
    setModoBuscarVenta(false);
    setTextoBusquedaVenta('');
    setErrorBusqueda('');
    setIsVentaBuscada(false);
    setUltimoVuelto(null);
    setEsPagoParcial(false);
    setDescuentoPorc(0);
    setDescuentoCustom('');
    setMostrarCustomDesc(false);
    cargarPendientes();
    cargarCatalogo();
  };

  return (
    <div>
      {/* Toast Alert */}
      {toast && (
        <div className="confirm-banner">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* BARRA DE ATAJOS DE TECLADO RÁPIDO */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          background: '#18181b',
          color: '#a1a1aa',
          padding: '6px 14px',
          borderRadius: '8px',
          fontSize: '11px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#fff', fontWeight: '700' }}>⚡ Atajos de mostrador:</span>
        <span><kbd style={{ background: '#27272a', color: '#f4f4f5', padding: '2px 5px', borderRadius: '4px', border: '1px solid #3f3f46' }}>F2</kbd> Buscar artículo</span>
        <span><kbd style={{ background: '#27272a', color: '#f4f4f5', padding: '2px 5px', borderRadius: '4px', border: '1px solid #3f3f46' }}>F4</kbd> Cliente</span>
        <span><kbd style={{ background: '#27272a', color: '#f4f4f5', padding: '2px 5px', borderRadius: '4px', border: '1px solid #3f3f46' }}>F9</kbd> Cobrar / Efectivo</span>
        <span><kbd style={{ background: '#27272a', color: '#f4f4f5', padding: '2px 5px', borderRadius: '4px', border: '1px solid #3f3f46' }}>Esc</kbd> Cerrar / Volver</span>
      </div>

      {/* Tabs Depósito */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div className="warehouse-tabs" style={{ marginBottom: 0 }}>
          {depositos.map((d) => (
            <button
              key={d.id}
              className={`warehouse-tab ${activeDepositId === d.id ? 'active' : ''}`}
              disabled={!!venta}
              onClick={() => setActiveDepositId(d.id)}
            >
              {d.nombre}
            </button>
          ))}
        </div>

        {isVentaBuscada && (
          <div style={{ fontSize: '12px', background: '#fef3c7', padding: '4px 10px', borderRadius: '4px', color: '#92400e', fontWeight: '600' }}>
            Retomando cobro de comprobante: {venta?.numeroComprobante}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '18px', alignItems: 'start', marginTop: '10px' }}>
        {/* ============================================================== */}
        {/* CATÁLOGO                                                       */}
        {/* ============================================================== */}
        <div>
          {/* BARRA SUPERIOR DE BÚSQUEDA Y CONTROLES */}
          <div className="catalog-toolbar" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div className="search-input" style={{ flex: 1 }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar por nombre o EAN (F2)…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={!!venta}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '0 4px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="select-field" style={{ minWidth: '135px' }}>
                Categoría:
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  disabled={!!venta}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: '500' }}
                >
                  <option value="todas">Todas</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* TOGGLE SWITCH: LISTA VS CUADRÍCULA */}
              <div
                style={{
                  display: 'inline-flex',
                  background: '#f1f5f9',
                  padding: '2px',
                  borderRadius: '7px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  title="Vista en lista detallada"
                  onClick={() => setVistaModo('lista')}
                  style={{
                    border: 'none',
                    background: vistaModo === 'lista' ? '#fff' : 'transparent',
                    color: vistaModo === 'lista' ? '#0f172a' : '#64748b',
                    boxShadow: vistaModo === 'lista' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    borderRadius: '5px',
                    padding: '5px 7px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </button>
                <button
                  type="button"
                  title="Vista en cuadrícula"
                  onClick={() => setVistaModo('cuadricula')}
                  style={{
                    border: 'none',
                    background: vistaModo === 'cuadricula' ? '#fff' : 'transparent',
                    color: vistaModo === 'cuadricula' ? '#0f172a' : '#64748b',
                    boxShadow: vistaModo === 'cuadricula' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    borderRadius: '5px',
                    padding: '5px 7px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </button>
              </div>
            </div>

            {/* PÍLDORAS DE FILTRADO RÁPIDO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--gray-100, #f1f5f9)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setFiltroDisponibilidad('todos')}
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '20px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: filtroDisponibilidad === 'todos' ? '#18181b' : '#fff',
                    color: filtroDisponibilidad === 'todos' ? '#fff' : '#64748b',
                    borderColor: filtroDisponibilidad === 'todos' ? '#18181b' : '#e2e8f0',
                  }}
                >
                  Todos ({countsStock.todos})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroDisponibilidad('con_stock')}
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '20px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: filtroDisponibilidad === 'con_stock' ? '#059669' : '#fff',
                    color: filtroDisponibilidad === 'con_stock' ? '#fff' : '#059669',
                    borderColor: filtroDisponibilidad === 'con_stock' ? '#059669' : '#a7f3d0',
                  }}
                >
                  ✓ Con stock ({countsStock.conStock})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroDisponibilidad('sin_stock')}
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '20px',
                    border: '1px solid',
                    cursor: 'pointer',
                    background: filtroDisponibilidad === 'sin_stock' ? '#dc2626' : '#fff',
                    color: filtroDisponibilidad === 'sin_stock' ? '#fff' : '#dc2626',
                    borderColor: filtroDisponibilidad === 'sin_stock' ? '#dc2626' : '#fecaca',
                  }}
                >
                  Agotados ({countsStock.sinStock})
                </button>
              </div>

              <span style={{ fontSize: '11px', color: 'var(--gray-400, #94a3b8)' }}>
                {catalogoFiltrado.length} artículos
              </span>
            </div>
          </div>

          {/* CATÁLOGO: VISTA LISTA O CUADRÍCULA */}
          <div className="table-panel">
            {catalogoLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                Cargando catálogo…
              </div>
            ) : catalogoFiltrado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                No hay artículos para los filtros seleccionados.
              </div>
            ) : vistaModo === 'lista' ? (
              /* ======================= FORMATO LISTA (TABLA) ======================= */
              <div className="table-scroll" style={{ maxHeight: '580px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Precio</th>
                      <th>Disponible</th>
                      <th style={{ textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogoFiltrado.map((a) => {
                      const sinStock = a.disponible <= 0;

                      return (
                        <tr
                          key={a.id}
                          style={{
                            background: sinStock ? '#f8fafc' : 'transparent',
                          }}
                        >
                          <td>
                            <div
                              className="cell-strong"
                              style={{
                                color: sinStock ? '#64748b' : 'var(--ink, #0f172a)',
                                fontWeight: sinStock ? '500' : '600',
                              }}
                            >
                              {a.descripcion}
                            </div>
                            <div className="cell-sub" style={{ color: sinStock ? '#94a3b8' : 'var(--gray-500)' }}>
                              {a.categoria}
                            </div>
                          </td>

                          <td
                            className="cell-mono"
                            style={{
                              color: sinStock ? '#64748b' : 'var(--ink, #0f172a)',
                              fontWeight: sinStock ? '400' : '600',
                            }}
                          >
                            {formatearMonto(a.precioActual)}
                          </td>

                          <td>
                            {sinStock ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: '#fef2f2',
                                  color: '#991b1b',
                                  border: '1px solid #fecaca',
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                                0 un. · Agotado
                              </span>
                            ) : a.disponible <= 3 ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: '#fffbeb',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                                {a.disponible} un. · Últimas
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: '#ecfdf5',
                                  color: '#065f46',
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                {a.disponible} un.
                              </span>
                            )}
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            {sinStock ? (
                              <button
                                type="button"
                                disabled
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  background: '#f1f5f9',
                                  color: '#94a3b8',
                                  cursor: 'not-allowed',
                                }}
                              >
                                Agotado
                              </button>
                            ) : (
                              <button
                                className="btn btn-outline btn-sm"
                                disabled={!!venta || modoBuscarVenta}
                                onClick={() => handleAgregarAlCarrito(a)}
                                style={{ fontWeight: '600', padding: '4px 12px' }}
                              >
                                + Agregar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ==================== FORMATO CUADRÍCULA (CARDS) ==================== */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                  gap: '12px',
                  maxHeight: '580px',
                  overflowY: 'auto',
                  padding: '14px',
                }}
              >
                {catalogoFiltrado.map((a) => {
                  const sinStock = a.disponible <= 0;

                  return (
                    <div
                      key={a.id}
                      style={{
                        background: sinStock ? '#f8fafc' : '#ffffff',
                        border: `1.5px solid ${sinStock ? '#e2e8f0' : '#e5e7eb'}`,
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                        boxShadow: sinStock ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                        opacity: sinStock ? 0.8 : 1,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              textTransform: 'uppercase',
                              fontWeight: '700',
                              color: '#64748b',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {a.categoria}
                          </span>
                          {sinStock ? (
                            <span style={{ fontSize: '10px', fontWeight: '800', background: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: '10px', border: '1px solid #fecaca' }}>
                              0 un.
                            </span>
                          ) : a.disponible <= 3 ? (
                            <span style={{ fontSize: '10px', fontWeight: '800', background: '#fffbeb', color: '#b45309', padding: '1px 6px', borderRadius: '10px', border: '1px solid #fde68a' }}>
                              {a.disponible} un.
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', fontWeight: '800', background: '#ecfdf5', color: '#047857', padding: '1px 6px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                              {a.disponible} un.
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            fontWeight: sinStock ? '500' : '700',
                            fontSize: '12.5px',
                            color: sinStock ? '#64748b' : '#0f172a',
                            lineHeight: '1.35',
                            minHeight: '34px',
                          }}
                          title={a.descripcion}
                        >
                          {a.descripcion}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: '800',
                            color: sinStock ? '#94a3b8' : '#0f172a',
                            marginBottom: '8px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatearMonto(a.precioActual)}
                        </div>

                        {sinStock ? (
                          <button
                            type="button"
                            disabled
                            style={{
                              width: '100%',
                              padding: '6px 0',
                              fontSize: '11px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              background: '#f1f5f9',
                              color: '#94a3b8',
                              cursor: 'not-allowed',
                            }}
                          >
                            Agotado
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!!venta || modoBuscarVenta}
                            onClick={() => handleAgregarAlCarrito(a)}
                            className="btn btn-outline btn-sm"
                            style={{
                              width: '100%',
                              padding: '6px 0',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                          >
                            + Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* CARRITO Y PANEL DE COBRO                                       */}
        {/* ============================================================== */}
        <div>
          {/* PANEL DE TICKETS PENDIENTES */}
          {modoBuscarVenta && !venta && (
            <div className="table-panel" style={{ padding: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                  Tickets pendientes de cobro
                </strong>
                <span className="badge badge-amber">
                  <span className="badge-dot" />
                  {ventasPendientes.length} en espera
                </span>
              </div>

              <div className="search-input" style={{ marginBottom: '12px' }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={textoBusquedaVenta}
                  onChange={(e) => setTextoBusquedaVenta(e.target.value)}
                  placeholder="Filtrar por comprobante o cliente (ej: VTA-00001)…"
                  autoFocus
                />
                {textoBusquedaVenta && (
                  <button
                    type="button"
                    onClick={() => setTextoBusquedaVenta('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {errorBusqueda && (
                <div style={{ color: 'var(--crit, #dc2626)', fontSize: '12px', marginBottom: '10px' }}>
                  {errorBusqueda}
                </div>
              )}

              <div className="table-scroll" style={{ maxHeight: '300px', border: '1px solid var(--gray-200)', borderRadius: '6px', marginBottom: '12px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Comprobante</th>
                      <th>Cliente</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPendientes ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-500)' }}>
                          Consultando tickets pendientes…
                        </td>
                      </tr>
                    ) : pendientesFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-500)' }}>
                          {ventasPendientes.length === 0
                            ? 'No hay ventas pendientes de cobro.'
                            : 'No se encontraron tickets con ese criterio.'}
                        </td>
                      </tr>
                    ) : (
                      pendientesFiltradas.map((vp) => (
                        <tr key={vp.ventaId || vp.id}>
                          <td>
                            <span className="cell-mono" style={{ fontWeight: '700', color: 'var(--ink)' }}>
                              {vp.numeroComprobante}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>{vp.cliente || 'Consumidor final'}</div>
                            <div style={{ fontSize: '10.5px', color: 'var(--gray-500)' }}>{formatearFechaHora(vp.fechaHoraRegistro)}</div>
                          </td>
                          <td className="cell-mono" style={{ textAlign: 'right', fontWeight: '700' }}>
                            {formatearMonto(vp.total)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              disabled={buscandoVenta}
                              onClick={() => handleCargarVenta(vp.numeroComprobante)}
                            >
                              Cobrar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <button
                className="btn btn-outline"
                style={{ width: '100%' }}
                onClick={() => {
                  setModoBuscarVenta(false);
                  setErrorBusqueda('');
                  setTextoBusquedaVenta('');
                }}
              >
                Volver al carrito (Esc)
              </button>
            </div>
          )}

          {/* VISTA NORMAL DE CARRITO */}
          {!modoBuscarVenta && (
            <>
              {/* Tarjeta Cliente */}
              <div className="table-panel" style={{ padding: '14px 16px', marginBottom: '12px' }}>
                {cliente ? (
                  <div className="detail-info-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', margin: 0, padding: 0, border: 'none' }}>
                    <div className="detail-info-item">
                      <div className="label">Cliente</div>
                      <div className="value" style={{ fontWeight: '600' }}>{cliente.razonSocial}</div>
                    </div>
                    <div className="detail-info-item">
                      <div className="label">{cliente.dni ? 'DNI' : 'CUIT'}</div>
                      <div className="value">{cliente.dni || cliente.cuit}</div>
                    </div>
                    {!venta && (
                      <button className="btn btn-outline btn-sm" style={{ marginTop: '8px' }} onClick={() => setCliente(null)}>
                        Quitar cliente
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>Consumidor final</div>
                      <div className="cell-sub" style={{ fontSize: '11.5px' }}>Venta directa de mostrador</div>
                    </div>
                    <button className="btn btn-outline btn-sm" disabled={!!venta} onClick={() => setIsClientModalOpen(true)}>
                      Buscar cliente (F4)
                    </button>
                  </div>
                )}
              </div>

              {/* Grilla Carrito */}
              <div className="table-panel">
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px' }}>
                    Artículos en caja ({(venta ? venta.items : carrito).length})
                  </strong>
                  {!venta && carrito.length > 0 && (
                    <button
                      type="button"
                      onClick={handleVaciarCarrito}
                      style={{ background: 'none', border: 'none', color: 'var(--crit, #dc2626)', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Ítem</th>
                        <th style={{ textAlign: 'center' }}>Cant.</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                        {!venta && <th style={{ width: '30px' }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(venta ? venta.items : carrito).length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-500)' }}>
                            El carrito está vacío.
                          </td>
                        </tr>
                      ) : (
                        (venta ? venta.items : carrito).map((it) => (
                          <tr key={it.articuloId}>
                            <td className="cell-strong">{it.descripcion}</td>
                            <td style={{ textAlign: 'center' }}>
                              {venta ? (
                                it.cantidad
                              ) : (
                                <div className="row-actions" style={{ justifyContent: 'center' }}>
                                  <button className="icon-btn" onClick={() => handleCambiarCantidad(it.articuloId, -1)}>−</button>
                                  <span style={{ minWidth: '18px', textAlign: 'center' }}>{it.cantidad}</span>
                                  <button className="icon-btn" onClick={() => handleCambiarCantidad(it.articuloId, 1)}>+</button>
                                </div>
                              )}
                            </td>
                            <td className="cell-mono" style={{ textAlign: 'right' }}>
                              {formatearMonto(it.importeLinea ?? it.cantidad * it.precioUnitario)}
                            </td>
                            {!venta && (
                              <td style={{ textAlign: 'center' }}>
                                <button className="icon-btn" onClick={() => handleQuitarItem(it.articuloId)}>
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* SELECTOR DE PROMOCIONES Y DESCUENTOS */}
                {!venta && carrito.length > 0 && (
                  <div style={{ padding: '12px 14px', background: '#fafafa', borderTop: '1px solid var(--gray-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--gray-700)' }}>
                        🎁 Descuento / Promoción comercial:
                      </span>
                      {porcentajeEfectivo > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--crit, #dc2626)', fontWeight: '700' }}>
                          -{porcentajeEfectivo}% OFF
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {[
                        { label: '0%', val: 0 },
                        { label: '10% (Efectivo)', val: 10 },
                        { label: '15% (Gremio)', val: 15 },
                      ].map((promo) => (
                        <button
                          key={promo.val}
                          type="button"
                          onClick={() => {
                            setDescuentoPorc(promo.val);
                            setMostrarCustomDesc(false);
                            setDescuentoCustom('');
                          }}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: '600',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                            background: !mostrarCustomDesc && descuentoPorc === promo.val ? '#111827' : '#fff',
                            color: !mostrarCustomDesc && descuentoPorc === promo.val ? '#fff' : '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          {promo.label}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setMostrarCustomDesc(!mostrarCustomDesc)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: '600',
                          borderRadius: '4px',
                          border: '1px solid #d1d5db',
                          background: mostrarCustomDesc ? '#111827' : '#fff',
                          color: mostrarCustomDesc ? '#fff' : '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        Personalizado %
                      </button>

                      {mostrarCustomDesc && (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="%"
                          value={descuentoCustom}
                          onChange={(e) => setDescuentoCustom(e.target.value)}
                          style={{ width: '60px', padding: '3px 6px', fontSize: '11px', border: '1px solid var(--red)', borderRadius: '4px' }}
                          autoFocus
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CARD DE TOTALES */}
              <div className="stat-card" style={{ marginTop: '12px' }}>
                {!venta && montoDescuentoCalculado > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                    <span>Subtotal:</span>
                    <span className="cell-mono">{formatearMonto(subtotalBrutoCarrito)}</span>
                  </div>
                )}

                {!venta && montoDescuentoCalculado > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--crit, #dc2626)', fontWeight: '600', marginBottom: '6px' }}>
                    <span>Descuento aplicado:</span>
                    <span className="cell-mono">-{formatearMonto(montoDescuentoCalculado)}</span>
                  </div>
                )}

                <div className="stat-value">
                  {formatearMonto(venta ? venta.total : totalCarritoConDescuento)}
                </div>
                <div className="stat-label">Total a cobrar</div>
              </div>
            </>
          )}

          {/* Botones de acción inicial */}
          {!venta && !modoBuscarVenta && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                disabled={procesando}
                onClick={() => {
                  setModoBuscarVenta(true);
                  setErrorBusqueda('');
                  cargarPendientes();
                }}
              >
                Cobrar ticket pendiente
                {ventasPendientes.length > 0 && (
                  <span
                    style={{
                      background: 'var(--amber, #f59e0b)',
                      color: '#fff',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {ventasPendientes.length}
                  </span>
                )}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={carrito.length === 0 || procesando}
                onClick={handleIniciarCobro}
              >
                {procesando ? 'Reservando stock…' : 'Registrar venta (F9)'}
              </button>
            </div>
          )}

          {/* PASARELA DE COBRO */}
          {enCobro && (
            <div style={{ marginTop: '14px' }}>
              <div className="modal-notice">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                <span>Reserva válida hasta las {formatearFechaHora(venta.fechaHoraExpiracion)}.</span>
              </div>

              {!modoPago ? (
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleNuevaVenta}>
                    {isVentaBuscada ? 'Volver' : 'Registrar otra'}
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => abrirPasarelaCobro(venta)}>
                    Pagar ahora (F9)
                  </button>
                </div>
              ) : (
                <>
                  <div className="stat-card" style={{ marginBottom: '12px', marginTop: '12px' }}>
                    <div
                      className="stat-value"
                      style={{
                        color: saldoPendiente > 0.01 ? 'var(--crit, #dc2626)' : 'var(--green, #16a34a)',
                      }}
                    >
                      {formatearMonto(saldoPendiente)}
                    </div>
                    <div className="stat-label">
                      {saldoPendiente <= 0.01 ? 'Total saldado — listo para confirmar' : 'Saldo restante a cobrar'}
                    </div>
                  </div>

                  {ultimoVuelto && (
                    <div
                      style={{
                        background: '#ecfdf5',
                        border: '1.5px solid #10b981',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700', textTransform: 'uppercase' }}>
                          ✓ Cobro en efectivo registrado
                        </div>
                        <div style={{ fontSize: '12px', color: '#065f46', marginTop: '2px' }}>
                          Cobrado: <b>{formatearMonto(ultimoVuelto.cobrado)}</b> · Entregó: <b>{formatearMonto(ultimoVuelto.entrego)}</b>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#047857', display: 'block' }}>Vuelto entregado:</span>
                        <strong style={{ fontSize: '20px', color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
                          {formatearMonto(ultimoVuelto.vuelto)}
                        </strong>
                      </div>
                    </div>
                  )}

                  {(venta.pagos || []).length > 0 && (
                    <div className="table-panel" style={{ marginBottom: '12px' }}>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Medio</th>
                              <th style={{ textAlign: 'right' }}>Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {venta.pagos.map((p) => (
                              <tr key={p.pagoId}>
                                <td>{METODOS_PAGO.find((m) => m.value === p.metodo)?.label || p.metodo}</td>
                                <td className="cell-mono" style={{ textAlign: 'right', fontWeight: '600' }}>
                                  {formatearMonto(p.monto)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {saldoPendiente > 0.01 && (
                    <form
                      onSubmit={handleAgregarPago}
                      style={{
                        background: '#f9fafb',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                        <div className="form-field" style={{ margin: 0 }}>
                          <label>Medio de pago</label>
                          <select
                            value={pagoForm.metodo}
                            onChange={(e) => {
                              setPagoForm({ ...pagoForm, metodo: e.target.value, pagaCon: '' });
                              setEsPagoParcial(false);
                            }}
                          >
                            {METODOS_PAGO.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Modalidad:</label>
                          <button
                            type="button"
                            onClick={() => {
                              const nuevo = !esPagoParcial;
                              setEsPagoParcial(nuevo);
                              setPagoForm((prev) => ({
                                ...prev,
                                monto: nuevo ? '' : saldoPendiente.toFixed(2),
                              }));
                            }}
                            className="btn btn-outline btn-sm"
                            style={{ width: '100%', fontSize: '11px', justifyContent: 'center' }}
                          >
                            {esPagoParcial ? 'Cobrar total' : '¿Cobro parcial?'}
                          </button>
                        </div>
                      </div>

                      {esPagoParcial && (
                        <div className="form-field" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px' }}>
                            Monto parcial a cobrar (máx: {formatearMonto(saldoPendiente)})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={saldoPendiente}
                            placeholder={saldoPendiente.toFixed(2)}
                            value={pagoForm.monto}
                            onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                            autoFocus
                            required
                          />
                        </div>
                      )}

                      {/* DETALLE EFECTIVO + VUELTO EN VIVO */}
                      {pagoForm.metodo === 'efectivo' && (
                        <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                            <div className="form-field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ink)' }}>
                                Dinero que entrega el cliente:
                              </label>
                              <input
                                ref={efectivoInputRef}
                                type="number"
                                step="10"
                                placeholder={`Total: $${montoCobro.toLocaleString('es-AR')}`}
                                value={pagoForm.pagaCon}
                                onChange={(e) => setPagoForm({ ...pagoForm, pagaCon: e.target.value })}
                                style={{ fontSize: '15px', fontWeight: '700' }}
                                autoFocus
                              />
                            </div>

                            <div
                              style={{
                                background: faltaEfectivo > 0 ? '#fef2f2' : vueltoEfectivo > 0 ? '#ecfdf5' : '#f8fafc',
                                border: `1.5px solid ${faltaEfectivo > 0 ? '#fca5a5' : vueltoEfectivo > 0 ? '#10b981' : '#e2e8f0'}`,
                                borderRadius: '8px',
                                padding: '10px 14px',
                                textAlign: 'center',
                                minHeight: '62px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                              }}
                            >
                              {faltaEfectivo > 0 ? (
                                <>
                                  <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '600' }}>Dinero insuficiente</span>
                                  <strong style={{ fontSize: '16px', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                                    Faltan {formatearMonto(faltaEfectivo)}
                                  </strong>
                                </>
                              ) : vueltoEfectivo > 0 ? (
                                <>
                                  <span style={{ fontSize: '11px', color: '#047857', fontWeight: '700', textTransform: 'uppercase' }}>Vuelto a entregar</span>
                                  <strong style={{ fontSize: '20px', color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatearMonto(vueltoEfectivo)}
                                  </strong>
                                </>
                              ) : dineroEntregado === montoCobro && dineroEntregado > 0 ? (
                                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: '700' }}>✓ Pago exacto</span>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: '#6b7280' }}>Ingresá los billetes recibidos</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600' }}>Billetes recibidos:</span>
                              {pagoForm.pagaCon && (
                                <button
                                  type="button"
                                  onClick={() => setPagoForm((prev) => ({ ...prev, pagaCon: '' }))}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => setPagoForm((prev) => ({ ...prev, pagaCon: String(montoCobro) }))}
                                style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Exacto (${montoCobro.toLocaleString('es-AR')})
                              </button>
                              {[1000, 2000, 5000, 10000, 20000].map((billete) => (
                                <button
                                  key={billete}
                                  type="button"
                                  onClick={() => {
                                    setPagoForm((prev) => {
                                      const actual = Number(prev.pagaCon) || 0;
                                      return { ...prev, pagaCon: String(actual + billete) };
                                    });
                                  }}
                                  style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  +${billete.toLocaleString('es-AR')}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TARJETAS */}
                      {(pagoForm.metodo === 'tarjeta_debito' || pagoForm.metodo === 'tarjeta_credito') && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '10px', background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                          <div className="form-field" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px' }}>Marca</label>
                            <select
                              value={pagoForm.marcaTarjeta}
                              onChange={(e) => setPagoForm({ ...pagoForm, marcaTarjeta: e.target.value })}
                            >
                              <option>Visa</option>
                              <option>Mastercard</option>
                              <option>Cabal</option>
                              <option>American Express</option>
                            </select>
                          </div>

                          <div className="form-field" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px' }}>Nro. Cupón / Lote <span style={{ color: 'red' }}>*</span></label>
                            <input
                              type="text"
                              placeholder="Ej: 04512"
                              value={pagoForm.numeroCupon}
                              onChange={(e) => setPagoForm({ ...pagoForm, numeroCupon: e.target.value })}
                              required
                            />
                          </div>

                          <div className="form-field" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px' }}>Cuotas</label>
                            <select
                              value={pagoForm.cuotas}
                              disabled={pagoForm.metodo === 'tarjeta_debito'}
                              onChange={(e) => setPagoForm({ ...pagoForm, cuotas: e.target.value })}
                            >
                              <option value="1">1 pago</option>
                              <option value="3">3 cuotas</option>
                              <option value="6">6 cuotas</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* TRANSFERENCIA */}
                      {pagoForm.metodo === 'transferencia' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                          <div className="form-field" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px' }}>Entidad / Billetera</label>
                            <select
                              value={pagoForm.bancoTransferencia}
                              onChange={(e) => setPagoForm({ ...pagoForm, bancoTransferencia: e.target.value })}
                            >
                              <option>Mercado Pago</option>
                              <option>Banco Galicia</option>
                              <option>Banco Macro</option>
                              <option>Ualá</option>
                              <option>Naranja X</option>
                            </select>
                          </div>
                          <div className="form-field" style={{ margin: 0 }}>
                            <label style={{ fontSize: '11px' }}>Nro. Operación <span style={{ color: 'red' }}>*</span></label>
                            <input
                              type="text"
                              placeholder="Ej: 8945123401"
                              value={pagoForm.comprobanteTransf}
                              onChange={(e) => setPagoForm({ ...pagoForm, comprobanteTransf: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={procesando || (pagoForm.metodo === 'efectivo' && faltaEfectivo > 0)}
                        style={{ width: '100%', padding: '10px' }}
                      >
                        {procesando ? 'Registrando...' : `+ Registrar cobro de ${formatearMonto(montoCobro)}`}
                      </button>
                    </form>
                  )}

                  {/* ACCIONES DE CIERRE */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button
                      className="btn btn-outline"
                      style={{ color: 'var(--crit, #dc2626)', borderColor: 'var(--crit, #dc2626)' }}
                      disabled={procesando}
                      onClick={handleCancelarVenta}
                    >
                      Cancelar venta
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      disabled={procesando || saldoPendiente > 0.01}
                      onClick={handleConfirmarVenta}
                    >
                      {procesando ? 'Confirmando…' : 'Confirmar venta'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CLIENTE */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={handleCerrarModalCliente}
        title={mostrarAltaCliente ? 'Nuevo cliente' : 'Buscar cliente (F4)'}
        wide={mostrarAltaCliente}
      >
        {mostrarAltaCliente ? (
          <form onSubmit={handleCrearCliente} className="form-row" noValidate>
            <div className="form-field full">
              <label>Nombre o Razón Social <span className="req">*</span></label>
              <input
                type="text"
                value={nuevoClienteForm.razonSocial}
                onChange={(e) => setNuevoClienteForm({ ...nuevoClienteForm, razonSocial: e.target.value })}
                autoFocus
                required
              />
              {clientErrors.razonSocial && (
                <span style={{ color: 'var(--crit, #dc2626)', fontSize: '11px', fontWeight: '600' }}>
                  {clientErrors.razonSocial}
                </span>
              )}
            </div>

            {clientErrors.documento && (
              <div className="form-field full" style={{ color: 'var(--crit, #dc2626)', fontSize: '11px', fontWeight: '600' }}>
                {clientErrors.documento}
              </div>
            )}

            <div className="form-field">
              <label>DNI</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="7 u 8 números"
                value={nuevoClienteForm.dni}
                onChange={(e) => setNuevoClienteForm({ ...nuevoClienteForm, dni: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              />
              {clientErrors.dni && (
                <span style={{ color: 'var(--crit, #dc2626)', fontSize: '11px', fontWeight: '600' }}>
                  {clientErrors.dni}
                </span>
              )}
            </div>

            <div className="form-field">
              <label>CUIT (Validación AFIP)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="11 dígitos sin guiones"
                value={nuevoClienteForm.cuit}
                onChange={(e) => setNuevoClienteForm({ ...nuevoClienteForm, cuit: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              />
              {clientErrors.cuit && (
                <span style={{ color: 'var(--crit, #dc2626)', fontSize: '11px', fontWeight: '600' }}>
                  {clientErrors.cuit}
                </span>
              )}
            </div>

            <div className="form-field">
              <label>Correo electrónico</label>
              <input
                type="email"
                placeholder="cliente@ejemplo.com"
                value={nuevoClienteForm.email}
                onChange={(e) => setNuevoClienteForm({ ...nuevoClienteForm, email: e.target.value })}
              />
              {clientErrors.email && (
                <span style={{ color: 'var(--crit, #dc2626)', fontSize: '11px', fontWeight: '600' }}>
                  {clientErrors.email}
                </span>
              )}
            </div>

            <div className="form-field">
              <label>Teléfono</label>
              <input
                type="text"
                placeholder="Ej: 3875123456"
                value={nuevoClienteForm.telefono}
                onChange={(e) => setNuevoClienteForm({ ...nuevoClienteForm, telefono: e.target.value })}
              />
              {clientErrors.telefono && (
                <span style={{ color: 'var(--crit, #dc2626)', fontSize: '11px', fontWeight: '600' }}>
                  {clientErrors.telefono}
                </span>
              )}
            </div>

            <div className="form-field full">
              <label>Dirección</label>
              <input
                type="text"
                value={nuevoClienteForm.direccion}
                onChange={(e) => setNuevoClienteForm({ ...nuevoClienteForm, direccion: e.target.value })}
              />
            </div>

            <div className="form-field full" style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setMostrarAltaCliente(false)}>
                Volver
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creandoCliente}>
                {creandoCliente ? 'Validando…' : 'Crear y asociar'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="search-input" style={{ marginBottom: '14px' }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, DNI o CUIT (ej: 44)…"
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                autoFocus
              />
            </div>

            {clientSearchLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-500)' }}>Buscando…</div>
            ) : clientResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-500)' }}>
                {clientQuery.trim().length < 2 ? 'Escribí al menos 2 caracteres.' : 'No se encontraron clientes.'}
              </div>
            ) : (
              <div className="table-panel" style={{ marginBottom: '14px' }}>
                <div className="table-scroll">
                  <table>
                    <tbody>
                      {clientResults.map((c) => (
                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => handleSeleccionarCliente(c)}>
                          <td className="cell-strong">{c.razonSocial}</td>
                          <td className="cell-mono">{c.dni || c.cuit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button className="btn btn-outline" style={{ width: '100%' }} onClick={handleAbrirAltaCliente}>
              + Crear cliente nuevo
            </button>
          </>
        )}
      </Modal>

      {/* TICKET / FACTURA TRAS CONFIRMAR */}
      <Modal
        isOpen={!!confirmada}
        onClose={handleNuevaVenta}
        title={`Comprobante emitido ${confirmada ? venta.numeroComprobante : ''}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => imprimirFacturaHTML(venta, ultimoVuelto)}>
              Imprimir ticket / factura
            </button>
            <button className="btn btn-primary" onClick={handleNuevaVenta}>Siguiente venta</button>
          </>
        }
      >
        {confirmada && (
          <div>
            <div className="cell-sub" style={{ marginBottom: '12px' }}>
              {formatearFechaHora(venta.fechaHoraRegistro)} · {cliente ? cliente.razonSocial : 'Consumidor final'}
            </div>
            <div className="table-panel">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th style={{ textAlign: 'center' }}>Cant.</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venta.items.map((it) => (
                      <tr key={it.articuloId}>
                        <td>{it.descripcion}</td>
                        <td style={{ textAlign: 'center' }}>{it.cantidad}</td>
                        <td className="cell-mono" style={{ textAlign: 'right' }}>{formatearMonto(it.importeLinea)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {ultimoVuelto && ultimoVuelto.vuelto > 0 && (
              <div style={{ marginTop: '12px', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#047857', fontWeight: '600' }}>Vuelto entregado al cliente:</span>
                <strong style={{ fontSize: '18px', color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
                  {formatearMonto(ultimoVuelto.vuelto)}
                </strong>
              </div>
            )}

            <div className="stat-card" style={{ marginTop: '14px' }}>
              <div className="stat-value">{formatearMonto(venta.total)}</div>
              <div className="stat-label">Total pagado</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Punto_de_Venta;