import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: WORKSPACE_ROOT,
  },
  outputFileTracingRoot: WORKSPACE_ROOT,
  outputFileTracingIncludes: {
    "/*": ["viewer/data/**/*"],
  },
};
export default nextConfig;
