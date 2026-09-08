// src/hooks/useAuthSession.js
// Shared auth session state for the scroll feed -- same supabaseRealtime
// client and magic-link flow ChimeIn already uses, so signing in from
// either surface signs you in everywhere (same Supabase project, same
// persisted session).
import { useEffect, useState } from "react";
import { supabaseRealtime } from "../lib/supabaseRealtime";

export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseRealtime.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabaseRealtime.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  return { session, loading };
}
