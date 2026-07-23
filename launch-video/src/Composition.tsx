import { Composition } from "remotion";
import { FPS, TOTAL_FRAMES } from "./constants";
import { LaunchVideo } from "./LaunchVideo";

export const VideoCompositions = () => {
  return (
    <Composition
      id="VectorBenchLaunch"
      component={LaunchVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
