'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [carrito, setCarrito] = useState([]);
  const [cliente, setCliente] = useState(null);
  
  // To prevent hydration mismatch, we load from localStorage after mount
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('guerrisi_carrito');
      if (storedCart) setCarrito(JSON.parse(storedCart));
      
      const storedClient = localStorage.getItem('guerrisi_cliente');
      if (storedClient) setCliente(JSON.parse(storedClient));
    } catch (err) {
      console.error('Error loading cart from storage', err);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('guerrisi_carrito', JSON.stringify(carrito));
    }
  }, [carrito, isLoaded]);
  
  useEffect(() => {
    if (isLoaded) {
      if (cliente) {
        localStorage.setItem('guerrisi_cliente', JSON.stringify(cliente));
      } else {
        localStorage.removeItem('guerrisi_cliente');
      }
    }
  }, [cliente, isLoaded]);

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
