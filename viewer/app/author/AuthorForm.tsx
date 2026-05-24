"use client";

import { useEffect, useMemo, useState } from "react";

type IconEntry = { name: string; source: string; style: string; category: string };
type SceneEntry = { name: string; parts: { id: string; type: string }[] };
type Options = { icons: IconEntry[]; scenes: SceneEntry[]; corruptions: string[] };

type Preview = {
  initial_svg: string;
  target_svg: string;
  expected_diff: any[];
  parts: string[];
  target_parts: string[];
  should_preserve: string[];
};

const DIFFICULTIES = [
  { value: "very_easy", label: "Very Easy" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "very_hard", label: "Very Hard" },
];

const COLORS = [
  "#e63946", "#3b82f6", "#22c55e", "#fde047", "#a855f7",
  "#f97316", "#ec4899", "#06b6d4", "#92400e", "#9ca3af",
];

// Corruption kinds the user can pick. The dynamic params block changes per kind.
const CORRUPTIONS_FOR_SOURCE: Record<"icon" | "scene", string[]> = {
  icon: ["wrong_color", "wrong_stroke_width", "wrong_scale", "clipped_viewbox"],
  scene: [
    "missing_part", "extra_part", "displaced_part", "miscolor_part",
    "flipped_part", "duplicate_part", "wrong_color", "clipped_viewbox",
  ],
};

export function AuthorForm() {
  // ---- options (fetched once) -------------------------------------------
  const [options, setOptions] = useState<Options | null>(null);
  useEffect(() => {
    fetch("/api/author/options").then((r) => r.json()).then(setOptions);
  }, []);

  // ---- form state -------------------------------------------------------
  const [difficulty, setDifficulty] = useState("very_easy");
  const [taskId, setTaskId] = useState("");
  const [sourceKind, setSourceKind] = useState<"icon" | "scene">("scene");
  const [sourceName, setSourceName] = useState("house");
  const [corruptionKind, setCorruptionKind] = useState("missing_part");
  const [params, setParams] = useState<Record<string, any>>({ part: "door" });
  const [instruction, setInstruction] = useState("This house is missing its door. Draw it back in.");
  const [category, setCategory] = useState("missing_part");

  // ---- auto-suggest next task id when difficulty changes ----------------
  useEffect(() => {
    fetch(`/api/author/next-id?difficulty=${difficulty}`)
      .then((r) => r.json())
      .then((d) => d.task_id && setTaskId(d.task_id));
  }, [difficulty]);

  // ---- reset source name when source kind changes -----------------------
  useEffect(() => {
    if (!options) return;
    if (sourceKind === "icon" && !options.icons.find((i) => i.name === sourceName)) {
      setSourceName(options.icons[0]?.name ?? "");
    }
    if (sourceKind === "scene" && !options.scenes.find((s) => s.name === sourceName)) {
      setSourceName(options.scenes[0]?.name ?? "");
    }
    // ensure corruption kind is valid for this source
    if (!CORRUPTIONS_FOR_SOURCE[sourceKind].includes(corruptionKind)) {
      setCorruptionKind(CORRUPTIONS_FOR_SOURCE[sourceKind][0]);
    }
  }, [sourceKind, options]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- reset params when corruption kind changes ------------------------
  useEffect(() => {
    if (!options) return;
    const scene = options.scenes.find((s) => s.name === sourceName);
    const firstPart = scene?.parts[0]?.id;
    switch (corruptionKind) {
      case "wrong_color":
        setParams({ wrong: "#e63946" });
        break;
      case "wrong_stroke_width":
        setParams({ wrong: 4 });
        break;
      case "wrong_scale":
        setParams({ wrong: 64 });
        break;
      case "clipped_viewbox":
        setParams({ w: 80, h: 80 });
        break;
      case "missing_part":
      case "flipped_part":
        setParams({ part: firstPart });
        break;
      case "displaced_part":
        setParams({ part: firstPart, dx: 16, dy: 0 });
        break;
      case "miscolor_part":
        setParams({ part: firstPart, wrong: "#e63946" });
        break;
      case "duplicate_part":
        setParams({ part: firstPart, dx: 10, dy: 0 });
        break;
      case "extra_part":
        setParams({
          part: {
            id: "stray-dot",
            type: "circle",
            cx: 24,
            cy: 100,
            r: 4,
            fill: "#e63946",
          },
        });
        break;
    }
    setCategory(corruptionKind);
  }, [corruptionKind, sourceName, options]);

  // ---- build the draft payload sent to /preview & /save -----------------
  const draft = useMemo(() => {
    return {
      source: { kind: sourceKind, name: sourceName },
      corruption: { kind: corruptionKind, ...params },
    };
  }, [sourceKind, sourceName, corruptionKind, params]);

  // ---- live preview (debounced) -----------------------------------------
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    const handle = setTimeout(() => {
      fetch("/api/author/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      })
        .then((r) => r.json())
        .then((p) => {
          if (cancel) return;
          if (p.error) {
            setPreviewError(p.error);
          } else {
            setPreview(p);
            setPreviewError(null);
          }
        })
        .catch((e) => !cancel && setPreviewError(String(e)));
    }, 150);
    return () => {
      cancel = true;
      clearTimeout(handle);
    };
  }, [draft]);

  // ---- save ------------------------------------------------------------
  const [saveStatus, setSaveStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const onSave = async () => {
    if (!instruction.trim()) {
      setSaveStatus({ kind: "err", msg: "instruction is required" });
      return;
    }
    const r = await fetch("/api/author/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        difficulty,
        category,
        instruction: instruction.trim(),
        draft,
        task_id: taskId,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setSaveStatus({ kind: "err", msg: j.error ?? `HTTP ${r.status}` });
      return;
    }
    setSaveStatus({ kind: "ok", msg: `Saved ${j.task_id}. Next id: ${j.next_id}` });
    setTaskId(j.next_id);
    setInstruction(""); // ready for the next task
  };

  if (!options) return <p className="muted">Loading options…</p>;

  const sceneInfo = options.scenes.find((s) => s.name === sourceName);
  const allowedCorruptions = CORRUPTIONS_FOR_SOURCE[sourceKind];

  return (
    <div className="author-grid">
      {/* LEFT: form */}
      <div className="author-form">
        <Field label="Task ID">
          <input
            className="text-input"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          />
        </Field>

        <Field label="Difficulty">
          <select className="text-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Source">
          <div className="radio-row">
            <label><input type="radio" checked={sourceKind === "scene"} onChange={() => setSourceKind("scene")} /> composite scene</label>
            <label><input type="radio" checked={sourceKind === "icon"} onChange={() => setSourceKind("icon")} /> single icon</label>
          </div>
        </Field>

        <Field label={sourceKind === "scene" ? "Scene" : "Icon"}>
          <select className="text-input" value={sourceName} onChange={(e) => setSourceName(e.target.value)}>
            {(sourceKind === "scene" ? options.scenes.map((s) => s.name) : options.icons.map((i) => i.name)).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>

        <Field label="Corruption">
          <select className="text-input" value={corruptionKind} onChange={(e) => setCorruptionKind(e.target.value)}>
            {allowedCorruptions.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </Field>

        <CorruptionParams
          kind={corruptionKind}
          params={params}
          setParams={setParams}
          sceneParts={sceneInfo?.parts ?? []}
        />

        <Field label="Category (derived; editable)">
          <input className="text-input" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>

        <Field label="Instruction (natural language)">
          <textarea
            className="text-input"
            rows={3}
            value={instruction}
            placeholder="e.g. This bell is missing its ringer. Add it back."
            onChange={(e) => setInstruction(e.target.value)}
          />
        </Field>

        <button className="btn-primary" onClick={onSave}>Save task & continue</button>
        {saveStatus && (
          <div className={saveStatus.kind === "ok" ? "save-ok" : "save-err"}>{saveStatus.msg}</div>
        )}
      </div>

      {/* RIGHT: preview */}
      <div className="author-preview">
        <div className="preview-row">
          <div className="panel">
            <div className="panel-title">Initial (broken)</div>
            <div className="panel-svg" dangerouslySetInnerHTML={{ __html: preview?.initial_svg ?? "" }} />
          </div>
          <div className="panel">
            <div className="panel-title">Target (clean)</div>
            <div className="panel-svg" dangerouslySetInnerHTML={{ __html: preview?.target_svg ?? "" }} />
          </div>
        </div>

        {previewError && <div className="save-err">Preview error: {previewError}</div>}

        {preview && (
          <>
            <h2>Expected diff</h2>
            <pre className="code">{JSON.stringify(preview.expected_diff, null, 2)}</pre>
            <h2>Parts ({preview.parts.length})</h2>
            <div className="preserve-list">
              {preview.parts.map((p) => (
                <span key={p} className={preview.target_parts.includes(p) ? "preserve-pill" : "tag"}>{p}</span>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              {preview.target_parts.length} target part(s) · {preview.should_preserve.length} preserved
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function CorruptionParams({
  kind,
  params,
  setParams,
  sceneParts,
}: {
  kind: string;
  params: Record<string, any>;
  setParams: (p: Record<string, any>) => void;
  sceneParts: { id: string; type: string }[];
}) {
  const update = (k: string, v: any) => setParams({ ...params, [k]: v });

  if (kind === "wrong_color") {
    return (
      <Field label="Wrong color">
        <ColorPicker value={params.wrong} onChange={(v) => update("wrong", v)} />
      </Field>
    );
  }
  if (kind === "wrong_stroke_width") {
    return (
      <Field label="Wrong stroke-width">
        <input
          type="number"
          step={0.5}
          className="text-input"
          value={params.wrong}
          onChange={(e) => update("wrong", parseFloat(e.target.value))}
        />
      </Field>
    );
  }
  if (kind === "wrong_scale") {
    return (
      <Field label="Wrong size (px)">
        <input
          type="number"
          step={4}
          className="text-input"
          value={params.wrong}
          onChange={(e) => update("wrong", parseFloat(e.target.value))}
        />
      </Field>
    );
  }
  if (kind === "clipped_viewbox") {
    return (
      <>
        <Field label="Clipped width">
          <input type="number" className="text-input" value={params.w} onChange={(e) => update("w", parseInt(e.target.value))} />
        </Field>
        <Field label="Clipped height">
          <input type="number" className="text-input" value={params.h} onChange={(e) => update("h", parseInt(e.target.value))} />
        </Field>
      </>
    );
  }
  if (kind === "missing_part" || kind === "flipped_part") {
    return (
      <Field label="Part">
        <PartPicker parts={sceneParts} value={params.part} onChange={(v) => update("part", v)} />
      </Field>
    );
  }
  if (kind === "displaced_part" || kind === "duplicate_part") {
    return (
      <>
        <Field label="Part">
          <PartPicker parts={sceneParts} value={params.part} onChange={(v) => update("part", v)} />
        </Field>
        <Field label="dx">
          <input type="number" step={1} className="text-input" value={params.dx} onChange={(e) => update("dx", parseInt(e.target.value))} />
        </Field>
        <Field label="dy">
          <input type="number" step={1} className="text-input" value={params.dy} onChange={(e) => update("dy", parseInt(e.target.value))} />
        </Field>
      </>
    );
  }
  if (kind === "miscolor_part") {
    return (
      <>
        <Field label="Part">
          <PartPicker parts={sceneParts} value={params.part} onChange={(v) => update("part", v)} />
        </Field>
        <Field label="Wrong color">
          <ColorPicker value={params.wrong} onChange={(v) => update("wrong", v)} />
        </Field>
      </>
    );
  }
  if (kind === "extra_part") {
    const extra = params.part ?? {};
    const setExtra = (k: string, v: any) => update("part", { ...extra, [k]: v });
    return (
      <Field label="Extra primitive (raw spec)">
        <textarea
          className="text-input"
          rows={6}
          value={JSON.stringify(extra, null, 2)}
          onChange={(e) => {
            try {
              update("part", JSON.parse(e.target.value));
            } catch {
              // ignore parse errors; user is still typing
            }
          }}
        />
      </Field>
    );
  }
  return null;
}

function PartPicker({
  parts,
  value,
  onChange,
}: {
  parts: { id: string; type: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select className="text-input" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {parts.map((p) => (
        <option key={p.id} value={p.id}>{p.id} <i>({p.type})</i></option>
      ))}
    </select>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-row">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className="color-swatch"
          style={{
            background: c,
            outline: value === c ? "2px solid var(--accent)" : "1px solid var(--border)",
          }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <input
        className="text-input"
        style={{ width: 100, marginLeft: 8 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
