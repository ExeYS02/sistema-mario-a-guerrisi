-- =============================================================
-- Prueba de humo de HU-34 (reserva atómica de stock del checkout web).
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de migracion_hu34_reserva_web.sql.
--
-- Corre todo dentro de una transacción y termina con ROLLBACK: no deja
-- ningún dato (ni cambia el stock real). Si algo falla, el mensaje de error
-- dice qué caso se rompió. Si termina bien, muestra el NOTICE
-- "HU-34: TODAS LAS PRUEBAS OK".
--
-- Nota: el caso 5 detecta descuentos duplicados de stock (falla con
-- "descuento duplicado o incorrecto").
-- =============================================================
BEGIN;

DO $$
DECLARE
  v_web  uuid := '00000000-0000-0000-0000-000000000001';
  v_art  uuid;
  v_dep  uuid;
  v_cli1 uuid;
  v_cli2 uuid;
  v_res  jsonb;
  v_v1   uuid;
  v_v2   uuid;
  v_resv int;
  v_txt  text;
  v_estado text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = v_web) THEN
    RAISE EXCEPTION 'No existe el usuario sistema web % en la tabla usuarios', v_web;
  END IF;

  -- Artículo activo con existencias en un depósito activo
  SELECT e.articulo_id, e.deposito_id INTO v_art, v_dep
  FROM existencias e
  JOIN articulos a ON a.id = e.articulo_id AND a.estado
  JOIN depositos d ON d.id = e.deposito_id AND d.estado
  LIMIT 1;
  IF v_art IS NULL THEN RAISE EXCEPTION 'No hay artículos con existencias para probar'; END IF;

  -- Escenario controlado: 5 unidades, 0 reservadas, solo en ese depósito
  UPDATE existencias SET cantidad = 0, cantidad_reservada = 0 WHERE articulo_id = v_art AND deposito_id <> v_dep;
  UPDATE existencias SET cantidad = 5, cantidad_reservada = 0 WHERE articulo_id = v_art AND deposito_id = v_dep;

  INSERT INTO clientes (razon_social, dni) VALUES ('TEST HU34 uno', 99999991) RETURNING id INTO v_cli1;
  INSERT INTO clientes (razon_social, dni) VALUES ('TEST HU34 dos', 99999992) RETURNING id INTO v_cli2;

  -- 1) Pedir más de lo que hay => bloquea y no reserva (criterios 1 y 2)
  v_res := crear_venta_web(v_cli1, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 6)),
                           'retiro', '127.0.0.1'::inet, v_web);
  IF (v_res->>'ok')::boolean OR v_res->>'codigo' <> 'STOCK_INSUFICIENTE'
     OR (v_res->'faltantes'->0->>'disponible')::int <> 5 THEN
    RAISE EXCEPTION 'Caso 1 falló: %', v_res;
  END IF;
  SELECT cantidad_reservada INTO v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_resv <> 0 THEN RAISE EXCEPTION 'Caso 1: no debía reservar nada (reservada=%)', v_resv; END IF;

  -- 2) Pedido válido => reserva + venta Pendiente + envío (criterio 3)
  v_res := crear_venta_web(v_cli1, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 3)),
                           'envio a domicilio', '127.0.0.1'::inet, v_web);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'Caso 2 falló: %', v_res; END IF;
  v_v1 := (v_res->>'venta_id')::uuid;
  SELECT cantidad_reservada INTO v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_resv <> 3 THEN RAISE EXCEPTION 'Caso 2: reservada debía ser 3 y es %', v_resv; END IF;
  IF (v_res->>'costo_envio')::numeric <= 0 THEN RAISE EXCEPTION 'Caso 2: faltó el costo de envío'; END IF;
  IF NOT EXISTS (SELECT 1 FROM envios WHERE venta_id = v_v1 AND tipo = 'envio a domicilio' AND estado = 'Pendiente')
     OR NOT EXISTS (SELECT 1 FROM ventas_detalle WHERE venta_id = v_v1 AND cantidad = 3) THEN
    RAISE EXCEPTION 'Caso 2: faltan envío o detalle';
  END IF;

  -- 3) Otro cliente pide 3 más: solo quedan 2 disponibles => bloquea (anti-sobreventa)
  v_res := crear_venta_web(v_cli2, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 3)),
                           'retiro', '127.0.0.1'::inet, v_web);
  IF (v_res->>'ok')::boolean OR (v_res->'faltantes'->0->>'disponible')::int <> 2 THEN
    RAISE EXCEPTION 'Caso 3 falló (debía quedar 2 disponible): %', v_res;
  END IF;

  -- 4) El mismo cliente reintenta con 5: la reserva anterior se reemplaza
  v_res := crear_venta_web(v_cli1, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 5)),
                           'retiro', '127.0.0.1'::inet, v_web);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'Caso 4 falló: %', v_res; END IF;
  v_v2 := (v_res->>'venta_id')::uuid;
  SELECT estado, motivo_cancelacion INTO v_estado, v_txt FROM ventas WHERE id = v_v1;
  IF v_estado <> 'Cancelada' THEN RAISE EXCEPTION 'Caso 4: la venta anterior debía quedar Cancelada y está %', v_estado; END IF;
  SELECT cantidad_reservada INTO v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_resv <> 5 THEN RAISE EXCEPTION 'Caso 4: reservada debía ser 5 y es %', v_resv; END IF;

  -- 4b) Cantidad 0 => error de validación (no llega a reservar nada)
  BEGIN
    PERFORM crear_venta_web(v_cli2, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 0)),
                            'retiro', '127.0.0.1'::inet, v_web);
    RAISE EXCEPTION 'Caso 4b: una cantidad 0 debía ser rechazada';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%mayores a cero%' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'HU-34: casos 1-4 OK';
END $$;

-- Segundo bloque: rearma un escenario limpio (5 unidades, 0 reservadas)
DO $$
DECLARE
  v_web  uuid := '00000000-0000-0000-0000-000000000001';
  v_art  uuid;
  v_dep  uuid;
  v_cli  uuid;
  v_cli2 uuid;
  v_res  jsonb;
  v_v    uuid;
  v_b    uuid;
  v_cant int;
  v_resv int;
  v_txt  text;
  v_estado text;
  v_num  text;
  v_total numeric;
BEGIN
  SELECT e.articulo_id, e.deposito_id INTO v_art, v_dep
  FROM existencias e
  JOIN articulos a ON a.id = e.articulo_id AND a.estado
  JOIN depositos d ON d.id = e.deposito_id AND d.estado
  LIMIT 1;
  UPDATE existencias SET cantidad = 0, cantidad_reservada = 0 WHERE articulo_id = v_art AND deposito_id <> v_dep;
  UPDATE existencias SET cantidad = 5, cantidad_reservada = 0 WHERE articulo_id = v_art AND deposito_id = v_dep;
  INSERT INTO clientes (razon_social, dni) VALUES ('TEST HU34 tres', 99999993) RETURNING id INTO v_cli;
  INSERT INTO clientes (razon_social, dni) VALUES ('TEST HU34 cuatro', 99999994) RETURNING id INTO v_cli2;

  -- 5) Confirmación: descuenta stock real UNA vez, libera la reserva, numera y registra el pago
  v_res := crear_venta_web(v_cli, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 5)),
                           'retiro', '127.0.0.1'::inet, v_web);
  v_v := (v_res->>'venta_id')::uuid;
  v_total := (v_res->>'total')::numeric;
  v_txt := confirmar_venta_web(v_v, v_total);
  IF v_txt <> 'confirmada' THEN RAISE EXCEPTION 'Caso 5: esperaba confirmada y devolvió %', v_txt; END IF;
  SELECT cantidad, cantidad_reservada INTO v_cant, v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_cant <> 0 OR v_resv <> 0 THEN
    RAISE EXCEPTION 'Caso 5: descuento duplicado o incorrecto (cantidad=%, reservada=%; se esperaba 0 y 0)', v_cant, v_resv;
  END IF;
  SELECT numero_comprobante INTO v_num FROM ventas WHERE id = v_v;
  IF v_num IS NULL OR v_num !~ '^VTA-[0-9]{5}$' THEN RAISE EXCEPTION 'Caso 5: comprobante inválido (%)', v_num; END IF;
  IF (SELECT COUNT(*) FROM pagos_venta WHERE venta_id = v_v) <> 1 THEN RAISE EXCEPTION 'Caso 5: debía haber 1 pago'; END IF;

  -- 6) Idempotencia: el webhook repetido no vuelve a descontar ni a cobrar
  v_txt := confirmar_venta_web(v_v, v_total);
  IF v_txt <> 'ya_confirmada' THEN RAISE EXCEPTION 'Caso 6: esperaba ya_confirmada y devolvió %', v_txt; END IF;
  SELECT cantidad INTO v_cant FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_cant <> 0 OR (SELECT COUNT(*) FROM pagos_venta WHERE venta_id = v_v) <> 1 THEN
    RAISE EXCEPTION 'Caso 6: la segunda notificación duplicó el efecto';
  END IF;

  -- 7) Monto que no coincide => no confirma
  UPDATE existencias SET cantidad = 5 WHERE articulo_id = v_art AND deposito_id = v_dep;
  v_res := crear_venta_web(v_cli, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 2)),
                           'retiro', '127.0.0.1'::inet, v_web);
  v_v := (v_res->>'venta_id')::uuid;
  IF confirmar_venta_web(v_v, 1) <> 'monto_no_coincide' THEN RAISE EXCEPTION 'Caso 7: debía rechazar el monto'; END IF;

  -- 8) Vencimiento: el job libera SOLO la reserva vencida (la de otro cliente, vigente, queda intacta)
  v_res := crear_venta_web(v_cli2, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 1)),
                           'retiro', '127.0.0.1'::inet, v_web);
  v_b := (v_res->>'venta_id')::uuid;
  UPDATE ventas SET fecha_hora_expiracion = now() - interval '1 minute' WHERE id = v_v;
  PERFORM liberar_ventas_pendientes_vencidas();
  SELECT estado, motivo_cancelacion INTO v_estado, v_txt FROM ventas WHERE id = v_v;
  SELECT cantidad_reservada INTO v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_estado <> 'Cancelada' OR v_txt <> 'Vencimiento automático' OR v_resv <> 1 THEN
    RAISE EXCEPTION 'Caso 8: vencimiento incorrecto (estado=%, motivo=%, reservada=%)', v_estado, v_txt, v_resv;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM envios WHERE venta_id = v_v AND estado = 'Cancelado') THEN
    RAISE EXCEPTION 'Caso 8: el envío debía quedar Cancelado';
  END IF;
  IF NOT cancelar_venta_web(v_b, 'limpieza del test') THEN RAISE EXCEPTION 'Caso 8: no pudo cancelar la reserva del otro cliente'; END IF;

  -- 9) Pago aprobado tarde, CON stock: se vuelve a reservar y se confirma
  v_txt := confirmar_venta_web(v_v, (SELECT total FROM ventas WHERE id = v_v));
  IF v_txt <> 'confirmada_tardia' THEN RAISE EXCEPTION 'Caso 9: esperaba confirmada_tardia y devolvió %', v_txt; END IF;
  SELECT cantidad, cantidad_reservada INTO v_cant, v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_cant <> 3 OR v_resv <> 0 THEN RAISE EXCEPTION 'Caso 9: stock incorrecto (cantidad=%, reservada=%; se esperaba 3 y 0)', v_cant, v_resv; END IF;

  -- 10) Pago aprobado tarde, SIN stock: no confirma y marca para reembolso
  v_res := crear_venta_web(v_cli, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 3)),
                           'retiro', '127.0.0.1'::inet, v_web);
  v_v := (v_res->>'venta_id')::uuid;
  UPDATE ventas SET fecha_hora_expiracion = now() - interval '1 minute' WHERE id = v_v;
  PERFORM liberar_ventas_pendientes_vencidas();
  UPDATE existencias SET cantidad = 1 WHERE articulo_id = v_art AND deposito_id = v_dep;
  v_txt := confirmar_venta_web(v_v, (SELECT total FROM ventas WHERE id = v_v));
  IF v_txt <> 'sin_stock_reembolsar' THEN RAISE EXCEPTION 'Caso 10: esperaba sin_stock_reembolsar y devolvió %', v_txt; END IF;
  SELECT cantidad, cantidad_reservada INTO v_cant, v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_cant <> 1 OR v_resv <> 0 THEN RAISE EXCEPTION 'Caso 10: no debía tocar el stock (cantidad=%, reservada=%)', v_cant, v_resv; END IF;

  -- 11) Cancelación por pago rechazado: libera SOLO su reserva (la del otro cliente queda intacta)
  UPDATE existencias SET cantidad = 5 WHERE articulo_id = v_art AND deposito_id = v_dep;
  v_res := crear_venta_web(v_cli, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 2)),
                           'retiro', '127.0.0.1'::inet, v_web);
  v_v := (v_res->>'venta_id')::uuid;
  v_res := crear_venta_web(v_cli2, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 2)),
                           'retiro', '127.0.0.1'::inet, v_web);
  v_b := (v_res->>'venta_id')::uuid;
  IF NOT cancelar_venta_web(v_v, 'Pago rechazado por Mercado Pago') THEN RAISE EXCEPTION 'Caso 11: no canceló'; END IF;
  SELECT cantidad_reservada INTO v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_resv <> 2 THEN RAISE EXCEPTION 'Caso 11: debía quedar la reserva del otro cliente (2) y hay % (¿doble liberación?)', v_resv; END IF;
  IF cancelar_venta_web(v_v, 'otra vez') THEN RAISE EXCEPTION 'Caso 11: cancelar dos veces debía devolver false'; END IF;
  IF NOT cancelar_venta_web(v_b, 'limpieza del test') THEN RAISE EXCEPTION 'Caso 11: no pudo cancelar la segunda'; END IF;
  SELECT cantidad_reservada INTO v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_resv <> 0 THEN RAISE EXCEPTION 'Caso 11: la reserva no se liberó (reservada=%)', v_resv; END IF;

  -- 12) Cambio de precio: si el total esperado no coincide, no reserva
  v_res := crear_venta_web(v_cli, jsonb_build_array(jsonb_build_object('articuloId', v_art, 'cantidad', 1)),
                           'retiro', '127.0.0.1'::inet, v_web, 1);
  IF (v_res->>'ok')::boolean OR v_res->>'codigo' <> 'PRECIOS_ACTUALIZADOS' THEN RAISE EXCEPTION 'Caso 12 falló: %', v_res; END IF;
  SELECT cantidad_reservada INTO v_resv FROM existencias WHERE articulo_id = v_art AND deposito_id = v_dep;
  IF v_resv <> 0 THEN RAISE EXCEPTION 'Caso 12: no debía reservar (reservada=%)', v_resv; END IF;

  RAISE NOTICE 'HU-34: TODAS LAS PRUEBAS OK';
END $$;

ROLLBACK;
