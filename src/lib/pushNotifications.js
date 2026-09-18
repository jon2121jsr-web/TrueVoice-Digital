/**
 * Native Push Notifications — src/lib/pushNotifications.js
 *
 * No-ops entirely on the web build -- this module only does anything
 * inside the iOS/Android app shells built via Capacitor (see
 * capacitor.config.ts). On native it:
 *   1. Requests push permission
 *   2. Registers for push with APNs/FCM
 *   3. POSTs the device token to /api/push/register (see that file)
 *   4. Wires foreground + tap listeners so a tapped notification can
 *      deep-link into the app via React Router
 *
 * Call initPushNotifications(navigate) once from App.jsx, passing the
 * react-router-dom `navigate` function from useNavigate().
 */

import { Capacitor } from '@capacitor/core';

const ENDPOINT = import.meta.env.VITE_PUSH_REGISTER_ENDPOINT || '/api/push/register';

let initialized = false;

export async function initPushNotifications(navigate) {
  // Web build (and any platform Capacitor doesn't recognize as native):
  // do nothing. Nothing below this line should ever run in a browser tab.
  if (!Capacitor.isNativePlatform()) return;

  // React 18/19 StrictMode double-invokes effects in dev; guard so a
  // second call in the same app session (e.g. a HMR remount) is a no-op
  // instead of registering twice or double-attaching listeners.
  if (initialized) return;
  initialized = true;

  const platform = Capacitor.getPlatform(); // 'ios' | 'android'

  // Dynamic import: the @capacitor/push-notifications plugin's native
  // binding doesn't exist in a plain web build. The early return above
  // already prevents this from running there, but keeping the import
  // dynamic means the plugin module is never even evaluated on web,
  // not just unused.
  const { PushNotifications } = await import('@capacitor/push-notifications');

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      console.warn('[push] permission not granted');
      return;
    }
    await PushNotifications.register();
  } catch (err) {
    console.warn('[push] permission/register failed', err);
    return;
  }

  PushNotifications.addListener('registration', async (token) => {
    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_token: token.value, platform }),
      });
    } catch (err) {
      console.warn('[push] failed to send device token to server', err);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration error', err);
  });

  // Foreground: app is open and a push arrives. iOS/Android both suppress
  // the system banner while foregrounded by default -- surfacing something
  // in-app (a toast, a badge) is a later product decision. For now just
  // log it so it's visible during testing instead of silently dropped.
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[push] received in foreground', notification);
  });

  // User tapped a notification (app was backgrounded or closed). Deep-link
  // using the `url` field api/push/send.js puts in the FCM data payload --
  // e.g. "/scroll/abc123" jumps straight to a Scroll clip.
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action.notification?.data?.url;
    if (url && typeof navigate === 'function') {
      navigate(url);
    }
  });
}
