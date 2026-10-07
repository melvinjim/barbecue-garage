import path from "node:path";
import type { NextConfig } from "next";

// Cabeceras de seguridad básicas para todo el panel.
// (La CSP completa con Clerk queda como mejora posterior: requiere nonces.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // El panel reutiliza el esquema de validación del sitio público (../js/data/schema.js),
  // que está fuera de esta carpeta: Turbopack solo resuelve archivos dentro de su raíz.
  // Así el panel valida la carta con las MISMAS reglas que el sitio, sin copias que se desincronicen.
  turbopack: {
    root: path.join(process.cwd(), ".."),
    // Tailwind CSS v4 con Turbopack (lo configura create-next-app; no quitar).
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // Las fotos suben por Server Action: 8 MB de foto + el resto del formulario (readUpload ya rechaza >8 MB).
  experimental: {
    serverActions: { bodySizeLimit: "9mb" },
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
