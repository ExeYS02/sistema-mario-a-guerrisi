-- =============================================================
-- HU-34 — Validación de stock en tiempo real + reserva temporal (soft-lock)
-- para el checkout de la tienda web.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de rpc_stock_venta.sql.
-- Es idempotente (CREATE OR REPLACE): se puede volver a correr.
--
-- ANTES DE EJECUTAR, correr estas dos consultas de diagnóstico:
--
--   (A) ¿Hay algún trigger sobre ventas que ya descuente stock?
--       select tgname, pg_get_triggerdef(oid)
--       from pg_trigger
--       where tgrelid = 'public.ventas'::regclass and not tgisinternal;
--
--       CONFIRMADO: existe trg_fn_gestionar_reserva_stock sobre ventas:
--         - Pendiente -> Confirmada: descuenta el stock real y libera la reserva.
--         - Pendiente -> Cancelada:  libera la reserva.
--         - Cancelada -> Confirmada: no hace nada (pago tardío: se descuenta a mano).
--       Por eso estas funciones NO llaman a liberar_stock_venta() ni (salvo en el
--       pago tardío) a confirmar_stock_venta(): lo haría dos veces.
--
--   (B) ¿Quedaron reservas negativas por el job viejo? (ver sección 0)
--       select * from existencias where cantidad_reservada < 0;
-- =============================================================


-- -------------------------------------------------------------
-- 0) Limpieza de datos: el checkout web anterior creaba ventas
--    'Pendiente' SIN reservar stock, pero el job de expiración sí
--    liberaba esa reserva inexistente (restando reservas ajenas).
--    Si la consulta (B) devolvió filas, dejarlas en 0:
-- -------------------------------------------------------------
UPDATE public.existencias SET cantidad_reservada = 0 WHERE cantidad_reservada < 0;


-- -------------------------------------------------------------
-- 1) liberar_stock_venta: nunca deja la reserva por debajo de 0
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liberar_stock_venta(p_venta_id uuid)
RETURNS void AS $$
DECLARE
  v_deposito_id uuid;
BEGIN
  SELECT deposito_id INTO v_deposito_id FROM ventas WHERE id = p_venta_id;

  UPDATE existencias e
  SET cantidad_reservada = GREATEST(0, e.cantidad_reservada - d.cantidad)
  FROM ventas_detalle d
  WHERE d.venta_id = p_venta_id
    AND e.articulo_id = d.articulo_id
    AND e.deposito_id = v_deposito_id;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------
-- 2) Job de expiración: saltea ventas que otro proceso está
--    confirmando en este instante (SKIP LOCKED) y también cancela
--    el envío asociado (ventas web).
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liberar_ventas_pendientes_vencidas()
RETURNS void AS $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT id FROM ventas
    WHERE estado = 'Pendiente' AND fecha_hora_expiracion < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- La reserva la libera el trigger trg_fn_gestionar_reserva_stock al pasar
    -- Pendiente -> Cancelada. NO liberar a mano acá: se liberaría dos veces.
    UPDATE ventas
    SET estado = 'Cancelada', motivo_cancelacion = 'Vencimiento automático'
    WHERE id = v.id;

    UPDATE envios SET estado = 'Cancelado'
    WHERE venta_id = v.id AND estado = 'Pendiente';
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------
-- 3) crear_venta_web: valida stock, reserva y crea venta + detalle
--    + envío en UNA sola transacción (ACID).
--
--    p_items: [{"articuloId": "<uuid>", "cantidad": 2}, ...]
--    Los precios salen SIEMPRE de articulos.precio_actual (nunca del
--    navegador). El costo de envío se calcula acá con la misma fórmula
--    que muestra la tienda: fijo + % del subtotal.
--
--    Devuelve jsonb:
--      {ok:true,  venta_id, deposito_id, subtotal, costo_envio, total, items:[...]}
--      {ok:false, codigo:'STOCK_INSUFICIENTE', faltantes:[{articulo_id, descripcion, solicitado, disponible, motivo}]}
--      {ok:false, codigo:'PRECIOS_ACTUALIZADOS', total, items:[{articulo_id, precio_unitario}]}
--    Errores inesperados (datos inválidos) se propagan como EXCEPTION.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_venta_web(
  p_cliente_id      uuid,
  p_items           jsonb,
  p_tipo_entrega    text,
  p_ip              inet,
  p_usuario_id      uuid,
  p_total_esperado  numeric DEFAULT NULL,
  p_envio_fijo      numeric DEFAULT 30000,
  p_envio_pct       numeric DEFAULT 0.03,
  p_minutos_reserva integer DEFAULT 10
) RETURNS jsonb AS $$
DECLARE
  v_lineas    jsonb;
  v_precios   jsonb;
  v_faltantes jsonb;
  v_deposito  uuid;
  v_subtotal  numeric;
  v_envio     numeric := 0;
  v_total     numeric;
  v_venta_id  uuid;
  v_envio_id  uuid;
  r           RECORD;
BEGIN
  -- ---- Validaciones de entrada ----
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra necesita al menos un artículo.';
  END IF;
  IF p_tipo_entrega IS NULL OR p_tipo_entrega NOT IN ('retiro', 'envio a domicilio') THEN
    RAISE EXCEPTION 'Tipo de entrega inválido.';
  END IF;
  IF p_cliente_id IS NULL OR NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id AND estado) THEN
    RAISE EXCEPTION 'Cliente inexistente o inactivo.';
  END IF;

  -- Agrupa líneas repetidas del mismo artículo
  SELECT COALESCE(jsonb_agg(jsonb_build_object('articulo_id', x.articulo_id, 'cantidad', x.cantidad)), '[]'::jsonb)
  INTO v_lineas
  FROM (
    SELECT (i->>'articuloId')::uuid AS articulo_id, SUM((i->>'cantidad')::int) AS cantidad
    FROM jsonb_array_elements(p_items) i
    GROUP BY 1
  ) x;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lineas) l WHERE (l->>'cantidad')::int <= 0) THEN
    RAISE EXCEPTION 'Las cantidades deben ser mayores a cero.';
  END IF;

  -- ---- Libera reservas vencidas para que el soft-lock sea de ~10 min reales
  --      (sin depender de la frecuencia del cron) ----
  PERFORM public.liberar_ventas_pendientes_vencidas();

  -- ---- Un cliente web tiene una sola reserva activa: un nuevo checkout
  --      reemplaza al anterior (evita bloquearse a sí mismo el último
  --      artículo si volvió atrás desde Mercado Pago) ----
  FOR r IN
    SELECT id FROM ventas
    WHERE estado = 'Pendiente' AND cliente_id = p_cliente_id AND usuario_id = p_usuario_id
    FOR UPDATE
  LOOP
    -- (la reserva anterior la libera el trigger al cancelar)
    UPDATE ventas SET estado = 'Cancelada', motivo_cancelacion = 'Reemplazada por un nuevo checkout'
    WHERE id = r.id;
    UPDATE envios SET estado = 'Cancelado' WHERE venta_id = r.id AND estado = 'Pendiente';
  END LOOP;

  -- ---- Bloquea las filas de existencias involucradas (orden fijo => sin deadlocks) ----
  PERFORM 1
  FROM existencias e
  JOIN depositos d ON d.id = e.deposito_id AND d.estado
  WHERE e.articulo_id IN (SELECT (l->>'articulo_id')::uuid FROM jsonb_array_elements(v_lineas) l)
  ORDER BY e.id_art_x_dep
  FOR UPDATE OF e;

  -- ---- Elige el depósito que cubre más líneas completas
  --      (la venta se despacha desde un único depósito) ----
  SELECT dep.deposito_id INTO v_deposito
  FROM (
    SELECT e.deposito_id,
           COUNT(*) FILTER (WHERE e.cantidad - e.cantidad_reservada >= (l->>'cantidad')::int) AS lineas_ok,
           SUM(LEAST(GREATEST(e.cantidad - e.cantidad_reservada, 0), (l->>'cantidad')::int))  AS unidades_cubiertas,
           SUM(GREATEST(e.cantidad - e.cantidad_reservada, 0))                                AS disponible_total
    FROM jsonb_array_elements(v_lineas) l
    JOIN existencias e ON e.articulo_id = (l->>'articulo_id')::uuid
    JOIN depositos d   ON d.id = e.deposito_id AND d.estado
    GROUP BY e.deposito_id
  ) dep
  ORDER BY dep.lineas_ok DESC, dep.unidades_cubiertas DESC, dep.disponible_total DESC
  LIMIT 1;

  -- ---- Artículos que no se pueden cubrir (inexistentes, inactivos o sin stock) ----
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'articulo_id', l->>'articulo_id',
           'descripcion', a.descripcion,
           'solicitado',  (l->>'cantidad')::int,
           'disponible',  GREATEST(COALESCE(e.cantidad - e.cantidad_reservada, 0), 0),
           'motivo',      CASE WHEN a.id IS NULL OR NOT a.estado THEN 'inactivo' ELSE 'sin_stock' END
         )), '[]'::jsonb)
  INTO v_faltantes
  FROM jsonb_array_elements(v_lineas) l
  LEFT JOIN articulos a   ON a.id = (l->>'articulo_id')::uuid
  LEFT JOIN existencias e ON e.articulo_id = a.id AND e.deposito_id = v_deposito
  WHERE a.id IS NULL
     OR NOT a.estado
     OR COALESCE(e.cantidad - e.cantidad_reservada, 0) < (l->>'cantidad')::int;

  IF jsonb_array_length(v_faltantes) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'STOCK_INSUFICIENTE', 'faltantes', v_faltantes);
  END IF;

  -- ---- Precios vigentes desde la base ----
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'articulo_id',     a.id,
           'descripcion',     a.descripcion,
           'cantidad',        (l->>'cantidad')::int,
           'precio_unitario', a.precio_actual
         ) ORDER BY a.descripcion), '[]'::jsonb),
         COALESCE(SUM(a.precio_actual * (l->>'cantidad')::int), 0)
  INTO v_precios, v_subtotal
  FROM jsonb_array_elements(v_lineas) l
  JOIN articulos a ON a.id = (l->>'articulo_id')::uuid;

  IF p_tipo_entrega = 'envio a domicilio' THEN
    v_envio := p_envio_fijo + round(v_subtotal * p_envio_pct, 2);
  END IF;
  v_total := v_subtotal + v_envio;

  -- Si el total que vio el cliente ya no coincide (cambió un precio), no se
  -- reserva ni se cobra: se le informa el total vigente.
  IF p_total_esperado IS NOT NULL AND abs(p_total_esperado - v_total) > 0.02 THEN
    RETURN jsonb_build_object(
      'ok', false, 'codigo', 'PRECIOS_ACTUALIZADOS', 'total', v_total,
      'items', (SELECT jsonb_agg(jsonb_build_object('articulo_id', x->>'articulo_id', 'precio_unitario', x->'precio_unitario'))
                FROM jsonb_array_elements(v_precios) x)
    );
  END IF;

  -- ---- Reserva (soft-lock) ----
  UPDATE existencias e
  SET cantidad_reservada = e.cantidad_reservada + (l->>'cantidad')::int
  FROM jsonb_array_elements(v_lineas) l
  WHERE e.deposito_id = v_deposito
    AND e.articulo_id = (l->>'articulo_id')::uuid;

  -- ---- Venta + detalle + envío ----
  INSERT INTO ventas (deposito_id, usuario_id, cliente_id, estado, total, fecha_hora_expiracion, ip_origen)
  VALUES (v_deposito, p_usuario_id, p_cliente_id, 'Pendiente', v_total,
          now() + make_interval(mins => p_minutos_reserva), p_ip)
  RETURNING id INTO v_venta_id;

  INSERT INTO ventas_detalle (venta_id, articulo_id, cantidad, precio_unitario, importe_linea)
  SELECT v_venta_id,
         (x->>'articulo_id')::uuid,
         (x->>'cantidad')::int,
         (x->>'precio_unitario')::numeric,
         (x->>'cantidad')::int * (x->>'precio_unitario')::numeric
  FROM jsonb_array_elements(v_precios) x;

  INSERT INTO envios (venta_id, cliente_id, tipo, estado)
  VALUES (v_venta_id, p_cliente_id, p_tipo_entrega, 'Pendiente')
  RETURNING id INTO v_envio_id;

  INSERT INTO envios_detalle (envio_id, articulo_id, cantidad)
  SELECT v_envio_id, (x->>'articulo_id')::uuid, (x->>'cantidad')::int
  FROM jsonb_array_elements(v_precios) x;

  RETURN jsonb_build_object(
    'ok', true,
    'venta_id', v_venta_id,
    'deposito_id', v_deposito,
    'subtotal', v_subtotal,
    'costo_envio', v_envio,
    'total', v_total,
    'items', v_precios
  );
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------
-- 4) confirmar_venta_web: lo llama el webhook de Mercado Pago cuando
--    el pago queda 'approved'. Idempotente y atómico.
--
--    Devuelve: 'confirmada' | 'confirmada_tardia' | 'ya_confirmada' |
--              'sin_stock_reembolsar' | 'cancelada_reembolsar' |
--              'monto_no_coincide' | 'no_existe'
--    Los resultados *_reembolsar / monto_no_coincide requieren acción
--    manual (reembolso o revisión): el webhook los deja en el log.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmar_venta_web(
  p_venta_id uuid,
  p_monto    numeric,
  p_metodo   text DEFAULT 'Mercado Pago'
) RETURNS text AS $$
DECLARE
  v          ventas%ROWTYPE;
  v_filas    integer;
  v_lineas   integer;
  v_num      integer;
  v_tardia   boolean := false;
BEGIN
  SELECT * INTO v FROM ventas WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'no_existe'; END IF;

  -- Idempotencia: Mercado Pago puede notificar más de una vez
  IF v.estado = 'Confirmada' THEN RETURN 'ya_confirmada'; END IF;

  IF abs(v.total - p_monto) > 0.01 THEN RETURN 'monto_no_coincide'; END IF;

  IF v.estado <> 'Pendiente' THEN
    -- Pago aprobado DESPUÉS de que la reserva venció o fue liberada
    -- (p. ej. reintento con otra tarjeta tras un rechazo). Se intenta
    -- reservar de nuevo; si ya no hay stock, hay que reembolsar.
    IF v.estado = 'Cancelada'
       AND v.motivo_cancelacion IN ('Vencimiento automático',
                                    'Pago rechazado por Mercado Pago',
                                    'Reemplazada por un nuevo checkout') THEN
      BEGIN
        UPDATE existencias e
        SET cantidad_reservada = e.cantidad_reservada + d.cantidad
        FROM ventas_detalle d
        WHERE d.venta_id = v.id
          AND e.articulo_id = d.articulo_id
          AND e.deposito_id = v.deposito_id
          AND (e.cantidad - e.cantidad_reservada) >= d.cantidad;
        GET DIAGNOSTICS v_filas = ROW_COUNT;

        SELECT COUNT(*) INTO v_lineas FROM ventas_detalle WHERE venta_id = v.id;
        IF v_filas <> v_lineas THEN
          RAISE EXCEPTION 'sin_stock';  -- revierte lo reservado dentro de este bloque
        END IF;
        v_tardia := true;
      EXCEPTION WHEN OTHERS THEN
        UPDATE ventas SET motivo_cancelacion = 'Pago aprobado sin stock disponible: reembolsar'
        WHERE id = v.id;
        RETURN 'sin_stock_reembolsar';
      END;
    ELSE
      UPDATE ventas
      SET motivo_cancelacion = COALESCE(motivo_cancelacion, '') || ' | Pago aprobado posterior: reembolsar'
      WHERE id = v.id AND COALESCE(motivo_cancelacion, '') NOT LIKE '%reembolsar%';
      RETURN 'cancelada_reembolsar';
    END IF;
  END IF;

  -- El descuento del stock real y la liberación de la reserva los hace el trigger
  -- trg_fn_gestionar_reserva_stock al pasar la venta a 'Confirmada' (UPDATE de abajo).
  -- NO llamar a confirmar_stock_venta() acá: descontaría dos veces.

  -- Número de comprobante correlativo (mismo formato VTA-00001 que el POS)
  PERFORM pg_advisory_xact_lock(hashtext('ventas.numero_comprobante'));
  SELECT COALESCE(MAX(substring(numero_comprobante FROM 5)::int), 0) + 1
  INTO v_num
  FROM ventas
  WHERE numero_comprobante ~ '^VTA-[0-9]+$';

  UPDATE ventas
  SET estado = 'Confirmada',
      fecha_hora_registro = now(),
      motivo_cancelacion = NULL,
      numero_comprobante = COALESCE(numero_comprobante, 'VTA-' || lpad(v_num::text, 5, '0'))
  WHERE id = v.id;

  -- El trigger solo descuenta en la transición Pendiente -> Confirmada. En el pago
  -- tardío la venta venía de Cancelada, así que acá se descuenta el stock real y se
  -- libera la reserva que se acaba de volver a tomar.
  IF v_tardia THEN
    PERFORM public.confirmar_stock_venta(v.id);
  END IF;

  INSERT INTO pagos_venta (venta_id, metodo, monto) VALUES (v.id, p_metodo, p_monto);

  RETURN CASE WHEN v_tardia THEN 'confirmada_tardia' ELSE 'confirmada' END;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------
-- 5) cancelar_venta_web: pago rechazado/cancelado, o falla al crear
--    la preferencia de pago. Libera la reserva. true = canceló.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_venta_web(p_venta_id uuid, p_motivo text)
RETURNS boolean AS $$
DECLARE
  v_estado text;
BEGIN
  SELECT estado INTO v_estado FROM ventas WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND OR v_estado <> 'Pendiente' THEN RETURN false; END IF;

  -- La reserva la libera el trigger al pasar Pendiente -> Cancelada.
  UPDATE ventas SET estado = 'Cancelada', motivo_cancelacion = p_motivo WHERE id = p_venta_id;
  UPDATE envios SET estado = 'Cancelado' WHERE venta_id = p_venta_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------
-- 6) Seguridad: estas funciones solo las usa el servidor (service_role).
--    Sin esto, cualquiera con la anon key (pública) podría llamarlas.
-- -------------------------------------------------------------
REVOKE ALL ON FUNCTION public.crear_venta_web(uuid, jsonb, text, inet, uuid, numeric, numeric, numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_venta_web(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_venta_web(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_venta_web(uuid, jsonb, text, inet, uuid, numeric, numeric, numeric, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_venta_web(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_venta_web(uuid, text) TO service_role;
