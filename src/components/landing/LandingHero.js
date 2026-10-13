'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const SLIDES = [
  {
    id: 1,
    titulo: 'Todo para tu música, en Salta',
    bajada: 'Instrumentos y accesorios de las mejores marcas.',
    ctaTexto: 'Ver catálogo',
    ctaLink: '/catalogo',
    claseTema: 'landing-hero-slide-1',
  },
  {
    id: 2,
    titulo: 'Últimos ingresos',
    bajada: 'Lo más nuevo de nuestro catálogo.',
    ctaTexto: 'Ver novedades',
    ctaLink: '/catalogo?orden=novedades',
    claseTema: 'landing-hero-slide-2',
  },
  {
    id: 3,
    titulo: 'Comprá online, retirá en el local',
    bajada: 'Retirá en Caseros 1056 o Galería Margalef, o pedí envío a domicilio.',
    ctaTexto: 'Explorar',
    ctaLink: '/catalogo',
    claseTema: 'landing-hero-slide-3',
  },
];

export default function LandingHero() {
  const [slideActiva, setSlideActiva] = useState(0);
  const [pausado, setPausado] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const irASiguiente = useCallback(() => {
    setSlideActiva((prev) => (prev + 1) % SLIDES.length);
  }, []);

  const irAAnterior = useCallback(() => {
    setSlideActiva((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches || pausado) return;

    const timer = setInterval(() => {
      irASiguiente();
    }, 6000);

    return () => clearInterval(timer);
  }, [pausado, irASiguiente]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0) irASiguiente();
      else irAAnterior();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <section
      className="landing-hero"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Banners principales"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="landing-hero-slides">
        {SLIDES.map((slide, index) => {
          const esActivo = index === slideActiva;
          return (
            <div
              key={slide.id}
              className={`landing-hero-slide ${slide.claseTema} ${esActivo ? 'active' : ''}`}
              aria-hidden={!esActivo}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${index + 1} de ${SLIDES.length}`}
            >
              <div className="landing-hero-content">
                <h1 className="landing-hero-title">{slide.titulo}</h1>
                <p className="landing-hero-subtitle">{slide.bajada}</p>
                <div>
                  <Link
                    href={slide.ctaLink}
                    className="btn btn-primary landing-hero-btn"
                    tabIndex={esActivo ? 0 : -1}
                  >
                    {slide.ctaTexto}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="landing-hero-arrow prev"
        onClick={irAAnterior}
        aria-label="Slide anterior"
      >
        &#10094;
      </button>
      <button
        type="button"
        className="landing-hero-arrow next"
        onClick={irASiguiente}
        aria-label="Siguiente slide"
      >
        &#10095;
      </button>

      <div className="landing-hero-dots">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`landing-hero-dot ${index === slideActiva ? 'active' : ''}`}
            onClick={() => setSlideActiva(index)}
            aria-label={`Ir a slide ${index + 1}`}
            aria-current={index === slideActiva ? 'true' : 'false'}
          />
        ))}
      </div>
    </section>
  );
}