'use client';

import { useState, useEffect, useRef } from 'react';
import { obtenerCatalogo } from '@/services/catalogoService';
import { useCart } from '@/context/CartContext';
import Modal from '@/components/Modal';
import { validarDatosCliente } from '@/utils/validacionCliente';

export default function CarritoClient() {
  const {
    carrito,
    setCarrito,
    agregarAlCarrito,
    modificarCantidad,
    eliminarDelCarrito,
    subtotalProductos,
    costoEnvio,
    total,
    cliente,
    setCliente,
    tipoEntrega,
    setTipoEntrega
  } = useCart();
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef(null);

  // Client state
  const [dniQuery, setDniQuery] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ razonSocial: '', dni: '', email: '', telefono: '', direccion: '' });
  
  // Verification Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyStep, setVerifyStep] = useState(1);
  const [pendingClient, setPendingClient] = useState(null);
  const [verifyCode, setVerifyCode] = useState(Array(6).fill(''));

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  // Error del checkout (stock insuficiente, precios actualizados, etc.)
  const [checkoutError, setCheckoutError] = useState(null); // { mensaje, faltantes? }

  // Edición de datos del cliente identificado
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ razon_social: '', email: '', telefono: '', direccion: '' });
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Handle product search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const data = await obtenerCatalogo({ q: searchTerm, porPagina: 5 });
        setSearchResults(data.items);
      } catch (err) {
        console.error('Error buscando productos', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounceRef.current);
  }, [searchTerm]);

  const onAgregar = (articulo) => {
    if (articulo.disponibilidad === 'sin_stock') {
      alert('Este artículo no tiene stock disponible.');
      return;
    }
    agregarAlCarrito(articulo);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Handle client search
  useEffect(() => {
    const digitos = dniQuery.replace(/\D/g, '');
    if (digitos.length === 8 && !cliente && !isVerifyModalOpen) {
      setClientLoading(true);
      fetch(`/api/clientes?dni=${digitos}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data && data.cliente) {
            setPendingClient(data.cliente);
            setVerifyStep(1);
            setIsVerifyModalOpen(true);
            setMostrarAlta(false);
          } else {
            setMostrarAlta(true);
            setNuevoCliente(prev => ({ ...prev, dni: digitos }));
          }
        })
        .catch(() => setMostrarAlta(true))
        .finally(() => setClientLoading(false));
    } else if (digitos.length < 8) {
      setMostrarAlta(false);
    }
  }, [dniQuery, cliente, isVerifyModalOpen]);

  const handleCloseVerifyModal = () => {
    setIsVerifyModalOpen(false);
    setVerifyStep(1);
    setVerifyCode(Array(6).fill(''));
    setDniQuery('');
  };

  const handleVerifySubmit = () => {
    if (verifyCode.join('') === '123456') {
      setCliente(pendingClient);
      setIsVerifyModalOpen(false);
      setVerifyCode(Array(6).fill(''));
      setDniQuery('');
    } else {
      alert('Código incorrecto. Intente nuevamente (el código es 123456).');
    }
  };

  const handleVerifyCodeChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    const newCode = [...verifyCode];
    newCode[index] = value;
    setVerifyCode(newCode);
    
    if (value && index < 5) {
      document.getElementById('code-input-' + (index + 1))?.focus();
    }
  };

  const abrirEdicion = () => {
    setEditForm({
      razon_social: cliente?.razon_social || '',
      email: cliente?.email || '',
      telefono: cliente?.telefono || '',
      direccion: cliente?.direccion || '',
    });
    setEditErrors({});
    setIsEditOpen(true);
  };

  const guardarEdicion = async () => {
    const { valores, errores } = validarDatosCliente(editForm);
    if (Object.keys(errores).length > 0) {
      setEditErrors(errores);
      return;
    }
    setEditSaving(true);
    setEditErrors({});
    try {
      const res = await fetch('/api/clientes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cliente.id, dni: cliente.dni, ...valores }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.cliente) {
        setCliente(data.cliente);
        setIsEditOpen(false);
      } else {
        setEditErrors(data.errores || { general: data.error || 'No pudimos guardar los cambios.' });
      }
    } catch (err) {
      console.error(err);
      setEditErrors({ general: 'Error de conexión. Intentá nuevamente.' });
    } finally {
      setEditSaving(false);
    }
  };

  const handlePagoClick = () => {
    if (!cliente) {
      alert('Por favor, identifíquese como cliente primero.');
      return;
    }
    if (tipoEntrega === 'envio' && !cliente.direccion) {
      alert('Para el envío a domicilio necesitamos tu dirección. Completala para continuar.');
      abrirEdicion();
      return;
    }
    setCheckoutError(null);
    setIsPaymentModalOpen(true);
  };

  // Quita del carrito lo que no hay y baja al máximo disponible lo que alcanza parcialmente.
  const ajustarAlStock = () => {
    const disponibles = new Map((checkoutError?.faltantes || []).map((f) => [f.articulo_id, f.disponible]));
    setCarrito((prev) =>
      prev.flatMap((i) => {
        if (!disponibles.has(i.id)) return [i];
        const max = disponibles.get(i.id);
        return max > 0 ? [{ ...i, cantidad: Math.min(i.cantidad, max) }] : [];
      })
    );
    setCheckoutError(null);
    setIsPaymentModalOpen(false);
  };

  const handleIniciarPago = async () => {
    setIsPaying(true);
    setCheckoutError(null);
    try {
      // El servidor recalcula precios y envío; solo se envía lo necesario más el
      // total que ve el cliente, para detectar si cambió algún precio.
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrito, cliente, tipoEntrega, total })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.init_point) {
        window.location.href = data.init_point; // se mantiene "Iniciando..." mientras redirige
        return;
      }

      if (res.status === 409 && data.codigo === 'STOCK_INSUFICIENTE') {
        setCheckoutError({ mensaje: data.error, faltantes: data.faltantes });
      } else if (res.status === 409 && data.codigo === 'PRECIOS_ACTUALIZADOS') {
        const nuevos = new Map((data.items || []).map((it) => [it.articulo_id, Number(it.precio_unitario)]));
        setCarrito((prev) => prev.map((i) => (nuevos.has(i.id) ? { ...i, precio: nuevos.get(i.id) } : i)));
        setCheckoutError({ mensaje: data.error });
      } else {
        setCheckoutError({ mensaje: data.error || 'Error desconocido al iniciar el pago.' });
      }
    } catch (err) {
      console.error(err);
      setCheckoutError({ mensaje: 'Error de conexión al procesar el pago.' });
    }
    setIsPaying(false);
  };

  return (
    <div className="store-container">
      <h1 className="store-title">Carrito de compras</h1>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Lado izquierdo: Buscador y lista de productos */}
        <div style={{ flex: '1 1 60%' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
              placeholder="Buscar producto por nombre o código para agregar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {isSearching && <div style={{ position: 'absolute', right: '10px', top: '10px' }}>Buscando...</div>}
            
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ccc', zIndex: 10 }}>
                {searchResults.map((res) => (
                  <div 
                    key={res.id} 
                    style={{ padding: '0.5rem', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => onAgregar(res)}
                  >
                    <div>
                      <strong>{res.descripcion}</strong>
                      <div style={{ fontSize: '0.85em', color: '#666' }}>{res.marca} - {res.modelo}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>${res.precio.toLocaleString('es-AR')}</div>
                      <div style={{ fontSize: '0.85em', color: res.disponibilidad === 'sin_stock' ? 'red' : 'green' }}>
                        {res.disponibilidad === 'sin_stock' ? 'Sin stock' : 'Disponible'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #eee' }}>
            <h2>Artículos seleccionados ({carrito.length})</h2>
            {carrito.length === 0 ? (
              <p>El carrito está vacío.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Producto</th>
                    <th style={{ padding: '0.5rem', width: '100px' }}>Cant.</th>
                    <th style={{ padding: '0.5rem', width: '120px', textAlign: 'right' }}>Precio</th>
                    <th style={{ padding: '0.5rem', width: '120px', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '0.5rem', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem' }}>{item.descripcion}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.cantidad} 
                          onChange={(e) => modificarCantidad(item.id, parseInt(e.target.value) || 1)}
                          style={{ width: '60px', padding: '0.25rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>${item.precio.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>${(item.precio * item.cantidad).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button type="button" onClick={() => eliminarDelCarrito(item.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ textAlign: 'right', marginTop: '1rem', fontSize: '1.25rem' }}>
              {tipoEntrega === 'envio' && carrito.length > 0 && (
                <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '0.25rem' }}>
                  Subtotal productos: ${subtotalProductos.toLocaleString('es-AR')} <br/>
                  Costo de envío: ${costoEnvio.toLocaleString('es-AR')}
                </div>
              )}
              <strong>Total Final: ${total.toLocaleString('es-AR')}</strong>
            </div>
          </div>
        </div>

        {/* Lado derecho: Cliente y Pago */}
        <div style={{ flex: '1 1 30%', minWidth: '300px' }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '4px', border: '1px solid #eee', marginBottom: '1rem' }}>
            <h3>Información del Cliente</h3>
            
            {!cliente && (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>DNI (8 dígitos)</label>
                <input
                  type="text"
                  placeholder="Ingresar DNI..."
                  value={dniQuery}
                  maxLength={8}
                  onChange={(e) => setDniQuery(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                {clientLoading && <div style={{ marginTop: '0.5rem', fontSize: '0.85em', color: '#666' }}>Buscando cliente...</div>}
              </div>
            )}

            {cliente && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                <strong>{cliente.razon_social}</strong>
                <div style={{ fontSize: '0.85em', color: '#4b5563', marginTop: '0.25rem', marginBottom: '1rem' }}>
                  <div>DNI: {cliente.dni}</div>
                  {cliente.email && <div>Email: {cliente.email}</div>}
                  {cliente.telefono && <div>Tel: {cliente.telefono}</div>}
                  {cliente.direccion && <div>Dirección: {cliente.direccion}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '0.5rem' }} onClick={abrirEdicion}>
                    Modificar mis datos
                  </button>
                  <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '0.5rem' }} onClick={() => setCliente(null)}>
                    Cambiar cliente
                  </button>
                </div>
              </div>
            )}

            {mostrarAlta && !cliente && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fdf8f6', borderRadius: '4px', border: '1px dashed #fdba74' }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Nuevo Cliente</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input type="text" placeholder="Nombre completo" value={nuevoCliente.razonSocial} onChange={(e) => setNuevoCliente({ ...nuevoCliente, razonSocial: e.target.value })} style={{ padding: '0.5rem' }} />
                  <input type="email" placeholder="Email (opcional)" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} style={{ padding: '0.5rem' }} />
                  <input type="text" placeholder="Teléfono (opcional)" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} style={{ padding: '0.5rem' }} />
                  <input type="text" placeholder="Dirección (opcional)" value={nuevoCliente.direccion} onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })} style={{ padding: '0.5rem' }} />
                  <button type="button" className="btn btn-outline" style={{ marginTop: '0.5rem' }} onClick={async () => {
                    try {
                      const res = await fetch('/api/clientes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          razon_social: nuevoCliente.razonSocial,
                          dni: dniQuery,
                          email: nuevoCliente.email,
                          telefono: nuevoCliente.telefono,
                          direccion: nuevoCliente.direccion,
                        })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setCliente(data.cliente);
                        setMostrarAlta(false);
                      } else {
                        alert('Error al registrar cliente');
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Error de conexión');
                    }
                  }}>
                    Registrar cliente
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '4px', border: '1px solid #eee', marginBottom: '1rem' }}>
            <h3>Opciones de Entrega</h3>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="tipoEntrega" 
                  value="retiro" 
                  checked={tipoEntrega === 'retiro'} 
                  onChange={() => setTipoEntrega('retiro')} 
                />
                Retirar del local
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="tipoEntrega" 
                  value="envio" 
                  checked={tipoEntrega === 'envio'} 
                  onChange={() => setTipoEntrega('envio')} 
                />
                <span>
                  Envío a domicilio 
                  <br/>
                  <span style={{ fontSize: '0.85em', color: '#666' }}>
                    {cliente?.direccion ? `(${cliente.direccion})` : '(Sin dirección registrada)'}
                  </span>
                </span>
              </label>
              {cliente && !cliente.direccion && (
                <button type="button" className="btn btn-outline" style={{ padding: '0.4rem', fontSize: '0.9em' }} onClick={abrirEdicion}>
                  Agregar dirección
                </button>
              )}
            </div>
          </div>

          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
            disabled={carrito.length === 0}
            onClick={handlePagoClick}
          >
            Continuar con el pago
          </button>
        </div>
      </div>

      <Modal isOpen={isVerifyModalOpen} onClose={handleCloseVerifyModal} title="Confirmar identidad">
        <div style={{ padding: '1rem' }}>
          {verifyStep === 1 ? (
            <>
              <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                ¿Deseas identificarte como <strong>{pendingClient?.razon_social}</strong>, DNI <strong>{pendingClient?.dni}</strong>?
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={handleCloseVerifyModal}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setVerifyStep(2)}>
                  Continuar
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: '1rem' }}>
                Para confirmar tu identidad, hemos enviado un codigo a tu correo registrado 
                (<strong>{pendingClient?.email || 'sin-correo@ejemplo.com'}</strong>). 
                Por favor ingresalo debajo:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', margin: '2rem 0' }}>
                {verifyCode.map((digit, i) => (
                  <input
                    key={i}
                    id={`code-input-${i}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleVerifyCodeChange(i, e.target.value.replace(/\D/g, ''))}
                    style={{ width: '40px', height: '40px', fontSize: '1.5rem', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                ))}
              </div>
              <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} onClick={handleVerifySubmit}>
                Confirmar
              </button>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => !isPaying && setIsPaymentModalOpen(false)} title="Confirmar Pago">
        <div style={{ padding: '1rem' }}>
          {checkoutError ? (
            <>
              <p style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#b91c1c' }}>
                <strong>{checkoutError.mensaje}</strong>
              </p>
              {checkoutError.faltantes?.length > 0 && (
                <ul style={{ margin: '0 0 1.5rem 1.25rem' }}>
                  {checkoutError.faltantes.map((f) => {
                    const nombre = f.descripcion || carrito.find((i) => i.id === f.articulo_id)?.descripcion || 'Artículo';
                    return (
                      <li key={f.articulo_id} style={{ marginBottom: '0.25rem' }}>
                        <strong>{nombre}</strong>:{' '}
                        {f.disponible > 0
                          ? `pediste ${f.solicitado} y solo quedan ${f.disponible}.`
                          : 'ya no está disponible.'}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsPaymentModalOpen(false)}>
                  Volver al carrito
                </button>
                {checkoutError.faltantes?.length > 0 ? (
                  <button type="button" className="btn btn-primary" onClick={ajustarAlStock}>
                    Ajustar al stock disponible
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={handleIniciarPago} disabled={isPaying}>
                    {isPaying ? 'Iniciando...' : 'Confirmar y pagar'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                Está por iniciar la instancia de pago de Mercado Pago por un total de <strong>${total.toLocaleString('es-AR')}</strong>.
                Reservaremos tus productos por 10 minutos mientras completás el pago. ¿Desea continuar?
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsPaymentModalOpen(false)} disabled={isPaying}>
                  Volver
                </button>
                <button type="button" className="btn btn-primary" onClick={handleIniciarPago} disabled={isPaying}>
                  {isPaying ? 'Iniciando...' : 'Sí'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => !editSaving && setIsEditOpen(false)} title="Modificar mis datos">
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.9em', color: '#4b5563' }}>
            DNI: <strong>{cliente?.dni}</strong> (el DNI no se puede modificar)
          </div>
          {[
            { campo: 'razon_social', label: 'Nombre completo', type: 'text', autoComplete: 'name' },
            { campo: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
            { campo: 'telefono', label: 'Teléfono', type: 'tel', autoComplete: 'tel' },
            { campo: 'direccion', label: 'Dirección de entrega', type: 'text', autoComplete: 'street-address' },
          ].map(({ campo, label, type, autoComplete }) => (
            <label key={campo} style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem' }}>{label}</span>
              <input
                type={type}
                autoComplete={autoComplete}
                value={editForm[campo]}
                onChange={(e) => setEditForm({ ...editForm, [campo]: e.target.value })}
                disabled={editSaving}
                style={{ width: '100%', padding: '0.5rem', border: `1px solid ${editErrors[campo] ? '#b91c1c' : '#ccc'}`, borderRadius: '4px' }}
              />
              {editErrors[campo] && <span style={{ color: '#b91c1c', fontSize: '0.85em' }}>{editErrors[campo]}</span>}
            </label>
          ))}
          {editErrors.general && <div style={{ color: '#b91c1c' }}>{editErrors.general}</div>}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsEditOpen(false)} disabled={editSaving}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={guardarEdicion} disabled={editSaving}>
              {editSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
