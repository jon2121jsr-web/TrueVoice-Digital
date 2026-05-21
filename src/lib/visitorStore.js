// TEMPORARY localStorage-backed visit log.
// When a TrueVoice Supabase project exists, swap the body of `recordVisit`
// for a single fetch() POST to /rest/v1/page_visits — that's the only line
// that needs to change. `readAllVisits` becomes a select().

const STORAGE_KEY = 'tv_page_visits';
const MAX_VISITS  = 5000;

export function recordVisit(visit) {
  try {
    const visits = readAllVisits();
    visits.push(visit);
    const trimmed = visits.length > MAX_VISITS ? visits.slice(-MAX_VISITS) : visits;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage unavailable (private mode, quota) — silent fail */
  }
}

export function readAllVisits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
