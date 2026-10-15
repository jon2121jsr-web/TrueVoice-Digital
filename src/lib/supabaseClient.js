import { IS_PREVIEW, previewReadOnlyFetch } from './previewSafety';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: { enabled: false },
    ...(IS_PREVIEW ? {
      global: { fetch: previewReadOnlyFetch(import.meta.env.VITE_SUPABASE_URL) },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    } : {}),
  }
);
