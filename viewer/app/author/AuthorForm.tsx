"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

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

const CORRUPTIONS_FOR_SOURCE: Record<"icon" | "scene", string[]> = {
  icon: ["wrong_color", "wrong_stroke_width", "wrong_scale", "clipped_viewbox"],
  scene: [
    "missing_part", "extra_part", "displaced_part", "miscolor_part",
    "flipped_part", "duplicate_part", "wrong_color", "clipped_viewbox",
  ],
};

export function AuthorForm() {
  const [options, setOptions] = useState<Options | null>(null);
  useEffect(() => {
    fetch("/api/author/options").then((r) => r.json()).then(setOptions);
  }, []);

  const [difficulty, setDifficulty] = useState("very_easy");
  const [taskId, setTaskId] = useState("");
  const [sourceKind, setSourceKind] = useState<"icon" | "scene">("scene");
  const [sourceName, setSourceName] = useState("house");
  const [corruptionKind, setCorruptionKind] = useState("missing_part");
  const [params, setParams] = useState<Record<string, any>>({ part: "door" });
  const [instruction, setInstruction] = useState("This house is missing its door. Draw it back in.");
  const [category, setCategory] = useState("missing_part");

  useEffect(() => {
    fetch(`/api/author/next-id?difficulty=${difficulty}`)
      .then((r) => r.json())
      .then((d) => d.task_id && setTaskId(d.task_id));
  }, [difficulty]);

  useEffect(() => {
    if (!options) return;
    if (sourceKind === "icon" && !options.icons.find((i) => i.name === sourceName)) {
      setSourceName(options.icons[0]?.name ?? "");
    }
    if (sourceKind === "scene" && !options.scenes.find((s) => s.name === sourceName)) {
      setSourceName(options.scenes[0]?.name ?? "");
    }
    if (!CORRUPTIONS_FOR_SOURCE[sourceKind].includes(corruptionKind)) {
      setCorruptionKind(CORRUPTIONS_FOR_SOURCE[sourceKind][0]);
    }
  }, [sourceKind, options]); // eslint-disable-line react-hooks/exhaustive-deps

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
          part: { id: "stray-dot", type: "circle", cx: 24, cy: 100, r: 4, fill: "#e63946" },
        });
        break;
    }
    setCategory(corruptionKind);
  }, [corruptionKind, sourceName, options]);

  const draft = useMemo(() => ({
    source: { kind: sourceKind, name: sourceName },
    corruption: { kind: corruptionKind, ...params },
  }), [sourceKind, sourceName, corruptionKind, params]);

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

  const [saveStatus, setSaveStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const onSave = async () => {
    if (!instruction.trim()) {
      setSaveStatus({ kind: "err", msg: "Instruction is required." });
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
    setInstruction("");
  };

  if (!options) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading options…</p>;
  }

  const sceneInfo = options.scenes.find((s) => s.name === sourceName);
  const allowedCorruptions = CORRUPTIONS_FOR_SOURCE[sourceKind];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      {/* FORM */}
      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader>
          <CardTitle>New task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="diff">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="diff"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tid">Task ID</Label>
              <Input id="tid" value={taskId} onChange={(e) => setTaskId(e.target.value)} className="font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Source</Label>
            <RadioGroup value={sourceKind} onValueChange={(v) => setSourceKind(v as "icon" | "scene")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem id="src-scene" value="scene" />
                <Label htmlFor="src-scene">composite scene</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="src-icon" value="icon" />
                <Label htmlFor="src-icon">single icon</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>{sourceKind === "scene" ? "Scene" : "Icon"}</Label>
            <Select value={sourceName} onValueChange={setSourceName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(sourceKind === "scene" ? options.scenes.map((s) => s.name) : options.icons.map((i) => i.name)).map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Corruption</Label>
            <Select value={corruptionKind} onValueChange={setCorruptionKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedCorruptions.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CorruptionParams kind={corruptionKind} params={params} setParams={setParams} sceneParts={sceneInfo?.parts ?? []} />

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="cat">Category</Label>
            <Input id="cat" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instr">Instruction (natural language)</Label>
            <Textarea
              id="instr"
              rows={4}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. This bell is missing its ringer. Add it back."
            />
          </div>

          <Button onClick={onSave} className="w-full" size="lg">
            <Save />
            Save task & continue
          </Button>

          {saveStatus && (
            <div
              className={
                "flex items-start gap-2 rounded-md border p-3 text-sm " +
                (saveStatus.kind === "ok"
                  ? "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                  : "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]")
              }
            >
              {saveStatus.kind === "ok" ? <CheckCircle2 className="mt-0.5" /> : <AlertCircle className="mt-0.5" />}
              <span>{saveStatus.msg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PREVIEW */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Initial (broken)</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-lg border bg-white text-[#222]"
                dangerouslySetInnerHTML={{ __html: preview?.initial_svg ?? "" }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Target (clean)</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="mx-auto flex aspect-square max-w-sm items-center justify-center rounded-lg border bg-white text-[#222]"
                dangerouslySetInnerHTML={{ __html: preview?.target_svg ?? "" }}
              />
            </CardContent>
          </Card>
        </div>

        {previewError && (
          <div className="rounded-md border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]">
            Preview error: {previewError}
          </div>
        )}

        {preview && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Expected diff</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-72 overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 font-mono text-xs">
                  {JSON.stringify(preview.expected_diff, null, 2)}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Parts ({preview.parts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {preview.parts.map((p) => (
                    <Badge key={p} variant={preview.target_parts.includes(p) ? "default" : "outline"}>
                      {p}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {preview.target_parts.length} target part(s) · {preview.should_preserve.length} preserved
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function CorruptionParams({
  kind, params, setParams, sceneParts,
}: {
  kind: string;
  params: Record<string, any>;
  setParams: (p: Record<string, any>) => void;
  sceneParts: { id: string; type: string }[];
}) {
  const update = (k: string, v: any) => setParams({ ...params, [k]: v });

  if (kind === "wrong_color") {
    return (
      <div className="space-y-1.5">
        <Label>Wrong color</Label>
        <ColorPicker value={params.wrong} onChange={(v) => update("wrong", v)} />
      </div>
    );
  }
  if (kind === "wrong_stroke_width") {
    return (
      <div className="space-y-1.5">
        <Label>Wrong stroke-width</Label>
        <Input type="number" step={0.5} value={params.wrong} onChange={(e) => update("wrong", parseFloat(e.target.value))} />
      </div>
    );
  }
  if (kind === "wrong_scale") {
    return (
      <div className="space-y-1.5">
        <Label>Wrong size (px)</Label>
        <Input type="number" step={4} value={params.wrong} onChange={(e) => update("wrong", parseFloat(e.target.value))} />
      </div>
    );
  }
  if (kind === "clipped_viewbox") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Width</Label>
          <Input type="number" value={params.w} onChange={(e) => update("w", parseInt(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Height</Label>
          <Input type="number" value={params.h} onChange={(e) => update("h", parseInt(e.target.value))} />
        </div>
      </div>
    );
  }
  if (kind === "missing_part" || kind === "flipped_part") {
    return (
      <div className="space-y-1.5">
        <Label>Part</Label>
        <PartPicker parts={sceneParts} value={params.part} onChange={(v) => update("part", v)} />
      </div>
    );
  }
  if (kind === "displaced_part" || kind === "duplicate_part") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>Part</Label>
          <PartPicker parts={sceneParts} value={params.part} onChange={(v) => update("part", v)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>dx</Label>
            <Input type="number" value={params.dx} onChange={(e) => update("dx", parseInt(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>dy</Label>
            <Input type="number" value={params.dy} onChange={(e) => update("dy", parseInt(e.target.value))} />
          </div>
        </div>
      </>
    );
  }
  if (kind === "miscolor_part") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>Part</Label>
          <PartPicker parts={sceneParts} value={params.part} onChange={(v) => update("part", v)} />
        </div>
        <div className="space-y-1.5">
          <Label>Wrong color</Label>
          <ColorPicker value={params.wrong} onChange={(v) => update("wrong", v)} />
        </div>
      </>
    );
  }
  if (kind === "extra_part") {
    const extra = params.part ?? {};
    return (
      <div className="space-y-1.5">
        <Label>Extra primitive (raw spec)</Label>
        <Textarea
          rows={6}
          className="font-mono text-xs"
          value={JSON.stringify(extra, null, 2)}
          onChange={(e) => {
            try {
              setParams({ ...params, part: JSON.parse(e.target.value) });
            } catch { /* still typing */ }
          }}
        />
      </div>
    );
  }
  return null;
}

function PartPicker({
  parts, value, onChange,
}: {
  parts: { id: string; type: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {parts.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.id} ({p.type})</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className="h-7 w-7 rounded-md border transition-transform hover:scale-110"
          style={{
            background: c,
            outline: value === c ? "2px solid hsl(var(--ring))" : "1px solid hsl(var(--border))",
            outlineOffset: value === c ? "1px" : "0",
          }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <Input className="ml-2 w-28 font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
