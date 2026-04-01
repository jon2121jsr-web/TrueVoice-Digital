import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'truevoice-favicon.png',
        'apple-touch-icon.png',
        'apple-touch-icon-167.png',
        'apple-touch-icon-152.png',
        'icon-192.png',
        'icon-512.png',
      ],

      manifest: {
        id: '/',
        name: 'TrueVoice Digital',
        short_name: 'TrueVoice',
        description: 'Streaming hope, worship, and encouragement 24/7.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#050816',
        theme_color: '#050816',
        categories: ['music', 'lifestyle', 'entertainment'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon',
          },
        ],
      },

      workbox: {
        // autoUpdate mode — new SW activates immediately on next load.
        // skipWaiting + clientsClaim ensure deployments take effect
        // without users needing to manually clear caches.
        skipWaiting: true,
        clientsClaim: true,

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/stream\.truevoice\.digital\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'azuracast-api',
              expiration: { maxAgeSeconds: 30 },
            },
          },
          {
            urlPattern: /^https:\/\/streaming\.live365\.com\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],

        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],
})
