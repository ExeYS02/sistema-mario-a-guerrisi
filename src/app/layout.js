import '@fontsource-variable/inter';
import './globals.css';
import StoreHeader from '@/components/StoreHeader';
import StoreFooter from '@/components/StoreFooter';
import RegistrarSW from '@/components/RegistrarSW';

export const metadata = {
  title: { default: 'Mario A. Guerrisi — Instrumentos musicales', template: '%s' },
  description: 'Tienda online de instrumentos musicales y accesorios Mario A. Guerrisi.',
  applicationName: 'Guerrisi',
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'Guerrisi', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#E33141',
};

import { CartProvider } from '@/context/CartContext';

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body className="store-body">
        <CartProvider>
          <StoreHeader />
          <main className="store-main">{children}</main>
          <StoreFooter />
          <RegistrarSW />
        </CartProvider>
      </body>
    </html>
  );
}
