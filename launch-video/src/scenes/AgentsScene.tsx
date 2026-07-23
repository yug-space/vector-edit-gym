import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { rise } from "../animation";
import { Background, Kicker, SceneImage, Status, TypeLine } from "../ui";

type Agent = {
  id: string;
  label: string;
  accent: string;
  image: string;
  code: string[];
  result: ReactNode;
};

const agents: Agent[] = [
  {
    id: "01",
    label: "solver / rewrite",
    accent: "#2877c7",
    image: "scenes/station-collateral.svg",
    code: [
      '<circle id="signal-amber" fill="#f59e0b" />',
      '<rect id="train-door" x="104" />',
      '<circle id="door-handle" cx="105" />',
    ],
    result: <Status ok={false}>collateral change</Status>,
  },
  {
    id: "02",
    label: "solver / approximate",
    accent: "#7658c7",
    image: "scenes/station-incomplete.svg",
    code: [
      '<path id="overhead-wire" d="M8 24 Q..." />',
      '<rect id="train-door" x="128" />',
      '<circle id="signal-amber" fill="#f59e0b" />',
    ],
    result: <Status ok={false}>repair incomplete</Status>,
  },
  {
    id: "03",
    label: "solver / surgical",
    accent: "#137c4a",
    image: "scenes/station-target.svg",
    code: [
      '<path id="overhead-wire" d="M8 18 C42..." />',
      '<rect id="train-door" x="128" />',
      '<circle id="signal-amber" fill="#f59e0b" />',
    ],
    result: <Status ok>candidate complete</Status>,
  },
];

const AgentCard = ({ agent, index }: { agent: Agent; index: number }) => {
  const frame = useCurrentFrame();
  const delay = 22 + index * 10;
  const imageOpacity = interpolate(frame, [delay + 52, delay + 72], [0.28, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <article className="agent-card" style={rise(frame, delay, 46)}>
      <div className="agent-card-head">
        <div className="agent-orbit" style={{ borderColor: agent.accent }}>
          <span style={{ background: agent.accent }} />A{agent.id}
        </div>
        <span className="agent-label">{agent.label}</span>
      </div>
      <div className="code-window">
        <div className="window-dots">
          <span />
          <span />
          <span />
        </div>
        {agent.code.map((line, lineIndex) => (
          <TypeLine
            key={line}
            text={line}
            frame={frame}
            start={delay + 14 + lineIndex * 17}
          />
        ))}
      </div>
      <div className="agent-preview" style={{ opacity: imageOpacity }}>
        <SceneImage src={agent.image} />
        <div className="agent-result">{agent.result}</div>
      </div>
    </article>
  );
};

export const AgentsScene = ({ duration }: { duration: number }) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [0, duration], [0, 1]);

  return (
    <Background tone="dark" duration={duration}>
      <div className="scene-pad agents-layout">
        <div className="agents-heading">
          <div style={rise(frame, 3)}>
            <Kicker light>Parallel evaluation</Kicker>
          </div>
          <h2 style={rise(frame, 10)}>
            Same instruction.
            <br />
            Different edits.
          </h2>
          <div className="agent-network" style={rise(frame, 18)}>
            <span className="network-source">SVG</span>
            <span
              className="network-line"
              style={{ transform: `scaleX(${pulse})` }}
            />
            <span className="network-targets">3 solvers</span>
          </div>
        </div>
        <div className="agents-grid">
          {agents.map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} index={index} />
          ))}
        </div>
        <div className="agents-caption" style={rise(frame, 122)}>
          The raster can look plausible while the SVG program is still wrong.
        </div>
      </div>
    </Background>
  );
};
