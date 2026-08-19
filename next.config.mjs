import withPWAInit, { runtimeCaching as defaultRuntimeCaching } from "@ducanh2912/next-pwa";

// Les images produits sont servies par le backend ; on autorise son origine
// (locale par défaut, celle de NEXT_PUBLIC_API_URL en production).
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  workboxOptions: {
    runtimeCaching: [
      // Vérification de session (GET /auth/me) : jamais servie depuis le
      // cache, même hors ligne. Le cache "cross-origin" par défaut (plus bas)
      // est un NetworkFirst avec repli sur une réponse vieille de jusqu'à 1h
      // si le réseau échoue/timeout — acceptable pour la plupart des appels,
      // mais pas pour la question "cet utilisateur a-t-il encore un compte
      // valide ?", où une réponse périmée peut faire croire à tort qu'un
      // compte supprimé ou suspendu est toujours actif.
      {
        urlPattern: ({ url }) => url.origin === apiUrl.origin && url.pathname === "/auth/me",
        handler: "NetworkOnly",
      },
      ...defaultRuntimeCaching,
    ],
  },
});

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
