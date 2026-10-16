'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { calcularCostoEnvio } from '@/utils/envio';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [carrito, setCarrito] = useState([]);
  const [tipoEntrega, setTipoEntrega] = useState('retiro');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('carrito_v1');
      if (storedCart) setCarrito(JSON.parse(storedCart));
      const storedTipo = localStorage.getItem('tipoEntrega_v1');
      if (storedTipo) setTipoEntrega(storedTipo);
    } catch (e) {
      console.error('Error cargando carrito', e);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem('carrito_v1', JSON.stringify(carrito));
        localStorage.setItem('tipoEntrega_v1', tipoEntrega);
      } catch (e) {
        console.error('Error guardando carrito', e);
      }
    }
  }, [carrito, tipoEntrega, isHydrated]);

  const agregarAlCarrito = (articulo) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === articulo.id);
      if (existe) {
        return prev.map((i) =>
          i.id === articulo.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { ...articulo, cantidad: 1 }];
    });
  };

  const modificarCantidad = (id, cantidad) => {
    if (cantidad < 1) return;
    setCarrito((prev) => prev.map((i) => (i.id === id ? { ...i, cantidad } : i)));
  };

  const eliminarDelCarrito = (id) => {
    setCarrito((prev) => prev.filter((i) => i.id !== id));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const subtotalProductos = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const costoEnvio = tipoEntrega === 'envio' && carrito.length > 0 ? calcularCostoEnvio(subtotalProductos) : 0;
  const total = subtotalProductos + costoEnvio;
  const totalArticulos = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  if (!isHydrated) return null; // Evita mismatch en SSR

  return (
    <CartContext.Provider value={{
      carrito, setCarrito, agregarAlCarrito, modificarCantidad, eliminarDelCarrito, vaciarCarrito,
      subtotalProductos, costoEnvio, total, totalArticulos,
      tipoEntrega, setTipoEntrega
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}