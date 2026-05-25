/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["data/**/*", "viewer/data/**/*", "./viewer/data/**/*"],
  },
};
export default nextConfig;
