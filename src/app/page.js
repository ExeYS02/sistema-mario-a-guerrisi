import { redirect } from 'next/navigation';

// La tienda arranca en el catálogo.
export default function Home() {
  redirect('/catalogo');
}
