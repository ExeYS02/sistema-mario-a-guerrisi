-- HU-32: índices para que el catálogo web y su búsqueda respondan en < 2 s.
-- Ejecutar una vez en el SQL Editor de Supabase. Es idempotente (IF NOT EXISTS).

-- Búsqueda por texto (ilike '%palabra%') sobre descripción, modelo y códigos
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_articulos_descripcion_trgm on public.articulos using gin (descripcion extensions.gin_trgm_ops);
create index if not exists idx_articulos_modelo_trgm      on public.articulos using gin (modelo extensions.gin_trgm_ops);
create index if not exists idx_articulos_codigo_int_trgm  on public.articulos using gin (codigo_interno extensions.gin_trgm_ops);
create index if not exists idx_articulos_ean13_trgm       on public.articulos using gin (codigo_ean13 extensions.gin_trgm_ops);

-- Filtros y ordenamientos del catálogo (solo artículos activos)
create index if not exists idx_articulos_estado_registro on public.articulos (estado, fecha_hora_registro desc);
create index if not exists idx_articulos_estado_precio   on public.articulos (estado, precio_actual);
create index if not exists idx_articulos_categoria       on public.articulos (categoria_id);
create index if not exists idx_articulos_marca           on public.articulos (marca_id);
create index if not exists idx_articulos_pais_origen     on public.articulos (pais_origen);

-- Disponibilidad por artículo
create index if not exists idx_existencias_articulo on public.existencias (articulo_id);
