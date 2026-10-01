CREATE OR REPLACE FUNCTION trg_fn_procesar_transferencia_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Restar stock del depósito de origen
    UPDATE public.existencias
    SET cantidad = cantidad - NEW.cantidad
    WHERE articulo_id = NEW.articulo_id AND deposito_id = NEW.deposito_origen_id;

    -- 2. Sumar stock al depósito de destino (Upsert)
    INSERT INTO public.existencias (articulo_id, deposito_id, cantidad)
    VALUES (NEW.articulo_id, NEW.deposito_destino_id, NEW.cantidad)
    ON CONFLICT (articulo_id, deposito_id)
    DO UPDATE SET cantidad = public.existencias.cantidad + NEW.cantidad;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_procesar_transferencia_stock
AFTER INSERT ON public.transferencias_stock
FOR EACH ROW
EXECUTE FUNCTION trg_fn_procesar_transferencia_stock();

-- Función 1: Validación y bloqueo concurrente
CREATE OR REPLACE FUNCTION trg_fn_validar_ajuste_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_cantidad_actual integer;
BEGIN
    -- Bloqueo de fila (FOR UPDATE) para lecturas consistentes
    SELECT cantidad INTO v_cantidad_actual
    FROM public.existencias
    WHERE articulo_id = NEW.articulo_id AND deposito_id = NEW.deposito_id
    FOR UPDATE;

    IF v_cantidad_actual IS NULL THEN v_cantidad_actual := 0; END IF;

    IF v_cantidad_actual <> NEW.cantidad_anterior THEN
        RAISE EXCEPTION 'Carrera detectada: La cantidad anterior (%) no coincide con la existencia actual (%).', NEW.cantidad_anterior, v_cantidad_actual;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_ajuste_stock
BEFORE INSERT ON public.ajustes_stock
FOR EACH ROW
EXECUTE FUNCTION trg_fn_validar_ajuste_stock();

-- Función 2: Aplicación del ajuste
CREATE OR REPLACE FUNCTION trg_fn_aplicar_ajuste_stock()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.existencias (articulo_id, deposito_id, cantidad)
    VALUES (NEW.articulo_id, NEW.deposito_id, NEW.cantidad_nueva)
    ON CONFLICT (articulo_id, deposito_id)
    DO UPDATE SET cantidad = NEW.cantidad_nueva;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aplicar_ajuste_stock
AFTER INSERT ON public.ajustes_stock
FOR EACH ROW
EXECUTE FUNCTION trg_fn_aplicar_ajuste_stock();

CREATE OR REPLACE FUNCTION trg_fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_hora_actualizacion = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_timestamp_articulos
BEFORE UPDATE ON public.articulos
FOR EACH ROW EXECUTE FUNCTION trg_fn_actualizar_timestamp();

CREATE TRIGGER trg_timestamp_existencias
BEFORE UPDATE ON public.existencias
FOR EACH ROW EXECUTE FUNCTION trg_fn_actualizar_timestamp();

CREATE TRIGGER trg_timestamp_politicas
BEFORE UPDATE ON public.politicas_reposicion_deposito
FOR EACH ROW EXECUTE FUNCTION trg_fn_actualizar_timestamp();

CREATE OR REPLACE FUNCTION trg_fn_registrar_historial_precio()
RETURNS TRIGGER AS $$
DECLARE
    v_usuario_id uuid;
BEGIN
    IF OLD.precio_actual IS DISTINCT FROM NEW.precio_actual THEN
        -- Intentamos capturar el usuario de la sesión de Supabase
        v_usuario_id := auth.uid();
        
        -- Si no hay sesión activa, tomamos un usuario de la tabla como fallback
        IF v_usuario_id IS NULL THEN
            SELECT id INTO v_usuario_id FROM public.usuarios LIMIT 1;
        END IF;

        INSERT INTO public.historial_precios (articulo_id, precio, usuario_id)
        VALUES (NEW.id, OLD.precio_actual, v_usuario_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;