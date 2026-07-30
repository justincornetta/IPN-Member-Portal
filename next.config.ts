import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  logging: {
    serverFunctions: false,
  },
};

export default nextConfig;
