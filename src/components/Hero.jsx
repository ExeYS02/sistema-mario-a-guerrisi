'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { HERO_SLIDES } from '@/config/hero';

export default function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loadedImages, setLoadedImages] = useState({});
  const [isSwiping, setIsSwiping] = useState(false);
  
  const heroRef = useRef(null);
  const touchStartX = useRef(null);

  // Detección de reduced motion en cliente
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Intersection Observer para pausar fuera de pantalla
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  // Control del Autoplay
  useEffect(() => {
    if (isHovered || isFocused || !isVisible || reducedMotion || isSwiping) return;

    const nextIndex = (activeIndex + 1) % HERO_SLIDES.length;
    const nextSlideId = HERO_SLIDES[nextIndex].id;
    
    // Si la imagen siguiente no cargó, otorga 1.5s extra antes de forzar el avance
    const delay = loadedImages[nextSlideId] ? 6000 : 7500; 

    const timeoutId = setTimeout(() => {
      setActiveIndex(nextIndex);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [activeIndex, isHovered, isFocused, isVisible, reducedMotion, loadedImages, isSwiping]);

  const handleImageLoad = (id) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  const goToSlide = (index) => {
    setActiveIndex(index);
  };

  // Controles Táctiles (Swipe)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!touchStartX.current) return;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 50) {
      goToSlide((activeIndex + 1) % HERO_SLIDES.length);
    } else if (diff < -50) {
      goToSlide((activeIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    }
    
    touchStartX.current = null;
    setIsSwiping(false);
  };

  return (
    <section 
      className="hero-root"
      ref={heroRef}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Carrusel de novedades y ofertas"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides */}
      <div className="hero-track">
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === activeIndex;
          const isDividido = slide.layout === 'dividido';

          return (
            <div 
              key={slide.id}
              className={`hero-slide ${isDividido ? 'hero-slide-dividido' : 'hero-slide-fondo'}`}
              data-active={isActive}
              aria-hidden={!isActive}
              role="group"
              aria-label={`Diapositiva ${index + 1} de ${HERO_SLIDES.length}`}
              inert={!isActive ? "" : undefined}
            >
              {/* Fondo / Imagen */}
              <div className="hero-bg">
                <Image
                  src={slide.imagen}
                  alt={slide.alt}
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  quality={75}
                  style={{ objectPosition: slide.posicion, objectFit: isDividido ? 'contain' : 'cover' }}
                  onLoad={() => handleImageLoad(slide.id)}
                />
                {!isDividido && <div className="hero-overlay"></div>}
              </div>

              {/* Contenido */}
              <div className="hero-content">
                <div className="hero-text-block">
                  <div className="hero-accent" aria-hidden="true"></div>
                  <span className="hero-eyebrow">{slide.eyebrow}</span>
                  <h2 className="hero-title">{slide.titulo}</h2>
                  <p className="hero-desc">{slide.bajada}</p>
                  
                  <div className="hero-actions">
                    <Link href={slide.cta.href} className="btn btn-primary hero-btn" tabIndex={isActive ? 0 : -1}>
                      {slide.cta.texto}
                    </Link>
                    {slide.ctaSecundario && (
                      <Link href={slide.ctaSecundario.href} className="btn btn-outline hero-btn" tabIndex={isActive ? 0 : -1}>
                        {slide.ctaSecundario.texto}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles: Barras de Progreso */}
      <div className="hero-controls">
        <div className="hero-progress-bars">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              className="hero-progress-btn"
              onClick={() => goToSlide(index)}
              aria-label={`Ir a la diapositiva ${index + 1}`}
              tabIndex={0}
            >
              <div className="hero-progress-track">
                <div 
                  className="hero-progress-fill" 
                  data-active={index === activeIndex}
                  data-paused={isHovered || isFocused || !isVisible || reducedMotion}
                ></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Controles: Flechas de navegación */}
      <button 
        className="hero-nav-arrow hero-nav-prev" 
        onClick={() => goToSlide((activeIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
        aria-label="Diapositiva anterior"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button 
        className="hero-nav-arrow hero-nav-next" 
        onClick={() => goToSlide((activeIndex + 1) % HERO_SLIDES.length)}
        aria-label="Siguiente diapositiva"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* Anuncio ARIA de cambio de estado */}
      <div aria-live={isHovered || isFocused ? "polite" : "off"} className="hero-sr-only">
        Diapositiva {activeIndex + 1} visible
      </div>
    </section>
  );
}