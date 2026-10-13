'use client';

import { useState, useEffect, useRef } from 'react';

const imageMemoryCache = new Map();

function AutoProductImage({ query, alt, className, style, lazy = false }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!lazy) {
      setInView(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
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
    if (!inView) return;

    if (!query || query.trim() === '') {
      setLoading(false);
      return;
    }

    const cleanQuery = query
      .replace(/[^\w\s-]/gi, '')
      .split(' ')
      .slice(0, 3)
      .join(' ')
      .trim();

    if (imageMemoryCache.has(cleanQuery)) {
      setImageUrl(imageMemoryCache.get(cleanQuery));
      setLoading(false);
      return;
    }

    const cachedStorage = typeof window !== 'undefined' ? sessionStorage.getItem(`img_cache_${cleanQuery}`) : null;
    if (cachedStorage) {
      imageMemoryCache.set(cleanQuery, cachedStorage);
      setImageUrl(cachedStorage);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setHasError(false);

    const fetchImage = async () => {
      try {
        let res = await fetch(
          `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`
        );
        let data = res.ok ? await res.json() : null;

        if (!data || !data.thumbnail?.source) {
          res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanQuery)}`
          );
          data = res.ok ? await res.json() : null;
        }

        if (isMounted) {
          if (data && data.thumbnail?.source) {
            const highResUrl = data.thumbnail.source.replace(/\/\d+px-/, '/600px-');
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
  }, [query, inView]);

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