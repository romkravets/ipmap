/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

// Three.js шейдери потребують unsafe-eval тільки в dev (HMR), в prod вже скомпільовані
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"; // Three.js runtime shader compilation needs unsafe-eval even in prod

const ContentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // WebSocket до свого сервера + текстури з CDN + raw GitHub для GeoJSON/textures
  "connect-src 'self' ws://localhost:4000 wss://localhost:4000 wss://*.sessionmap.app wss://*.onrender.com https://*.onrender.com https://unpkg.com https://cdn.jsdelivr.net https://raw.githubusercontent.com https://api.github.com",
  "img-src 'self' data: blob: https://unpkg.com https://cdn.jsdelivr.net https://raw.githubusercontent.com",
  "worker-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // HSTS: 2 роки + preload (submittable to browser preload lists)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
