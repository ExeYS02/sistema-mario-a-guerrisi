import Hero from '@/components/Hero';
import LandingBeneficios from '@/components/landing/LandingBeneficios';
import ProductCarousel from '@/components/landing/ProductCarousel';
import BrandCarousel from '@/components/landing/BrandCarousel';
import { obtenerDatosLanding } from '@/server/services/landingService';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mario A. Guerrisi | Instrumentos Musicales en Salta',
  description: 'Tienda de instrumentos musicales y accesorios en Salta Capital. Comprá online con retiro en local o envío a domicilio.',
};

export default async function HomePage() {
  const { estrella, imperdibles, preferidos, marcas } = await obtenerDatosLanding();

  return (
    <main className="landing-page">
      {/* Nuevo Hero estabilizado que reemplaza a LandingHero */}
      <Hero />
      
      <LandingBeneficios />

      

<ProductCarousel
        titulo="Algunos de nuestros productos estrella"
        subtitulo="Selección especial para vos"
        items={estrella}
        linkVerMas="/catalogo"
        textoLinkVerMas="Ver todo el catálogo"
      />

      

<ProductCarousel
        titulo="Imperdibles"
        subtitulo="Lo más nuevo ingresado al catálogo"
        items={imperdibles}
        linkVerMas="/catalogo?orden=novedades"
        textoLinkVerMas="Ver todos los nuevos"
      />

      

<ProductCarousel
        titulo="Preferidos por los clientes"
        subtitulo="Los instrumentos y accesorios más elegidos"
        items={preferidos}
        linkVerMas="/catalogo"
        textoLinkVerMas="Ver todos los favoritos"
      />

      <BrandCarousel marcas={marcas} />
    </main>
  );
}