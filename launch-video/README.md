# Vector-Bench Launch Film

A 36-second, 1920x1080 launch film built with
[Remotion](https://www.remotion.dev/). The composition uses real Vector-Bench
task inputs, model outputs, verifier outcomes, and leaderboard values.

## Storyboard

1. Introduce Vector-Bench and its natural-language SVG repair setting.
2. Show a corrupted station task while the public instruction is written.
3. Follow three candidate solvers constructing different SVG outputs.
4. Run each candidate through repair, validity, and preservation gates.
5. Show the current top-three full-pass results.
6. Close on the project URL and authors.

The solver labels in the parallel-edit and verifier scenes describe candidate
behaviors, not named model claims. The leaderboard scene uses the frozen values
in `data/leaderboard.json`.

## Commands

From the repository root:

```sh
npm --prefix launch-video install
npm run video:lint
npm run video:dev
npm run video:render
```

The Remotion Studio opens the `VectorBenchLaunch` composition. The render command
writes `launch-video/out/vector-bench-launch.mp4`; generated renders and QA stills
are intentionally ignored by Git.

Render a checkpoint frame:

```sh
npm --prefix launch-video run still -- \
  VectorBenchLaunch stills/verifier.png --frame=718
```

## Source Layout

```text
src/LaunchVideo.tsx   composition timeline and audio cues
src/scenes/           six storyboard scenes
src/ui.tsx            reusable visual primitives
src/animation.ts      deterministic frame helpers
public/scenes/        benchmark SVG inputs and candidate artifacts
public/audio/         generated score and interface cues
```

All motion uses Remotion frame state; there are no CSS transitions or runtime
animations. The score and interface cues are synthesized assets. Scene SVGs are
derived from the frozen benchmark corpus and remain subject to the repository's
[provenance notice](../NOTICE.md).
