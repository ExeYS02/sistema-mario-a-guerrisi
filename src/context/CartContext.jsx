'use client';

import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [carrito, setCarrito] = useState([]);
  const [cliente, setCliente] = useState(null);

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

  const total = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const totalArticulos = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  return (
    <CartContext.Provider value={{
      carrito,
      setCarrito,
      agregarAlCarrito,
      modificarCantidad,
      eliminarDelCarrito,
      vaciarCarrito,
      total,
      totalArticulos,
      cliente,
      setCliente
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
