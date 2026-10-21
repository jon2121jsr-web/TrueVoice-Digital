
import "./PulseIntro.css";
import { NavLink } from "react-router-dom";

export default function PulseIntro() {
  return (
    <header className="pulse-intro" aria-labelledby="pulse-title">
      <div className="pulse-intro__eyebrow">
        <span className="pulse-intro__live-dot" />
        TRUEVOICE PULSE
      </div>

      <h1 id="pulse-title">
        Music is the heartbeat.
        <span> Discovery is the experience.</span>
      </h1>


      <nav className="pulse-intro__modes" aria-label="PULSE modes">
        <NavLink to="/" end>PULSE LIVE</NavLink>
        <NavLink to="/explore">PULSE EXPLORE <span aria-hidden="true">↗</span></NavLink>
        <span>MY PULSE <small>Coming soon</small></span>
      </nav>

      <p className="pulse-intro__signature">
        Hear something. Feel something. Find something.
      </p>
    </header>
  );
}
