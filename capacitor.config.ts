import type { CapacitorConfig } from '@capacitor/cli';

// Bundle ID: digital.truevoice.app
// Reverse-DNS of the production domain (truevoice.digital) — used to
// register both the iOS App ID (Apple Developer Portal) and the Android
// applicationId (Google Play Console). This must match exactly in both
// places once the native projects are generated via `npx cap add`.
const config: CapacitorConfig = {
  appId: 'digital.truevoice.app',
  appName: 'TrueVoice Digital',

  // `npm run build` outputs the CSR bundle here — Capacitor copies this
  // folder into the native shells on every `npx cap sync`. Nothing about
  // the existing Vite/React app changes; it's just wrapped.
  webDir: 'dist',

  // No devServer / server.url override here on purpose — that's a
  // live-reload convenience for local native dev only, and gets added
  // temporarily (pointing at `vite dev`'s LAN address) rather than
  // committed, so production native builds always load the bundled
  // `dist/` and never reach out to a dev machine.

  // `server.hostname` + `iosScheme: 'https'` make the WebView's real
  // origin "https://truevoice.digital" instead of the default
  // "capacitor://localhost" (Capacitor still serves the bundled dist/
  // files locally -- nothing is fetched over the network). This is
  // required for the YouTube embeds: YouTube's IFrame Player checks
  // the page's actual origin, and we were previously just claiming a
  // fake "https://truevoice.digital" origin parameter that didn't
  // match where the WebView really was, which is why embeds kept
  // failing with YouTube's own "configuration error" screen.
  server: {
    hostname: 'truevoice.digital',
    iosScheme: 'https',
    androidScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      // Matches the PWA manifest's background_color/theme_color
      // (vite.config.js) so the native splash doesn't flash a different
      // color than the app that loads behind it.
      backgroundColor: '#050816',
      launchShowDuration: 0,
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      // iOS: show system banner/sound/badge even while the app is in
      // the foreground (otherwise foreground pushes are silent on iOS).
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },

  ios: {
    // Lets the WebView background show through instead of a hard white
    // flash during transitions — matches the dark theme.
    backgroundColor: '#050816',
  },
  android: {
    backgroundColor: '#050816',
  },
};

export default config;
