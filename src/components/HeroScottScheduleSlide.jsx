import { useEffect, useState } from "react";
import { getActiveShow } from "../showSchedule.js";
import "./HeroScottScheduleSlide.css";

export default function HeroScottScheduleSlide() {
  const [activeShow, setActiveShow] = useState(getActiveShow);

  useEffect(() => {
    const tick = () => setActiveShow(getActiveShow());
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hero-std-slide hsss-slide">
      <div className="hsss-glow" aria-hidden="true" />
      <div className="hsss-content">
        <div className="hsss-logo-col">
          <div className="scott-schedule-title">
            <span className="sst-the">THE</span>
            <span className="sst-name">SCOTT RITCHIE</span>
            <span className="sst-stream">— STREAM —</span>
          </div>
        </div>
        <div className="hsss-text-col">
          <div className="hsss-sched-card">
            <div className="hsss-sched-days">MON – FRI</div>
            <div className="hsss-sched-times">
              <span>6AM – 9AM ET</span>
              <span>1PM – 4PM ET</span>
            </div>
          </div>
          <p className="hsss-subtext">Tune in live on TrueVoice Digital</p>
        </div>
      </div>
      {activeShow?.id === 'scott' && (
        <div className="hsss-live-badge">
          <span className="hsss-live-dot" aria-hidden="true" />
          LIVE NOW
        </div>
      )}
    </div>
  );
}
