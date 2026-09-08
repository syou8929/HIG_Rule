import { resolve } from "node:path";
import YAML from "yaml";
import config from "../src/config/hig.json" with { type: "json" };
import normativeReview from "../src/config/normative-review.json" with { type: "json" };
import { makeCoverage } from "../src/lib/coverage.js";
import { nextReviewBatch, pendingRuleReviews } from "../src/lib/review-queue.js";
import { loadRules, loadSourcePages } from "../src/lib/store.js";
import type { Inventory, Rule } from "../src/lib/types.js";
import { now, readJson, sha256, writeJson, writeText } from "../src/lib/util.js";

const inventory = await readJson<Inventory>(resolve("src/sources/apple-hig/inventory.json"));
const allRules = await loadRules({ includeDeprecated: true });
const sourcePages = await loadSourcePages();
const active = allRules.filter((rule) => rule.status === "active");
const coverage = makeCoverage(inventory, allRules, sourcePages);

const runtime = `1. Identify the target Apple platform, device, and input methods.
2. Identify the primary user task and relevant product constraints.
3. Query only the relevant rules by category, platform, component, modality, and task.
4. Review accessibility first, then privacy and explicit user intent.
5. Apply platform-specific guidance before Apple-common and universal guidance.
6. Select components and patterns that fit the platform context.
7. Review empty, loading, error, denied-permission, and offline states.
8. Check relevant settings such as Dynamic Type, VoiceOver, keyboard access, pointer input, and Reduce Motion.
9. Review interaction, hierarchy, writing, and state transitions — not only appearance.
10. Report evidence, conflicts, exceptions, unresolved questions, and rule confidence.

Do not claim authoritative HIG compliance. Report what was checked and what remains unverified.`;

const conflict = config.conflictPriority.map((item, index) => `${index + 1}. ${item}`).join("\n");
const defaultRetrieval = "Run `npm run query -- --platform ios --category components --task review` and add `--component <slug>`, `--modality keyboard`, `--normative MUST`, `--confidence low`, or `--limit <n>` as needed.";

function makePrompt(retrieval: string, scope = ""): string {
  return `# Apple HIG rule runtime

This adapter is generated from ${active.length} active, source-traceable atomic rules. The canonical store is under \`src/rules/\`; do not hand-edit generated adapters.

## Runtime procedure

${scope}${runtime}

## Conflict priority

${conflict}

When product requirements differ from HIG guidance, explain the difference and risk instead of silently replacing the product requirement. Treat low-confidence rules as review prompts, not settled facts.

## Retrieval

${retrieval}`;
}

const basePrompt = makePrompt(defaultRetrieval);
const codexPrompt = `${makePrompt(`Start with 10 or fewer rules and filters for the actual target. Preview counts and bytes with \`npm run --silent query -- --platform ios --category components --component buttons --limit 10 --preflight\`; omit \`--preflight\` to retrieve them.

- Never load the full rule store, exported rules, or broad checklists into model context. Use scripts for counts and filtering; return only the selected rules and a short summary.
- Filters combine with AND. \`--task\` matches every Unicode keyword against English/Japanese text; it does not translate or perform semantic search. Do not use \`--task review\` to request a review workflow.
- Results sort by conflict priority, requested-platform specificity, keyword relevance, then ID. Inspect \`total\`, \`returned\`, and \`has_more\`; continue with \`--offset <next_offset>\`, keeping filters and the source snapshot fixed. Query applicable accessibility and privacy guidance separately from component filters and report coverage gaps.
- Default compact output retains scope, conditions, exceptions, confidence, review status, and source trace. Resolve each rule's \`source.ref\` through the response's \`sources\` table. Use \`--id <rule-id> --format json\` for full fields, including rationale and checks. Markdown lists candidates only.
- The CLI limits each response to 10 rules by default (maximum 50) and enforces 12,000 bytes for compact output or 32,000 for full JSON, including metadata. \`--max-bytes\` may set 1,024–32,000 bytes. If one rule cannot fit, retrieval exits 2 with \`minimum_required_bytes\`; adjust the budget within the ceiling or inspect it locally. Never skip that rule silently. These are response-byte limits, not total token limits.`, "Apply this procedure to Apple UI design, implementation, and review. For repository maintenance, use the maintenance contract; determine platform/device details only when they affect the requested change.\n\n")}

## Codex / GPT-6 Astra execution

- Use established user intent and authorization for routine, reversible work. Ask only when missing information materially changes correctness or scope. Keep HIG guidance distinct from user requirements and report conflicts.
- Before bulk fetching or source review, announce the scope, batch size, available usage reading, and stopping conditions. Start with at most 3 pages and 50 rules per batch, splitting long pages by section. Expand only after reporting observed effort and a revised plan.
- Use at most one helper for a bounded independent subtask when it saves time or improves quality. Give it only the needed context and request a short evidence-based report.
- When usage readings are available, check at batch boundaries. Unless the user sets another budget, defer the next batch if usage rises by 5 percentage points from the run's baseline or remaining capacity reaches 30%. Save completed IDs, unresolved issues, evidence, and the next step. Without readings, retain small batches and disclose that consumption is unmeasured. Shared or delayed usage readings are not a hard token limit.
- Run required checks once per change set; repeat for new changes, failures, or unresolved concerns. A successful local build does not establish current Apple-source freshness. Verify freshness separately when requested; page hash changes require review before updating source-bound decisions.
- Report the outcome, evidence, checks, and remaining work concisely. Do not claim measured token savings or Astra optimization without comparison results.`;

function rulesMarkdown(rules: Rule[]): string {
  const sections: string[] = ["# Apple HIG AI Rules", "", `Generated ${now()}. ${active.length} active rules; ${rules.filter((rule) => rule.status === "deprecated").length} deprecated rules.`, ""];
  for (const category of config.topCategories) {
    const categoryRules = rules.filter((rule) => rule.category === category);
    if (!categoryRules.length) continue;
    sections.push(`## ${category}`, "");
    let currentTopic = "";
    for (const rule of categoryRules) {
      if (rule.topic !== currentTopic) {
        currentTopic = rule.topic;
        sections.push(`### ${currentTopic}`, "");
      }
      sections.push(`- **${rule.id} · ${rule.normative_level} · ${rule.confidence}** — ${rule.statement.en} ([source](${rule.source.url}))`);
    }
    sections.push("");
  }
  return sections.join("\n");
}

function checklist(title: string, rules: Rule[]): string {
  const lines = [`# ${title}`, "", "Use this generated checklist with the source trace and confidence level; it is not a compliance certificate.", ""];
  for (const rule of rules) lines.push(`- [ ] ${rule.id} — ${rule.statement.en} (${rule.normative_level}, ${rule.confidence}; [source](${rule.source.url}))`);
  return lines.join("\n");
}

const accessibility = active.filter((rule) => ["accessibility", "voiceover", "inclusion"].includes(rule.topic) || rule.tags.includes("accessibility"));
const implementation = active.filter((rule) => ["components", "inputs", "patterns"].includes(rule.category));
const design = active.filter((rule) => ["getting-started", "foundations", "patterns", "components"].includes(rule.category));
const reviewQueue = pendingRuleReviews(active);
const reviewBatch = nextReviewBatch(active);
const countBy = (values: Array<string | number>): Record<string, number> => Object.fromEntries(
  Array.from(new Set(values)).sort().map((value) => [String(value), values.filter((candidate) => candidate === value).length]),
);
const reviewQueueReport = {
  schema_version: "1.0.0",
  generated_at: now(),
  remaining_review_count: reviewQueue.length,
  next_priority_rank: reviewBatch[0]?.priority_rank ?? null,
  next_priority_label: reviewBatch[0] ? config.conflictPriority[reviewBatch[0].priority_rank - 1] ?? null : null,
  next_batch_count: reviewBatch.length,
  by_priority: countBy(reviewQueue.map((rule) => rule.priority_rank)),
  by_normative_level: countBy(reviewQueue.map((rule) => rule.normative_level)),
  by_category: countBy(reviewQueue.map((rule) => rule.category)),
  next_batch: reviewBatch.map((rule) => ({
    id: rule.id,
    normative_level: rule.normative_level,
    confidence: rule.confidence,
    priority_rank: rule.priority_rank,
    category: rule.category,
    topic: rule.topic,
    title: rule.title,
    source: rule.source,
  })),
  pending_rule_ids: reviewQueue.map((rule) => rule.id),
};

await writeJson(resolve("dist/apple-hig-rules.json"), allRules);
await writeText(resolve("dist/apple-hig-rules.yaml"), YAML.stringify(allRules, { lineWidth: 0 }));
await writeText(resolve("dist/apple-hig-rules.md"), rulesMarkdown(allRules));
await writeText(resolve("dist/agents/system-prompt.md"), basePrompt);
await writeText(resolve("dist/agents/AGENTS.md"), `${codexPrompt}\n\n## Codex repository behavior\n\nInspect project-local AGENTS.md files first. Make HIG-driven changes only within the requested scope and validate the resulting behavior.`);
await writeText(resolve("dist/agents/CLAUDE.md"), `${basePrompt}\n\n## Claude Code behavior\n\nRetrieve the smallest relevant rule subset before proposing or editing UI code.`);
await writeText(resolve("dist/agents/GEMINI.md"), `${basePrompt}\n\n## Gemini behavior\n\nCite rule IDs and source URLs for every material HIG finding.`);
await writeText(resolve("dist/agents/copilot-instructions.md"), `${basePrompt}\n\n## GitHub Copilot behavior\n\nApply these rules while generating and reviewing UI code; flag unresolved manual checks.`);
await writeText(resolve("dist/agents/apple-hig.mdc"), `---\ndescription: Apply source-traceable Apple HIG rules to UI design and implementation\nalwaysApply: false\n---\n\n${basePrompt}`);
await writeText(resolve("AGENTS.md"), `${codexPrompt}\n\n## Repository maintenance contract\n\n- Treat \`src/rules/**/*.json\` as the canonical rule store and rebuild every adapter from it.\n- Use only Apple official HIG pages as primary sources.\n- Never persist full source-page prose, images, video, or design resources.\n- Keep evidence fragments below 20 words and preserve source URL, section path, retrieval time, and hashes.\n- Do not raise conditional language to MUST without explicit support; route uncertainty to review.\n- Preserve stable rule IDs through \`src/config/rule-id-map.json\`; deprecate removed rules before deletion.\n- Treat review registries under \`src/config/\` as source-trace-bound; require re-review when hashes or candidate sets become stale.\n- Run \`npm run ci\` after rule, schema, generator, or adapter changes.\n- Report blocked pages and pages without rules explicitly; never infer missing source content.`);
await writeText(resolve("CLAUDE.md"), `${basePrompt}\n\n## Claude Code behavior\n\nRetrieve the smallest relevant rule subset before proposing or editing UI code.`);
await writeText(resolve("GEMINI.md"), `${basePrompt}\n\n## Gemini behavior\n\nCite rule IDs and source URLs for every material HIG finding.`);
await writeText(resolve(".github/copilot-instructions.md"), `${basePrompt}\n\n## GitHub Copilot behavior\n\nApply these rules while generating and reviewing UI code; flag unresolved manual checks.`);
await writeText(resolve(".cursor/rules/apple-hig.mdc"), `---\ndescription: Apply source-traceable Apple HIG rules to UI design and implementation\nalwaysApply: false\n---\n\n${basePrompt}`);
await writeText(resolve("dist/checklists/design-review.md"), checklist("UI design review checklist", design));
await writeText(resolve("dist/checklists/implementation-review.md"), checklist("Implementation review checklist", implementation));
await writeText(resolve("dist/checklists/accessibility-review.md"), checklist("Accessibility review checklist", accessibility));
await writeJson(resolve("dist/reports/review-queue.json"), reviewQueueReport);
await writeText(resolve("dist/reports/review-queue.md"), `# Human source-review queue

- Remaining rules: ${reviewQueueReport.remaining_review_count}
- Next priority: ${reviewQueueReport.next_priority_rank ?? "none"}${reviewQueueReport.next_priority_label ? ` (${reviewQueueReport.next_priority_label})` : ""}
- Next batch: ${reviewQueueReport.next_batch_count}

This queue tracks canonical rule extraction and source-context review. Product-specific design and implementation checks remain manual even after a rule leaves this queue.

## Remaining by priority

${Object.entries(reviewQueueReport.by_priority).map(([key, value]) => `- ${key} (${config.conflictPriority[Number(key) - 1] ?? "unknown"}): ${value}`).join("\n") || "None."}

## Remaining by normative level

${Object.entries(reviewQueueReport.by_normative_level).map(([key, value]) => `- ${key}: ${value}`).join("\n") || "None."}

## Next batch

${reviewBatch.length ? reviewBatch.map((rule) => `- ${rule.id} · ${rule.normative_level} — ${rule.title} · ${rule.source.section_path.join(" > ")} ([source](${rule.source.url}))`).join("\n") : "None."}
`);
await writeJson(resolve("src/sources/apple-hig/coverage.json"), coverage);
await writeJson(resolve("dist/reports/coverage.json"), coverage);
const list = (values: string[]) => values.length ? values.map((value) => `- ${value}`).join("\n") : "None.";
await writeText(resolve("dist/reports/coverage.md"), `# Coverage report

- Discovered canonical pages: ${coverage.totals.discovered}
- Fetched pages: ${coverage.totals.fetched}
- Blocked pages: ${coverage.totals.failed}
- Classified pages: ${coverage.totals.classified}
- Pages with rules: ${coverage.totals.rules_extracted_pages}
- Active atomic rules: ${coverage.totals.rules}
- Pages without rules: ${coverage.pages_without_rules.length}
- Low-confidence rules: ${coverage.low_confidence_rules.length}
- Rules requiring human review: ${coverage.review_required_rules.length}
- Reference notes: ${coverage.reference_note_details.length}

## Rules by category

${Object.entries(coverage.by_category).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Normative levels

${Object.entries(coverage.by_normative_level).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Rules by platform

${Object.entries(coverage.by_platform).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Rules by testability

${Object.entries(coverage.by_testability).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Blocked pages

${coverage.blocked_page_details.length ? coverage.blocked_page_details.map((page) => `- ${page.url} — ${page.reason}`).join("\n") : "None."}

## Pages without rules

${list(coverage.pages_without_rules)}

## Low-confidence rules

${list(coverage.low_confidence_rules)}

## Rules requiring human review

${list(coverage.review_required_rules)}

## Reference notes

${coverage.reference_note_details.length ? coverage.reference_note_details.map((item) => `- ${item.url} · ${item.section_path.join(" > ")} — ${item.note}`).join("\n") : "None."}
`);

const reviewedNormativeRules = active.filter((rule) => normativeReview.reviewed_levels.includes(rule.normative_level as "MUST" | "MUST_NOT"));
if (reviewedNormativeRules.length !== normativeReview.reviewed_rule_count) {
  throw new Error(`Normative review expected ${normativeReview.reviewed_rule_count} MUST/MUST_NOT rules, found ${reviewedNormativeRules.length}`);
}
const normativeDecisions = reviewedNormativeRules.map((rule) => {
  const override = normativeReview.overrides[rule.id as keyof typeof normativeReview.overrides];
  const basis = override?.review_note
    ?? (rule.normative_level === "MUST_NOT"
      ? "Retained MUST_NOT after confirming an explicit, source-scoped prohibition."
      : "Retained MUST after confirming an unqualified source directive and its surrounding conditions and exceptions.");
  return {
    id: rule.id,
    normative_level: rule.normative_level,
    decision: override ? "retained_with_atomicity_or_scope_correction" : "retained",
    basis,
    source: {
      url: rule.source.url,
      section_path: rule.source.section_path,
      source_hash: rule.source.source_hash,
      source_sentence_hash: rule.source.source_sentence_hash,
    },
  };
});
const splitRules = normativeReview.additional_rules.map((extra) => {
  const rule = active.find((item) => item.title === extra.title && item.source.source_sentence_hash === active.find((base) => base.id === extra.base_rule_id)?.source.source_sentence_hash);
  if (!rule) throw new Error(`Missing reviewed split rule for ${extra.base_rule_id}`);
  return { id: rule.id, base_rule_id: extra.base_rule_id, normative_level: rule.normative_level, basis: extra.review_note, source: rule.source };
});
const normativeReport = {
  schema_version: "1.0.0",
  generated_at: now(),
  reviewed_at: normativeReview.reviewed_at,
  review_method: normativeReview.review_method,
  official_source_only: normativeReview.official_source_only,
  source_inventory_hash: normativeReview.source_inventory_hash,
  reviewed_rule_count: normativeDecisions.length,
  retained_must: normativeDecisions.filter((item) => item.normative_level === "MUST").length,
  retained_must_not: normativeDecisions.filter((item) => item.normative_level === "MUST_NOT").length,
  normative_level_changes: Object.values(normativeReview.overrides).filter((item) => "normative_level" in item).length,
  mixed_strength_candidates_split: splitRules.length,
  rules: normativeDecisions,
  additional_atomic_rules: splitRules,
};
await writeJson(resolve("dist/reports/normative-review.json"), normativeReport);
await writeText(resolve("dist/reports/normative-review.md"), `# MUST / MUST_NOT source review

- Reviewed rules: ${normativeReport.reviewed_rule_count}
- Retained MUST: ${normativeReport.retained_must}
- Retained MUST_NOT: ${normativeReport.retained_must_not}
- Normative level changes: ${normativeReport.normative_level_changes}
- Mixed-strength candidates split: ${normativeReport.mixed_strength_candidates_split}
- Official source only: ${normativeReport.official_source_only ? "yes" : "no"}
- Reviewed at: ${normativeReport.reviewed_at}

This is a source-context review, not a claim of authoritative HIG compliance. Full Apple source prose is not persisted.

## Atomicity and scope corrections

${normativeDecisions.filter((item) => item.decision !== "retained").map((item) => `- ${item.id} — ${item.basis} ([source](${item.source.url}))`).join("\n") || "None."}
${splitRules.map((item) => `- ${item.id} — ${item.basis} ([source](${item.source.url}))`).join("\n")}

## Reviewed rules

${normativeDecisions.map((item) => `- ${item.id} · ${item.normative_level} · ${item.decision} — ${item.basis} ([source](${item.source.url}))`).join("\n")}
`);

const canonicalHash = sha256(JSON.stringify(allRules));
await writeJson(resolve("dist/manifest.json"), {
  schema_version: "1.0.0",
  generated_at: now(),
  canonical_rule_count: allRules.length,
  active_rule_count: active.length,
  canonical_hash: canonicalHash,
  source_inventory_hash: sha256(JSON.stringify(inventory.pages.map((page) => [page.canonical_url, page.source_hash]))),
  generated_from: [
    "src/rules/**/*.json",
    "src/sources/apple-hig/inventory.json",
    "src/config/normative-review.json",
    "src/config/source-review.json",
  ],
});

console.log(`Built JSON, YAML, Markdown, ${6} AI adapters, and ${3} checklists from ${active.length} active rules.`);
