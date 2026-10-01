import './globals.css';

export const metadata = {
  title: 'Mario A. Guerrisi — Sistema',
  description: 'Sistema de gestión para la tienda de música Mario A. Guerrisi',
  icons: { icon: '/logoMarca2.jpg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
