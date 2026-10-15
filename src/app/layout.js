import './globals.css';
import '@fontsource-variable/inter';
import StoreHeader from '@/components/StoreHeader';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import LoginModal from '@/components/LoginModal';

export const metadata = {
  title: 'Mario A. Guerrisi | Instrumentos Musicales',
  description: 'Tienda online de instrumentos musicales',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <CartProvider>
            <div className="layout-tienda">
              <StoreHeader />
              <main className="main-tienda">{children}</main>
            </div>
            <LoginModal />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}