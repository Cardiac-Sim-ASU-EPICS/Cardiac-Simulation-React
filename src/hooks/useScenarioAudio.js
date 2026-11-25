import { useCallback, useEffect, useRef } from "react";

const RHYTHM_AUDIO_PROFILES = {
  "normal-sinus": { bpm: 72, frequency: 880 },
  "atrial-fibrillation": { bpm: 125, frequency: 820, irregular: true },
  "ventricular-fibrillation": {
    bpm: 88,
    frequency: 520,
    irregular: true,
    volume: 0.018,
  },
  "atrial-flutter": { bpm: 150, frequency: 840 },
  "sinus-tachycardia": { bpm: 120, frequency: 900 },
  "ventricular-tachycardia": { bpm: 165, frequency: 720 },
  "supraventricular-tachycardia": { bpm: 170, frequency: 940 },
  "sinus-bradycardia": { bpm: 40, frequency: 780 },
  pea: { bpm: 70, frequency: 760 },
  wpw: { bpm: 95, frequency: 860 },
  "ectopic-atrial-rhythm": { bpm: 82, frequency: 830, irregular: true },
};

const DEFAULT_PROFILE = { bpm: 80, frequency: 840 };
const SCENARIO_VOLUME_MULTIPLIER = 4;
const MAX_SCENARIO_VOLUME = 0.3;

export default function useScenarioAudio({
  enabled,
  isActive,
  outcome,
  rhythmId,
  secondsLeft,
}) {
  const audioContextRef = useRef(null);
  const heartbeatTimerRef = useRef(0);
  const activeOscillatorsRef = useRef(new Set());
  const previousSecondRef = useRef(secondsLeft);
  const previousOutcomeRef = useRef(outcome);

  const isSupported =
    typeof window !== "undefined" && Boolean(window.AudioContext || window.webkitAudioContext);

  const primeAudio = useCallback(() => {
    if (!isSupported) return Promise.resolve(false);

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;
    if (context.state === "suspended") {
      return context.resume().then(() => true).catch(() => false);
    }

    return Promise.resolve(context.state === "running");
  }, [isSupported]);

  const playTone = useCallback(({
    duration = 0.06,
    frequency,
    offset = 0,
    type = "sine",
    volume = 0.035,
  }) => {
    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;

    const startTime = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const audibleVolume = Math.min(volume * SCENARIO_VOLUME_MULTIPLIER, MAX_SCENARIO_VOLUME);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(audibleVolume, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    activeOscillatorsRef.current.add(oscillator);
    oscillator.addEventListener("ended", () => {
      activeOscillatorsRef.current.delete(oscillator);
    });
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }, []);

  const silenceAudio = useCallback(() => {
    if (heartbeatTimerRef.current) {
      window.clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = 0;
    }

    activeOscillatorsRef.current.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The oscillator may already have completed its short envelope.
      }
    });
    activeOscillatorsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!enabled) silenceAudio();
  }, [enabled, silenceAudio]);

  useEffect(() => {
    if (!enabled || !isActive || outcome) return undefined;

    const profile = RHYTHM_AUDIO_PROFILES[rhythmId] || DEFAULT_PROFILE;
    const baseDelay = Math.max(360, Math.min(1500, 60000 / profile.bpm));
    let cancelled = false;

    function scheduleHeartbeat() {
      if (cancelled) return;

      playTone({
        duration: rhythmId === "ventricular-fibrillation" ? 0.035 : 0.055,
        frequency: profile.frequency,
        type: rhythmId === "ventricular-fibrillation" ? "triangle" : "square",
        volume: profile.volume || 0.028,
      });

      const irregularity = profile.irregular ? 0.72 + Math.random() * 0.56 : 1;
      heartbeatTimerRef.current = window.setTimeout(
        scheduleHeartbeat,
        baseDelay * irregularity
      );
    }

    heartbeatTimerRef.current = window.setTimeout(scheduleHeartbeat, 180);

    return () => {
      cancelled = true;
      if (heartbeatTimerRef.current) {
        window.clearTimeout(heartbeatTimerRef.current);
        heartbeatTimerRef.current = 0;
      }
    };
  }, [enabled, isActive, outcome, playTone, rhythmId]);

  useEffect(() => {
    const secondChanged = previousSecondRef.current !== secondsLeft;
    previousSecondRef.current = secondsLeft;

    if (
      !secondChanged ||
      !enabled ||
      !isActive ||
      outcome ||
      secondsLeft <= 0 ||
      secondsLeft > 5
    ) {
      return;
    }

    playTone({ frequency: 1160, duration: 0.08, type: "sine", volume: 0.065 });
    if (secondsLeft <= 3) {
      playTone({
        frequency: 920,
        duration: 0.07,
        offset: 0.12,
        type: "sine",
        volume: 0.05,
      });
    }
  }, [enabled, isActive, outcome, playTone, secondsLeft]);

  useEffect(() => {
    const outcomeChanged = previousOutcomeRef.current !== outcome;
    previousOutcomeRef.current = outcome;

    if (!outcomeChanged || !enabled || !isActive || !outcome) return;

    silenceAudio();

    if (outcome === "success") {
      playTone({ frequency: 620, duration: 0.16, type: "sine", volume: 0.05 });
      playTone({
        frequency: 880,
        duration: 0.28,
        offset: 0.16,
        type: "sine",
        volume: 0.055,
      });
      return;
    }

    playTone({ frequency: 620, duration: 0.9, type: "sine", volume: 0.045 });
    playTone({
      frequency: 310,
      duration: 1.25,
      offset: 0.48,
      type: "sine",
      volume: 0.035,
    });
  }, [enabled, isActive, outcome, playTone, silenceAudio]);

  useEffect(() => {
    return () => {
      silenceAudio();
      const context = audioContextRef.current;
      if (context && context.state !== "closed") {
        context.close().catch(() => undefined);
      }
    };
  }, [silenceAudio]);

  return { isSupported, primeAudio, silenceAudio };
}
