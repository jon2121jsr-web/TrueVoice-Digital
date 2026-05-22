import { useEffect } from 'react';
import { recordVisit } from '../lib/visitorStore';

export function useVisitorBeacon() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;

    recordVisit(
      window.location.pathname,
      document.referrer,
      navigator.userAgent
    );
  }, []);
}
