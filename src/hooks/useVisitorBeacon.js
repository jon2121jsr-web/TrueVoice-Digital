import { useEffect } from 'react';
import { recordVisit } from '../lib/visitorStore';

export function useVisitorBeacon() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;

    recordVisit({
      visited_at: new Date().toISOString(),
      path:       window.location.pathname,
      referrer:   document.referrer || null,
      user_agent: navigator.userAgent,
    });
  }, []);
}
