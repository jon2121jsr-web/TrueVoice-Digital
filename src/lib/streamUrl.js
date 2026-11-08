// Stage 4A website recovery: use the standard origin mount, not the relay mount.
// Rollback: return LIVE365_STREAM_URL below, or restore the prior deployment.
// No automatic fallback or legacy environment/platform override is enabled.
export const LIVE365_STREAM_URL = "https://streaming.live365.com/a61535";
export const AZURACAST_STREAM_URL = "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

export function preferredStreamUrl() {
  return AZURACAST_STREAM_URL;
}
