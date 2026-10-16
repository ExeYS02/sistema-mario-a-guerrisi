'use client';

import { useState, useEffect, useRef } from 'react';
import imagenesCatalogo from '@/data/catalogo-imagenes.json';

const imageMemoryCache = new Map();
const JUNK_WORDS = new Set([
  'sin especificar',
  'estándar',
  'estandar',
  's/ean',
  's/c',
  'n/a',
  'null',
  'undefined',
  'todas',
  'articulo',
]);
const CATEGORIAS_INGLES = {
  bajos: 'bass guitar',
  guitarras: 'guitar',
  percusion: 'drum',
  teclados: 'keyboard',
  accesorios: 'musical instrument accessories',
  vientos: 'woodwind instrument',
  cuerdas: 'string instrument',
};
const TERMINOS_EXCLUIDOS = /\b(logo|diagram|schematic|manual|poster|sheet music|icon|silhouette)\b/i;

function limpiarTexto(texto) {
  if (!texto) return '';
  const valor = String(texto).trim();
  return JUNK_WORDS.has(valor.toLowerCase()) ? '' : valor;
}

function normalizarClave(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function obtenerImagenFija({ id, internalCode, ean, brand, model }) {
  const marcaModelo = [normalizarClave(brand), normalizarClave(model)].filter(Boolean).join(' ');
  const imagen =
    imagenesCatalogo.porCodigoInterno?.[internalCode] ||
    imagenesCatalogo.porCodigoEan13?.[ean] ||
    imagenesCatalogo.porId?.[id] ||
    imagenesCatalogo.porMarcaModelo?.[marcaModelo];

  return typeof imagen === 'string' ? imagen : '';
}

function construirTerminosBusqueda({ brand, model, description, category, query }) {
  const marca = limpiarTexto(brand);
  const modelo = limpiarTexto(model);
  const descripcion = limpiarTexto(description);
  const categoria = limpiarTexto(category);
  const consulta = limpiarTexto(query);
  const categoriaIngles = CATEGORIAS_INGLES[normalizarClave(categoria)] || categoria;
  const nombreProducto = [marca, modelo].filter(Boolean).join(' ');

  return [...new Set([
    [marca, modelo, categoriaIngles, 'musical instrument'].filter(Boolean).join(' '),
    [marca, modelo, 'instrument'].filter(Boolean).join(' '),
    [marca, descripcion, categoriaIngles, 'instrument'].filter(Boolean).join(' '),
    [modelo, categoriaIngles, 'musical instrument'].filter(Boolean).join(' '),
    [nombreProducto, 'musical instrument'].filter(Boolean).join(' '),
    [descripcion, categoriaIngles, 'musical instrument'].filter(Boolean).join(' '),
    [consulta, categoriaIngles, 'musical instrument'].filter(Boolean).join(' '),
    [categoriaIngles, 'musical instrument'].filter(Boolean).join(' '),
  ].map((term) => term.trim()).filter((term) => term.replace(/\s/g, '').length >= 2))];
}

function puntuarResultado(titulo, terminosProducto, categoria) {
  const tituloNormalizado = normalizarClave(titulo.replace(/^File:/i, ''));
  if (TERMINOS_EXCLUIDOS.test(tituloNormalizado)) return -1;

  const tokens = [...new Set(terminosProducto
    .flatMap((term) => normalizarClave(term).split(' '))
    .filter((token) => token.length > 2))];
  const coincidencias = tokens.filter((token) => tituloNormalizado.includes(token)).length;
  const categoriaNormalizada = normalizarClave(categoria);
  const coincideCategoria = categoriaNormalizada && tituloNormalizado.includes(categoriaNormalizada);

  return coincidencias + (coincideCategoria ? 2 : 0);
}

async function buscarEnCommons(terminos, terminosProducto, categoria) {
  const candidatos = new Map();

  for (const termino of terminos.slice(0, 5)) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: termino,
      gsrlimit: '12',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '700',
      format: 'json',
      origin: '*',
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!response.ok) continue;

    const data = await response.json();
    for (const page of Object.values(data?.query?.pages || {})) {
      const titulo = page?.title || '';
      const imagen = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
      const puntaje = puntuarResultado(titulo, terminosProducto, categoria);
      if (!imagen || puntaje < 1) continue;

      const candidatoExistente = candidatos.get(imagen);
      if (!candidatoExistente || candidatoExistente.puntaje < puntaje) {
        candidatos.set(imagen, { url: imagen, puntaje });
      }
    }

    if (candidatos.size >= 8) break;
  }

  return [...candidatos.values()]
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, 8)
    .map(({ url }) => url);
}

async function buscarEnWikipedia(terminos) {
  const candidatos = [];

  for (const termino of terminos.slice(0, 4)) {
    const params = new URLSearchParams({
      action: 'query',
      origin: '*',
      format: 'json',
      generator: 'search',
      gsrsearch: termino,
      gsrlimit: '8',
      prop: 'pageimages',
      pithumbsize: '600',
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
    if (!response.ok) continue;

    const data = await response.json();
    for (const page of Object.values(data?.query?.pages || {})) {
      const imagen = page?.thumbnail?.source;
      if (imagen && !candidatos.includes(imagen)) candidatos.push(imagen);
    }
    if (candidatos.length >= 8) break;
  }

  return candidatos.slice(0, 8);
}

async function buscarImagenesInternet(terminos, terminosProducto, categoria, cacheKey) {
  const cacheada = imageMemoryCache.get(cacheKey);
  if (cacheada) return cacheada;

  let cacheStorage = null;
  try {
    cacheStorage = sessionStorage.getItem(`img_cache_${cacheKey}`);
  } catch (error) {
    console.error('No se pudo leer la caché de imágenes:', error);
  }

  if (cacheStorage) {
    try {
      const parsedCache = JSON.parse(cacheStorage);
      if (Array.isArray(parsedCache) && parsedCache.length) {
        imageMemoryCache.set(cacheKey, parsedCache);
        return parsedCache;
      }
    } catch (error) {
      console.error('No se pudo interpretar la caché de imágenes:', error);
    }
  }

  let candidatos = [];
  try {
    candidatos = await buscarEnCommons(terminos, terminosProducto, categoria);
  } catch (error) {
    console.error('Error buscando imágenes en Wikimedia Commons:', error);
  }

  if (!candidatos.length) {
    try {
      candidatos = await buscarEnWikipedia(terminos);
    } catch (error) {
      console.error('Error buscando imágenes en Wikipedia:', error);
    }
  }

  if (candidatos.length) {
    imageMemoryCache.set(cacheKey, candidatos);
    try {
      sessionStorage.setItem(`img_cache_${cacheKey}`, JSON.stringify(candidatos));
    } catch (error) {
      console.error('No se pudo guardar la caché de imágenes:', error);
    }
  }

  return candidatos;
}

function AutoProductImage({
  id,
  internalCode,
  ean,
  brand,
  model,
  description,
  category,
  query,
  alt,
  className,
  style,
  lazy = false,
}) {
  const [imageCandidates, setImageCandidates] = useState([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const [useInternetFallback, setUseInternetFallback] = useState(false);
  const imgRef = useRef(null);
  const fixedImage = obtenerImagenFija({ id, internalCode, ean, brand, model });

  useEffect(() => {
    if (!lazy || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!inView && typeof IntersectionObserver !== 'undefined') return undefined;

    let isMounted = true;
    const terminos = construirTerminosBusqueda({ brand, model, description, category, query });
    const cacheKey = `v3_${terminos.join('|')}`;

    const cargarImagenes = async () => {
      setLoading(true);
      setHasError(false);
      setImageIndex(0);

      if (fixedImage && !useInternetFallback) {
        setImageCandidates([fixedImage]);
        setLoading(false);
        return;
      }

      setImageCandidates([]);
      if (!terminos.length) {
        setHasError(true);
        setLoading(false);
        return;
      }

      try {
        const terminosProducto = [brand, model, description, query].filter(Boolean);
        const candidatos = await buscarImagenesInternet(terminos, terminosProducto, category, cacheKey);
        if (!isMounted) return;
        setImageCandidates(candidatos);
        setHasError(candidatos.length === 0);
      } catch (error) {
        console.error('Error al cargar imágenes del producto:', error);
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    cargarImagenes();

    return () => {
      isMounted = false;
    };
  }, [brand, model, description, category, query, inView, lazy, fixedImage, useInternetFallback]);

  const imageUrl = imageCandidates[imageIndex];

  if (hasError || !imageUrl) {
    return (
      <div ref={imgRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: '50px', height: '50px', stroke: 'var(--gray-700)', ...style }}
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={imageUrl}
      alt={alt || query}
      className={className}
      onLoad={() => setLoading(false)}
      onError={() => {
        if (imageIndex + 1 < imageCandidates.length) {
          setImageIndex((index) => index + 1);
        } else if (fixedImage && !useInternetFallback) {
          setUseInternetFallback(true);
        } else {
          setHasError(true);
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: loading ? 0 : 1,
        transition: 'opacity 0.3s ease',
        ...style,
      }}
    />
  );
}

export default AutoProductImage;
