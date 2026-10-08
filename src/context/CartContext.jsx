'use client';

import React, { createContext, useContext, useState } from 'react';
import { calcularCostoEnvio } from '@/utils/envio';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [carrito, setCarrito] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [tipoEntrega, setTipoEntrega] = useState('retiro'); // 'retiro' | 'envio'

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

  return (
    <CartContext.Provider value={{
      carrito,
      setCarrito,
      agregarAlCarrito,
      modificarCantidad,
      eliminarDelCarrito,
      vaciarCarrito,
      subtotalProductos,
      costoEnvio,
      total,
      totalArticulos,
      cliente,
      setCliente,
      tipoEntrega,
      setTipoEntrega
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
