'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';

export default function ProductCarousel({
  titulo,
  subtitulo,
  items = [],
  linkVerMas = '/catalogo',
  textoLinkVerMas = 'Ver todo el catálogo',
}) {
  const scrollerRef = useRef(null);
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
  }, [checkScroll, items]);

  if (!Array.isArray(items) || items.length < 3) {
    return null;
  }

  const scrollByAmount = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = 280;
    const amount = direction === 'left' ? -cardWidth * 2 : cardWidth * 2;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="landing-section">
      <div className="landing-section-header">
        <div>
          <h2 className="landing-section-title">{titulo}</h2>
          {subtitulo && <p className="landing-section-sub">{subtitulo}</p>}
        </div>
        <div className="landing-section-actions">
          {linkVerMas && (
            <Link href={linkVerMas} className="landing-link-more">
              {textoLinkVerMas} &rarr;
            </Link>
          )}
          <div className="landing-carousel-arrows">
            <button
              type="button"
              className="landing-arrow-btn"
              onClick={() => scrollByAmount('left')}
              disabled={!canScrollLeft}
              aria-label={`Desplazar a la izquierda en ${titulo}`}
            >
              &#10094;
            </button>
            <button
              type="button"
              className="landing-arrow-btn"
              onClick={() => scrollByAmount('right')}
              disabled={!canScrollRight}
              aria-label={`Desplazar a la derecha en ${titulo}`}
            >
              &#10095;
            </button>
          </div>
        </div>
      </div>

      <div className="landing-products-scroll" ref={scrollerRef}>
        {items.map((articulo) => (
          <div key={articulo.id} className="landing-product-item">
            <ProductCard articulo={articulo} />
          </div>
        ))}
      </div>
    </section>
  );
}