-- =============================================================
-- Migración Sprint 3 — Módulo POS (HU-15, HU-16, HU-19, HU-20)
-- Orden de ejecución: respetar el orden de este archivo,
-- ya que hay dependencias de FK entre los bloques.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Habilitar pg_cron (requerido para la expiración automática
--    de reservas). Si tu plan de Supabase no lo ofrece, saltar
--    este bloque y el CREATE EXTENSION / SELECT cron.schedule
--    del final, y resolver la expiración con un cron de Node
--    en erp-backend que llame liberar_ventas_pendientes_vencidas()
--    cada 5 minutos.
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -------------------------------------------------------------
-- 2) Modificaciones a tablas existentes
-- -------------------------------------------------------------

-- DNI directo en clientes (personas físicas). cuit sigue siendo
-- el identificador para empresas/razón social. Ambos nullable
-- porque un cliente usa uno u otro, no necesariamente los dos.
ALTER TABLE public.clientes
  ADD COLUMN dni bigint UNIQUE;

-- Reserva de stock: cuánto de "cantidad" está comprometido por
-- ventas en estado Pendiente, sin descontarse todavía.
ALTER TABLE public.existencias
  ADD COLUMN cantidad_reservada integer NOT NULL DEFAULT 0
    CHECK (cantidad_reservada >= 0 AND cantidad_reservada <= cantidad);

-- -------------------------------------------------------------
-- 3) Tablas nuevas
-- -------------------------------------------------------------

CREATE TABLE public.ventas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_comprobante text UNIQUE,          -- null hasta Confirmar (último + 1 recién ahí)
  deposito_id uuid NOT NULL REFERENCES public.depositos(id),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  cliente_id uuid REFERENCES public.clientes(id),   -- null = consumidor final
  estado text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado = ANY (ARRAY['Pendiente','Cancelada','Confirmada','Anulada'])),
  total numeric NOT NULL,
  fecha_hora_reserva timestamp NOT NULL DEFAULT now(),
  fecha_hora_expiracion timestamp NOT NULL DEFAULT (now() + interval '2 hours'),
  fecha_hora_registro timestamp,              -- se completa al Confirmar
  fecha_hora_anulacion timestamp,
  motivo_cancelacion text,                    -- 'Vencimiento automático' | 'Cancelada por cajero' | null
  ip_origen inet NOT NULL,
  CONSTRAINT ventas_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ventas_detalle (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.ventas(id),
  articulo_id uuid NOT NULL REFERENCES public.articulos(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL,
  importe_linea numeric NOT NULL,   -- cantidad * precio_unitario
  CONSTRAINT ventas_detalle_pkey PRIMARY KEY (id)
);

CREATE TABLE public.pagos_venta (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES public.ventas(id),
  metodo text NOT NULL
    CHECK (metodo = ANY (ARRAY['efectivo','tarjeta_debito','tarjeta_credito','transferencia','cuenta_corriente'])),
  monto numeric NOT NULL CHECK (monto > 0),
  fecha_hora_registro timestamp NOT NULL DEFAULT now(),
  CONSTRAINT pagos_venta_pkey PRIMARY KEY (id)
);

-- -------------------------------------------------------------
-- 4) Función + job de liberación automática de reservas vencidas
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION liberar_ventas_pendientes_vencidas() RETURNS void AS $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT id, deposito_id FROM ventas
    WHERE estado = 'Pendiente' AND fecha_hora_expiracion < now()
  LOOP
    UPDATE existencias e
    SET cantidad_reservada = cantidad_reservada - d.cantidad
    FROM ventas_detalle d
    WHERE d.venta_id = v.id
      AND e.articulo_id = d.articulo_id
      AND e.deposito_id = v.deposito_id;

    UPDATE ventas
    SET estado = 'Cancelada', motivo_cancelacion = 'Vencimiento automático'
    WHERE id = v.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('liberar_reservas_pos', '*/5 * * * *', 'SELECT liberar_ventas_pendientes_vencidas();');

-- =============================================================
-- Pendiente para más adelante (NO ejecutar todavía):
-- Cuando ventas esté en uso real, migrar el FK de
-- notas_credito_debito.factura_origen_id de ventas_mock_origen(id)
-- a ventas(id), y migrar los datos de prueba si los hubiera.
-- =============================================================
