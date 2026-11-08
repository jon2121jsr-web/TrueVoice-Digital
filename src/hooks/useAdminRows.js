import { useEffect, useState } from 'react';
import { readAdminData } from '../lib/adminData';

export function useAdminRows(kind, days, token, pollMs = 0) {
  const [state, setState] = useState({ rows: null, loading: true, error: null });
  useEffect(() => {
    let active = true, inFlight = false;
    let controller;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const identity = { kind, days, token };
      setState({ rows: null, loading: true, error: null, identity });
      try {
        const rows = await readAdminData(kind, days, token, controller.signal);
        if (active) setState({ rows, loading: false, error: null, identity });
      } catch (error) {
        if (active) setState({ rows: null, loading: false, identity, error: error.name === 'AbortError'
          ? 'Admin metrics timed out. Check connectivity and retry.' : error.message });
      } finally { clearTimeout(timeout); inFlight = false; }
    };
    load();
    const timer = pollMs ? setInterval(load, pollMs) : null;
    return () => { active = false; controller?.abort(); clearInterval(timer); };
  }, [kind, days, token, pollMs]);
  return state.identity?.kind === kind && state.identity.days === days && state.identity.token === token
    ? state : { rows: null, loading: true, error: null };
}
