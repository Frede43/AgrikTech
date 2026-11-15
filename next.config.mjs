import withPWAInit, { runtimeCaching as defaultRuntimeCaching } from "@ducanh2912/next-pwa";

// Les images produits sont servies par le backend ; on autorise son origine
// (locale par défaut, celle de NEXT_PUBLIC_API_URL en production).
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

// Workbox sérialise chaque `urlPattern` fonction via .toString() pour
// l'intégrer telle quelle dans le sw.js généré — un contexte d'exécution
// (le service worker, dans le navigateur) totalement séparé de celui de ce
// fichier de config (Node.js, au build). Toute fermeture sur une variable
// externe (ex: `apiUrl`) ne survit donc PAS à cette sérialisation : le nom
// de la variable se retrouve littéralement dans le texte du sw.js, sans sa
// valeur, provoquant un "ReferenceError: apiUrl is not defined" au moment
// où le navigateur essaie d'exécuter cette fonction pour router une requête.
// Une RegExp, elle, se sérialise nativement en un littéral autonome
// (/motif/flags) sans dépendre d'aucune portée extérieure — d'où son usage
// ici plutôt qu'une fonction fléchée, pour matcher une origine dynamique
// (dépendant de NEXT_PUBLIC_API_URL) sans réintroduire le même piège.
const escapedApiOrigin = apiUrl.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const apiUrlPattern = new RegExp(`^${escapedApiOrigin}(?:/|$)`);

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  workboxOptions: {
    runtimeCaching: [
      // Les réponses de l'API peuvent être liées à l'utilisateur connecté.
      // Workbox ne doit jamais les réutiliser hors ligne ni entre sessions.
      {
        urlPattern: apiUrlPattern,
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
