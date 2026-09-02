/**
 * GitHub Pages cannot run a server, so the app is a static export.
 *
 * `basePath` is baked in at build time, which is why production and development
 * are two separate builds rather than one artifact copied twice:
 *   production   BASE_PATH=/Bike-Fitting-Tool
 *   development  BASE_PATH=/Bike-Fitting-Tool/dev
 *
 * Never write a literal path anywhere in the app - one of the two environments
 * would break. See docs/app-architecture.md risk R2.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.BASE_PATH ?? '',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
