'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function BrandCarousel({ marcas = [] }) {
  const scrollerRef = useRef(null);
  const [pausado, setPausado] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, marcas]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches || pausado) return;

    const interval = setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 1, behavior: 'auto' });
      }
    }, 30);

    return () => clearInterval(interval);
  }, [pausado]);

  if (!Array.isArray(marcas) || marcas.length === 0) {
    return null;
  }

  const scrollByAmount = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -220 : 220;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="landing-section landing-brands-section">
      <div className="landing-section-header">
        <div>
          <h2 className="landing-section-title">Nuestras marcas</h2>
          <p className="landing-section-sub">Trabajamos con los principales fabricantes del mundo</p>
        </div>
        <div className="landing-section-actions">
          <Link href="/catalogo" className="landing-link-more">
            Ver todo el catálogo &rarr;
          </Link>
          <div className="landing-carousel-arrows">
            <button
              type="button"
              className="landing-arrow-btn"
              onClick={() => scrollByAmount('left')}
              disabled={!canScrollLeft}
              aria-label="Desplazar marcas a la izquierda"
            >
              &#10094;
            </button>
            <button
              type="button"
              className="landing-arrow-btn"
              onClick={() => scrollByAmount('right')}
              disabled={!canScrollRight}
              aria-label="Desplazar marcas a la derecha"
            >
              &#10095;
            </button>
          </div>
        </div>
      </div>

      <div
        className="landing-brands-scroll"
        ref={scrollerRef}
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocus={() => setPausado(true)}
        onBlur={() => setPausado(false)}
      >
        {marcas.map((m) => (
          <Link
            key={m.id}
            href={`/catalogo?marca=${m.id}`}
            className="landing-brand-tile"
          >
            <span className="landing-brand-name">{m.nombre}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}