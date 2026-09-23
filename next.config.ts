import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
};

export default nextConfig;
