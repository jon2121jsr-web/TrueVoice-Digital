// src/showSchedule.js
// All times are Eastern Time. Add/remove entries here when the schedule changes.

function getNowInET() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

export const showSchedule = [
  { id: 'scott', name: 'The Scott Ritchie Stream',    tagline: 'Live Now', logo: '/images/shows/scott-ritchie-logo.png', days: [1,2,3,4,5], startHour: 6,  startMin: 0, endHour: 9,  endMin: 0 },
  { id: 'ryan',  name: 'The Ryan Kliesch Show-gram',  tagline: 'Live Now', logo: '/images/shows/ryan-kliesch-logo.png',  days: [1,2,3,4,5], startHour: 9,  startMin: 0, endHour: 12, endMin: 0 },
  { id: 'scott', name: 'The Scott Ritchie Stream',    tagline: 'Live Now', logo: '/images/shows/scott-ritchie-logo.png', days: [1,2,3,4,5], startHour: 13, startMin: 0, endHour: 16, endMin: 0 },
  { id: 'ryan',  name: 'The Ryan Kliesch Show-gram',  tagline: 'Live Now', logo: '/images/shows/ryan-kliesch-logo.png',  days: [1,2,3,4,5], startHour: 16, startMin: 0, endHour: 19, endMin: 0 },
];

export function getActiveShow() {
  const now      = getNowInET();
  const day      = now.getDay();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  return showSchedule.find(show =>
    show.days.includes(day) &&
    totalMin >= show.startHour * 60 + show.startMin &&
    totalMin <  show.endHour  * 60 + show.endMin
  ) || null;
}
