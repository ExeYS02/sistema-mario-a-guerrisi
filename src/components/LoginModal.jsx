'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';

export default function LoginModal() {
  const { modalAbierto, cerrarLogin, identificarDni, validarDesafio, crearCliente, cliente } = useAuth();
  
  const [paso, setPaso] = useState('dni'); // 'dni' | 'desafio' | 'alta'
  const [dni, setDni] = useState('');
  const [tipoDesafio, setTipoDesafio] = useState('');
  const [respuestaDesafio, setRespuestaDesafio] = useState('');
  const [altaForm, setAltaForm] = useState({ razon_social: '', email: '', telefono: '', direccion: '' });
  
  const [cargando, setCargando] = useState(false);
  const [errorStr, setErrorStr] = useState('');

  useEffect(() => {
    if (cliente) cerrarLogin();
  }, [cliente, cerrarLogin]);

  const manejarCierre = () => {
    setPaso('dni');
    setDni('');
    setRespuestaDesafio('');
    setErrorStr('');
    cerrarLogin();
  };

  const procesarDni = async (e) => {
    e.preventDefault();
    if (!dni || dni.length < 7) return;
    setErrorStr('');
    setCargando(true);
    try {
      const res = await identificarDni(dni);
      if (res.existe) {
        setTipoDesafio(res.tipoValidacion);
        setPaso('desafio');
      } else {
        setPaso('alta');
      }
    } catch (err) {
      setErrorStr(err.message || 'Error al validar el DNI');
    } finally {
      setCargando(false);
    }
  };

  const enviarDesafio = async (e) => {
    e.preventDefault();
    setErrorStr('');
    setCargando(true);
    try {
      await validarDesafio(dni, respuestaDesafio);
      manejarCierre();
    } catch (err) {
      setErrorStr(err.message || 'La respuesta no coincide');
    } finally {
      setCargando(false);
    }
  };

  const enviarAlta = async (e) => {
    e.preventDefault();
    setErrorStr('');
    setCargando(true);
    try {
      await crearCliente({ dni, ...altaForm });
      manejarCierre();
    } catch (err) {
      setErrorStr(err.message || 'Error al registrarse');
    } finally {
      setCargando(false);
    }
  };

  const errorUi = errorStr && <div className="auth-error" aria-live="polite">{errorStr}</div>;

  return (
    <Modal isOpen={modalAbierto} onClose={manejarCierre} title="Identificación rápida">
      {paso === 'dni' && (
        <form className="auth-step" onSubmit={procesarDni}>
          <p className="auth-hint">Ingresá tu DNI para continuar con tu compra o ver tus envíos.</p>
          <input className="auth-input" type="number" placeholder="Tu DNI sin puntos" value={dni} onChange={e => setDni(e.target.value)} required disabled={cargando} autoFocus />
          <button className="auth-btn auth-btn-primary" type="submit" disabled={cargando}>Continuar</button>
          {errorUi}
        </form>
      )}

      {paso === 'desafio' && (
        <form className="auth-step" onSubmit={enviarDesafio}>
          <p className="auth-hint">Para proteger tu cuenta, confirmá tu <b>{tipoDesafio === 'email' ? 'correo electrónico' : 'teléfono'}</b> registrado.</p>
          <input className="auth-input" type={tipoDesafio === 'email' ? 'email' : 'text'} placeholder={`Tu ${tipoDesafio}`} value={respuestaDesafio} onChange={e => setRespuestaDesafio(e.target.value)} required disabled={cargando} autoFocus />
          <button className="auth-btn auth-btn-primary" type="submit" disabled={cargando}>Validar Identidad</button>
          {errorUi}
          <div className="auth-footer-link">
            <button className="auth-btn-link" type="button" onClick={() => { setPaso('dni'); setErrorStr(''); }}>Volver</button>
          </div>
        </form>
      )}

      {paso === 'alta' && (
        <form className="auth-step" onSubmit={enviarAlta}>
          <p className="auth-hint">No encontramos tu DNI. Completá tus datos para comprar.</p>
          <div className="form-field">
            <label>DNI</label>
            <input className="auth-input" type="number" value={dni} disabled />
          </div>
          <div className="form-field">
            <label>Nombre Completo</label>
            <input className="auth-input" type="text" value={altaForm.razon_social} onChange={e => setAltaForm({ ...altaForm, razon_social: e.target.value })} required disabled={cargando} autoFocus />
          </div>
          <div className="form-field">
            <label>Correo Electrónico</label>
            <input className="auth-input" type="email" value={altaForm.email} onChange={e => setAltaForm({ ...altaForm, email: e.target.value })} required disabled={cargando} />
          </div>
          <div className="form-field">
            <label>Teléfono</label>
            <input className="auth-input" type="text" value={altaForm.telefono} onChange={e => setAltaForm({ ...altaForm, telefono: e.target.value })} required disabled={cargando} />
          </div>
          <button className="auth-btn auth-btn-primary" type="submit" disabled={cargando}>Completar y Continuar</button>
          {errorUi}
          <div className="auth-footer-link">
            <button className="auth-btn-link" type="button" onClick={() => { setPaso('dni'); setErrorStr(''); }}>Volver</button>
          </div>
        </form>
      )}
    </Modal>
  );
}