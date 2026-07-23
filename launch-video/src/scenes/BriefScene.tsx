import { interpolate, useCurrentFrame } from "remotion";
import { reveal, rise } from "../animation";
import { COLORS, TASK_PROMPT } from "../constants";
import { Background, Kicker, SceneImage } from "../ui";

const callouts = [
  { label: "wire sag", left: "48%", top: "18%", delay: 42 },
  { label: "door shifted", left: "67%", top: "48%", delay: 54 },
  { label: "signal dark", left: "77%", top: "29%", delay: 66 },
];

export const BriefScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const promptProgress = interpolate(frame, [16, 84], [0, TASK_PROMPT.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Background duration={duration}>
      <div className="brief-layout">
        <div className="brief-copy">
          <div style={rise(frame, 4)}>
            <Kicker>Task 01 / scenic repair</Kicker>
          </div>
          <h2 style={rise(frame, 12)}>
            Describe the problem.
            <br />
            Hide the answer.
          </h2>
          <div className="prompt-box" style={rise(frame, 20)}>
            <div className="prompt-label">
              <span className="prompt-dot" />
              Natural-language instruction
            </div>
            <p>
              {TASK_PROMPT.slice(0, Math.floor(promptProgress))}
              {promptProgress < TASK_PROMPT.length ? (
                <span className="cursor cursor-dark">_</span>
              ) : null}
            </p>
          </div>
          <div className="brief-rule" style={rise(frame, 92)}>
            <span>Input</span>
            <strong>corrupted SVG</strong>
            <span className="rule-arrow">→</span>
            <span>Target</span>
            <strong>evaluator only</strong>
          </div>
        </div>

        <div className="brief-visual" style={rise(frame, 10, 48)}>
          <SceneImage
            src="scenes/station-corrupted.svg"
            label="corrupted input.svg"
            className="brief-scene"
          />
          {callouts.map((callout) => {
            const progress = reveal(frame, callout.delay, 14);
            return (
              <div
                key={callout.label}
                className="callout"
                style={{
                  left: callout.left,
                  top: callout.top,
                  opacity: progress,
                  transform: `scale(${0.75 + progress * 0.25})`,
                }}
              >
                <span
                  className="callout-ring"
                  style={{
                    boxShadow: `0 0 0 ${
                      4 + Math.sin(frame / 5) * 2
                    }px rgba(255,140,26,.18)`,
                  }}
                />
                <span className="callout-label">{callout.label}</span>
              </div>
            );
          })}
          <div
            className="hidden-target"
            style={{ opacity: reveal(frame, 96, 18) }}
          >
            <span>?</span>
            hidden target
          </div>
          <div
            className="brief-orange-corner"
            style={{ background: COLORS.orange }}
          />
        </div>
      </div>
    </Background>
  );
};
