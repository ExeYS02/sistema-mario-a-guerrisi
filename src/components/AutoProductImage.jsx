'use client';

import { useState, useEffect, useRef } from 'react';

const imageMemoryCache = new Map();

function AutoProductImage({ brand, model, description, category, query, alt, className, style, lazy = false }) {
  const [imageCandidates, setImageCandidates] = useState([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!lazy) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!inView && typeof IntersectionObserver !== 'undefined') return;

    const junkWords = ['sin especificar', 'estándar', 'estandar', 's/ean', 's/c', 'n/a', 'null', 'undefined', 'todas', 'articulo'];
    const cleanWord = (text) => {
      if (!text) return '';
      const value = String(text).trim();
      return junkWords.includes(value.toLowerCase()) ? '' : value;
    };

    const cleanQuery = (text) =>
      cleanWord(text)
        .replace(/sin especificar|estándar|estandar|s\/c/gi, '')
        .trim();

    const cleanBrand = cleanWord(brand);
    const cleanModel = cleanWord(model);
    const cleanDescription = cleanWord(description);
    const cleanCategory = cleanWord(category);
    const productName = [cleanBrand, cleanModel].filter(Boolean).join(' ');
    const cleanUserQuery = cleanQuery(query);
    const searchTerms = [
      cleanUserQuery ? `"${cleanUserQuery}" ${cleanCategory} musical instrument` : '',
      productName ? `"${productName}" ${cleanCategory} musical instrument` : '',
      [cleanBrand, cleanModel, cleanDescription, cleanCategory, 'musical instrument'].filter(Boolean).join(' '),
      productName ? `"${productName}" instrument` : '',
      [cleanDescription, cleanCategory, 'musical instrument'].filter(Boolean).join(' '),
      [cleanBrand, cleanCategory, 'musical instrument'].filter(Boolean).join(' '),
      cleanCategory ? `${cleanCategory} musical instrument` : '',
      cleanUserQuery ? `${cleanUserQuery} instrument product` : '',
    ];
    const uniqueSearchTerms = [...new Set(searchTerms.filter((term) => term.replace(/["\s]/g, '').length >= 2))];

    if (uniqueSearchTerms.length === 0) {
      return;
    }

    const cacheKey = `v2_${uniqueSearchTerms.join('|')}`;

    let isMounted = true;

    const fetchImage = async () => {
      setLoading(true);
      setHasError(false);
      setImageCandidates([]);
      setImageIndex(0);

      try {
        const cachedMemory = imageMemoryCache.get(cacheKey);
        let cachedCandidates = Array.isArray(cachedMemory)
          ? cachedMemory
          : cachedMemory
            ? [cachedMemory]
            : null;
        let cachedStorage = null;
        try {
          cachedStorage =
            typeof window !== 'undefined' ? sessionStorage.getItem(`img_cache_${cacheKey}`) : null;
        } catch (storageError) {
          console.error('No se pudo leer la caché de imágenes:', storageError);
        }

        if (!cachedCandidates && cachedStorage) {
          try {
            const parsedCache = JSON.parse(cachedStorage);
            cachedCandidates = Array.isArray(parsedCache) ? parsedCache : [cachedStorage];
          } catch {
            cachedCandidates = [cachedStorage];
          }
        }

        const candidates = [...(cachedCandidates || [])];

        for (const term of uniqueSearchTerms) {
          if (candidates.length >= 8) break;
          const endpoint = `https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrsearch=${encodeURIComponent(
            term
          )}&gsrlimit=10&prop=pageimages&pithumbsize=600`;
          try {
            const res = await fetch(endpoint);
            if (!res.ok) continue;

            const data = await res.json();
            const pages = data?.query?.pages;
            if (pages) {
              Object.values(pages).forEach((page) => {
                const source = page?.thumbnail?.source;
                if (source && !candidates.includes(source) && candidates.length < 8) {
                  candidates.push(source);
                }
              });
            }
          } catch (searchError) {
            console.error(`Error buscando imágenes con el término "${term}":`, searchError);
          }
        }

        if (isMounted) {
          if (candidates.length) {
            imageMemoryCache.set(cacheKey, candidates);
            try {
              sessionStorage.setItem(`img_cache_${cacheKey}`, JSON.stringify(candidates));
            } catch (storageError) {
              console.error('No se pudo guardar la caché de imágenes:', storageError);
            }
            setImageCandidates(candidates);
          } else {
            setHasError(true);
          }
        }
      } catch (err) {
        console.error('Error al cargar imágenes del producto:', err);
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [brand, model, description, category, query, inView, lazy]);

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