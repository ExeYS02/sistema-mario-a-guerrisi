'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';
import { apiFetchAuth } from '@/services/apiClient';

export default function CarritoClient() {
  const router = useRouter();
  const { carrito, modificarCantidad, eliminarDelCarrito, total, subtotalProductos, costoEnvio, tipoEntrega, setTipoEntrega } = useCart();
  const { cliente, abrirLogin, cerrarSesion, actualizarCliente } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [errorCheckout, setErrorCheckout] = useState('');
  
  const [modalEdit, setModalEdit] = useState(false);
  const [editForm, setEditForm] = useState({ razon_social: '', email: '', telefono: '', direccion: '' });

  const abrirEdicion = () => {
    setEditForm({ 
      razon_social: cliente.razon_social, 
      email: cliente.email || '',
      telefono: cliente.telefono, 
      direccion: cliente.direccion 
    });
    setModalEdit(true);
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    setErrorCheckout('');
    setLoading(true);
    try {
      await actualizarCliente(editForm);
      setModalEdit(false);
    } catch (err) {
      setErrorCheckout(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePagoClick = async () => {
    if (!cliente) {
      abrirLogin();
      return;
    }
    if (tipoEntrega === 'envio' && !cliente.direccion) {
      setErrorCheckout('Falta dirección para el envío a domicilio.');
      abrirEdicion();
      return;
    }

    setLoading(true);
    setErrorCheckout('');
    try {
      const res = await apiFetchAuth('/checkout', cliente.id, {
        method: 'POST',
        body: { items: carrito, tipoEntrega, totalEsperado: total }
      });
      if (res.init_point) window.location.href = res.init_point;
    } catch (err) {
      setErrorCheckout(err.message || 'Ocurrió un error al procesar el pago. Debés intentarlo nuevamente.');
      setLoading(false);
    }
  };

  if (carrito.length === 0) {
    return (
      <div className="carrito-vacio">
        <h2>Tu carrito está vacío</h2>
        <Link href="/catalogo" className="btn btn-primary">Ir al catálogo</Link>
      </div>
    );
  }

  return (
    <div className="carrito-container">
      <div className="carrito-main">
        <h2>Tu Carrito</h2>
        <div className="carrito-items">
          {carrito.map(item => (
            <div key={item.id} className="carrito-item">
              <div className="item-info">
                <h3>{item.descripcion}</h3>
                <p>Precio: ${Number(item.precio).toLocaleString('es-AR')}</p>
              </div>
              <div className="item-actions">
                <input type="number" min="1" value={item.cantidad} onChange={(e) => modificarCantidad(item.id, Number(e.target.value))} disabled={loading} />
                <button className="btn-eliminar" onClick={() => eliminarDelCarrito(item.id)} disabled={loading}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="carrito-sidebar">
        <div className="resumen-card">
          <h3>Resumen de compra</h3>
          <div className="resumen-row">
            <span>Subtotal</span>
            <span>${subtotalProductos.toLocaleString('es-AR')}</span>
          </div>
          
          <div className="opciones-entrega">
            <h4>Entrega</h4>
            <label>
              <input type="radio" name="entrega" checked={tipoEntrega === 'retiro'} onChange={() => setTipoEntrega('retiro')} disabled={loading} />
              Retiro en sucursal (Gratis)
            </label>
            <label>
              <input type="radio" name="entrega" checked={tipoEntrega === 'envio'} onChange={() => setTipoEntrega('envio')} disabled={loading} />
              Envío a domicilio
            </label>
            {tipoEntrega === 'envio' && (
              <div className="resumen-row">
                <span>Costo envío</span>
                <span>${costoEnvio.toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>

          <div className="resumen-total">
            <span>Total</span>
            <span>${total.toLocaleString('es-AR')}</span>
          </div>

          <div className="cliente-info-card">
            {cliente ? (
              <>
                <div className="cliente-datos">
                  <p><strong>{cliente.razon_social}</strong></p>
                  <p>{cliente.email}</p>
                  <p>DNI: {cliente.dni}</p>
                  <p>Tel: {cliente.telefono}</p>
                  {tipoEntrega === 'envio' && <p>Dir: {cliente.direccion || <span className="req">Falta dirección</span>}</p>}
                </div>
                <div className="cliente-acciones">
                  <button className="btn-link" onClick={abrirEdicion} disabled={loading}>Modificar mis datos</button>
                  <button className="btn-link text-danger" onClick={cerrarSesion} disabled={loading}>Cerrar sesión</button>
                </div>
              </>
            ) : (
              <div className="cliente-anonimo">
                <p>Ingresá para comprar de forma segura y guardar tu carrito.</p>
                <button className="btn btn-outline" onClick={abrirLogin} disabled={loading}>Ingresar</button>
              </div>
            )}
          </div>

          {errorCheckout && <div className="alerta-error">{errorCheckout}</div>}

          <button className="btn btn-primary btn-block" onClick={handlePagoClick} disabled={loading}>
            {cliente ? 'Continuar con el pago' : 'Ingresar para pagar'}
          </button>
        </div>
      </div>

      <Modal isOpen={modalEdit} onClose={() => setModalEdit(false)} title="Modificar mis datos">
        <form onSubmit={guardarEdicion} className="form-edit-cliente">
          <div className="form-field">
            <label>Nombre completo</label>
            <input type="text" value={editForm.razon_social} onChange={e => setEditForm({...editForm, razon_social: e.target.value})} required disabled={loading}/>
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} required disabled={loading} />
          </div>
          <div className="form-field">
            <label>Teléfono</label>
            <input type="text" value={editForm.telefono} onChange={e => setEditForm({...editForm, telefono: e.target.value})} required disabled={loading}/>
          </div>
          <div className="form-field">
            <label>Dirección {tipoEntrega === 'envio' && <span className="req">*</span>}</label>
            <input type="text" value={editForm.direccion} onChange={e => setEditForm({...editForm, direccion: e.target.value})} required={tipoEntrega === 'envio'} disabled={loading}/>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>Guardar cambios</button>
        </form>
      </Modal>
    </div>
  );
}