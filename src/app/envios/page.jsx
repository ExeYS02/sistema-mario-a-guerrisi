import EnviosClient from './EnviosClient';

export const metadata = {
  title: 'Tus envíos | Mario A. Guerrisi',
  description: 'Revisa el estado de tus envíos y retiros',
};

export default function EnviosPage() {
  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <h1>Tus envíos</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Consulta el estado de tus pedidos, retiros en sucursal y envíos a domicilio.
      </p>
      <EnviosClient />
    </main>
  );
}
