import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy para a API Nest: o navegador chama /api/... no próprio localhost:3000
  // e o Next repassa para localhost:8000. Como é a mesma origem, não passa por CORS.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
