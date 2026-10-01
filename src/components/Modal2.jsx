'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';

/**
 * Componente Modal2 - Modal Multiproducto (Patrón Maestro-Detalle)
 * Permite registrar movimientos de múltiples productos en una sola transacción
 * con cálculo y vista previa de existencias en tiempo real y alertas de restricciones.
 */
function Modal2({
  isOpen = false,
  onClose,
  onConfirm,
  depositos = [],
  usuarios = [],
  motivos = [],
  catalogoProductos = [],
  isSubmitting = false,
  initialTipoMovimiento = 'entrada',
  initialDeposito = '',
}) {
  const modalBodyRef = useRef(null);

  // 1. Estado para datos maestros (Cabecera)
  const [headerData, setHeaderData] = useState({
    deposito: '',
    tipoMovimiento: 'entrada',
    responsable: '',
  });

  // 2. Estado para datos de detalle (Array dinámico de productos)
  const [productos, setProductos] = useState([
    { id: Date.now(), producto: '', cantidad: 1, motivo: '' },
  ]);

  // Mapa de existencias actuales del depósito seleccionado: { [articulo_id]: cantidad }
  const [stockMap, setStockMap] = useState({});
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Objeto de alerta de restricción: { title: string, message: string, details?: string[] } | null
  const [alertInfo, setAlertInfo] = useState(null);

  // Inicializar o resetear datos al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setHeaderData({
        deposito: initialDeposito || (depositos.length > 0 ? depositos[0].id : ''),
        tipoMovimiento: initialTipoMovimiento || 'entrada',
        responsable: usuarios.length > 0 ? usuarios[0].id : '',
      });

      setProductos([
        {
          id: Date.now(),
          producto: catalogoProductos.length > 0 ? catalogoProductos[0].id : '',
          cantidad: 1,
          motivo: motivos.length > 0 ? motivos[0].id : '',
        },
      ]);
      setAlertInfo(null);
    }
  }, [isOpen, depositos, usuarios, motivos, catalogoProductos, initialTipoMovimiento, initialDeposito]);

  // Cargar existencias de todos los productos en el depósito seleccionado
  useEffect(() => {
    const fetchStocksForDeposit = async () => {
      if (!isOpen || !headerData.deposito) return;
      setIsLoadingStock(true);
      try {
        const { data, error } = await supabase
          .from('existencias')
          .select('articulo_id, cantidad')
          .eq('deposito_id', headerData.deposito);

        if (!error && data) {
          const map = {};
          data.forEach((row) => {
            map[row.articulo_id] = row.cantidad;
          });
          setStockMap(map);
        }
      } catch (err) {
        console.error('Error cargando existencias del depósito:', err);
      } finally {
        setIsLoadingStock(false);
      }
    };

    fetchStocksForDeposit();
  }, [isOpen, headerData.deposito]);

  // Cerrar con Escape y bloquear scroll del body
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Manejadores de la cabecera (Maestro)
  const handleChangeHeader = (field, value) => {
    setAlertInfo(null);
    setHeaderData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Manejadores de la tabla dinámica de productos (Detalle)
  const handleAddRow = () => {
    setAlertInfo(null);
    const newRow = {
      id: Date.now() + Math.random(),
      producto: catalogoProductos.length > 0 ? catalogoProductos[0].id : '',
      cantidad: 1,
      motivo: motivos.length > 0 ? motivos[0].id : '',
    };
    setProductos((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (id) => {
    if (productos.length === 1) {
      triggerAlert(
        'Cantidad mínima requerida',
        'Debe haber al menos un producto registrado en la transacción.'
      );
      return;
    }
    setAlertInfo(null);
    setProductos((prev) => prev.filter((row) => row.id !== id));
  };

  const handleChangeRow = (id, field, value) => {
    setAlertInfo(null);
    setProductos((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: field === 'cantidad' ? Math.max(1, Number(value) || 1) : value,
            }
          : row
      )
    );
  };

  // Cálculo de existencias resultantes por producto
  const stockProjections = useMemo(() => {
    return productos.map((item) => {
      const art = catalogoProductos.find((p) => p.id === item.producto);
      const current = stockMap[item.producto] ?? 0;
      const cant = Number(item.cantidad) || 0;

      let resulting = current;
      if (headerData.tipoMovimiento === 'entrada') {
        resulting = current + cant;
      } else if (headerData.tipoMovimiento === 'salida') {
        resulting = current - cant;
      } else if (headerData.tipoMovimiento === 'ajuste') {
        resulting = cant;
      }

      const isNegative = resulting < 0;

      return {
        id: item.id,
        productoId: item.producto,
        descripcion: art?.descripcion || 'Producto sin seleccionar',
        modelo: art?.modelo || '',
        currentStock: current,
        resultingStock: resulting,
        isNegative,
      };
    });
  }, [productos, stockMap, headerData.tipoMovimiento, catalogoProductos]);

  const selectedDepositName = useMemo(() => {
    const d = depositos.find((dep) => dep.id === headerData.deposito);
    return d ? d.nombre : 'Depósito seleccionado';
  }, [depositos, headerData.deposito]);

  // Función helper para disparar la alerta y hacer scroll arriba
  const triggerAlert = (title, message, details = []) => {
    setAlertInfo({ title, message, details });
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Envío y validación estricta de restricciones con cartel de alerta
  const handleSubmit = (e) => {
    e.preventDefault();
    setAlertInfo(null);

    // 1. Validación de datos maestros (Cabecera)
    if (!headerData.deposito) {
      triggerAlert(
        'Depósito no seleccionado',
        'Debes seleccionar un depósito para poder procesar la transacción.'
      );
      return;
    }
    if (!headerData.tipoMovimiento) {
      triggerAlert(
        'Tipo de movimiento requerido',
        'Debes especificar el tipo de movimiento (Entrada, Salida o Ajuste).'
      );
      return;
    }
    if (!headerData.responsable) {
      triggerAlert(
        'Usuario responsable requerido',
        'Debes indicar qué usuario es responsable de este movimiento de inventario.'
      );
      return;
    }

    // 2. Validación de campos en cada fila de producto
    for (let i = 0; i < productos.length; i++) {
      const item = productos[i];
      if (!item.producto) {
        triggerAlert(
          'Producto sin seleccionar',
          `En la fila #${i + 1} no se ha seleccionado ningún artículo del catálogo.`
        );
        return;
      }
      if (!item.cantidad || item.cantidad <= 0) {
        triggerAlert(
          'Cantidad inválida',
          `En la fila #${i + 1} la cantidad debe ser un número entero mayor a 0.`
        );
        return;
      }
    }

    // 3. Validación de productos duplicados
    const productIds = productos.map((p) => p.producto);
    const seen = new Set();
    const duplicates = [];
    productIds.forEach((id) => {
      if (seen.has(id)) duplicates.push(id);
      else seen.add(id);
    });

    if (duplicates.length > 0) {
      const dupNames = duplicates.map((dId) => {
        const art = catalogoProductos.find((p) => p.id === dId);
        return art ? art.descripcion : 'Producto duplicado';
      });
      triggerAlert(
        'Productos duplicados en la lista',
        'No es posible registrar el mismo producto en múltiples filas dentro de la misma transacción.',
        dupNames.map((name) => `"${name}" aparece más de una vez. Agrupa las cantidades en una sola fila.`)
      );
      return;
    }

    // 4. Validación de Stock Insuficiente (Salidas)
    if (headerData.tipoMovimiento === 'salida') {
      const deficientItems = stockProjections.filter((p) => p.isNegative);
      if (deficientItems.length > 0) {
        const details = deficientItems.map((p) => {
          const item = productos.find((row) => row.id === p.id);
          const cantPedida = Number(item?.cantidad || 0);
          return `• "${p.descripcion}": Stock actual en "${selectedDepositName}" es de ${p.currentStock} un., pero intentas retirar ${cantPedida} un. (Faltan ${Math.abs(p.resultingStock)} un.).`;
        });

        triggerAlert(
          'Restricción de Stock Insuficiente',
          `No se puede confirmar la salida porque el depósito "${selectedDepositName}" no cuenta con existencias suficientes para los siguientes artículos:`,
          details
        );
        return;
      }
    }

    // 5. Validación de Ajuste sin cambios (Ajuste de inventario)
    if (headerData.tipoMovimiento === 'ajuste') {
      const unchangedItems = productos.filter((row) => {
        const current = stockMap[row.producto] ?? 0;
        return current === Number(row.cantidad);
      });

      if (unchangedItems.length > 0) {
        const details = unchangedItems.map((row) => {
          const art = catalogoProductos.find((p) => p.id === row.producto);
          return `• "${art?.descripcion || 'Artículo'}": El stock actual ya es ${row.cantidad}.`;
        });

        triggerAlert(
          'Ajuste sin variación de existencias',
          'En un ajuste de inventario, la nueva cantidad ingresada debe ser diferente a la existencia actual del depósito:',
          details
        );
        return;
      }
    }

    // Si pasó todas las restricciones, confirmamos el movimiento
    if (onConfirm) {
      onConfirm({ headerData, productos });
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal modal-wide"
        style={{ maxWidth: '850px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="modal-header">
          <div>
            <h3>Registrar movimiento de stock</h3>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
              Transacción multiproducto con validación estricta de inventario
            </span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar ventana">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="modal-body" ref={modalBodyRef}>
          <form id="multiproduct-form" onSubmit={handleSubmit}>
            {/* ========================================================================= */}
            {/* CARTEL DE ALERTA DE RESTRICCIONES AL INTENTAR CONFIRMAR                   */}
            {/* ========================================================================= */}
            {alertInfo && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '16px 18px',
                  background: '#fef2f2',
                  border: '1.5px solid #f87171',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                  animation: 'modalFadeIn 0.2s ease-out',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        background: '#fee2e2',
                        borderRadius: '50%',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ width: '20px', height: '20px' }}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '800', color: '#991b1b' }}>
                        {alertInfo.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', lineHeight: '1.4' }}>
                        {alertInfo.message}
                      </p>

                      {alertInfo.details && alertInfo.details.length > 0 && (
                        <ul
                          style={{
                            margin: '8px 0 0 0',
                            paddingLeft: '18px',
                            fontSize: '12.5px',
                            color: '#7f1d1d',
                            lineHeight: '1.5',
                          }}
                        >
                          {alertInfo.details.map((det, dIdx) => (
                            <li key={dIdx} style={{ marginTop: '3px' }}>
                              {det}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAlertInfo(null)}
                    title="Cerrar alerta"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#991b1b',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: '16px', height: '16px' }}
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 1. ENCABEZADO DEL FORMULARIO (DATOS MAESTROS)                              */}
            {/* ========================================================================= */}
            <div
              style={{
                background: 'var(--gray-50, #f8f9fa)',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--gray-200, #e9ecef)',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--gray-500)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                }}
              >
                Datos Generales del Movimiento
              </div>

              <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: 0 }}>
                {/* Depósito */}
                <div className="form-field">
                  <label>
                    Depósito<span className="req">*</span>
                  </label>
                  <select
                    value={headerData.deposito}
                    onChange={(e) => handleChangeHeader('deposito', e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Seleccionar depósito...
                    </option>
                    {depositos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de movimiento */}
                <div className="form-field">
                  <label>
                    Tipo de movimiento<span className="req">*</span>
                  </label>
                  <select
                    value={headerData.tipoMovimiento}
                    onChange={(e) => handleChangeHeader('tipoMovimiento', e.target.value)}
                    required
                  >
                    <option value="entrada">Entrada (+)</option>
                    <option value="salida">Salida (-)</option>
                    <option value="ajuste">Ajuste de inventario</option>
                  </select>
                </div>

                {/* Usuario responsable */}
                <div className="form-field">
                  <label>
                    Usuario responsable<span className="req">*</span>
                  </label>
                  <select
                    value={headerData.responsable}
                    onChange={(e) => handleChangeHeader('responsable', e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Seleccionar usuario...
                    </option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. CUERPO DEL FORMULARIO (DETALLE DINÁMICO DE PRODUCTOS)                  */}
            {/* ========================================================================= */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ink)' }}>
                  Detalle de Productos ({productos.length})
                </div>
                <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                  {isLoadingStock ? 'Consultando existencias...' : `Existencias en: ${selectedDepositName}`}
                </span>
              </div>

              {/* Lista dinámica de filas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {productos.map((item, index) => {
                  const projection = stockProjections.find((p) => p.id === item.id);
                  const currentStock = projection?.currentStock ?? 0;
                  const resultingStock = projection?.resultingStock ?? 0;
                  const isNeg = projection?.isNegative ?? false;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'var(--white)',
                        padding: '14px',
                        borderRadius: '8px',
                        border: isNeg ? '1.5px solid #f87171' : '1px solid var(--gray-200)',
                        boxShadow: isNeg ? '0 0 0 1px #f87171' : 'none',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(220px, 3fr) 100px minmax(180px, 2fr) 40px',
                          gap: '10px',
                          alignItems: 'end',
                        }}
                      >
                        {/* Producto */}
                        <div className="form-field" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px' }}>
                            Producto #{index + 1}
                            <span className="req">*</span>
                          </label>
                          <select
                            value={item.producto}
                            onChange={(e) => handleChangeRow(item.id, 'producto', e.target.value)}
                            required
                          >
                            <option value="" disabled>
                              Seleccionar producto...
                            </option>
                            {catalogoProductos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.descripcion} {p.modelo ? `(${p.modelo})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad */}
                        <div className="form-field" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px' }}>
                            Cantidad<span className="req">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="Cant."
                            value={item.cantidad}
                            onChange={(e) => handleChangeRow(item.id, 'cantidad', e.target.value)}
                            required
                          />
                        </div>

                        {/* Motivo */}
                        <div className="form-field" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px' }}>Motivo</label>
                          <select
                            value={item.motivo}
                            onChange={(e) => handleChangeRow(item.id, 'motivo', e.target.value)}
                          >
                            <option value="">(Opcional) Seleccionar motivo...</option>
                            {motivos.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Botón Eliminar fila */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(item.id)}
                            title="Eliminar producto"
                            disabled={productos.length === 1}
                            style={{
                              background: productos.length === 1 ? 'var(--gray-100)' : '#fee2e2',
                              border: 'none',
                              borderRadius: '8px',
                              width: '38px',
                              height: '38px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: productos.length === 1 ? 'not-allowed' : 'pointer',
                              color: productos.length === 1 ? 'var(--gray-400)' : 'var(--red)',
                              transition: 'background 0.2s',
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ width: '16px', height: '16px' }}
                            >
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Indicador de stock en la fila */}
                      {item.producto && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '6px 12px',
                            background: isNeg ? '#fef2f2' : 'var(--gray-50, #f8f9fa)',
                            borderRadius: '6px',
                            border: isNeg ? '1px solid #fca5a5' : '1px solid var(--gray-200, #e9ecef)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--gray-600)' }}>
                              Stock actual: <strong style={{ color: 'var(--black)' }}>{currentStock}</strong>
                            </span>
                            <span style={{ color: 'var(--gray-400)' }}>→</span>
                            <span>
                              Stock resultante:{' '}
                              <strong
                                style={{
                                  color: isNeg
                                    ? 'var(--crit, #dc2626)'
                                    : headerData.tipoMovimiento === 'salida'
                                    ? 'var(--gray-900)'
                                    : 'var(--green, #16a34a)',
                                }}
                              >
                                {resultingStock}
                              </strong>
                            </span>
                          </div>

                          {isNeg && (
                            <span
                              style={{
                                color: 'var(--crit, #dc2626)',
                                fontWeight: '700',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ width: '14px', height: '14px' }}
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              Stock insuficiente
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Botón Agregar otro producto */}
              <div style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAddRow}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    justifyContent: 'center',
                    padding: '10px 16px',
                    borderStyle: 'dashed',
                    fontWeight: '600',
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: '16px', height: '16px' }}
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  + Agregar otro producto
                </button>
              </div>

              {/* ========================================================================= */}
              {/* 3. VISTA PREVIA CONSOLIDADA DE EXISTENCIAS RESULTANTES                   */}
              {/* ========================================================================= */}
              <div
                style={{
                  marginTop: '20px',
                  background: 'var(--gray-50, #f8f9fa)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--gray-200, #e9ecef)',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--gray-500)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Resumen de existencias proyectadas en {selectedDepositName}</span>
                  <span style={{ fontSize: '10px', textTransform: 'none', color: 'var(--gray-400)' }}>
                    Tipo: {headerData.tipoMovimiento.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stockProjections.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--white)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: p.isNegative ? '1px solid #fca5a5' : '1px solid var(--gray-200)',
                      }}
                    >
                      <div style={{ maxWidth: '60%' }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'var(--ink)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {p.descripcion}
                        </div>
                        {p.modelo && (
                          <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                            Modelo: {p.modelo}
                          </div>
                        )}
                      </div>

                      {/* Comparativa Stock Actual → Resultante */}
                      <div className="stock-preview" style={{ margin: 0, padding: '8px 14px', gap: '12px' }}>
                        <div className="sp-item">
                          <div className="n" style={{ fontSize: '15px' }}>{p.currentStock}</div>
                          <div className="l">Actual</div>
                        </div>
                        <div className="sp-arrow">→</div>
                        <div className="sp-item">
                          <div
                            className="n"
                            style={{
                              fontSize: '15px',
                              color: p.isNegative
                                ? 'var(--crit, #dc2626)'
                                : headerData.tipoMovimiento === 'salida'
                                ? 'var(--gray-900)'
                                : 'var(--green, #16a34a)',
                            }}
                          >
                            {p.resultingStock}
                          </div>
                          <div
                            className="l"
                            style={{
                              color: p.isNegative ? 'var(--crit, #dc2626)' : 'var(--gray-500)',
                              fontWeight: p.isNegative ? '700' : 'normal',
                            }}
                          >
                            {p.isNegative ? 'Insuficiente' : 'Resultante'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="multiproduct-form"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Procesando movimiento...' : 'Confirmar movimiento'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Modal2;
