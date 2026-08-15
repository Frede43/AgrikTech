import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

// Les images produits sont servies par le backend ; on autorise son origine
// (locale par défaut, celle de NEXT_PUBLIC_API_URL en production).
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", ""),
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/static/**",
      },
    ],
  },
  turbopack: {},
};

export default withPWA(nextConfig);
