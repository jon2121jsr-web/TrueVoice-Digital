import { useEffect, useState } from "react";
import { getActiveShow } from "../showSchedule.js";
import "./HeroRyanScheduleSlide.css";

export default function HeroRyanScheduleSlide() {
  const [activeShow, setActiveShow] = useState(getActiveShow);

  useEffect(() => {
    const tick = () => setActiveShow(getActiveShow());
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hero-std-slide hrss-slide">
      <div className="hrss-content">
        <div className="hrss-logo-col">
          <img
            src="/images/shows/ryan-kliesch-logo.png"
            alt="The Ryan Kliesch Show-gram"
            className="hrss-logo-img"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
        </div>
        <div className="hrss-text-col">
          <div className="hrss-sched-card">
            <div className="hrss-sched-days">MON – FRI</div>
            <div className="hrss-sched-times">
              <span>9AM – 12PM ET</span>
              <span>4PM – 7PM ET</span>
            </div>
          </div>
          <p className="hrss-subtext">Tune in live on TrueVoice Digital</p>
        </div>
      </div>
      {activeShow?.id === 'ryan' && (
        <div className="hrss-live-badge">
          <span className="hrss-live-dot" aria-hidden="true" />
          LIVE NOW
        </div>
      )}
    </div>
  );
}
