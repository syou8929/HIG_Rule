import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import ruleSchema from "../schemas/rule.schema.json" with { type: "json" };
import sourcePageSchema from "../schemas/source-page.schema.json" with { type: "json" };
import coverageSchema from "../schemas/coverage.schema.json" with { type: "json" };
import inventorySchema from "../schemas/inventory.schema.json" with { type: "json" };
import { makeCoverage } from "../src/lib/coverage.js";
import { loadRules, loadSourcePages } from "../src/lib/store.js";
import type { Inventory } from "../src/lib/types.js";
import { now, readJson, sha256, writeJson, writeText } from "../src/lib/util.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const addFormats = addFormatsModule as unknown as (instance: Ajv2020) => Ajv2020;
addFormats(ajv);
const validateRule = ajv.compile(ruleSchema);
const validatePage = ajv.compile(sourcePageSchema);
const validateCoverage = ajv.compile(coverageSchema);
const validateInventory = ajv.compile(inventorySchema);
const errors: string[] = [];
const warnings: string[] = [];
const rules = await loadRules({ includeDeprecated: true });
const pages = await loadSourcePages();
const inventoryPath = resolve("src/sources/apple-hig/inventory.json");
const inventory = await readJson<Inventory>(inventoryPath);
const coverage = await readJson<unknown>(resolve("src/sources/apple-hig/coverage.json"));

if (!validateInventory(inventory)) errors.push(`inventory: ${ajv.errorsText(validateInventory.errors)}`);

for (const rule of rules) {
  if (!validateRule(rule)) errors.push(`${rule.id}: ${ajv.errorsText(validateRule.errors)}`);
}
for (const page of pages) {
  if (!validatePage(page)) errors.push(`${page.url}: ${ajv.errorsText(validatePage.errors)}`);
  for (const candidate of page.guidance_candidates) {
    if (candidate.word_count > 19 || candidate.text.trim().split(/\s+/).length > 19) errors.push(`${page.url}: evidence fragment exceeds 19 words`);
  }
}
if (!validateCoverage(coverage)) errors.push(`coverage: ${ajv.errorsText(validateCoverage.errors)}`);

const expectedCoverage = makeCoverage(inventory, rules);
const withoutGeneratedAt = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { generated_at: _generatedAt, ...rest } = value as Record<string, unknown>;
  return rest;
};
if (JSON.stringify(withoutGeneratedAt(coverage)) !== JSON.stringify(withoutGeneratedAt(expectedCoverage))) {
  errors.push("Coverage data is stale or inconsistent with the inventory and canonical rules");
}

const ids = new Set<string>();
for (const rule of rules) {
  if (ids.has(rule.id)) errors.push(`Duplicate rule ID: ${rule.id}`);
  ids.add(rule.id);
  if (!rule.source.url.startsWith("https://developer.apple.com/design/human-interface-guidelines")) errors.push(`${rule.id}: non-HIG primary source`);
  if (!rule.source.section_path.length) errors.push(`${rule.id}: missing section path`);
  if (rule.normative_level === "MUST" && !/^(always|ensure|make sure|must|required)/i.test(rule.title)) warnings.push(`${rule.id}: MUST requires strength review`);
  if (rule.normative_level === "MUST_NOT" && !/^(never|must not)/i.test(rule.title)) warnings.push(`${rule.id}: MUST_NOT requires strength review`);
  if (rule.scope.portability === "universal" && /\b(ios|ipados|macos|tvos|visionos|watchos|swiftui|uikit|appkit|sf symbols)\b/i.test(`${rule.title} ${rule.statement.en}`)) {
    errors.push(`${rule.id}: Apple-specific language is classified as universal`);
  }
}

const canonicalUrls = new Set(inventory.pages.map((page) => page.canonical_url));
if (canonicalUrls.size !== inventory.pages.length) errors.push("Inventory contains duplicate canonical URLs");
if (inventory.pages.some((page) => page.category === "unclassified")) errors.push("Inventory contains unclassified pages");
const pageUrls = new Set(pages.map((page) => page.canonical_url));
const sourcePageByUrl = new Map(pages.map((page) => [page.canonical_url, page]));
const activeRulesByUrl = new Map<string, typeof rules>();
for (const rule of rules.filter((item) => item.status === "active")) {
  const pageRules = activeRulesByUrl.get(rule.source.url) ?? [];
  pageRules.push(rule);
  activeRulesByUrl.set(rule.source.url, pageRules);

  const sourcePage = sourcePageByUrl.get(rule.source.url);
  if (!sourcePage) {
    errors.push(`${rule.id}: source URL is absent from the source-page store`);
    continue;
  }
  if (rule.source.source_hash !== sourcePage.source_hash) errors.push(`${rule.id}: source hash does not match its source-page record`);
  const candidate = sourcePage.guidance_candidates.find((item) =>
    item.source_sentence_hash === rule.source.source_sentence_hash
    && JSON.stringify(item.section_path) === JSON.stringify(rule.source.section_path));
  if (!candidate) errors.push(`${rule.id}: source candidate is absent from its source-page record`);
}
for (const page of inventory.pages) {
  if (!["blocked", "skipped"].includes(page.status) && !pageUrls.has(page.canonical_url)) errors.push(`Missing source-page record: ${page.canonical_url}`);
  if (["blocked", "skipped"].includes(page.status) && !page.status_history.some((entry) => entry.status === page.status && entry.reason)) {
    errors.push(`${page.canonical_url}: ${page.status} page has no recorded reason`);
  }
  const sourcePage = sourcePageByUrl.get(page.canonical_url);
  if (sourcePage) {
    if (sourcePage.category !== page.category) errors.push(`${page.canonical_url}: inventory/source category mismatch`);
    if (sourcePage.source_hash !== page.source_hash) errors.push(`${page.canonical_url}: inventory/source hash mismatch`);
    if (sourcePage.guidance_candidates.length !== page.candidate_count) errors.push(`${page.canonical_url}: inventory candidate count mismatch`);
  }
  const activeCount = activeRulesByUrl.get(page.canonical_url)?.length ?? 0;
  if (activeCount !== page.rule_count) errors.push(`${page.canonical_url}: inventory rule count ${page.rule_count} does not match ${activeCount} active rules`);
}

const distRules = await readJson<unknown>(resolve("dist/apple-hig-rules.json"));
if (JSON.stringify(distRules) !== JSON.stringify(rules)) errors.push("Generated JSON adapter is stale relative to canonical rules");
const manifest = await readJson<{ canonical_hash: string }>(resolve("dist/manifest.json"));
if (manifest.canonical_hash !== sha256(JSON.stringify(rules))) errors.push("Generated manifest hash is stale");

const normalizedStatements = new Map<string, string[]>();
for (const rule of rules.filter((item) => item.status === "active")) {
  const normalized = rule.statement.en.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const matches = normalizedStatements.get(normalized) ?? [];
  matches.push(rule.id);
  normalizedStatements.set(normalized, matches);
}
const duplicates = Array.from(normalizedStatements.values()).filter((matches) => matches.length > 1);
if (duplicates.length) warnings.push(`${duplicates.length} exact normalized-statement duplicate groups require review`);

async function markdownFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(path));
    else if (entry.isFile() && /\.(md|mdc)$/.test(entry.name)) result.push(path);
  }
  return result;
}

for (const path of await markdownFiles(resolve("."))) {
  const text = await import("node:fs/promises").then(({ readFile }) => readFile(path, "utf8"));
  for (const match of text.matchAll(/\]\((?!https?:\/\/|#)([^)]+)\)/g)) {
    const target = match[1]?.split("#")[0];
    if (!target || target.startsWith("mailto:")) continue;
    try { await stat(resolve(path, "..", target)); } catch { errors.push(`${path}: broken local link ${target}`); }
  }
}

const report = { generated_at: now(), valid: errors.length === 0, errors, warnings, duplicate_rule_candidates: duplicates };
await writeJson(resolve("dist/reports/validation.json"), report);
await writeText(resolve("dist/reports/validation.md"), `# Validation report\n\n- Result: ${report.valid ? "PASS" : "FAIL"}\n- Errors: ${errors.length}\n- Warnings: ${warnings.length}\n- Duplicate candidate groups: ${duplicates.length}\n\n## Errors\n\n${errors.length ? errors.map((error) => `- ${error}`).join("\n") : "None."}\n\n## Warnings\n\n${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "None."}\n\n## Duplicate rule candidates\n\n${duplicates.length ? duplicates.map((ids) => `- ${ids.join(", ")}`).join("\n") : "None."}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  for (const page of inventory.pages) {
    if (page.status !== "blocked" && page.status !== "validated") {
      page.status = "validated";
      page.status_history.push({ status: "validated", at: now() });
    }
  }
  inventory.generated_at = now();
  await writeJson(inventoryPath, inventory);
  console.log(`Validated ${rules.length} rules, ${pages.length} source pages, coverage, generated adapters, and local links (${warnings.length} warnings).`);
}
