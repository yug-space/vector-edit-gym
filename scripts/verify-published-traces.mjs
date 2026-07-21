#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDirectory = join(ROOT, "data");
const resultsDirectory = join(dataDirectory, "model-results");
const published = readJson(join(dataDirectory, "model-results.json"));
const failures = [];
const traceIds = new Set();
let recordCount = 0;

const taskIds = Object.keys(published.results ?? {}).sort();
const shardIds = readdirSync(resultsDirectory)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.slice(0, -5))
  .sort();
if (JSON.stringify(taskIds) !== JSON.stringify(shardIds)) {
  fail("task shard set differs from model-results.json");
}

for (const taskId of taskIds) {
  const task = readJson(join(dataDirectory, "tasks", `${taskId}.json`));
  const shard = readJson(join(resultsDirectory, `${taskId}.json`));
  const rows = published.results[taskId];
  if (JSON.stringify(shard) !== JSON.stringify(rows)) {
    fail(`${taskId}: shard differs from model-results.json`);
  }
  if (rows.length !== published.runs.length) {
    fail(`${taskId}: expected ${published.runs.length} model rows, found ${rows.length}`);
  }

  for (const row of rows) {
    recordCount += 1;
    const label = `${taskId}/${row.model}`;
    if (row.task_id !== taskId) fail(`${label}: task ID mismatch`);
    const trace = row.trace;
    if (!trace || typeof trace !== "object") {
      fail(`${label}: trace is missing`);
      continue;
    }
    if (trace.schema_version !== published.trace_schema) fail(`${label}: trace schema mismatch`);
    if (!trace.trace_id || traceIds.has(trace.trace_id)) fail(`${label}: trace ID is missing or duplicated`);
    traceIds.add(trace.trace_id);

    const prompt = `Repair request:\n${task.instruction}\n\nCorrupted SVG:\n${task.initial_svg}`;
    const messages = trace.request?.messages ?? [];
    if (messages.length !== 2 || messages[0]?.role !== "system" || messages[1]?.role !== "user") {
      fail(`${label}: expected one system and one user request message`);
    }
    verifyReference(label, messages[1]?.content_ref, messages[1]?.content_sha256, prompt);

    for (const attempt of trace.attempts ?? []) {
      for (const choice of attempt.response?.choices ?? []) {
        const message = choice?.message;
        if (!message?.content_ref) continue;
        verifyReference(
          `${label}: response`,
          message.content_ref,
          message.content_sha256,
          resolveReference(message.content_ref, row, prompt),
        );
      }
    }

    const extraction = trace.extraction ?? {};
    for (const field of ["raw_response", "produced_svg"]) {
      const ref = extraction[`${field}_ref`];
      if (!ref) continue;
      verifyReference(
        `${label}: extraction.${field}`,
        ref,
        extraction[`${field}_sha256`],
        resolveReference(ref, row, prompt),
      );
    }

    const evaluations = trace.evaluations ?? [];
    if (evaluations.length === 0) fail(`${label}: evaluator history is empty`);
    const current = evaluations.at(-1) ?? {};
    for (const field of [
      "reward",
      "specification_pass",
      "repair_pass",
      "preservation_pass",
      "validity_pass",
    ]) {
      if (current[field] !== row[field]) fail(`${label}: current evaluator snapshot differs for ${field}`);
    }
    if (current.diff_report_ref) {
      const report = resolveReference(current.diff_report_ref, row, prompt);
      if (report == null) fail(`${label}: verifier report reference does not resolve`);
    }
  }
}

scanCredentials(published, "model-results.json");

if (failures.length > 0) {
  console.error(`Trace verification failed with ${failures.length} error(s):`);
  for (const message of failures.slice(0, 25)) console.error(`- ${message}`);
  if (failures.length > 25) console.error(`- ... ${failures.length - 25} more`);
  process.exit(1);
}

console.log(
  `Verified ${recordCount} published traces across ${taskIds.length} tasks: `
  + "all references resolve, hashes match, shards agree, and no credential patterns were found.",
);

function verifyReference(label, ref, digest, value) {
  if (!ref) {
    fail(`${label}: reference is missing`);
    return;
  }
  if (value == null) {
    fail(`${label}: ${ref} does not resolve`);
    return;
  }
  if (typeof value !== "string") {
    fail(`${label}: hashed reference ${ref} is not a string`);
    return;
  }
  if (!digest || sha256(value) !== digest) fail(`${label}: hash mismatch for ${ref}`);
}

function resolveReference(ref, row, prompt) {
  if (ref === "task.prompt") return prompt;
  if (ref === "result.produced_svg") return row.produced_svg;
  if (ref === "result.raw_response") return row.raw_response;
  if (ref === "result.verifier_report") return row.verifier_report;
  fail(`${row.task_id}/${row.model}: unknown reference ${ref}`);
  return undefined;
}

function scanCredentials(value, location) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanCredentials(child, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (
        /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[-_]?key)$/i.test(key)
        && child !== "[REDACTED]"
      ) {
        fail(`${location}.${key}: sensitive field is not redacted`);
      }
      scanCredentials(child, `${location}.${key}`);
    }
    return;
  }
  if (typeof value !== "string") return;
  if (/\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{12,}/i.test(value)) {
    fail(`${location}: bearer credential pattern found`);
  }
  if (/\bsk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{16,}\b/.test(value)) {
    fail(`${location}: API credential pattern found`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message) {
  failures.push(message);
}
