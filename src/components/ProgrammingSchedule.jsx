// src/components/ProgrammingSchedule.jsx
// Full weekly lineup card — reads directly from showSchedule.js, so it
// stays in sync automatically whenever that file changes.
import { useEffect, useState } from "react";
import { showSchedule, getActiveShow } from "../showSchedule.js";
import "./ProgrammingSchedule.css";

export default function ProgrammingSchedule() {
  const [activeShow, setActiveShow] = useState(getActiveShow);

  useEffect(() => {
    const tick = () => setActiveShow(getActiveShow());
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const byStart = (a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin);
  const weekdaySlots  = showSchedule.filter(s => s.days.includes(1)).sort(byStart);
  const saturdaySlots = showSchedule.filter(s => s.days.includes(6)).sort(byStart);

  if (weekdaySlots.length === 0 && saturdaySlots.length === 0) return null;

  return (
    <section className="tv-section tv-section--stacked">
      <p className="tv-sched-eyebrow">Mon&ndash;Fri</p>
      <h2 className="tv-section-title">This week on TrueVoice</h2>

      <div className="tv-sched-grid">
        {weekdaySlots.map((slot, idx) => {
          const isLive = slot === activeShow;
          return (
            <div key={idx} className={`tv-sched-card${isLive ? " is-live" : ""}`}>
              {isLive && (
                <span className="tv-sched-live-badge">
                  <span className="tv-sched-live-dot" aria-hidden="true" />
                  Live
                </span>
              )}
              <div className="tv-sched-time">{slot.phxRange} &middot; {slot.etRange}</div>
              <div className="tv-sched-show">{slot.name}</div>
            </div>
          );
        })}
      </div>

      {saturdaySlots.length > 0 && (
        <div className="tv-sched-sat">
          <p className="tv-sched-eyebrow">Saturday</p>
          {saturdaySlots.map((slot, idx) => {
            const isLive = slot === activeShow;
            return (
              <div key={idx} className={`tv-sched-sat-row${isLive ? " is-live" : ""}`}>
                <div>
                  <div className="tv-sched-show">{slot.name}</div>
                  {slot.id === "pigskin" && (
                    <div className="tv-sched-sat-sub">with Joel Norris</div>
                  )}
                </div>
                <div className="tv-sched-sat-time">
                  {slot.phxRange}
                  <span className="tv-sched-sat-time-et">{slot.etRange}</span>
                </div>
                {isLive && (
                  <span className="tv-sched-live-badge tv-sched-live-badge--inline">
                    <span className="tv-sched-live-dot" aria-hidden="true" />
                    Live
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
