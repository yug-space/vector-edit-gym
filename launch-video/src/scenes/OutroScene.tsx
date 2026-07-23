import { interpolate, useCurrentFrame } from "remotion";
import { reveal, rise } from "../animation";
import { Background, Kicker, SceneImage, Wordmark } from "../ui";

const scenes = [
  "scenes/camp-corrupted.svg",
  "scenes/aurora-corrupted.svg",
  "scenes/volcano-corrupted.svg",
];

export const OutroScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();

  return (
    <Background tone="dark" duration={duration}>
      <div className="outro-scenes">
        {scenes.map((src, index) => (
          <SceneImage
            key={src}
            src={src}
            className="outro-scene"
            style={{
              opacity: reveal(frame, 10 + index * 8, 24) * 0.45,
              transform: `translateY(${interpolate(
                frame,
                [0, duration],
                [index * 18, index * 18 - 28],
              )}px)`,
            }}
          />
        ))}
        <div className="outro-wash" />
      </div>
      <div className="outro-content">
        <div style={rise(frame, 18)}>
          <Kicker light>Now open source</Kicker>
        </div>
        <div style={rise(frame, 30, 40)}>
          <Wordmark size={142} light />
        </div>
        <h2 style={rise(frame, 42)}>Can models surgically edit SVG code?</h2>
        <div className="outro-url" style={rise(frame, 58)}>
          <span>www.vecbench.xyz</span>
          <span className="outro-url-arrow">↗</span>
        </div>
        <div className="outro-authors" style={rise(frame, 74)}>
          Yug Gupta <span>×</span> Prannay Hebbar
        </div>
      </div>
    </Background>
  );
};
