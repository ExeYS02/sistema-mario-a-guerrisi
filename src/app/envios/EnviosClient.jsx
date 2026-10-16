'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetchAuth } from '@/services/apiClient';

export default function EnviosClient() {
  const { cliente, isHydrated, abrirLogin } = useAuth();
  const [envios, setEnvios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isHydrated && cliente) {
      setLoading(true);
      apiFetchAuth('/envios', cliente.id)
        .then(data => setEnvios(Array.isArray(data) ? data : (data?.envios ?? [])))
        .catch(err => setError(err.message || 'Error al cargar envíos.'))
        .finally(() => setLoading(false));
    } else {
      setEnvios([]);
    }
  }, [isHydrated, cliente]);

  if (!isHydrated) return null;

  if (!cliente) {
    return (
      <div className="envios-page">
        <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
          <h2>Tus Envíos</h2>
          <p>Para ver el estado de tus envíos y compras, debés ingresar a tu cuenta.</p>
          <button className="btn btn-primary" onClick={abrirLogin} style={{ marginTop: '20px' }}>
            Ingresar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="envios-page">
      <div className="container">
        <h2>Tus Envíos</h2>
        
        {loading && <p>Cargando información...</p>}
        {error && <div className="alerta-error">{error}</div>}
        
        {!loading && envios.length === 0 && !error && (
          <p>Aún no tenés compras registradas.</p>
        )}

        {!loading && envios.length > 0 && (
          <div className="envios-grid">
            {envios.map(envio => (
              <div key={envio.id} className="envio-card">
                <div className="envio-header">
                  <span className={`estado-badge ${envio.estado.toLowerCase().replace(' ', '-')}`}>
                    {envio.estado}
                  </span>
                  <span className="fecha">
                    {new Date(envio.fecha_hora_registro).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="envio-body">
                  <p><strong>Tipo:</strong> {envio.tipo === 'retiro' ? 'Retiro en sucursal' : 'Envío a domicilio'}</p>
                  {envio.fecha_estimada && <p><strong>Llegada estimada:</strong> {new Date(envio.fecha_estimada).toLocaleDateString()}</p>}
                  <p><strong>Comprobante:</strong> {envio.ventas?.numero_comprobante || 'Procesando'}</p>
                  
                  <div className="envio-items">
                    <h4>Artículos</h4>
                    <ul>
                      {envio.envios_detalle?.map((det, i) => (
                        <li key={i}>{det.cantidad}x {det.articulos?.descripcion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}