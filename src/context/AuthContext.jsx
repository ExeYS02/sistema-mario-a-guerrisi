'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, apiFetchAuth } from '@/services/apiClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [cliente, setCliente] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    try {
      const storedClient = localStorage.getItem('cliente_v1');
      if (storedClient) {
        setCliente(JSON.parse(storedClient));
      }
    } catch (e) {
      console.error('Error cargando cliente de localStorage', e);
    }
    setIsHydrated(true);
  }, []);

  const loginSilencioso = (datosCliente) => {
    setCliente(datosCliente);
    localStorage.setItem('cliente_v1', JSON.stringify(datosCliente));
  };

  const identificarDni = async (dni) => {
    return await apiFetch('/auth/identificar', { method: 'POST', body: { dni } });
  };

  const validarDesafio = async (dni, respuesta) => {
    const data = await apiFetch('/auth/validar', { method: 'POST', body: { dni, respuesta } });
    loginSilencioso(data);
    return data;
  };

  const crearCliente = async (datos) => {
    const data = await apiFetch('/clientes', { method: 'POST', body: datos });
    loginSilencioso(data);
    return data;
  };

  const actualizarCliente = async (datos) => {
    if (!cliente) return;
    const data = await apiFetchAuth('/clientes', cliente.id, { method: 'PUT', body: datos });
    loginSilencioso(data);
    return data;
  };

  const cerrarSesion = () => {
    setCliente(null);
    localStorage.removeItem('cliente_v1');
  };

  return (
    <AuthContext.Provider value={{
      cliente,
      isHydrated,
      modalAbierto,
      abrirLogin: () => setModalAbierto(true),
      cerrarLogin: () => setModalAbierto(false),
      identificarDni,
      validarDesafio,
      crearCliente,
      actualizarCliente,
      cerrarSesion
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}