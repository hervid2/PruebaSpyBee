/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['mapbox-gl'],
  sassOptions: {
    includePaths: ['./src/styles'],
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
