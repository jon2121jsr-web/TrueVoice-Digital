// src/lib/apiBase.js
// Native apps (iOS/Android via Capacitor) are just static files loaded
// from the device -- there is no server behind them. A relative fetch
// like `/api/youtube` only resolves when the page is actually hosted at
// that origin (the live website), so from inside the app it fails
// silently. Route those same-origin API calls to the real live site's
// serverless functions instead, while leaving the website build (where
// a relative path is correct and preferred) untouched.
import { Capacitor } from "@capacitor/core";

const LIVE_SITE_ORIGIN = "https://www.truevoice.digital";

export const IS_NATIVE_APP = Capacitor.isNativePlatform();

// "" for the website build (relative paths resolve against its own
// origin); the live site's absolute origin when running as a native app.
export const API_BASE = IS_NATIVE_APP ? LIVE_SITE_ORIGIN : "";
