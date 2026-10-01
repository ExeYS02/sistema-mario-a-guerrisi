-- =============================================================================
-- HU-11 — Gestión de Proveedores — DDL sugerido
-- =============================================================================
-- WARNING: al igual que docs/sprint1/ddl_bdd_sprint1.sql, este esquema se deja
-- como referencia de contexto para el equipo de base de datos. Ejecutar y
-- ajustar según el estado real de la BD antes de correrlo en Supabase.
--
-- Dependencias funcionales (según la HU): ninguna para esta tabla en sí.
-- Bloquea a: HU-12 (Cotizaciones y OC), HU-13 (Recepción) y HU-14 (Cuentas por
-- pagar), que van a referenciar proveedores.id como FK.
-- =============================================================================

CREATE TABLE public.proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  cuit text NOT NULL UNIQUE, -- guardado sin guiones (solo 11 dígitos); el formato XX-XXXXXXXX-X se aplica en el frontend
  nombre_contacto text NOT NULL DEFAULT ''::text,
  telefono text NOT NULL,
  email text NOT NULL,
  direccion text NOT NULL DEFAULT ''::text,
  condicion_pago text NOT NULL,
  notas text NOT NULL DEFAULT ''::text,
  estado boolean NOT NULL DEFAULT true,
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  fecha_hora_actualizacion timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT proveedores_pkey PRIMARY KEY (id),
  -- Mismo set de valores que CONDICIONES_PAGO en erp-front/src/pages/Gestion_de_proveedores.jsx.
  -- Si el negocio pide administrar condiciones de pago dinámicamente, migrar a
  -- una tabla maestra (mismo patrón que categorias/marcas/paises_origen).
  CONSTRAINT proveedores_condicion_pago_check CHECK (
    condicion_pago IN ('contado', '15_dias', '30_dias', '60_dias', '90_dias', 'cuenta_corriente')
  ),
  -- Validación básica de formato (11 dígitos numéricos). La validación fuerte
  -- del dígito verificador módulo 11 se hace en frontend (utils/cuit.js) y se
  -- puede replicar en backend si se necesita blindar contra clientes no-web.
  CONSTRAINT proveedores_cuit_formato_check CHECK (cuit ~ '^[0-9]{11}$')
);

-- Reutiliza la función trg_fn_actualizar_timestamp() ya creada en Sprint 1
-- (ver docs/sprint1/trigger_sprint1.sql) para mantener fecha_hora_actualizacion.
CREATE TRIGGER trg_timestamp_proveedores
BEFORE UPDATE ON public.proveedores
FOR EACH ROW EXECUTE FUNCTION trg_fn_actualizar_timestamp();

-- Índice para acelerar la búsqueda de duplicados por CUIT (criterio de
-- aceptación 2 de HU-11). UNIQUE ya crea un índice, se deja explícito por claridad.
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_cuit ON public.proveedores (cuit);

-- =============================================================================
-- Fuera de alcance de HU-11 (queda para HU-12/HU-13):
-- CREATE TABLE public.ordenes_compra ( ... proveedor_id uuid REFERENCES proveedores(id) ... )
-- El criterio de aceptación 3 de HU-11 (ficha con historial de OC y montos
-- operados) va a consultar esa tabla una vez que exista.
-- =============================================================================
