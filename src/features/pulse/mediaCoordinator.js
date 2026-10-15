// Commands only: radio state, audio ownership, and recovery stay in NowPlayingPanel.
export function createMediaCoordinator() {
  let radio = null;
  let stopVideo = null;
  let resumeVideo = null;
  return {
    attachRadio(controls) {
      radio = controls;
      return () => { if (radio === controls) radio = null; };
    },
    playRadio(options) { radio?.play(options); },
    pauseRadio() { radio?.pause(); },
    startVideo(stop, resume) {
      if (stopVideo !== stop) this.stopVideo();
      radio?.pause();
      stopVideo = stop;
      resumeVideo = resume;
    },
    endVideo(stop) { if (stopVideo === stop) { stopVideo = null; resumeVideo = null; } },
    pauseVideo() { stopVideo?.(); },
    playVideo() { resumeVideo?.(); },
    stopVideo() {
      const stop = stopVideo;
      stopVideo = null;
      resumeVideo = null;
      stop?.();
    },
    isVideoActive() { return stopVideo !== null; },
    pauseAll() { this.stopVideo(); radio?.pause(); },
  };
}

export function stopEmbeddedVideo(iframe) {
  try {
    iframe?.contentWindow?.postMessage({ source: "tvd-yt-embed-cmd", type: "stop" }, "*");
  } catch { /* frame already removed */ }
}
