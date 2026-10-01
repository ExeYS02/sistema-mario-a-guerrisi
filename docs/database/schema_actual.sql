-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- Esquema ACTUAL completo de la base (Supabase / PostgreSQL). Solo referencia.
-- Para crear la base desde cero ver los demás .sql de esta carpeta (en orden de sprint).

CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  estado boolean NOT NULL DEFAULT true,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.depositos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  direccion text NOT NULL DEFAULT ''::text,
  estado boolean NOT NULL DEFAULT true,
  CONSTRAINT depositos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categorias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  estado boolean DEFAULT true,
  CONSTRAINT categorias_pkey PRIMARY KEY (id)
);
CREATE TABLE public.marcas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  estado boolean NOT NULL DEFAULT true,
  CONSTRAINT marcas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.paises_origen (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  estado boolean DEFAULT true,
  CONSTRAINT paises_origen_pkey PRIMARY KEY (id)
);
CREATE TABLE public.motivos_ajustes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  estado boolean NOT NULL DEFAULT true,
  CONSTRAINT motivos_ajustes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  dni bigint NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  estado boolean NOT NULL DEFAULT true,
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  rol_id uuid NOT NULL,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES public.roles(id)
);
CREATE TABLE public.articulos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo_interno text NOT NULL DEFAULT ('COD-'::text || lpad((nextval('sq_articulos_codigo'::regclass))::text, 5, '0'::text)) UNIQUE,
  descripcion text NOT NULL,
  codigo_ean13 text NOT NULL UNIQUE,
  categoria_id uuid NOT NULL,
  marca_id uuid NOT NULL,
  pais_origen uuid NOT NULL,
  precio_actual numeric NOT NULL,
  estado boolean NOT NULL DEFAULT true,
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  fecha_hora_actualizacion timestamp without time zone NOT NULL DEFAULT now(),
  modelo text NOT NULL DEFAULT 'Sin especificar'::text,
  CONSTRAINT articulos_pkey PRIMARY KEY (id),
  CONSTRAINT articulos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id),
  CONSTRAINT articulos_marca_id_fkey FOREIGN KEY (marca_id) REFERENCES public.marcas(id),
  CONSTRAINT articulos_pais_origen_fkey FOREIGN KEY (pais_origen) REFERENCES public.paises_origen(id)
);
CREATE TABLE public.historial_precios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  articulo_id uuid NOT NULL,
  precio numeric NOT NULL,
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  usuario_id uuid NOT NULL,
  CONSTRAINT historial_precios_pkey PRIMARY KEY (id),
  CONSTRAINT historial_precios_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id),
  CONSTRAINT historial_precios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.existencias (
  articulo_id uuid NOT NULL,
  deposito_id uuid NOT NULL,
  cantidad integer NOT NULL DEFAULT 0,
  fecha_hora_actualizacion timestamp without time zone NOT NULL DEFAULT now(),
  id_art_x_dep uuid NOT NULL DEFAULT gen_random_uuid(),
  stock_minimo integer DEFAULT '0'::smallint,
  stock_maximo integer DEFAULT '0'::smallint,
  actualizado_por uuid,
  cantidad_reservada integer NOT NULL DEFAULT 0,
  CONSTRAINT existencias_pkey PRIMARY KEY (id_art_x_dep),
  CONSTRAINT exitencias_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id),
  CONSTRAINT exitencias_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.depositos(id),
  CONSTRAINT existencias_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id)
);
CREATE TABLE public.ajustes_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  articulo_id uuid NOT NULL,
  deposito_id uuid NOT NULL,
  motivo_id uuid NOT NULL,
  cantidad_anterior integer NOT NULL,
  cantidad_nueva integer NOT NULL,
  usuario_id uuid NOT NULL,
  ip_origen inet NOT NULL,
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT ajustes_stock_pkey PRIMARY KEY (id),
  CONSTRAINT ajustes_stock_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id),
  CONSTRAINT ajustes_stock_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.depositos(id),
  CONSTRAINT ajustes_stock_motivo_id_fkey FOREIGN KEY (motivo_id) REFERENCES public.motivos_ajustes(id),
  CONSTRAINT ajustes_stock_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  cuit character varying NOT NULL UNIQUE CHECK (cuit::text ~ '^[0-9]{11}$'::text),
  email text NOT NULL DEFAULT ''::text,
  telefono text NOT NULL DEFAULT ''::text,
  condicion_pago text NOT NULL CHECK (condicion_pago = ANY (ARRAY['contado'::text, '15_dias'::text, '30_dias'::text, '60_dias'::text, '90_dias'::text, 'cuenta_corriente'::text])),
  estado boolean NOT NULL DEFAULT true,
  nombre_contacto text NOT NULL DEFAULT ''::text,
  direccion text NOT NULL DEFAULT ''::text,
  notas text NOT NULL DEFAULT ''::text,
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  fecha_hora_actualizacion timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT proveedores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ordenes_compra (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_orden integer NOT NULL DEFAULT nextval('ordenes_compra_numero_orden_seq'::regclass) UNIQUE,
  proveedor_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'::text CHECK (estado = ANY (ARRAY['Pendiente'::text, 'Parcial'::text, 'Recibida'::text, 'Cancelada'::text])),
  fecha_emision timestamp without time zone NOT NULL DEFAULT now(),
  cotizacion_id uuid NOT NULL,
  CONSTRAINT ordenes_compra_pkey PRIMARY KEY (id),
  CONSTRAINT ordenes_compra_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id),
  CONSTRAINT ordenes_compra_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT ordenes_compra_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES public.cotizaciones(id)
);
CREATE TABLE public.ordenes_compra_detalle (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  orden_compra_id uuid NOT NULL,
  articulo_id uuid NOT NULL,
  cantidad_solicitada integer NOT NULL CHECK (cantidad_solicitada > 0),
  cantidad_recibida integer NOT NULL DEFAULT 0,
  precio_unitario numeric NOT NULL,
  CONSTRAINT ordenes_compra_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT ordenes_compra_detalle_oc_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id),
  CONSTRAINT ordenes_compra_detalle_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id)
);
CREATE TABLE public.cuentas_por_pagar (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL,
  orden_compra_id uuid,
  monto_total numeric NOT NULL,
  saldo_pendiente numeric NOT NULL,
  fecha_vencimiento date NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'::text CHECK (estado = ANY (ARRAY['Pendiente'::text, 'Pagada'::text, 'Mora'::text])),
  comprobante_proveedor_id uuid,
  CONSTRAINT cuentas_por_pagar_pkey PRIMARY KEY (id),
  CONSTRAINT cuentas_por_pagar_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id),
  CONSTRAINT cuentas_por_pagar_oc_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id),
  CONSTRAINT cuentas_por_pagar_comprobante_proveedor_id_fkey FOREIGN KEY (comprobante_proveedor_id) REFERENCES public.comprobantes_proveedores(id)
);
CREATE TABLE public.pagos_cxp (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cuenta_por_pagar_id uuid NOT NULL,
  monto_pagado numeric NOT NULL CHECK (monto_pagado > 0::numeric),
  fecha_pago timestamp without time zone NOT NULL DEFAULT now(),
  usuario_id uuid NOT NULL,
  CONSTRAINT pagos_cxp_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_cxp_cxp_id_fkey FOREIGN KEY (cuenta_por_pagar_id) REFERENCES public.cuentas_por_pagar(id),
  CONSTRAINT pagos_cxp_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  cuit character varying UNIQUE CHECK (cuit::text ~ '^[0-9]{11}$'::text),
  estado boolean NOT NULL DEFAULT true,
  dni bigint UNIQUE,
  telefono text NOT NULL DEFAULT ''::text,
  direccion text NOT NULL DEFAULT ''::text,
  email text,
  CONSTRAINT clientes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cotizaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'::text CHECK (estado = ANY (ARRAY['Pendiente'::text, 'Enviada'::text, 'Aprobada'::text, 'Cancelada'::text])),
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  fecha_hora_actualizacion timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cotizaciones_pkey PRIMARY KEY (id),
  CONSTRAINT cotizaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.cotizaciones_detalle (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL,
  articulo_id uuid NOT NULL,
  cantidad_solicitada integer NOT NULL CHECK (cantidad_solicitada > 0),
  CONSTRAINT cotizaciones_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT cotizaciones_detalle_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES public.cotizaciones(id),
  CONSTRAINT cotizaciones_detalle_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id)
);
CREATE TABLE public.cotizaciones_proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL,
  proveedor_id uuid NOT NULL,
  fecha_envio timestamp without time zone NOT NULL DEFAULT now(),
  estado_respuesta text NOT NULL DEFAULT 'Pendiente'::text CHECK (estado_respuesta = ANY (ARRAY['Pendiente'::text, 'Respondida'::text, 'Sin respuesta'::text])),
  CONSTRAINT cotizaciones_proveedores_pkey PRIMARY KEY (id),
  CONSTRAINT cotizaciones_proveedores_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES public.cotizaciones(id),
  CONSTRAINT cotizaciones_proveedores_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id)
);
CREATE TABLE public.cotizaciones_proveedores_detalle (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotizacion_proveedor_id uuid NOT NULL,
  articulo_id uuid NOT NULL,
  precio_unitario_ofertado numeric NOT NULL CHECK (precio_unitario_ofertado > 0::numeric),
  CONSTRAINT cotizaciones_proveedores_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT cotizaciones_proveedores_detalle_cp_id_fkey FOREIGN KEY (cotizacion_proveedor_id) REFERENCES public.cotizaciones_proveedores(id),
  CONSTRAINT cotizaciones_proveedores_detalle_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id)
);
CREATE TABLE public.comprobantes_proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL,
  orden_compra_id uuid,
  numero_comprobante text NOT NULL,
  tipo_comprobante text NOT NULL CHECK (tipo_comprobante = ANY (ARRAY['Factura A'::text, 'Factura B'::text, 'Factura C'::text, 'Nota de Crédito'::text, 'Nota de Débito'::text, 'Remito'::text])),
  fecha_emision date NOT NULL,
  fecha_registro timestamp without time zone NOT NULL DEFAULT now(),
  monto_total numeric NOT NULL CHECK (monto_total >= 0::numeric),
  usuario_id uuid,
  fecha_vencimiento date,
  CONSTRAINT comprobantes_proveedores_pkey PRIMARY KEY (id),
  CONSTRAINT comprobantes_proveedores_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id),
  CONSTRAINT comprobantes_proveedores_oc_id_fkey FOREIGN KEY (orden_compra_id) REFERENCES public.ordenes_compra(id),
  CONSTRAINT comprobantes_proveedores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.comprobantes_proveedores_detalle (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comprobante_id uuid NOT NULL,
  articulo_id uuid NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0::numeric),
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  CONSTRAINT comprobantes_proveedores_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT comprobantes_proveedores_detalle_comp_id_fkey FOREIGN KEY (comprobante_id) REFERENCES public.comprobantes_proveedores(id),
  CONSTRAINT comprobantes_proveedores_detalle_art_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id)
);
CREATE TABLE public.ventas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_comprobante text UNIQUE,
  deposito_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  cliente_id uuid,
  estado text NOT NULL DEFAULT 'Pendiente'::text CHECK (estado = ANY (ARRAY['Pendiente'::text, 'Cancelada'::text, 'Confirmada'::text, 'Anulada'::text])),
  total numeric NOT NULL,
  fecha_hora_reserva timestamp without time zone NOT NULL DEFAULT now(),
  fecha_hora_expiracion timestamp without time zone NOT NULL DEFAULT (now() + '00:10:00'::interval),
  fecha_hora_registro timestamp without time zone,
  fecha_hora_anulacion timestamp without time zone,
  motivo_cancelacion text,
  ip_origen inet NOT NULL,
  CONSTRAINT ventas_pkey PRIMARY KEY (id),
  CONSTRAINT ventas_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.depositos(id),
  CONSTRAINT ventas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.ventas_detalle (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL,
  articulo_id uuid NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL,
  importe_linea numeric NOT NULL,
  CONSTRAINT ventas_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT ventas_detalle_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT ventas_detalle_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id)
);
CREATE TABLE public.pagos_venta (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL,
  metodo text NOT NULL,
  monto numeric NOT NULL CHECK (monto > 0::numeric),
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT pagos_venta_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_venta_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id)
);
