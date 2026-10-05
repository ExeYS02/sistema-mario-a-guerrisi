'use client';

import { useState, useEffect, useRef } from 'react';
import { obtenerCatalogo } from '@/services/catalogoService';
import { useCart } from '@/context/CartContext';
import Modal from '@/components/Modal';

export default function CarritoClient() {
  const {
    carrito,
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

  const handlePago = () => {
    alert('Continuar con el pago... (Funcionalidad pendiente)');
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
                <button type="button" className="btn btn-outline" style={{ width: '100%', padding: '0.5rem' }} onClick={() => setCliente(null)}>
                  Cambiar cliente
                </button>
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
            </div>
          </div>

          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
            disabled={carrito.length === 0}
            onClick={handlePago}
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
    </div>
  );
}
