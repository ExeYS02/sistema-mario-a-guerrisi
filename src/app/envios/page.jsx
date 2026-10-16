import EnviosClient from './EnviosClient';

export const metadata = {
  title: 'Tus envíos | Mario A. Guerrisi',
  description: 'Revisá el estado de tus envíos y retiros',
};

export default function EnviosPage() {
  return (
    <div className="store-container">
      <h1 className="store-title">Tus envíos</h1>
      <p className="store-subtitle">
        Consultá el estado de tus pedidos, retiros en sucursal y envíos a domicilio.
      </p>
      <EnviosClient />
    </div>
  );
}