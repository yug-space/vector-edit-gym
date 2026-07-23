import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { rise } from "../animation";
import { COLORS } from "../constants";
import { Background, Kicker, SceneImage, Wordmark } from "../ui";

const samples = [
  {
    src: "scenes/camp-corrupted.svg",
    label: "repair smoke + stars",
    rotate: -5,
    x: -520,
    y: 250,
  },
  {
    src: "scenes/station-corrupted.svg",
    label: "repair signal + door",
    rotate: 1.5,
    x: 0,
    y: 295,
  },
  {
    src: "scenes/aurora-corrupted.svg",
    label: "repair aurora + moon",
    rotate: 5,
    x: 520,
    y: 245,
  },
];

export const IntroScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.8, stiffness: 120 },
  });
  const stripProgress = spring({
    frame: frame - 42,
    fps,
    config: { damping: 20, mass: 0.9, stiffness: 90 },
  });

  return (
    <Background duration={duration}>
      <div className="intro-accent" />
      <div className="intro-center">
        <div style={rise(frame, 4, 20)}>
          <Kicker>An SVG repair benchmark</Kicker>
        </div>
        <div
          style={{
            marginTop: 34,
            transform: `scale(${0.88 + scale * 0.12})`,
            opacity: scale,
          }}
        >
          <Wordmark size={132} authors />
        </div>
        <h1 className="intro-question" style={rise(frame, 22, 28)}>
          Can models surgically edit SVG code?
        </h1>
        <p className="intro-copy" style={rise(frame, 32, 26)}>
          Natural-language repairs. Hidden structural targets.
          <br />
          Binary rewards for clean edits.
        </p>
      </div>

      <div
        className="sample-strip"
        style={{
          opacity: stripProgress,
          transform: `translateY(${(1 - stripProgress) * 120}px)`,
        }}
      >
        {samples.map((sample, index) => (
          <SceneImage
            key={sample.src}
            src={sample.src}
            label={sample.label}
            className="sample-card"
            style={{
              transform: `translate(${sample.x}px, ${sample.y}px) rotate(${
                sample.rotate +
                interpolate(frame, [0, duration], [0, index % 2 ? 0.8 : -0.8])
              }deg)`,
              borderColor: index === 1 ? COLORS.orange : COLORS.gray200,
            }}
          />
        ))}
      </div>
    </Background>
  );
};
