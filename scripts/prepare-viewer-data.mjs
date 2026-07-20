import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "data");
const DEST = join(ROOT, "viewer", "data");

if (!existsSync(SRC)) {
  throw new Error(`missing source data directory: ${SRC}`);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const name of [
  "icons",
  "tasks",
  "model-results",
  "leaderboard.json",
  "model-results-summary.json",
]) {
  const source = join(SRC, name);
  if (existsSync(source)) cpSync(source, join(DEST, name), { recursive: true });
}

const PUBLIC = join(ROOT, "viewer", "public");
const PAPER_PDF = join(ROOT, "output", "pdf", "vectoreditgym-paper.pdf");
if (existsSync(PAPER_PDF)) {
  mkdirSync(PUBLIC, { recursive: true });
  cpSync(PAPER_PDF, join(PUBLIC, "vectoreditgym-paper.pdf"));
}

const PAPER_FIGURES = join(ROOT, "paper", "figures");
const PUBLIC_FIGURES = join(PUBLIC, "figures");
if (existsSync(PAPER_FIGURES)) {
  rmSync(PUBLIC_FIGURES, { recursive: true, force: true });
  mkdirSync(PUBLIC_FIGURES, { recursive: true });
  for (const name of ["edit-completion-vs-ucr.png", "quality-cost-pareto.png"]) {
    const source = join(PAPER_FIGURES, name);
    if (existsSync(source)) cpSync(source, join(PUBLIC_FIGURES, name));
  }
}
