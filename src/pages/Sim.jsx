import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { RHYTHMS } from "../data/rhythms.js";
import { RHYTHM_VIDEO_PATHS } from "../data/rhythmVideos.js";
import ECGWaveform from "../components/ECGWaveform.jsx";
import RhythmEducationTabs from "../components/RhythmEducationTabs.jsx";

const SPEED_OPTIONS = [1, 0.75, 0.5, 0.25];
const WAVEFORM_SPEED_OPTIONS = [0.5, 1, 1.5, 2];

function formatBpm(bpm) {
  if (!bpm) return "--";
  if (bpm.type === "unstable") return "Chaotic";
  if (bpm.type === "range") return `${bpm.min}-${bpm.max} BPM`;
  return `${bpm.value} BPM`;
}

function SimulatorWaveform({ rhythm }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const displayedBpm = rhythm.id === "ventricular-tachycardia"
    ? { type: "fixed", value: 220 }
    : rhythm.bpm;

  function resetWaveform() {
    setIsPlaying(true);
    setSpeed(1);
    setResetKey((key) => key + 1);
  }

  return (
    <aside className="sim-waveform-panel" aria-label={`${rhythm.name} EKG waveform`}>
      <div className="sim-waveform-panel__head">
        <div>
          <div className="sim-waveform-panel__eyebrow">EKG Waveform</div>
          <h2 className="sim-waveform-panel__title">{rhythm.name}</h2>
        </div>
        <div className="sim-waveform-panel__readout">
          <span>{rhythm.tag}</span>
          <strong>{formatBpm(displayedBpm)}</strong>
        </div>
      </div>

      <div className="sim-waveform-panel__display">
        <ECGWaveform
          key={resetKey}
          rhythmId={rhythm.id}
          isPlaying={isPlaying}
          speed={speed}
          height={300}
        />
      </div>

      <div className="sim-waveform-controls" aria-label="Waveform controls">
        <button
          type="button"
          className={`sim-waveform-control ${isPlaying ? "sim-waveform-control--active" : ""}`}
          onClick={() => setIsPlaying(true)}
          disabled={isPlaying}
        >
          Play
        </button>
        <button
          type="button"
          className={`sim-waveform-control ${!isPlaying ? "sim-waveform-control--active" : ""}`}
          onClick={() => setIsPlaying(false)}
          disabled={!isPlaying}
        >
          Pause
        </button>
        <label className="sim-waveform-speed">
          <span>Speed</span>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {WAVEFORM_SPEED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}x
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="sim-waveform-control" onClick={resetWaveform}>
          Reset
        </button>
      </div>
    </aside>
  );
}

export default function Sim() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const videoPanelRef = useRef(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isAnimationFullscreen, setIsAnimationFullscreen] = useState(false);

  const rhythm = useMemo(() => RHYTHMS.find((x) => x.id === id), [id]);
  const videoSrc = RHYTHM_VIDEO_PATHS[rhythm?.id];

  // Reset animation speed when switching rhythms
  useEffect(() => {
    setPlaybackRate(1);
  }, [id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    function syncFullscreenState() {
      const fullscreenElement =
        document.fullscreenElement || document.webkitFullscreenElement;

      setIsAnimationFullscreen(fullscreenElement === videoPanelRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!isAnimationFullscreen) return undefined;

    document.body.classList.add("animation-fullscreen-open");

    function handleEscape(event) {
      if (event.key !== "Escape") return;

      const fullscreenElement =
        document.fullscreenElement || document.webkitFullscreenElement;
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;

      if (fullscreenElement === videoPanelRef.current && exitFullscreen) {
        Promise.resolve(exitFullscreen.call(document))
          .catch(() => undefined)
          .finally(() => {
            setIsAnimationFullscreen(false);
          });
      } else {
        setIsAnimationFullscreen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.classList.remove("animation-fullscreen-open");
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAnimationFullscreen]);

  async function enterAnimationFullscreen() {
    const panel = videoPanelRef.current;
    if (!panel) return;

    setIsAnimationFullscreen(true);

    const requestFullscreen = panel.requestFullscreen || panel.webkitRequestFullscreen;
    if (!requestFullscreen) return;

    try {
      await requestFullscreen.call(panel);
    } catch {
      // The full-viewport CSS mode remains active when native fullscreen is unavailable.
    }
  }

  async function exitAnimationFullscreen() {
    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement;
    const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;

    if (fullscreenElement === videoPanelRef.current && exitFullscreen) {
      try {
        await exitFullscreen.call(document);
      } catch {
        // State cleanup below still returns the animation to its embedded layout.
      } finally {
        setIsAnimationFullscreen(false);
      }
      return;
    }

    setIsAnimationFullscreen(false);
  }


  if (!rhythm) {
    return (
      <section className="page">
        <div className="hero">
          <h1 className="hero__title">Not found</h1>
          <p className="hero__sub">
            That module doesn’t exist. Go back to <Link to="/">Home</Link>.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="sim-head">
        <div>
          <h1 className="sim-title">{rhythm.name}</h1>
          <div className="sim-meta">{rhythm.description}</div>
        </div>
        <div className="badge">Module • {rhythm.tag}</div>
      </div>

      <div className="sim-media-grid">
        <div
          ref={videoPanelRef}
          className={`canvas sim-video-panel${
            isAnimationFullscreen ? " sim-video-panel--fullscreen" : ""
          }`}
          aria-label={`${rhythm.name} animation area`}
        >
          <>
            <video
              ref={videoRef}
              className="canvas__video"
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = playbackRate;
              }}
            />
            <div className="sim-video-toolbar">
              <label className="sim-video-speed">
                <span>Speed</span>
                <select
                  value={playbackRate}
                  onChange={(event) => setPlaybackRate(Number(event.target.value))}
                  aria-label="Animation playback speed"
                >
                  {SPEED_OPTIONS.map((speed) => (
                    <option key={speed} value={speed}>
                      {speed === 1 ? "1.0" : speed}x
                    </option>
                  ))}
                </select>
              </label>

              <div className="sim-video-toolbar__actions">
                <span className="sim-video-label">{rhythm.tag} Animation</span>
                <button
                  type="button"
                  className="sim-video-fullscreen-button"
                  onClick={
                    isAnimationFullscreen
                      ? exitAnimationFullscreen
                      : enterAnimationFullscreen
                  }
                  aria-pressed={isAnimationFullscreen}
                  aria-label={
                    isAnimationFullscreen
                      ? `Minimize ${rhythm.name} animation`
                      : `View ${rhythm.name} animation full screen`
                  }
                >
                  {isAnimationFullscreen ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
                    </svg>
                  )}
                  <span>{isAnimationFullscreen ? "Minimize" : "Full screen"}</span>
                </button>
              </div>
            </div>

            {isAnimationFullscreen ? (
              <div className="sim-video-fullscreen-hint">Press Esc to exit full screen</div>
            ) : null}
          </>
        </div>

        <SimulatorWaveform key={rhythm.id} rhythm={rhythm} />
      </div>

      <RhythmEducationTabs
        key={rhythm.id}
        rhythmId={rhythm.id}
        rhythmName={rhythm.name}
      />
    </section>
  );
}
