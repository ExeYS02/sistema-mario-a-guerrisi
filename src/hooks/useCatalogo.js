'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerCatalogo } from '@/services/catalogoService';

// Cada cuánto se vuelve a pedir el catálogo mientras la pestaña está visible.
// HU-32 pide reflejar cambios de precio/stock en < 1 minuto: con 30 s hay margen.
export const INTERVALO_REFRESCO_MS = 30_000;

const VACIO = { items: [], total: 0, pagina: 1, porPagina: 12, totalPaginas: 1, actualizadoEn: null };

export function useCatalogo(params) {
  // `clave` identifica la consulta a la que pertenece lo que hay en pantalla.
  // Mientras no coincida con la consulta actual, se considera "cargando".
  const [estado, setEstado] = useState({ clave: null, data: VACIO, error: '' });
  const controlador = useRef(null);
  const clave = JSON.stringify(params);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    controlador.current?.abort(); // descarta la búsqueda anterior si todavía no terminó
    const ctl = new AbortController();
    controlador.current = ctl;
    try {
      const data = await obtenerCatalogo(JSON.parse(clave), { signal: ctl.signal });
      if (ctl.signal.aborted) return;
      setEstado({ clave, data, error: '' });
    } catch (e) {
      if (e.name === 'AbortError' || ctl.signal.aborted) return;
      // En un refresco silencioso se conserva lo que ya se mostraba.
      if (!silencioso) setEstado((prev) => ({ clave, data: prev.data, error: e.message || 'No pudimos cargar el catálogo.' }));
    }
  }, [clave]);

  // Carga al cambiar búsqueda / filtros / página
  useEffect(() => {
    cargar();
    return () => controlador.current?.abort();
  }, [cargar]);

  // Refresco periódico + al volver a la pestaña o recuperar conexión
  useEffect(() => {
    const refrescar = () => { if (document.visibilityState === 'visible') cargar({ silencioso: true }); };
    const id = setInterval(refrescar, INTERVALO_REFRESCO_MS);
    document.addEventListener('visibilitychange', refrescar);
    window.addEventListener('online', refrescar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refrescar);
      window.removeEventListener('online', refrescar);
    };
  }, [cargar]);

  const cargando = estado.clave !== clave;
  // Al reintentar tras un error se vuelve a mostrar "cargando" hasta que responda
  const recargar = () => { setEstado((prev) => ({ ...prev, clave: null, error: '' })); cargar(); };
  return { ...estado.data, cargando, error: cargando ? '' : estado.error, recargar };
}

export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const act = () => setEnLinea(navigator.onLine);
    act();
    window.addEventListener('online', act);
    window.addEventListener('offline', act);
    return () => { window.removeEventListener('online', act); window.removeEventListener('offline', act); };
  }, []);
  return enLinea;
}
