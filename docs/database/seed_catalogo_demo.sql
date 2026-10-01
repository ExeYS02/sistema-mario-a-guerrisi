-- DATOS DE PRUEBA para el catálogo (HU-32). Solo para desarrollo.
-- Inserta categorías, marcas, países, un depósito y 8 artículos con stock.
-- Todo lo creado acá se puede borrar con el bloque "LIMPIEZA" del final.
-- Es seguro correrlo más de una vez (usa ON CONFLICT).

insert into public.categorias (nombre) values ('Accesorios'), ('Bajos'), ('Guitarras'), ('Percusión'), ('Teclados') on conflict (nombre) do nothing;
insert into public.marcas (nombre) values ('D''Addario'), ('Fender'), ('Gibson'), ('Pearl'), ('Yamaha') on conflict (nombre) do nothing;
insert into public.paises_origen (nombre) values ('China'), ('Estados Unidos'), ('Indonesia'), ('México') on conflict (nombre) do nothing;
insert into public.depositos (nombre, direccion) values ('Depósito Central (demo)', 'Av. Principal 123') on conflict (nombre) do nothing;

with datos(descripcion, ean, cat, marca, pais, precio, modelo, stock, minimo) as (
  values
  ('Guitarra eléctrica Stratocaster Player', '9990000000012', 'Guitarras', 'Fender', 'Estados Unidos', 1250000, 'Player MX-2024', 15, 3),
  ('Guitarra eléctrica Les Paul Standard', '9990000000029', 'Guitarras', 'Gibson', 'Estados Unidos', 2890000, 'Standard 60s', 4, 5),
  ('Guitarra criolla Clásica C40', '9990000000036', 'Guitarras', 'Yamaha', 'Indonesia', 185000, 'C40', 22, 5),
  ('Bajo eléctrico Jazz Bass', '9990000000043', 'Bajos', 'Fender', 'México', 1180000, 'Player Jazz', 0, 2),
  ('Teclado Portátil PSR-E373', '9990000000050', 'Teclados', 'Yamaha', 'China', 420000, 'PSR-E373', 9, 3),
  ('Piano digital P-45', '9990000000067', 'Teclados', 'Yamaha', 'Indonesia', 690000, 'P-45', 2, 3),
  ('Batería acústica Stage Custom', '9990000000074', 'Percusión', 'Pearl', 'China', 980000, 'Stage Custom', 6, 2),
  ('Cuerdas para guitarra eléctrica 010', '9990000000081', 'Accesorios', 'D''Addario', 'Estados Unidos', 14500, 'EXL110', 60, 20)
), nuevos as (
  insert into public.articulos (descripcion, codigo_ean13, categoria_id, marca_id, pais_origen, precio_actual, modelo)
  select d.descripcion, d.ean,
         (select id from public.categorias where nombre = d.cat),
         (select id from public.marcas where nombre = d.marca),
         (select id from public.paises_origen where nombre = d.pais),
         d.precio, d.modelo
  from datos d
  on conflict (codigo_ean13) do nothing
  returning id, codigo_ean13
)
insert into public.existencias (articulo_id, deposito_id, cantidad, stock_minimo, stock_maximo)
select n.id, (select id from public.depositos where nombre = 'Depósito Central (demo)'),
       d.stock, d.minimo, greatest(d.stock * 2, 10)
from nuevos n join datos d on d.ean = n.codigo_ean13;

-- ===== LIMPIEZA (descomentar para borrar los datos de prueba) =====
-- delete from public.existencias where articulo_id in (select id from public.articulos where codigo_ean13 like '999000000%');
-- delete from public.historial_precios where articulo_id in (select id from public.articulos where codigo_ean13 like '999000000%');
-- delete from public.articulos where codigo_ean13 like '999000000%';
-- delete from public.depositos where nombre = 'Depósito Central (demo)';
