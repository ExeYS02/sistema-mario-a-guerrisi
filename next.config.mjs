/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  serverExternalPackages: ['mercadopago'],
  allowedDevOrigins: ['unbeaten-pediatric-collector.ngrok-free.dev', 'localhost:3000'],
};

export default nextConfig;
