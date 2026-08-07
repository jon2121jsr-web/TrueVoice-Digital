// src/showSchedule.js
// Canonical schedule times are Phoenix, Arizona (America/Phoenix). Phoenix
// does not observe daylight saving, so live-show detection below never
// drifts. The etRange/etStart labels are fixed display strings (current
// EDT offset, PHX + 3h) — like the rest of the site's hardcoded ET labels,
// they'll read an hour early during Standard Time months (~Nov–Mar).
// Update those label strings by hand if that becomes a problem.
// Add/remove entries here when the schedule changes.

function getNowInPHX() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' }));
}

export const showSchedule = [
  // ── The Ryan Kliesch Show-gram — Mon–Fri, 3x daily ──
  { id: 'ryan', name: 'The Ryan Kliesch Show-gram', tagline: 'Live Now', logo: '/images/shows/ryan-kliesch-logo.png',
    days: [1,2,3,4,5], startHour: 6,  startMin: 0, endHour: 8,  endMin: 0,
    phxRange: '6–8AM PHX',      etRange: '9–11AM ET',    etStart: '9AM ET',  phxStart: '6AM PHX' },
  { id: 'ryan', name: 'The Ryan Kliesch Show-gram', tagline: 'Live Now', logo: '/images/shows/ryan-kliesch-logo.png',
    days: [1,2,3,4,5], startHour: 10, startMin: 0, endHour: 12, endMin: 0,
    phxRange: '10AM–12PM PHX',  etRange: '1–3PM ET',     etStart: '1PM ET',  phxStart: '10AM PHX' },
  { id: 'ryan', name: 'The Ryan Kliesch Show-gram', tagline: 'Live Now', logo: '/images/shows/ryan-kliesch-logo.png',
    days: [1,2,3,4,5], startHour: 14, startMin: 0, endHour: 16, endMin: 0,
    phxRange: '2–4PM PHX',      etRange: '5–7PM ET',     etStart: '5PM ET',  phxStart: '2PM PHX' },

  // ── The Reclaimed Life with Denisha Workizer — Mon–Fri, 3x daily ──
  { id: 'denisha', name: 'The Reclaimed Life with Denisha Workizer', tagline: 'Live Now', logo: null,
    days: [1,2,3,4,5], startHour: 8,  startMin: 0, endHour: 10, endMin: 0,
    phxRange: '8–10AM PHX',     etRange: '11AM–1PM ET',  etStart: '11AM ET', phxStart: '8AM PHX' },
  { id: 'denisha', name: 'The Reclaimed Life with Denisha Workizer', tagline: 'Live Now', logo: null,
    days: [1,2,3,4,5], startHour: 12, startMin: 0, endHour: 14, endMin: 0,
    phxRange: '12–2PM PHX',     etRange: '3–5PM ET',     etStart: '3PM ET',  phxStart: '12PM PHX' },
  { id: 'denisha', name: 'The Reclaimed Life with Denisha Workizer', tagline: 'Live Now', logo: null,
    days: [1,2,3,4,5], startHour: 16, startMin: 0, endHour: 18, endMin: 0,
    phxRange: '4–6PM PHX',      etRange: '7–9PM ET',     etStart: '7PM ET',  phxStart: '4PM PHX' },

  // ── Pigskin Frenzy — Saturdays ──
  { id: 'pigskin', name: 'Pigskin Frenzy', tagline: 'Live Now', logo: null,
    days: [6], startHour: 12, startMin: 0, endHour: 14, endMin: 0,
    phxRange: '12–2PM PHX',     etRange: '3–5PM ET',     etStart: '3PM ET',  phxStart: '12PM PHX' },
];

export function getActiveShow() {
  const now      = getNowInPHX();
  const day      = now.getDay();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  return showSchedule.find(show =>
    show.days.includes(day) &&
    totalMin >= show.startHour * 60 + show.startMin &&
    totalMin <  show.endHour  * 60 + show.endMin
  ) || null;
}

// Next show to air from right now — checks the rest of today first, then
// wraps forward through the week. Used by the "Next up" ticker.
export function getNextShow() {
  const now      = getNowInPHX();
  const day      = now.getDay();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  const byStart  = (a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin);

  const laterToday = showSchedule
    .filter(s => s.days.includes(day) && s.startHour * 60 + s.startMin > totalMin)
    .sort(byStart);
  if (laterToday.length) return laterToday[0];

  for (let offset = 1; offset <= 7; offset++) {
    const d = (day + offset) % 7;
    const candidates = showSchedule.filter(s => s.days.includes(d)).sort(byStart);
    if (candidates.length) return candidates[0];
  }
  return null;
}
