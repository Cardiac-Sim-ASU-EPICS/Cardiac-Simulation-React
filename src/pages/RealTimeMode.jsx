import React, { useEffect, useMemo, useState } from "react";
import ECGWaveform from "../components/ECGWaveform.jsx";
import { REAL_TIME_SCENARIOS } from "../data/realTimeScenarios.js";

const STATUS_STYLES = {
  stable: {
    label: "Stable",
    color: "#7ef0a5",
    background: "rgba(126,240,165,0.12)",
    borderColor: "rgba(126,240,165,0.26)",
  },
  unstable: {
    label: "Unstable",
    color: "#ffd479",
    background: "rgba(255,212,121,0.12)",
    borderColor: "rgba(255,212,121,0.24)",
  },
  urgent: {
    label: "Urgent",
    color: "#ffb36b",
    background: "rgba(255,179,107,0.12)",
    borderColor: "rgba(255,179,107,0.26)",
  },
  critical: {
    label: "Critical",
    color: "#ff9c9c",
    background: "rgba(255,140,140,0.12)",
    borderColor: "rgba(255,140,140,0.26)",
  },
};

// Shuffle answer choices
function shuffleActions(actions) {
  const shuffled = [...actions];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function buildInitialState(scenario) {
  return {
    stepId: scenario.initialStepId,
    patientStatus: scenario.initialStatus,
    actionLog: [],
    feedback: null,
    outcome: null,
    secondsLeft: scenario.steps[scenario.initialStepId].timeLimit,
    currentRhythmId: scenario.rhythmId,
  };
}

function DecisionTimer({ secondsLeft, timeLimit, isFinished }) {
  const safeTimeLimit = Math.max(timeLimit || 1, 1);
  const progress = isFinished
    ? 0
    : Math.max(0, Math.min(100, (secondsLeft / safeTimeLimit) * 100));
  const urgency = isFinished
    ? "finished"
    : secondsLeft <= 5
      ? "critical"
      : secondsLeft <= 10
        ? "warning"
        : "active";
  const statusText = isFinished
    ? "Scenario ended"
    : urgency === "critical"
      ? "Act now"
      : urgency === "warning"
        ? "Time running out"
        : "Choose an action";

  return (
    <div
      className={`decision-timer decision-timer--${urgency}`}
      role="timer"
      aria-label={`${secondsLeft} seconds remaining. ${statusText}.`}
      style={{ "--decision-progress": `${progress}%` }}
    >
      <div className="decision-timer__content">
        <svg className="decision-timer__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.6 1.7M9 3h6M12 3v2" />
        </svg>
        <div className="decision-timer__copy">
          <span>{statusText}</span>
          <div className="decision-timer__value">
            <strong>{secondsLeft}</strong>
            <small>sec</small>
          </div>
        </div>
      </div>
      <div className="decision-timer__track" aria-hidden="true">
        <div className="decision-timer__bar" />
      </div>
    </div>
  );
}

export default function RealTimeMode() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(REAL_TIME_SCENARIOS[0]?.id ?? "");
  const selectedScenario = useMemo(
    () => REAL_TIME_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) || REAL_TIME_SCENARIOS[0],
    [selectedScenarioId]
  );

  const [simulationState, setSimulationState] = useState(() => buildInitialState(selectedScenario));
  // Start button and countdown
  const [hasStarted, setHasStarted] = useState(false);
  const [countdown, setCountdown] = useState(null);
  // Tracks new attempts so answers reshuffle on restart
  const [attemptNumber, setAttemptNumber] = useState(0);
  const currentStep =
    selectedScenario?.steps?.[simulationState.stepId] ||
    selectedScenario?.steps?.[selectedScenario.initialStepId];
  const statusStyle = STATUS_STYLES[simulationState.patientStatus] || STATUS_STYLES.stable;
  const isScenarioFinished = simulationState.outcome !== null;
  // Shuffle the answer choices for each question and new attempt
  const shuffledActions = useMemo(
    () => shuffleActions(currentStep?.actions || []),
    [selectedScenarioId, simulationState.stepId, attemptNumber]
  );

  useEffect(() => {
    setSimulationState(buildInitialState(selectedScenario));
  }, [selectedScenario]);

  useEffect(() => {
  // Start the timer only after the countdown finishes
  if (isScenarioFinished || !hasStarted || countdown > 0) {
    return undefined;
    }

    const timer = setInterval(() => {
      setSimulationState((currentState) => {
        if (currentState.outcome !== null) {
          return currentState;
        }

        if (currentState.secondsLeft > 1) {
          return { ...currentState, secondsLeft: currentState.secondsLeft - 1 };
        }

        const timeoutResult = selectedScenario.steps[currentState.stepId].timeout;
        const nextStepId = timeoutResult.nextStepId || currentState.stepId;
        const nextStep = selectedScenario.steps[nextStepId];

        return {
          ...currentState,
          stepId: nextStepId,
          patientStatus: timeoutResult.nextStatus || currentState.patientStatus,
          feedback: {
            status: "incorrect",
            text: timeoutResult.feedback,
          },
          outcome: timeoutResult.outcome || null,
          secondsLeft: timeoutResult.outcome ? 0 : nextStep.timeLimit,
          currentRhythmId: timeoutResult.nextRhythmId || currentState.currentRhythmId,
          actionLog: [
            ...currentState.actionLog,
            {
              label: "No action taken",
              result: "Timed out",
            },
          ],
        };
      });
    }, 1000);

    return () => clearInterval(timer);
    //edited
  }, [isScenarioFinished, selectedScenario, hasStarted, countdown]);

  // Countdown before simulation starts
  useEffect(() => {
    if (countdown === null || countdown === 0) {
      return undefined;
    }

  const timer = setTimeout(() => {
    setCountdown((currentCountdown) => currentCountdown - 1);
  }, 1000);

  return () => clearTimeout(timer);
}, [countdown]);
  // Start simulation and begin countdown
  function handleStartSimulation() {
    setHasStarted(true);
    setCountdown(3);
  }

  function handleScenarioChange(scenarioId) {
    const nextScenario =
      REAL_TIME_SCENARIOS.find((scenario) => scenario.id === scenarioId) || REAL_TIME_SCENARIOS[0];

    setSimulationState(buildInitialState(nextScenario));
    setHasStarted(false);
    setCountdown(null);
    setSelectedScenarioId(scenarioId);
  }

  function handleRestartScenario() {
    setSimulationState(buildInitialState(selectedScenario));
    setAttemptNumber((currentAttempt) => currentAttempt + 1);
  }

  function handleAction(action) {
    if (isScenarioFinished) {
      return;
    }

    setSimulationState((currentState) => {
      const nextStepId = action.nextStepId || currentState.stepId;
      const nextStep = selectedScenario.steps[nextStepId];

      return {
        ...currentState,
        stepId: nextStepId,
        patientStatus: action.nextStatus || currentState.patientStatus,
        feedback: {
          status: action.isCorrect ? "correct" : "incorrect",
          text: action.feedback,
        },
        outcome: action.outcome || null,
        secondsLeft: action.outcome ? 0 : nextStep.timeLimit,
        currentRhythmId: action.nextRhythmId || currentState.currentRhythmId,
        actionLog: [
          ...currentState.actionLog,
          {
            label: action.label,
            result: action.isCorrect ? "Correct" : "Incorrect",
          },
        ],
      };
    });
  }

  return (
    <section className="page">
      <div className="hero">
        <h1 className="hero__title">Real Time Mode</h1>
        <p className="hero__sub">
          Work through time-sensitive cardiac scenarios and choose the next best action before the
          patient condition worsens.
        </p>
      </div>

      <div className="sim-grid" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="sim-head">
            <div>
              <h2 className="sim-title" style={{ fontSize: 28 }}>{selectedScenario.title}</h2>
              <div className="sim-meta">
                {selectedScenario.patient.name}, age {selectedScenario.patient.age} |{" "}
                {selectedScenario.patient.condition}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div
                className="badge"
                style={{
                  color: statusStyle.color,
                  borderColor: statusStyle.borderColor,
                  background: statusStyle.background,
                }}
              >
                Status | {statusStyle.label}
              </div>
            </div>
          </div>

          <div
            className="sim-canvas"
            aria-label="Real time simulation area"
            style={{ minHeight: 560, padding: 24, background: "#121218" }}
          >
          {!hasStarted ? (
            <div className="real-time-start-screen">
              <div className="real-time-start-card">
                <div className="real-time-start-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="13" r="8" />
                    <path d="M12 9v4l2.6 1.7M9 3h6M12 3v2" />
                  </svg>
                </div>
                <div className="real-time-start-card__eyebrow">Timed decision scenario</div>
                <h3>Be ready to act quickly</h3>
                <p>
                  Each action has a visible countdown. If time expires, the patient may
                  deteriorate and the scenario will advance or end.
                </p>
                <button
                  type="button"
                  className="sidebar__btn real-time-start-card__button"
                  onClick={handleStartSimulation}
                >
                  Start timed scenario
                </button>
              </div>
            </div>
        ) : countdown > 0 ? (
          <div className="real-time-countdown" aria-live="assertive">
            <span>Get ready</span>
            <strong>{countdown}</strong>
            <p>The decision timer starts when this countdown ends.</p>
          </div>
            ) : (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <ECGWaveform
                rhythmId={simulationState.currentRhythmId}
                isPlaying={hasStarted && countdown === 0 && !isScenarioFinished}
                height={250}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      marginBottom: 10,
                    }}
                  >
                    Scenario Description
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
                    {currentStep.title}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.82)", lineHeight: 1.7, maxWidth: "62ch" }}>
                    {currentStep.description}
                  </div>

                  {simulationState.feedback ? (
                    <div
                      style={{
                        marginTop: 16,
                        borderRadius: 16,
                        border: `1px solid ${
                          simulationState.feedback.status === "correct"
                            ? "rgba(126,240,165,0.22)"
                            : "rgba(255,156,156,0.22)"
                        }`,
                        background:
                          simulationState.feedback.status === "correct"
                            ? "rgba(126,240,165,0.08)"
                            : "rgba(255,156,156,0.08)",
                        padding: 14,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        {simulationState.feedback.status === "correct" ? "Correct" : "Incorrect"}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
                        {simulationState.feedback.text}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="real-time-action-panel">
                  <div className="real-time-action-panel__header">
                    <div className="real-time-action-panel__heading">
                      <span>Action Panel</span>
                      <strong>Choose the next best action</strong>
                    </div>

                    <DecisionTimer
                      secondsLeft={simulationState.secondsLeft}
                      timeLimit={currentStep.timeLimit}
                      isFinished={isScenarioFinished}
                    />
                  </div>

                  <div className="real-time-action-panel__choices">
                    {isScenarioFinished ? (
                      <div className="real-time-outcome-card">
                        <div style={{ fontSize: 22, fontWeight: 700 }}>
                          {simulationState.outcome === "success" ? "Scenario Success" : "Scenario Failed"}
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.76)", lineHeight: 1.6 }}>
                          {simulationState.outcome === "success"
                            ? "Your decisions improved patient status and moved the case toward a stable rhythm."
                            : "The patient deteriorated because the scenario was not managed appropriately in time."}
                        </div>
                        <button
                          type="button"
                          className="sidebar__btn"
                          style={{ marginTop: 4 }}
                          onClick={handleRestartScenario}
                        >
                          Restart Scenario
                        </button>
                      </div>
                    ) : (
                      shuffledActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className="sidebar__btn real-time-action-choice"
                          onClick={() => handleAction(action)}
                        >
                          {action.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        <aside className="panel" aria-label="Real time mode details">
          <div className="panel__head">Simulation Setup</div>
          <div className="panel__body">
            <div className="kv">
              <span>Scenario</span>
              <strong>{selectedScenario.title}</strong>
            </div>
            <div className="kv">
              <span>Rhythm</span>
              <strong>{simulationState.currentRhythmId}</strong>
            </div>
            <div className="kv">
              <span>Status</span>
              <strong>{statusStyle.label}</strong>
            </div>

            <div className="panel__head" style={{ margin: "8px -14px 0" }}>
              Scenario Select
            </div>

            <label className="sim-waveform-speed" style={{ width: "100%", minWidth: 0 }}>
              <span style={{ flexShrink: 0 }}>Scenario</span>
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <select
                  value={selectedScenario.id}
                  onChange={(event) => handleScenarioChange(event.target.value)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    padding: "6px 30px 6px 10px",
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                  }}
                >
                  {REAL_TIME_SCENARIOS.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.title}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: 12,
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "rgba(255,255,255,0.75)",
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  &#9662;
                </span>
              </div>
            </label>

            <button type="button" className="sidebar__btn sidebar__btn--ghost" onClick={handleRestartScenario}>
              Restart Current Scenario
            </button>

            <div className="panel__head" style={{ margin: "8px -14px 0" }}>
              Action Summary
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {simulationState.actionLog.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.66)", lineHeight: 1.6, fontSize: 13 }}>
                  No actions taken yet. Make a decision before the timer runs out.
                </div>
              ) : (
                simulationState.actionLog.map((entry, index) => (
                  <div
                    key={`${entry.label}-${index}`}
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{entry.label}</div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{entry.result}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
