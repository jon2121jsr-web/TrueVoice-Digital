// One licensed listener distribution path on every platform:
// AzuraCast (program origin and metadata) -> Live365 -> listener.
// Never route audience audio directly to the AzuraCast origin, even as fallback.
// The URL is intentionally fixed: legacy environment and platform overrides
// must not bypass Live365 royalty reporting and listener analytics.
export const LIVE365_STREAM_URL = "https://streaming.live365.com/a61535";

export function preferredStreamUrl() {
  return LIVE365_STREAM_URL;
}
