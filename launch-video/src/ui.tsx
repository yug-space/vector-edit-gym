import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { COLORS } from "./constants";
import { reveal, sceneOpacity } from "./animation";

export const Background = ({
  tone = "light",
  children,
  duration,
}: {
  tone?: "light" | "dark";
  children: ReactNode;
  duration: number;
}) => {
  const frame = useCurrentFrame();
  const dark = tone === "dark";

  return (
    <AbsoluteFill
      className={dark ? "scene scene-dark" : "scene scene-light"}
      style={{ opacity: sceneOpacity(frame, duration) }}
    >
      <div className="grid-field" style={{ opacity: dark ? 0.12 : 0.4 }} />
      <div
        className="scan-line"
        style={{
          transform: `translateX(${interpolate(
            frame,
            [0, duration],
            [-300, 2100],
          )}px)`,
          opacity: dark ? 0.24 : 0.16,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const Kicker = ({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) => (
  <div className={light ? "kicker kicker-light" : "kicker"}>
    <span className="kicker-line" />
    {children}
  </div>
);

export const Wordmark = ({
  size = 92,
  light = false,
  authors = false,
}: {
  size?: number;
  light?: boolean;
  authors?: boolean;
}) => (
  <div className="wordmark-wrap">
    <div
      className="wordmark"
      style={{
        fontSize: size,
        color: light ? COLORS.white : COLORS.ink,
      }}
    >
      Vector-<strong>Bench</strong>
    </div>
    {authors ? (
      <div className={light ? "byline byline-light" : "byline"}>
        <span>by</span>
        <strong>Yug Gupta + Prannay Hebbar</strong>
      </div>
    ) : null}
  </div>
);

export const SceneImage = ({
  src,
  label,
  style,
  className = "",
}: {
  src: string;
  label?: string;
  style?: CSSProperties;
  className?: string;
}) => (
  <div className={`scene-image ${className}`} style={style}>
    {label ? <div className="scene-image-label">{label}</div> : null}
    <Img src={staticFile(src)} />
  </div>
);

export const Status = ({
  ok,
  children,
  neutral = false,
}: {
  ok: boolean;
  children: ReactNode;
  neutral?: boolean;
}) => (
  <span
    className={`status ${
      neutral ? "status-neutral" : ok ? "status-ok" : "status-bad"
    }`}
  >
    <span>{neutral ? "·" : ok ? "✓" : "×"}</span>
    {children}
  </span>
);

export const TypeLine = ({
  text,
  frame,
  start,
  color = COLORS.gray200,
}: {
  text: string;
  frame: number;
  start: number;
  color?: string;
}) => {
  const chars = Math.floor(
    interpolate(frame, [start, start + 38], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <div className="type-line" style={{ color }}>
      {text.slice(0, chars)}
      {chars < text.length ? <span className="cursor">_</span> : null}
    </div>
  );
};

export const GateRow = ({
  label,
  value,
  ok,
  delay,
}: {
  label: string;
  value: string;
  ok: boolean;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const progress = reveal(frame, delay, 12);
  return (
    <div
      className="gate-row"
      style={{
        opacity: progress,
        transform: `translateX(${(1 - progress) * 24}px)`,
      }}
    >
      <div className="gate-icon" data-ok={ok}>
        {ok ? "✓" : "×"}
      </div>
      <div>
        <div className="gate-label">{label}</div>
        <div className="gate-value">{value}</div>
      </div>
    </div>
  );
};
