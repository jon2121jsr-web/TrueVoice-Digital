// src/hooks/useVerseRadioAudio.js
// Plays TrueVoice's live radio stream behind the Verse of the Day card in
// the Spiritual Scrolling feed. Independent of the homepage's own
// <audio> player in App.jsx -- that one only mounts on the "*" route, so
// it isn't reachable from /scroll, and the two routes are never on
// screen at once anyway, so there's no risk of double playback.
//
// One shared Audio() element for the whole /scroll session (same pattern
// as useYouTubePlayer's sharedMuted): mute is a feed-wide preference that
// carries across every verse card instead of resetting per card, and
// reusing a single already-user-activated element (rather than creating
// a fresh one per card) is what makes an unmuted resume reliable on
// mobile -- browsers gate a *new* media element's unmuted autoplay much
// more strictly than resuming one they've already seen a real tap on.
import { useEffect, useState } from "react";

const LIVE365_STREAM_URL = "https://streaming.live365.com/a61535";
const LIVE_STREAM_URL =
  import.meta.env.VITE_TRUEVOICE_STREAM_URL || LIVE365_STREAM_URL;
const AZURACAST_FALLBACK_URL =
  "https://stream.truevoice.digital/listen/truevoice_digital/radio.mp3";

let sharedAudio = null;
let sharedMuted = true;
const listeners = new Set();

function getAudio() {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "none";
    sharedAudio.muted = sharedMuted;
    sharedAudio.playsInline = true;
  }
  return sharedAudio;
}

function setSharedMuted(next) {
  sharedMuted = next;
  getAudio().muted = next;
  listeners.forEach((listener) => listener(next));
}

function startPlayback(audio) {
  if (!audio.src) {
    audio.src = LIVE_STREAM_URL;
  }
  audio.play().catch(() => {
    audio.src = AZURACAST_FALLBACK_URL;
    audio.play().catch(() => {
      // Autoplay blocked entirely (e.g. an unmuted resume with no fresh
      // gesture behind it) -- the mute button is still a real click, and
      // toggling it calls play() again below, which will succeed then.
    });
  });
}

// `active` mirrors the video cards' isActive: only the on-screen verse
// card should be making sound. Mute is shared feed-wide, like video mute.
export function useVerseRadioAudio(active) {
  const [muted, setMuted] = useState(sharedMuted);

  useEffect(() => {
    const onChange = (next) => setMuted(next);
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, []);

  useEffect(() => {
    const audio = getAudio();
    if (active) {
      audio.muted = sharedMuted;
      startPlayback(audio);
    } else {
      audio.pause();
    }
  }, [active]);

  // Safety net for leaving /scroll entirely while a verse card was still
  // active -- the `active` effect above already pauses on the normal
  // scroll-away path.
  useEffect(() => {
    return () => {
      if (!active) return;
      sharedAudio?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const next = !sharedMuted;
    setSharedMuted(next);
    // A real click -- if playback had been silently blocked because an
    // earlier attempt had no gesture behind it, this one will succeed.
    if (active) startPlayback(getAudio());
  };

  return { muted, toggleMute };
}
