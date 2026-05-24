import Link from "next/link";
import { notFound } from "next/navigation";
import { getTask, type DiffEntry } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function TaskDetail({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();

  return (
    <>
      <Link href="/" className="back-link">← All tasks</Link>
      <h1>
        <span style={{ fontFamily: "var(--mono)", color: "var(--fg-3)" }}>{task.task_id}</span>{" "}
        <span className="tag">{task.difficulty}</span>{" "}
        <span className="tag">{task.category}</span>
      </h1>

      <div className="instruction-box">
        <strong>Instruction:</strong> {task.instruction}
      </div>

      <div className="detail-grid">
        <div className="panel">
          <div className="panel-title">Initial</div>
          <div className="panel-svg" dangerouslySetInnerHTML={{ __html: task.initial_svg }} />
        </div>
        <div className="panel">
          <div className="panel-title">Target (expected output)</div>
          <div className="panel-svg" dangerouslySetInnerHTML={{ __html: task.target_svg }} />
        </div>
      </div>

      <h2>Expected diff</h2>
      <DiffTable diff={task.expected_diff} />

      <h2>Should preserve</h2>
      {task.should_preserve.length === 0 ? (
        <p className="muted">No other parts in this scene.</p>
      ) : (
        <div className="preserve-list">
          {task.should_preserve.map((p) => (
            <span key={p} className="preserve-pill">{p}</span>
          ))}
        </div>
      )}

      <h2>Parts in scene</h2>
      <div className="preserve-list">
        {task.parts.map((p) => (
          <span key={p} className="tag">{p}</span>
        ))}
      </div>

      <h2>Initial SVG source</h2>
      <pre className="code">{task.initial_svg}</pre>

      <h2>Target SVG source</h2>
      <pre className="code">{task.target_svg}</pre>

      <h2>Structured spec (target)</h2>
      <pre className="code">{JSON.stringify(task.target_spec, null, 2)}</pre>
    </>
  );
}

function DiffTable({ diff }: { diff: DiffEntry[] }) {
  if (diff.length === 0) {
    return <p className="muted">No diff entries.</p>;
  }
  return (
    <table className="diff-table">
      <thead>
        <tr>
          <th>Part</th>
          <th>Attribute</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {diff.map((d, i) => (
          <tr key={i}>
            <td>{d.part}</td>
            <td>{d.attribute}</td>
            <td className="diff-before">{formatVal(d.before)}</td>
            <td className="diff-after">{formatVal(d.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
