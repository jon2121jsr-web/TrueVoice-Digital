import { IS_PREVIEW, previewReadOnlyFetch } from './previewSafety';
import { createClient } from '@supabase/supabase-js';

// Separate client with realtime enabled — used only by ChimeIn.
// The default supabaseClient.js has realtime disabled to avoid
// unnecessary websocket connections on every page load.
export const supabaseRealtime = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: { enabled: true },
    ...(IS_PREVIEW ? { global: { fetch: previewReadOnlyFetch(import.meta.env.VITE_SUPABASE_URL) } } : {}),
    auth: {
      detectSessionInUrl: !IS_PREVIEW,
      persistSession: !IS_PREVIEW,
      autoRefreshToken: !IS_PREVIEW,
    }
  }
);
