// Browser recovery stays in NowPlayingPanel; native intent/recovery stays in Swift.
export function createMediaCoordinator(nativeAudio = null) {
  let videoEpoch = 0;
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
      if (!nativeAudio) radio?.pause();
      stopVideo = stop;
      resumeVideo = resume;
      const token = ++videoEpoch;
      if (nativeAudio) return nativeAudio.setVideoActive(true).then(() => token === videoEpoch && stopVideo === stop);
    },
    endVideo(stop) {
      if (stopVideo === stop) {
        videoEpoch += 1;
        stopVideo = null;
        resumeVideo = null;
        nativeAudio?.setVideoActive(false).catch(() => {});
      }
    },
    pauseVideo() { stopVideo?.(); },
    playVideo() { resumeVideo?.(); },
    stopVideo() {
      videoEpoch += 1;
      nativeAudio?.setVideoActive(false).catch(() => {});
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
