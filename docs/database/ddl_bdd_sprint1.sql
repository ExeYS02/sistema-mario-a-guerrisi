-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
  stock_min smallint DEFAULT '0'::smallint,
  stock_max smallint DEFAULT '0'::smallint,
  CONSTRAINT existencias_pkey PRIMARY KEY (id_art_x_dep),
  CONSTRAINT exitencias_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id),
  CONSTRAINT exitencias_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.depositos(id)
);
CREATE TABLE public.politicas_reposicion_deposito (
  articulo_id uuid NOT NULL,
  deposito_id uuid NOT NULL,
  stock_minimo integer NOT NULL,
  stock_maximo integer NOT NULL,
  actualizado_por uuid NOT NULL,
  fecha_hora_actualizacion timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT politicas_reposicion_deposito_pkey PRIMARY KEY (articulo_id, deposito_id),
  CONSTRAINT politicas_reposicion_deposito_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id),
  CONSTRAINT politicas_reposicion_deposito_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.depositos(id),
  CONSTRAINT politicas_reposicion_deposito_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id)
);
CREATE TABLE public.transferencias_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  articulo_id uuid NOT NULL,
  deposito_origen_id uuid NOT NULL,
  deposito_destino_id uuid NOT NULL,
  cantidad integer NOT NULL,
  usuario_id uuid NOT NULL,
  ip_origen inet NOT NULL,
  fecha_hora_registro timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT transferencias_stock_pkey PRIMARY KEY (id),
  CONSTRAINT transferencias_stock_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.articulos(id),
  CONSTRAINT transferencias_stock_deposito_origen_id_fkey FOREIGN KEY (deposito_origen_id) REFERENCES public.depositos(id),
  CONSTRAINT transferencias_stock_deposito_destino_id_fkey FOREIGN KEY (deposito_destino_id) REFERENCES public.depositos(id),
  CONSTRAINT transferencias_stock_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
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