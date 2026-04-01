import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // =====================================================
      // FIX: was 'autoUpdate' — that mode calls
      // skipWaiting() + clients.claim() immediately, which
      // swaps the active service worker while the app is
      // open. Mid-session SW swaps are exactly what causes
      // the iOS lock screen to drop icon/metadata and flicker
      // as iOS transitions between two registration states.
      //
      // 'prompt' waits for the user to close and reopen the
      // app before the new SW activates. No mid-session swap,
      // no flicker. The trade-off is that users stay on the
      // previous build until their next launch — which is
      // perfectly acceptable for a streaming PWA.
      // =====================================================
      registerType: 'prompt',

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
          // =====================================================
          // FIX: apple touch icon entry added.
          // iOS reads the web manifest on some iOS 16.4+ builds
          // and uses this entry to resolve the home screen icon
          // independently of the <link rel="apple-touch-icon">
          // tags in index.html. Without this entry, a manifest
          // cache miss (e.g. after a SW update) leaves iOS with
          // no icon reference at all, which is what was causing
          // the blank/missing icon on the lock screen.
          // =====================================================
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon',
          },
        ],
      },

      workbox: {
        // =====================================================
        // FIX: skipWaiting and clientsClaim are now explicitly
        // false. Previously these were implicitly true under
        // 'autoUpdate' mode. Setting them false here makes the
        // intent unambiguous and prevents any plugin version
        // differences from silently re-enabling them.
        // =====================================================
        skipWaiting: false,
        clientsClaim: false,

        runtimeCaching: [
          {
            // AzuraCast now-playing API — network first, short cache
            urlPattern: /^https:\/\/stream\.truevoice\.digital\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'azuracast-api',
              expiration: { maxAgeSeconds: 30 },
            },
          },
          {
            // Live365 stream — never cache audio streams
            urlPattern: /^https:\/\/streaming\.live365\.com\//,
            handler: 'NetworkOnly',
          },
          {
            // Google Fonts / external assets — cache aggressively
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Album art / images — stale while revalidate
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
        enabled: false, // flip to true temporarily to test SW in dev
      },
    }),
  ],
})
