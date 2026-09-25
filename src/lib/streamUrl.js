// src/lib/streamUrl.js
// iOS's native <audio> element (AVFoundation, used by both Safari and
// Capacitor's WKWebView) rejects TrueVoice's raw Icecast/SHOUTcast MP3
// stream outright with MEDIA_ERR_SRC_NOT_SUPPORTED -- confirmed via an
// on-device debug readout during TestFlight testing. Android and desktop
// browsers play the same stream fine. HLS is Apple's own recommended
// format for exactly this situation and is natively supported, so iOS
// (native app only -- mobile Safari on the website is unaffected and
// unchanged) gets the HLS stream instead; every other platform keeps
// using the plain MP3 stream as before.
import { Capacitor } from "@capacitor/core";

const HLS_STREAM_URL = "https://stream.truevoice.digital/hls/truevoice_digital/live.m3u8";

export const IS_IOS_NATIVE =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

export function preferredStreamUrl(mp3Url) {
  return IS_IOS_NATIVE ? HLS_STREAM_URL : mp3Url;
}
