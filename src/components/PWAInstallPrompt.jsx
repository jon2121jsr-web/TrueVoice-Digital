// src/components/PWAInstallPrompt.jsx
// Shows a mobile-only install prompt:
//   Android — intercepts beforeinstallprompt for one-tap native install
//   iOS     — shows Share → Add to Home Screen instructions
// Dismissed state stored in localStorage for 7 days.
// Never shown again once installed.

import { useEffect, useRef, useState } from "react";
import "./PWAInstallPrompt.css";

const STORAGE_KEY    = "tv_pwa_prompt";
const DISMISS_DAYS   = 7;
const SHOW_DELAY_MS  = 30_000; // 30 seconds after page load

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobile() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function shouldShow() {
  if (!isMobile())          return false;
  if (isInStandaloneMode()) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const { state, until } = JSON.parse(raw);
    if (state === "installed") return false;
    if (state === "dismissed" && Date.now() < until) return false;
  } catch { /* ignore */ }
  return true;
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      state: "dismissed",
      until: Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000,
    }));
  } catch { /* ignore */ }
}

function markInstalled() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: "installed" }));
  } catch { /* ignore */ }
}

export default function PWAInstallPrompt() {
  const [visible,     setVisible]     = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const deferredPrompt                = useRef(null);

  useEffect(() => {
    if (!shouldShow()) return;

    // Android: capture the install prompt
    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Track if user installs via browser prompt
    window.addEventListener("appinstalled", () => {
      markInstalled();
      setVisible(false);
    });

    setIsIOSDevice(isIOS());

    const timer = window.setTimeout(() => {
      if (shouldShow()) setVisible(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      // Android: trigger native prompt
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === "accepted") markInstalled();
      else markDismissed();
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    markDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pwa-prompt" role="dialog" aria-label="Install TrueVoice Digital">
      <div className="pwa-prompt-inner">

        <img src="/icon-192.png" alt="TrueVoice Digital" className="pwa-prompt-icon" />

        <div className="pwa-prompt-text">
          <p className="pwa-prompt-title">Get the TrueVoice app</p>
          {isIOSDevice ? (
            <p className="pwa-prompt-sub">
              Tap <span className="pwa-share-icon">⎋</span> then
              <strong> Add to Home Screen</strong> for lock screen controls
              and uninterrupted streaming.
            </p>
          ) : (
            <p className="pwa-prompt-sub">
              Add to your home screen for lock screen controls and
              uninterrupted streaming.
            </p>
          )}
        </div>

        <div className="pwa-prompt-actions">
          {!isIOSDevice && (
            <button
              type="button"
              className="pwa-prompt-btn pwa-prompt-btn--primary"
              onClick={handleInstall}
            >
              Install
            </button>
          )}
          <button
            type="button"
            className="pwa-prompt-btn pwa-prompt-btn--ghost"
            onClick={handleDismiss}
          >
            Not now
          </button>
        </div>

      </div>
    </div>
  );
}
