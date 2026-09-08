import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import ruleSchema from "../schemas/rule.schema.json" with { type: "json" };
import sourcePageSchema from "../schemas/source-page.schema.json" with { type: "json" };
import coverageSchema from "../schemas/coverage.schema.json" with { type: "json" };
import inventorySchema from "../schemas/inventory.schema.json" with { type: "json" };
import duplicateReview from "../src/config/duplicate-review.json" with { type: "json" };
import normativeReview from "../src/config/normative-review.json" with { type: "json" };
import sourceReview from "../src/config/source-review.json" with { type: "json" };
import { makeCoverage } from "../src/lib/coverage.js";
import { duplicateGroupKey, duplicateSourceTraceHash, findExactDuplicateGroups, normalizeRuleStatement } from "../src/lib/duplicates.js";
import { loadRules, loadSourcePages } from "../src/lib/store.js";
import type { Inventory, Rule } from "../src/lib/types.js";
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
const reviewedOverrideIds = new Set(Object.keys(normativeReview.overrides));
const reviewedAdditionalRules = new Set(normativeReview.additional_rules.map((rule) => `${rule.normative_level}\n${rule.title}`));
type SourceReviewRule = {
  source: { source_hash: string; source_sentence_hash: string; section_path: string[] };
  confidence?: "low" | "medium" | "high";
  review_required?: boolean;
  scope?: Rule["scope"];
  review_note: string;
};
type SourceReviewBatch = {
  id: string;
  reviewed_at: string;
  confidence: "low" | "medium" | "high";
  review_required: boolean;
  pages: Array<{ url: string; source_hash: string }>;
  rule_ids: string[];
  scope?: Rule["scope"];
  review_note: string;
};
const sourceReviewRules = sourceReview.rules as Record<string, SourceReviewRule>;
const sourceReviewBatches = sourceReview.batches as SourceReviewBatch[];
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

const expectedCoverage = makeCoverage(inventory, rules, pages);
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
  const hasReviewedAdditionalStrength = reviewedAdditionalRules.has(`${rule.normative_level}\n${rule.title}`);
  if (rule.normative_level === "MUST" && !/^(always|ensure|make sure|must|required)/i.test(rule.title) && !reviewedOverrideIds.has(rule.id) && !hasReviewedAdditionalStrength) warnings.push(`${rule.id}: MUST requires strength review`);
  if (rule.normative_level === "MUST_NOT" && !/^(never|must not)/i.test(rule.title) && !reviewedOverrideIds.has(rule.id) && !hasReviewedAdditionalStrength) warnings.push(`${rule.id}: MUST_NOT requires strength review`);
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
const manifest = await readJson<{ canonical_hash: string; source_inventory_hash: string }>(resolve("dist/manifest.json"));
if (manifest.canonical_hash !== sha256(JSON.stringify(rules))) errors.push("Generated manifest hash is stale");
if (manifest.source_inventory_hash !== normativeReview.source_inventory_hash) errors.push("Normative review source inventory hash is stale");
const normativeReviewReport = await readJson<{ reviewed_rule_count: number; rules: Array<{ id: string; normative_level: string; source: { source_hash: string; source_sentence_hash: string } }> }>(resolve("dist/reports/normative-review.json"));
const currentNormativeRules = rules.filter((rule) => rule.status === "active" && ["MUST", "MUST_NOT"].includes(rule.normative_level));
if (normativeReviewReport.reviewed_rule_count !== currentNormativeRules.length) errors.push("Normative review report count is stale");
const reviewedById = new Map(normativeReviewReport.rules.map((rule) => [rule.id, rule]));
for (const rule of currentNormativeRules) {
  const reviewed = reviewedById.get(rule.id);
  if (!reviewed) errors.push(`${rule.id}: absent from normative review report`);
  else if (reviewed.normative_level !== rule.normative_level || reviewed.source.source_hash !== rule.source.source_hash || reviewed.source.source_sentence_hash !== rule.source.source_sentence_hash) {
    errors.push(`${rule.id}: normative review trace is stale`);
  }
}

const activeRules = rules.filter((item) => item.status === "active");
const activeRuleById = new Map(activeRules.map((rule) => [rule.id, rule]));
const sourceReviewBatchByRuleId = new Map<string, SourceReviewBatch>();
for (const batch of sourceReviewBatches) {
  const batchPageByUrl = new Map(batch.pages.map((page) => [page.url, page]));
  for (const id of batch.rule_ids) {
    if (sourceReviewBatchByRuleId.has(id)) {
      errors.push(`${id}: source review rule appears in more than one batch`);
      continue;
    }
    sourceReviewBatchByRuleId.set(id, batch);
    const rule = activeRuleById.get(id);
    if (!rule) {
      errors.push(`${id}: source review batch points to a missing active rule`);
      continue;
    }
    const page = batchPageByUrl.get(rule.source.url);
    if (!page || page.source_hash !== rule.source.source_hash) errors.push(`${id}: source review batch page trace is stale`);
  }
}
const sourceReviewIds = Array.from(new Set([
  ...Object.keys(sourceReviewRules),
  ...sourceReviewBatches.flatMap((batch) => batch.rule_ids),
])).sort();
const sourceReviewReportRules = sourceReviewIds.map((id) => {
  const review = sourceReviewRules[id];
  const batch = sourceReviewBatchByRuleId.get(id);
  const rule = activeRuleById.get(id);
  if (!rule) {
    errors.push(`${id}: source review points to a missing active rule`);
    return null;
  }
  if (review && (rule.source.source_hash !== review.source.source_hash
    || rule.source.source_sentence_hash !== review.source.source_sentence_hash
    || JSON.stringify(rule.source.section_path) !== JSON.stringify(review.source.section_path))) {
    errors.push(`${id}: source review trace is stale`);
  }
  const expectedReviewRequired = review?.review_required ?? batch?.review_required;
  const expectedConfidence = review?.confidence ?? batch?.confidence;
  if (rule.review_required !== expectedReviewRequired || rule.confidence !== expectedConfidence) {
    errors.push(`${id}: source review state is not applied to the canonical rule`);
  }
  const expectedScope = review?.scope ?? batch?.scope;
  if (expectedScope && !isDeepStrictEqual(rule.scope, expectedScope)) {
    errors.push(`${id}: source review scope is not applied to the canonical rule`);
  }
  return {
    id,
    confidence: rule.confidence,
    review_required: rule.review_required,
    review_note: review?.review_note ?? batch!.review_note,
    ...(batch ? { batch_id: batch.id } : {}),
    source: rule.source,
  };
}).filter((item): item is NonNullable<typeof item> => Boolean(item));
const duplicates = findExactDuplicateGroups(activeRules);
const duplicateByKey = new Map(duplicates.map((group) => [duplicateGroupKey(group), group]));
const duplicateReviewByKey = new Map<string, (typeof duplicateReview.groups)[number]>();
const validDuplicateReviewKeys = new Set<string>();

for (const review of duplicateReview.groups) {
  const key = duplicateGroupKey(review.rule_ids);
  if (duplicateReviewByKey.has(key)) {
    errors.push(`Duplicate review registry repeats group: ${review.rule_ids.join(", ")}`);
    continue;
  }
  duplicateReviewByKey.set(key, review);
  const currentGroup = duplicateByKey.get(key);
  if (!currentGroup) {
    errors.push(`Duplicate review group is stale or no longer exact: ${review.rule_ids.join(", ")}`);
    continue;
  }
  const currentRules = currentGroup.map((id) => activeRuleById.get(id)).filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));
  if (currentRules.length !== currentGroup.length) {
    errors.push(`Duplicate review group has missing canonical rules: ${review.rule_ids.join(", ")}`);
    continue;
  }
  const normalizedStatementHash = sha256(normalizeRuleStatement(currentRules[0]!.statement.en));
  const sourceTraceHash = duplicateSourceTraceHash(currentRules);
  let valid = true;
  if (normalizedStatementHash !== review.normalized_statement_hash) {
    errors.push(`Duplicate review statement hash is stale: ${review.rule_ids.join(", ")}`);
    valid = false;
  }
  if (sourceTraceHash !== review.source_trace_hash) {
    errors.push(`Duplicate review source trace is stale: ${review.rule_ids.join(", ")}`);
    valid = false;
  }
  if (review.disposition !== "retained_contextual_duplicate") {
    errors.push(`Unsupported duplicate review disposition: ${review.disposition}`);
    valid = false;
  }
  if (valid) validDuplicateReviewKeys.add(key);
}

const unresolvedDuplicates = duplicates.filter((group) => !validDuplicateReviewKeys.has(duplicateGroupKey(group)));
if (unresolvedDuplicates.length) warnings.push(`${unresolvedDuplicates.length} exact normalized-statement duplicate groups require review`);

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

const reviewedDuplicateGroups = duplicates
  .filter((group) => validDuplicateReviewKeys.has(duplicateGroupKey(group)))
  .map((group) => {
    const review = duplicateReviewByKey.get(duplicateGroupKey(group))!;
    const groupRules = group.map((id) => activeRuleById.get(id)!);
    return {
      rule_ids: group,
      normalized_statement_hash: review.normalized_statement_hash,
      source_trace_hash: review.source_trace_hash,
      disposition: review.disposition,
      review_note: review.review_note,
      sources: groupRules.map((rule) => ({
        id: rule.id,
        url: rule.source.url,
        section_path: rule.source.section_path,
        source_hash: rule.source.source_hash,
        source_sentence_hash: rule.source.source_sentence_hash,
      })),
    };
  });
const duplicateReviewReport = {
  schema_version: duplicateReview.schema_version,
  generated_at: now(),
  reviewed_at: duplicateReview.reviewed_at,
  review_method: duplicateReview.review_method,
  official_source_only: duplicateReview.official_source_only,
  candidate_group_count: duplicates.length,
  reviewed_group_count: reviewedDuplicateGroups.length,
  unresolved_group_count: unresolvedDuplicates.length,
  groups: reviewedDuplicateGroups,
  unresolved_groups: unresolvedDuplicates,
};
const sourceReviewReport = {
  schema_version: sourceReview.schema_version,
  generated_at: now(),
  reviewed_at: sourceReview.reviewed_at,
  review_method: sourceReview.review_method,
  official_source_only: sourceReview.official_source_only,
  reviewed_batch_count: sourceReviewBatches.length,
  reviewed_rule_count: sourceReviewReportRules.length,
  batches: sourceReviewBatches,
  rules: sourceReviewReportRules,
};
await writeJson(resolve("dist/reports/source-review.json"), sourceReviewReport);
await writeText(resolve("dist/reports/source-review.md"), `# General source-context review

- Reviewed rules: ${sourceReviewReport.reviewed_rule_count}
- Reviewed batches: ${sourceReviewReport.reviewed_batch_count}
- Official source only: ${sourceReviewReport.official_source_only ? "yes" : "no"}
- Reviewed at: ${sourceReviewReport.reviewed_at}

This report records source-context and structured-constraint reviews outside the dedicated MUST/MUST_NOT review. It is not a claim of authoritative HIG compliance.

## Reviewed rules

${sourceReviewReportRules.length ? sourceReviewReportRules.map((item) => `- ${item.id} · ${item.confidence} — ${item.review_note} ([source](${item.source.url}))`).join("\n") : "None."}
`);
await writeJson(resolve("dist/reports/duplicate-review.json"), duplicateReviewReport);
await writeText(resolve("dist/reports/duplicate-review.md"), `# Exact duplicate source review

- Candidate groups: ${duplicateReviewReport.candidate_group_count}
- Reviewed contextual groups: ${duplicateReviewReport.reviewed_group_count}
- Unresolved groups: ${duplicateReviewReport.unresolved_group_count}
- Official source only: ${duplicateReviewReport.official_source_only ? "yes" : "no"}
- Reviewed at: ${duplicateReviewReport.reviewed_at}

Exact statements are retained only when separate Apple HIG pages, sections, components, technologies, or platform scopes need independent retrieval. This is not a claim of authoritative HIG compliance.

## Reviewed contextual duplicates

${reviewedDuplicateGroups.length ? reviewedDuplicateGroups.map((group) => `- ${group.rule_ids.join(", ")} — ${group.review_note}\n${group.sources.map((source) => `  - ${source.id}: ${source.section_path.join(" > ")} ([source](${source.url}))`).join("\n")}`).join("\n") : "None."}

## Unresolved duplicate candidates

${unresolvedDuplicates.length ? unresolvedDuplicates.map((ids) => `- ${ids.join(", ")}`).join("\n") : "None."}
`);

const report = {
  generated_at: now(),
  valid: errors.length === 0,
  errors,
  warnings,
  duplicate_rule_candidates: duplicates,
  reviewed_duplicate_groups: reviewedDuplicateGroups.map((group) => group.rule_ids),
  unresolved_duplicate_candidates: unresolvedDuplicates,
};
await writeJson(resolve("dist/reports/validation.json"), report);
await writeText(resolve("dist/reports/validation.md"), `# Validation report

- Result: ${report.valid ? "PASS" : "FAIL"}
- Errors: ${errors.length}
- Warnings: ${warnings.length}
- Duplicate candidate groups: ${duplicates.length}
- Reviewed duplicate groups: ${reviewedDuplicateGroups.length}
- Unresolved duplicate groups: ${unresolvedDuplicates.length}

## Errors

${errors.length ? errors.map((error) => `- ${error}`).join("\n") : "None."}

## Warnings

${warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "None."}

## Unresolved duplicate candidates

${unresolvedDuplicates.length ? unresolvedDuplicates.map((ids) => `- ${ids.join(", ")}`).join("\n") : "None."}

Reviewed contextual duplicates are recorded in [duplicate-review.md](duplicate-review.md).
`);

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
