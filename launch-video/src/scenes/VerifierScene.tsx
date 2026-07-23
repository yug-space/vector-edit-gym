import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { rise } from "../animation";
import { COLORS } from "../constants";
import { Background, GateRow, Kicker, SceneImage } from "../ui";

const candidates = [
  {
    id: "A",
    title: "Collateral edit",
    image: "scenes/station-collateral.svg",
    gates: [
      { label: "Requested repair", value: "1 / 3 changes pass", ok: false },
      { label: "SVG validity", value: "parses + renders", ok: true },
      { label: "Preservation", value: "door handle changed", ok: false },
    ],
    reward: 0,
    note: "A visible fix is not enough.",
  },
  {
    id: "B",
    title: "Approximate edit",
    image: "scenes/station-incomplete.svg",
    gates: [
      { label: "Requested repair", value: "55% repair progress", ok: false },
      { label: "SVG validity", value: "parses + renders", ok: true },
      { label: "Preservation", value: "unrelated parts intact", ok: true },
    ],
    reward: 0,
    note: "Clean but incomplete is still incomplete.",
  },
  {
    id: "C",
    title: "Surgical edit",
    image: "scenes/station-target.svg",
    gates: [
      { label: "Requested repair", value: "3 / 3 within tolerance", ok: true },
      { label: "SVG validity", value: "parses + renders", ok: true },
      { label: "Preservation", value: "unrelated parts intact", ok: true },
    ],
    reward: 1,
    note: "Every gate passes.",
  },
];

const Candidate = ({
  candidate,
}: {
  candidate: (typeof candidates)[number];
}) => {
  const frame = useCurrentFrame();
  const rewardProgress = interpolate(frame, [48, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="candidate"
      style={{
        opacity: interpolate(frame, [0, 8, 74, 88], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${interpolate(
          frame,
          [0, 12, 78, 90],
          [28, 0, 0, -22],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )}px)`,
      }}
    >
      <div className="candidate-visual">
        <div className="candidate-label">
          Candidate {candidate.id}
          <strong>{candidate.title}</strong>
        </div>
        <SceneImage src={candidate.image} />
      </div>
      <div className="candidate-gates">
        {candidate.gates.map((gate, index) => (
          <GateRow
            key={gate.label}
            label={gate.label}
            value={gate.value}
            ok={gate.ok}
            delay={10 + index * 11}
          />
        ))}
      </div>
      <div className="candidate-reward">
        <div
          className="reward-number"
          data-pass={candidate.reward === 1}
          style={{ transform: `scale(${0.76 + rewardProgress * 0.24})` }}
        >
          {candidate.reward}
        </div>
        <div>
          <span>binary reward</span>
          <strong>{candidate.note}</strong>
        </div>
      </div>
    </div>
  );
};

export const VerifierScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();

  return (
    <Background duration={duration}>
      <div className="scene-pad verifier-layout">
        <div className="verifier-heading">
          <div style={rise(frame, 3)}>
            <Kicker>Executable verifier</Kicker>
          </div>
          <h2 style={rise(frame, 9)}>
            Looking right
            <br />
            is not enough.
          </h2>
          <p style={rise(frame, 16)}>
            Requested edits are tolerant.
            <br />
            Side effects are not.
          </p>
          <div className="gate-equation" style={rise(frame, 28)}>
            <span>REPAIR</span>
            <b>∧</b>
            <span>VALID</span>
            <b>∧</b>
            <span>PRESERVE</span>
            <b>=</b>
            <strong style={{ color: COLORS.orangeStrong }}>REWARD</strong>
          </div>
        </div>
        <div className="candidate-stage">
          {candidates.map((candidate, index) => (
            <Sequence
              key={candidate.id}
              from={index * 74}
              durationInFrames={92}
              layout="none"
            >
              <Candidate candidate={candidate} />
            </Sequence>
          ))}
          <div className="candidate-counter">
            {candidates.map((candidate, index) => (
              <span
                key={candidate.id}
                style={{
                  background:
                    frame >= index * 74 && frame < index * 74 + 92
                      ? COLORS.orange
                      : COLORS.gray200,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Background>
  );
};
