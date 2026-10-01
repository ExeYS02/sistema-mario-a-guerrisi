'use client';

import { useState, useEffect } from 'react';

// Caché en memoria para evitar llamadas duplicadas en la misma sesión
const imageMemoryCache = new Map();

function AutoProductImage({ query, alt, className, style }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!query || query.trim() === '') {
      setLoading(false);
      return;
    }

    // 1. Limpiar el término de búsqueda (ej: "Fender Stratocaster Player" -> "Fender Stratocaster")
    const cleanQuery = query
      .replace(/[^\w\s-]/gi, '')
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .trim();

    // 2. Verificar si ya está en caché de memoria o sessionStorage
    if (imageMemoryCache.has(cleanQuery)) {
      setImageUrl(imageMemoryCache.get(cleanQuery));
      setLoading(false);
      return;
    }

    const cachedStorage = sessionStorage.getItem(`img_cache_${cleanQuery}`);
    if (cachedStorage) {
      imageMemoryCache.set(cleanQuery, cachedStorage);
      setImageUrl(cachedStorage);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setHasError(false);

    // 3. Buscar en Wikipedia/Wikimedia API (Español e Inglés con fallback)
    const fetchImage = async () => {
      try {
        // Intento 1: Wikipedia en español
        let res = await fetch(
          `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`
        );
        let data = res.ok ? await res.json() : null;

        // Intento 2: Wikipedia en inglés (catálogo más amplio de marcas/modelos)
        if (!data || !data.thumbnail?.source) {
          res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`
          );
          data = res.ok ? await res.json() : null;
        }

        if (isMounted) {
          if (data && data.thumbnail?.source) {
            const highResUrl = data.thumbnail.source.replace(/\/\d+px-/, '/600px-'); // Mejorar resolución
            imageMemoryCache.set(cleanQuery, highResUrl);
            sessionStorage.setItem(`img_cache_${cleanQuery}`, highResUrl);
            setImageUrl(highResUrl);
          } else {
            setHasError(true);
          }
        }
      } catch (err) {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [query]);

  // Si falló o no encontró foto, muestra el icono estándar
  if (hasError || !imageUrl) {
    return (
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
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || query}
      className={className}
      onError={() => setHasError(true)}
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