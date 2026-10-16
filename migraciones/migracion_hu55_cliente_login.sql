-- Migración HU-55: Login del Cliente Web (Flujo Simplificado)
-- No se requieren cambios estructurales (DDL) para el Guest Checkout.
-- La tabla public.clientes ya posee los campos necesarios (id UUID, dni, email, telefono).

SELECT 'Migración HU-55 aplicada: Sin cambios requeridos en el esquema' AS estado_migracion;