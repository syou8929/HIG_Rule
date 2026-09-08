import { lstat, open, realpath } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { launchBrowser, openRenderedPage } from "../src/lib/browser.js";
import config from "../src/config/hig.json" with { type: "json" };
import { captureSourceInspection, createSourceEvidence } from "../src/lib/source-inspection.js";
import type { SourcePage } from "../src/lib/types.js";
import { normalizeUrl, readJson } from "../src/lib/util.js";

const args = process.argv.slice(2);
const values = new Map<string, string>();
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index]!;
  const value = args[index + 1];
  if (!["--slug", "--output"].includes(flag) || !value || value.startsWith("--") || values.has(flag)) {
    throw new Error("Usage: tsx scripts/inspect-source.ts --slug <page-slug> [--output <evidence.json>]");
  }
  values.set(flag, value);
}
const slug = values.get("--slug");
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Provide a single valid --slug");
const output = values.get("--output");
if (output && !output.endsWith(".json")) throw new Error("Evidence output must use a .json path");
const outputPath = output ? resolve(output) : null;
if (outputPath) {
  const root = await realpath(resolve("."));
  const allowedRoots = [resolve(root, ".cache"), resolve(root, "docs/audits")];
  if (!allowedRoots.some((directory) => outputPath.startsWith(`${directory}${sep}`))) {
    throw new Error("Evidence output must be under .cache/ or docs/audits/, never a canonical data path");
  }
  const parent = dirname(outputPath);
  if (await realpath(parent) !== parent) throw new Error("Evidence output parent must not use symlink redirection");
  try {
    await lstat(outputPath);
    throw new Error("Evidence output already exists; choose a new filename");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
const stored = await readJson<SourcePage>(resolve("src/sources/apple-hig/pages", `${slug}.json`));
if (normalizeUrl(stored.canonical_url, config.sourceRoot) !== stored.canonical_url) {
  throw new Error("Stored canonical URL must be a normalized official Apple HIG URL");
}
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ locale: "en-US" });
  await openRenderedPage(page, stored.canonical_url);
  const first = await captureSourceInspection(page);
  await openRenderedPage(page, stored.canonical_url);
  const second = await captureSourceInspection(page);
  if (first.canonical_url !== stored.canonical_url || second.canonical_url !== stored.canonical_url) {
    throw new Error("Canonical URL changed; inspect the redirect before reviewing this source");
  }
  const evidence = {
    schema_version: "1.0.0",
    previous_source_hash: stored.source_hash,
    previous_retrieved_at: stored.retrieved_at,
    repeated_render: {
      retrieved_at: first.retrieved_at,
      source_hash: first.source_hash,
      stable: first.source_hash === second.source_hash,
    },
    ...createSourceEvidence(second, stored.guidance_candidates),
  };
  if (outputPath) {
    const file = await open(outputPath, "wx");
    try { await file.writeFile(`${JSON.stringify(evidence, null, 2)}\n`, "utf8"); }
    finally { await file.close(); }
  }
  console.log(JSON.stringify({
    url: evidence.canonical_url,
    retrieved_at: evidence.retrieved_at,
    source_hash: evidence.source_hash,
    previous_source_hash: stored.source_hash,
    repeated_render_stable: evidence.repeated_render.stable,
    matched_candidates: evidence.matched_candidate_count,
    unmatched_candidates: evidence.unmatched_candidate_count,
    unmatched: evidence.candidates.filter((candidate) => candidate.status !== "matched"),
    section_paths: evidence.section_paths,
    output: outputPath,
    note: "No source, rule, or review registry was modified. Hash matches require a separate semantic review.",
  }, null, 2));
  if (!evidence.repeated_render.stable) process.exitCode = 2;
} finally {
  await browser.close();
}
