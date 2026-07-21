import { readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { Inventory, Rule, SourcePage } from "../src/lib/types.js";
import normativeReview from "../src/config/normative-review.json" with { type: "json" };
import sourceReview from "../src/config/source-review.json" with { type: "json" };
import { automatedChecksFor, devicesFor, isActionable, makeTitle, modalitiesFor, normative, paraphrase, platformsForCandidate, portability, priorityFor, ruleKey, tagsFor } from "../src/lib/rules.js";
import { now, readJson, slugify, writeJson } from "../src/lib/util.js";

const inventoryPath = resolve("src/sources/apple-hig/inventory.json");
const pagesDir = resolve("src/sources/apple-hig/pages");
const rulesRoot = resolve("src/rules");
const idMapPath = resolve("src/config/rule-id-map.json");
const inventory = await readJson<Inventory>(inventoryPath);
type RuleOverride = {
  title?: string;
  statement?: Rule["statement"];
  normative_level?: Rule["normative_level"];
  confidence?: Rule["confidence"];
  review_required?: boolean;
  polarity?: Rule["polarity"];
  severity?: Rule["severity"];
  conditions?: string[];
  exceptions?: string[];
  review_note: string;
};
const reviewedOverrides = normativeReview.overrides as Record<string, RuleOverride>;
type SourceReviewOverride = {
  source: { source_hash: string; source_sentence_hash: string; section_path: string[] };
  title?: string;
  statement?: Rule["statement"];
  normative_level?: Rule["normative_level"];
  confidence?: Rule["confidence"];
  review_required?: boolean;
  polarity?: Rule["polarity"];
  severity?: Rule["severity"];
  conditions?: string[];
  exceptions?: string[];
  checks?: Rule["checks"];
  testability?: Rule["testability"];
  scope?: Rule["scope"];
  review_note: string;
};
type SourceReviewBatch = {
  id: string;
  confidence: Rule["confidence"];
  review_required: boolean;
  pages: Array<{ url: string; source_hash: string }>;
  rule_ids: string[];
  review_note: string;
};
const sourceReviewOverrides = sourceReview.rules as Record<string, SourceReviewOverride>;
const sourceReviewBatches = sourceReview.batches as SourceReviewBatch[];
const sourceReviewBatchByRuleId = new Map<string, SourceReviewBatch>();
for (const batch of sourceReviewBatches) {
  for (const id of batch.rule_ids) {
    if (sourceReviewBatchByRuleId.has(id)) throw new Error(`Source review batches repeat rule ${id}`);
    sourceReviewBatchByRuleId.set(id, batch);
  }
}
let idMap: Record<string, string> = {};
try { idMap = await readJson<Record<string, string>>(idMapPath); } catch { /* First extraction creates the registry. */ }
idMap = Object.fromEntries(Object.entries(idMap).map(([key, id]) => [key, id.replaceAll("_", "-")]));

const existingByPage = new Map<string, Rule[]>();
for (const category of inventory.categories) {
  const directory = resolve(rulesRoot, category);
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const rules = await readJson<Rule[]>(resolve(directory, entry.name));
        if (rules[0]) existingByPage.set(rules[0].source.url, rules);
      }
    }
  } catch { /* Category directory is created on demand. */ }
}

const sequenceByTopic = new Map<string, number>();
for (const id of Object.values(idMap)) {
  const prefix = id.replace(/-\d{4}$/, "");
  const sequence = Number(id.match(/(\d{4})$/)?.[1] ?? 0);
  sequenceByTopic.set(prefix, Math.max(sequenceByTopic.get(prefix) ?? 0, sequence));
}

function allocateId(page: SourcePage, key: string): string {
  if (idMap[key]) return idMap[key];
  const category = page.category.toUpperCase();
  const topic = page.slug.toUpperCase();
  const prefix = `HIG-${category}-${topic}`;
  const sequence = (sequenceByTopic.get(prefix) ?? 0) + 1;
  sequenceByTopic.set(prefix, sequence);
  const id = `${prefix}-${String(sequence).padStart(4, "0")}`;
  idMap[key] = id;
  return id;
}

function applyReviewedOverride(rule: Rule): Rule {
  const override = reviewedOverrides[rule.id];
  const normativeStrengthReviewed = normativeReview.reviewed_levels.includes(rule.normative_level as "MUST" | "MUST_NOT");
  if (!override && !normativeStrengthReviewed) return rule;
  const statement = override?.statement ?? rule.statement;
  return {
    ...rule,
    ...(override?.title ? { title: override.title } : {}),
    statement,
    ...(override?.normative_level ? { normative_level: override.normative_level } : {}),
    ...(override?.confidence ? { confidence: override.confidence } : {}),
    ...(normativeStrengthReviewed ? { review_required: false } : override?.review_required === undefined ? {} : { review_required: override.review_required }),
    ...(override?.polarity ? { polarity: override.polarity } : {}),
    ...(override?.severity ? { severity: override.severity } : {}),
    ...(override?.conditions ? { conditions: override.conditions } : {}),
    ...(override?.exceptions ? { exceptions: override.exceptions } : {}),
    checks: {
      ...rule.checks,
      manual: [`Does the design satisfy “${statement.en}” in the documented ${rule.source.page_title} context?`],
    },
    source: { ...rule.source, evidence_paraphrase: statement.en },
    ...(rule.apple_native_rule ? { apple_native_rule: statement.en } : {}),
  };
}

function applySourceReview(rule: Rule): Rule {
  const review = sourceReviewOverrides[rule.id];
  const batch = sourceReviewBatchByRuleId.get(rule.id);
  if (!review && !batch) return rule;
  const statement = review?.statement ?? rule.statement;
  return {
    ...rule,
    ...(review?.title ? { title: review.title } : {}),
    statement,
    ...(review?.normative_level ? { normative_level: review.normative_level } : {}),
    confidence: review?.confidence ?? batch!.confidence,
    review_required: review?.review_required ?? batch!.review_required,
    ...(review?.polarity ? { polarity: review.polarity } : {}),
    ...(review?.severity ? { severity: review.severity } : {}),
    ...(review?.conditions ? { conditions: review.conditions } : {}),
    ...(review?.exceptions ? { exceptions: review.exceptions } : {}),
    ...(review?.scope ? { scope: review.scope } : {}),
    checks: review?.checks ?? {
      ...rule.checks,
      manual: [`Does the design satisfy “${statement.en}” in the documented ${rule.source.page_title} context?`],
    },
    ...(review?.testability ? { testability: review.testability } : {}),
    source: { ...rule.source, evidence_paraphrase: statement.en },
    ...(rule.apple_native_rule ? { apple_native_rule: statement.en } : {}),
  };
}

let total = 0;
const expectedRuleFiles = new Set<string>();
for (const record of inventory.pages) {
  const sourcePath = resolve(pagesDir, `${record.slug}.json`);
  let page: SourcePage;
  try { page = await readJson<SourcePage>(sourcePath); } catch { continue; }
  if (page.category === "unclassified") continue;
  const category = page.category;
  const duplicateCandidateCount = new Map<string, number>();
  const active: Rule[] = page.guidance_candidates.filter(isActionable).map((candidate) => {
    const strength = normative(candidate.text);
    const statement = paraphrase(candidate.text, page.title);
    const scopePortability = portability(page);
    const modalities = modalitiesFor(`${page.title} ${candidate.text}`);
    const platforms = platformsForCandidate(page, candidate);
    const automatedChecks = automatedChecksFor(page, candidate, modalities);
    const rule: Rule = {
      id: (() => {
        const baseKey = ruleKey(page, candidate);
        const duplicateIndex = duplicateCandidateCount.get(baseKey) ?? 0;
        duplicateCandidateCount.set(baseKey, duplicateIndex + 1);
        const legacyKey = `${baseKey}#${candidate.section_path.map(slugify).join("/")}`;
        const key = duplicateIndex === 0
          ? baseKey
          : duplicateIndex === 1
            ? legacyKey
            : `${legacyKey}#${slugify(candidate.text)}`;
        return allocateId(page, key);
      })(),
      title: makeTitle(candidate),
      category,
      topic: page.slug,
      subtopic: slugify(candidate.section_path.at(-1) || "overview"),
      statement,
      ...strength,
      scope: {
        portability: scopePortability,
        platforms,
        devices: devicesFor(platforms),
        components: category === "components" ? [page.slug] : [],
        modalities,
      },
      conditions: ["Apply within the platform, component, and section context identified by the source trace."],
      exceptions: [],
      rationale: {
        en: `Applying this guidance supports a consistent and usable ${page.title} experience on the scoped Apple platforms.`,
        ja: `この指針は、対象Appleプラットフォームにおける${page.title}の一貫性と使いやすさを支えます。`,
      },
      checks: {
        automated: automatedChecks,
        manual: [`Does the design satisfy “${statement.en}” in the documented ${page.title} context?`],
      },
      testability: automatedChecks.length ? "hybrid" : "manual",
      severity: strength.severity,
      anti_patterns: [`Ignoring this guidance in a context where the source section applies.`],
      positive_examples: [`A design review records how the implementation satisfies this rule and any source-scoped exception.`],
      source: {
        url: page.canonical_url,
        page_title: page.title,
        section_path: candidate.section_path,
        retrieved_at: page.retrieved_at,
        source_hash: page.source_hash,
        source_sentence_hash: candidate.source_sentence_hash,
        evidence_paraphrase: statement.en,
      },
      tags: tagsFor(page, candidate),
      priority_rank: priorityFor(page, platforms),
      status: "active",
      ...(scopePortability === "universal" ? {} : {
        apple_native_rule: statement.en,
        portable_interpretation: `Preserve the user-centered intent after replacing Apple-specific platforms, components, and input conventions.`,
      }),
    };
    return applySourceReview(applyReviewedOverride(rule));
  });
  for (const extra of normativeReview.additional_rules) {
    const base = active.find((rule) => rule.id === extra.base_rule_id);
    if (!base) continue;
    const candidate = page.guidance_candidates.find((item) =>
      item.source_sentence_hash === base.source.source_sentence_hash
      && JSON.stringify(item.section_path) === JSON.stringify(base.source.section_path));
    if (!candidate) throw new Error(`Missing source candidate for reviewed split rule ${extra.base_rule_id}`);
    const statement = extra.statement as Rule["statement"];
    active.push({
      ...base,
      id: allocateId(page, `${ruleKey(page, candidate)}#split-${extra.split_key}`),
      title: extra.title,
      statement,
      normative_level: extra.normative_level as Rule["normative_level"],
      confidence: extra.confidence as Rule["confidence"],
      review_required: extra.review_required,
      polarity: extra.polarity as Rule["polarity"],
      severity: extra.severity as Rule["severity"],
      conditions: extra.conditions,
      exceptions: extra.exceptions,
      rationale: extra.rationale,
      checks: {
        automated: [],
        manual: [`Does the design satisfy “${statement.en}” in the documented ${page.title} context?`],
      },
      testability: "manual",
      source: { ...base.source, evidence_paraphrase: statement.en },
      tags: Array.from(new Set([...base.tags, "split-guidance"])),
      ...(base.apple_native_rule ? { apple_native_rule: statement.en } : {}),
    });
  }
  const oldRules = existingByPage.get(page.canonical_url) ?? existingByPage.get(page.url) ?? [];
  const activeIds = new Set(active.map((rule) => rule.id));
  const sortRules = (items: Rule[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  const rulesChanged = JSON.stringify(sortRules(active)) !== JSON.stringify(sortRules(oldRules.filter((rule) => rule.status === "active")));
  const deprecated = oldRules
    .filter((rule) => !activeIds.has(rule.id))
    .map((rule) => ({ ...rule, status: "deprecated" as const, deprecated_at: rule.deprecated_at ?? now() }));
  const rules = [...active, ...deprecated].sort((a, b) => a.id.localeCompare(b.id));
  const output = resolve(rulesRoot, category, `${page.slug}.json`);
  expectedRuleFiles.add(output);
  await writeJson(output, rules);
  record.rule_count = active.length;
  if (active.length && (record.status !== "validated" || rulesChanged)) {
    record.status = "rules_extracted";
    if (record.status_history.at(-1)?.status !== "rules_extracted") record.status_history.push({ status: "rules_extracted", at: now() });
  }
  total += active.length;
}

for (const category of inventory.categories) {
  const directory = resolve(rulesRoot, category);
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isFile() && entry.name.endsWith(".json") && !expectedRuleFiles.has(path)) await unlink(path);
    }
  } catch { /* Missing empty category directory is valid. */ }
}

inventory.generated_at = now();
await writeJson(idMapPath, Object.fromEntries(Object.entries(idMap).sort(([a], [b]) => a.localeCompare(b))));
await writeJson(inventoryPath, inventory);
console.log(`Extracted ${total} active atomic rules from ${inventory.pages.filter((page) => page.rule_count > 0).length} pages.`);
