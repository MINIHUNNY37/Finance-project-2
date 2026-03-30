import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // Next.js bundles + React need 'unsafe-eval' for certain runtime
            // code paths (dynamic imports, source maps, dev overlay).
            // 'unsafe-inline' is required for styled-jsx and inline event handlers.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com",
              "connect-src 'self' https://accounts.google.com https://*.neon.tech wss://*.neon.tech https://query1.finance.yahoo.com https://query2.finance.yahoo.com",
              "frame-src https://accounts.google.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
