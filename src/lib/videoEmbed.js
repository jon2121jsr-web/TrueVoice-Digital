// Keep the real-origin native workaround; expose a user-gesture play escape
// hatch in explicit video modals when audible autoplay is refused.
import { Capacitor } from "@capacitor/core";

export function selectVideoBridge(url, { development, native, location } = {}) {
  try {
    if (!development || native || !location || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return url;
    if (new URLSearchParams(location.search).get("pulseLocalBridge") !== "1") return url;
    const original = new URL(url);
    const local = new URL(location.origin);
    if (!["http:", "https:"].includes(local.protocol) || !["truevoice.digital", "www.truevoice.digital"].includes(original.hostname) || original.pathname !== "/yt-embed.html") return url;
    const bridge = new URL("/yt-embed.html", local.origin);
    bridge.search = original.search;
    return bridge.toString();
  } catch { return url; }
}

export function withVideoControls(url, { progress = false } = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/yt-embed.html") parsed.searchParams.set("controls", "1");
    if (progress && parsed.pathname === "/yt-embed.html") {
      parsed.searchParams.set("progress", "1");
      parsed.searchParams.set("loop", "0");
      parsed.searchParams.delete("playlist");
    }
    return selectVideoBridge(parsed.toString(), {
      development: !!import.meta.env?.DEV,
      native: Capacitor.isNativePlatform(),
      location: typeof window === "undefined" ? null : window.location,
    });
  } catch { return url; }
}
