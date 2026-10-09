'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/context/CartContext';

export default function EnviosClient() {
  const { cliente, setCliente } = useCart();
  
  const [dniBusqueda, setDniBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [stepModal, setStepModal] = useState(1);
  const [codigoIngresado, setCodigoIngresado] = useState(['', '', '', '', '', '']);

  const [envios, setEnvios] = useState([]);
  const [cargandoEnvios, setCargandoEnvios] = useState(false);

  useEffect(() => {
    const cargarEnvios = async (clienteId) => {
      setCargandoEnvios(true);
      try {
        const res = await fetch(`/api/envios?cliente_id=${clienteId}`);
        if (res.ok) {
          const data = await res.json();
          setEnvios(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargandoEnvios(false);
      }
    };

    if (cliente) {
      cargarEnvios(cliente.id);
    }
  }, [cliente]);

  const handleBuscarCliente = async () => {
    if (dniBusqueda.length !== 8) {
      setErrorBusqueda('El DNI debe tener 8 dígitos');
      return;
    }
    setBuscando(true);
    setErrorBusqueda('');
    try {
      const res = await fetch(`/api/clientes?dni=${dniBusqueda}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cliente) {
          setClienteEncontrado(data.cliente);
          setShowIdentityModal(true);
          setStepModal(1);
          setCodigoIngresado(['', '', '', '', '', '']);
        } else {
          setErrorBusqueda('No se encontró ningún cliente con ese DNI');
        }
      } else {
        if (res.status === 404) {
          setErrorBusqueda('No se encontró ningún cliente con ese DNI');
        } else {
          setErrorBusqueda('Error al buscar el cliente');
        }
      }
    } catch (err) {
      setErrorBusqueda('Error de conexión');
    } finally {
      setBuscando(false);
    }
  };

  const handleCodigoChange = (index, value) => {
    if (value.length > 1) return;
    const newCode = [...codigoIngresado];
    newCode[index] = value;
    setCodigoIngresado(newCode);
    if (value !== '' && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleConfirmarCodigo = () => {
    const codigoCompleto = codigoIngresado.join('');
    if (codigoCompleto === '123456') {
      setCliente(clienteEncontrado);
      setShowIdentityModal(false);
      setDniBusqueda('');
    } else {
      alert('Código incorrecto. Intenta con 123456');
    }
  };

  const handleCerrarModal = () => {
    setShowIdentityModal(false);
    setDniBusqueda('');
  };

  const cambiarCliente = () => {
    setCliente(null);
    setEnvios([]);
  };

  const formatearFecha = (fechaOriginal, tipo) => {
    if (!fechaOriginal) return 'Fecha no disponible';
    const fecha = new Date(fechaOriginal);
    if (isNaN(fecha.getTime())) return fechaOriginal;

    const fechaBase = new Date(fechaOriginal);
    if (tipo === 'retiro') {
      fechaBase.setDate(fechaBase.getDate() + 1);
      return `Podés retirarlo a partir del: ${fechaBase.toLocaleDateString('es-AR')}`;
    } else {
      fechaBase.setDate(fechaBase.getDate() + 7);
      return `Llegará el: ${fechaBase.toLocaleDateString('es-AR')}`;
    }
  };

  if (!cliente) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
        <h3>Identifícate para ver tus envíos</h3>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Ingresa tu DNI para buscar tus pedidos asociados.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Buscar por DNI (8 dígitos)..."
            value={dniBusqueda}
            onChange={(e) => setDniBusqueda(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscarCliente()}
          />
          <button className="btn btn-primary" onClick={handleBuscarCliente} disabled={buscando}>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {errorBusqueda && <p style={{ color: 'var(--danger-color)' }}>{errorBusqueda}</p>}

        {showIdentityModal && (
          <div className="modal-overlay open" onClick={handleCerrarModal}>
            <div className="modal" style={{ maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Confirmar identidad</h3>
                <button className="modal-close" onClick={handleCerrarModal} aria-label="Cerrar ventana">
                  <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="modal-body">
                {stepModal === 1 ? (
                  <>
                    <p>¿Deseas identificarte como <strong>{clienteEncontrado?.razon_social}</strong>, DNI <strong>{clienteEncontrado?.dni}</strong>?</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                      <button className="btn btn-secondary" onClick={handleCerrarModal}>Cancelar</button>
                      <button className="btn btn-primary" onClick={() => setStepModal(2)}>Continuar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ marginBottom: '1.5rem' }}>
                      Para confirmar tu identidad, hemos enviado un código a tu correo registrado (<strong>{clienteEncontrado?.email || 'correo'}</strong>). Por favor ingrésalo debajo:
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
                      {codigoIngresado.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`code-input-${idx}`}
                          type="text"
                          className="input"
                          style={{ width: '40px', height: '50px', textAlign: 'center', fontSize: '1.5rem', padding: '0' }}
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodigoChange(idx, e.target.value)}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                      <button className="btn btn-secondary" onClick={() => setStepModal(1)}>Volver</button>
                      <button className="btn btn-primary" onClick={handleConfirmarCodigo}>Confirmar</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Hola, {cliente.razon_social}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>DNI: {cliente.dni} | Email: {cliente.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={cambiarCliente}>Cambiar cliente</button>
      </div>

      {cargandoEnvios ? (
        <p>Cargando tus envíos...</p>
      ) : envios.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No tienes envíos ni retiros registrados.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {envios.map(envio => (
            <div key={envio.id} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.85rem', 
                      fontWeight: 'bold',
                      backgroundColor: envio.estado === 'Entregado' ? '#d4edda' : '#fff3cd',
                      color: envio.estado === 'Entregado' ? '#155724' : '#856404'
                    }}>
                      {envio.estado}
                    </span>
                    {envio.tipo === 'retiro' ? 'Retiro en Sucursal' : 'Envío a Domicilio'}
                  </h3>
                  <p style={{ margin: 0, fontWeight: '500', color: 'var(--primary-color)' }}>
                    {envio.fecha_estimada ? (
                      envio.tipo === 'retiro' 
                        ? `Podés retirarlo a partir del: ${new Date(envio.fecha_estimada).toLocaleDateString('es-AR')}`
                        : `Llegará el: ${new Date(envio.fecha_estimada).toLocaleDateString('es-AR')}`
                    ) : (
                      formatearFecha(envio.fecha_registro || envio.fecha_hora_registro || envio.created_at, envio.tipo)
                    )}
                  </p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <p style={{ margin: '0 0 0.25rem 0' }}>Comprobante: <strong>{envio.numero_comprobante}</strong></p>
                  <p style={{ margin: '0 0 0.25rem 0' }}>Estado Venta: <strong>{envio.venta_estado}</strong></p>
                  <p style={{ margin: 0 }}>Registrado el: {new Date(envio.fecha_registro || envio.fecha_hora_registro || envio.created_at).toLocaleDateString('es-AR')}</p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Artículos incluidos:</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {envio.envios_detalle && envio.envios_detalle.map((detalle, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: idx < envio.envios_detalle.length - 1 ? '1px dashed var(--border-color)' : 'none' }}>
                      <div>
                        <span style={{ fontWeight: '500' }}>{detalle.articulos?.descripcion}</span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>Mod: {detalle.articulos?.modelo}</span>
                      </div>
                      <div style={{ fontWeight: 'bold' }}>
                        x{detalle.cantidad}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
