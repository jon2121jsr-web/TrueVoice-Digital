// AzuraCast is the origin/metadata source, never a listener fallback.
// Ignore legacy environment/platform overrides on every listener platform.
export const LIVE365_STREAM_URL = "https://streaming.live365.com/a61535";

export function preferredStreamUrl() {
  return LIVE365_STREAM_URL;
}
