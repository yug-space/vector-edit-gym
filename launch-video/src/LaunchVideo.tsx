import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { SCENES, TOTAL_FRAMES } from "./constants";
import { AgentsScene } from "./scenes/AgentsScene";
import { BriefScene } from "./scenes/BriefScene";
import { IntroScene } from "./scenes/IntroScene";
import { OutroScene } from "./scenes/OutroScene";
import { ResultsScene } from "./scenes/ResultsScene";
import { VerifierScene } from "./scenes/VerifierScene";

const Whoosh = () => (
  <Audio src={staticFile("audio/whoosh.wav")} volume={0.18} />
);

const Click = () => <Audio src={staticFile("audio/click.wav")} volume={0.12} />;

export const LaunchVideo = () => {
  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("audio/score.wav")}
        volume={(frame) => {
          if (frame < 20) return (frame / 20) * 2;
          if (frame > TOTAL_FRAMES - 40) {
            return Math.max(0, ((TOTAL_FRAMES - frame) / 40) * 2);
          }
          return 2;
        }}
      />

      <Sequence
        from={SCENES.intro.from}
        durationInFrames={SCENES.intro.duration}
      >
        <IntroScene duration={SCENES.intro.duration} />
      </Sequence>
      <Sequence
        from={SCENES.brief.from}
        durationInFrames={SCENES.brief.duration}
      >
        <BriefScene duration={SCENES.brief.duration} />
      </Sequence>
      <Sequence
        from={SCENES.agents.from}
        durationInFrames={SCENES.agents.duration}
      >
        <AgentsScene duration={SCENES.agents.duration} />
      </Sequence>
      <Sequence
        from={SCENES.verifier.from}
        durationInFrames={SCENES.verifier.duration}
      >
        <VerifierScene duration={SCENES.verifier.duration} />
      </Sequence>
      <Sequence
        from={SCENES.results.from}
        durationInFrames={SCENES.results.duration}
      >
        <ResultsScene duration={SCENES.results.duration} />
      </Sequence>
      <Sequence
        from={SCENES.outro.from}
        durationInFrames={SCENES.outro.duration}
      >
        <OutroScene duration={SCENES.outro.duration} />
      </Sequence>

      {[
        SCENES.brief.from,
        SCENES.agents.from,
        SCENES.verifier.from,
        SCENES.results.from,
        SCENES.outro.from,
      ].map((from) => (
        <Sequence key={from} from={from} durationInFrames={25}>
          <Whoosh />
        </Sequence>
      ))}
      {[312, 330, 348, 568, 642].map((from) => (
        <Sequence key={from} from={from} durationInFrames={18}>
          <Click />
        </Sequence>
      ))}
      <Sequence from={716} durationInFrames={80}>
        <Audio src={staticFile("audio/ding.wav")} volume={0.2} />
      </Sequence>
    </AbsoluteFill>
  );
};
