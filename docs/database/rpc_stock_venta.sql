-- =============================================================
-- Funciones RPC — se llaman desde ventaService.js vía
-- supabaseAdmin.rpc(...) para garantizar atomicidad real,
-- ya que el cliente JS de Supabase no soporta transacciones
-- multi-paso desde la aplicación.
-- Ejecutar DESPUÉS de migracion_pos_sprint3.sql
-- =============================================================

-- Reserva TODOS los ítems de una venta en una sola transacción
-- implícita: si algún ítem no tiene disponible suficiente, se
-- aborta el RAISE EXCEPTION y Postgres revierte todo lo reservado
-- hasta ese punto dentro de la misma llamada.
CREATE OR REPLACE FUNCTION reservar_stock_venta(p_deposito_id uuid, p_items jsonb)
RETURNS void AS $$
DECLARE
  item jsonb;
  filas_afectadas int;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    UPDATE existencias
    SET cantidad_reservada = cantidad_reservada + (item->>'cantidad')::int
    WHERE articulo_id = (item->>'articuloId')::uuid
      AND deposito_id = p_deposito_id
      AND (cantidad - cantidad_reservada) >= (item->>'cantidad')::int;

    GET DIAGNOSTICS filas_afectadas = ROW_COUNT;
    IF filas_afectadas = 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para el artículo %', (item->>'articuloId');
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Contraparte de reservar_stock_venta: libera la reserva de una
-- lista de ítems directamente (sin venta_id), para el caso en que
-- la cabecera de ventas falla DESPUÉS de reservar el stock y hay
-- que revertir esa reserva sin tener todavía un id de venta.
CREATE OR REPLACE FUNCTION liberar_stock_items(p_deposito_id uuid, p_items jsonb)
RETURNS void AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    UPDATE existencias
    SET cantidad_reservada = GREATEST(0, cantidad_reservada - (item->>'cantidad')::int)
    WHERE articulo_id = (item->>'articuloId')::uuid
      AND deposito_id = p_deposito_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Confirma: descuenta stock real y libera la reserva, para todas
-- las líneas de la venta en un solo UPDATE.
-- Nota: "cantidad" existe tanto en existencias como en ventas_detalle,
-- así que hay que calificar con el alias (e.cantidad) o Postgres tira
-- "column reference is ambiguous" y la venta nunca se confirma.
CREATE OR REPLACE FUNCTION confirmar_stock_venta(p_venta_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE existencias e
  SET cantidad = e.cantidad - d.cantidad,
      cantidad_reservada = e.cantidad_reservada - d.cantidad,
      fecha_hora_actualizacion = now()
  FROM ventas_detalle d
  JOIN ventas v ON v.id = d.venta_id
  WHERE d.venta_id = p_venta_id
    AND e.articulo_id = d.articulo_id
    AND e.deposito_id = v.deposito_id;
END;
$$ LANGUAGE plpgsql;

-- Libera la reserva sin descontar stock real (cancelación manual
-- o vencimiento automático). Reemplaza la lógica inline que tenía
-- liberar_ventas_pendientes_vencidas() para no duplicarla.
CREATE OR REPLACE FUNCTION liberar_stock_venta(p_venta_id uuid)
RETURNS void AS $$
DECLARE
  v_deposito_id uuid;
BEGIN
  SELECT deposito_id INTO v_deposito_id FROM ventas WHERE id = p_venta_id;

  UPDATE existencias e
  SET cantidad_reservada = e.cantidad_reservada - d.cantidad
  FROM ventas_detalle d
  WHERE d.venta_id = p_venta_id
    AND e.articulo_id = d.articulo_id
    AND e.deposito_id = v_deposito_id;
END;
$$ LANGUAGE plpgsql;

-- Refactor del job de expiración para reutilizar liberar_stock_venta
-- en vez de repetir la lógica (reemplaza la versión anterior).
CREATE OR REPLACE FUNCTION liberar_ventas_pendientes_vencidas() RETURNS void AS $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT id FROM ventas
    WHERE estado = 'Pendiente' AND fecha_hora_expiracion < now()
  LOOP
    PERFORM liberar_stock_venta(v.id);

    UPDATE ventas
    SET estado = 'Cancelada', motivo_cancelacion = 'Vencimiento automático'
    WHERE id = v.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
