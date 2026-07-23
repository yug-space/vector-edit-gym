import { interpolate, useCurrentFrame } from "remotion";
import { reveal, rise } from "../animation";
import { COLORS, LEADERBOARD } from "../constants";
import { Background, Kicker } from "../ui";

export const ResultsScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();

  return (
    <Background duration={duration}>
      <div className="scene-pad results-layout">
        <div className="results-copy">
          <div style={rise(frame, 3)}>
            <Kicker>Measured end to end</Kicker>
          </div>
          <h2 style={rise(frame, 10)}>
            The benchmark
            <br />
            stays difficult.
          </h2>
          <div className="best-score" style={rise(frame, 24)}>
            <strong>15.0%</strong>
            <span>best full-pass rate</span>
          </div>
          <p style={rise(frame, 36)}>
            One outcome per task. No fallback routing.
            <br />
            Every trace remains inspectable.
          </p>
        </div>

        <div className="leaderboard-panel" style={rise(frame, 14, 48)}>
          <div className="leaderboard-head">
            <span>solver</span>
            <span>full pass</span>
          </div>
          {LEADERBOARD.map((entry, index) => {
            const barProgress = reveal(frame, 34 + index * 12, 32);
            return (
              <div className="leaderboard-row" key={entry.name}>
                <div className="leaderboard-rank">0{index + 1}</div>
                <div className="leaderboard-name">
                  <strong>{entry.name}</strong>
                  <span>{entry.provider}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${entry.score * 5.2 * barProgress}%`,
                      background: index === 0 ? COLORS.orange : COLORS.gray400,
                    }}
                  />
                </div>
                <div className="leaderboard-score">
                  {(
                    interpolate(barProgress, [0, 1], [0, entry.score]) || 0
                  ).toFixed(1)}
                  %
                </div>
              </div>
            );
          })}
          <div className="leaderboard-foot">
            <span>40 naturalistic repair tasks</span>
            <span>published traces + artifacts</span>
          </div>
        </div>
      </div>
    </Background>
  );
};
