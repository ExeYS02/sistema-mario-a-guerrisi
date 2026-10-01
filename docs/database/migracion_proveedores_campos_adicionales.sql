-- =============================================================================
-- HU-11 — Gestión de Proveedores — Migración de campos adicionales
-- =============================================================================
-- Contexto: la tabla public.proveedores ya existe en Supabase (creada por el
-- equipo de base de datos) con las columnas mínimas:
--   id, razon_social, cuit, email, telefono, condicion_pago, estado
--
-- El frontend de HU-11 (formulario de alta/edición, ficha de proveedor y
-- buscador) también necesita nombre de contacto, dirección, notas internas y
-- fecha de alta. Esta migración agrega esas columnas sin tocar las que ya
-- existen ni los datos ya cargados.
--
-- Ejecutar una sola vez contra la base de datos de Supabase.
-- =============================================================================

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS nombre_contacto text NOT NULL DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS direccion text NOT NULL DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS notas text NOT NULL DEFAULT ''::text,
  ADD COLUMN IF NOT EXISTS fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_hora_actualizacion timestamp without time zone NOT NULL DEFAULT now();

-- Reutiliza la función trg_fn_actualizar_timestamp() ya creada en Sprint 1
-- (ver docs/sprint1/trigger_sprint1.sql) para mantener fecha_hora_actualizacion
-- al día en cada UPDATE. Se dropea primero por si ya existía de una corrida
-- previa (la migración es re-ejecutable).
DROP TRIGGER IF EXISTS trg_timestamp_proveedores ON public.proveedores;
CREATE TRIGGER trg_timestamp_proveedores
BEFORE UPDATE ON public.proveedores
FOR EACH ROW EXECUTE FUNCTION trg_fn_actualizar_timestamp();

-- Nota: no se agrega condicion_pago_check ni cuit_formato_check acá porque la
-- tabla real ya trae su propia validación de CUIT (11 dígitos, ver el CHECK
-- original de la tabla). Si condicion_pago no tiene todavía un CHECK que
-- limite los valores a los que usa el frontend (contado, 15_dias, 30_dias,
-- 60_dias, 90_dias, cuenta_corriente), descomentar:
--
-- ALTER TABLE public.proveedores
--   ADD CONSTRAINT proveedores_condicion_pago_check
--   CHECK (condicion_pago IN ('contado', '15_dias', '30_dias', '60_dias', '90_dias', 'cuenta_corriente'));
