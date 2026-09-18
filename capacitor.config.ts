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
