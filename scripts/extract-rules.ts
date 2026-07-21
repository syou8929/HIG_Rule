import { readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { Inventory, Rule, SourcePage } from "../src/lib/types.js";
import { automatedChecksFor, devicesFor, isActionable, makeTitle, modalitiesFor, normative, paraphrase, platformsForCandidate, portability, priorityFor, ruleKey, tagsFor } from "../src/lib/rules.js";
import { now, readJson, slugify, writeJson } from "../src/lib/util.js";

const inventoryPath = resolve("src/sources/apple-hig/inventory.json");
const pagesDir = resolve("src/sources/apple-hig/pages");
const rulesRoot = resolve("src/rules");
const idMapPath = resolve("src/config/rule-id-map.json");
const inventory = await readJson<Inventory>(inventoryPath);
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

let total = 0;
const expectedRuleFiles = new Set<string>();
for (const record of inventory.pages) {
  const sourcePath = resolve(pagesDir, `${record.slug}.json`);
  let page: SourcePage;
  try { page = await readJson<SourcePage>(sourcePath); } catch { continue; }
  if (page.category === "unclassified") continue;
  const category = page.category;
  const seenCandidateKeys = new Set<string>();
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
        const key = seenCandidateKeys.has(baseKey) ? `${baseKey}#${candidate.section_path.map(slugify).join("/")}` : baseKey;
        seenCandidateKeys.add(baseKey);
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
    return rule;
  });
  const activeHashes = new Set(active.map((rule) => rule.source.source_sentence_hash));
  const oldRules = existingByPage.get(page.canonical_url) ?? existingByPage.get(page.url) ?? [];
  const deprecated = oldRules
    .filter((rule) => !activeHashes.has(rule.source.source_sentence_hash))
    .map((rule) => ({ ...rule, status: "deprecated" as const, deprecated_at: rule.deprecated_at ?? now() }));
  const rules = [...active, ...deprecated].sort((a, b) => a.id.localeCompare(b.id));
  const output = resolve(rulesRoot, category, `${page.slug}.json`);
  expectedRuleFiles.add(output);
  await writeJson(output, rules);
  record.rule_count = active.length;
  if (active.length) {
    record.status = "rules_extracted";
    record.status_history.push({ status: "rules_extracted", at: now() });
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
