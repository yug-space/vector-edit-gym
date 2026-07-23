import { Easing, interpolate } from "remotion";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const reveal = (frame: number, delay = 0, duration = 18): number =>
  interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

export const sceneOpacity = (
  frame: number,
  duration: number,
  fade = 10,
): number =>
  interpolate(frame, [0, fade, duration - fade, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const rise = (
  frame: number,
  delay = 0,
  distance = 34,
): { opacity: number; transform: string } => {
  const progress = reveal(frame, delay);
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * distance}px)`,
  };
};

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
