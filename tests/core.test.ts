import assert from "node:assert/strict";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import ruleSchema from "../schemas/rule.schema.json" with { type: "json" };
import sourcePageSchema from "../schemas/source-page.schema.json" with { type: "json" };
import duplicateReview from "../src/config/duplicate-review.json" with { type: "json" };
import sourceReview from "../src/config/source-review.json" with { type: "json" };
import { duplicateGroupKey, duplicateSourceTraceHash, findExactDuplicateGroups, normalizeRuleStatement } from "../src/lib/duplicates.js";
import { loadRules, loadSourcePages } from "../src/lib/store.js";
import { isActionable, normative, paraphrase, platformsForCandidate } from "../src/lib/rules.js";
import { nextReviewBatch, pendingRuleReviews } from "../src/lib/review-queue.js";
import type { GuidanceCandidate, SourcePage } from "../src/lib/types.js";
import { normalizeUrl, sha256 } from "../src/lib/util.js";
import { diffRuleSnapshots, type RuleSnapshot } from "../src/lib/rule-diff.js";

test("normalizes HIG URLs and rejects out-of-scope URLs", () => {
  const root = "https://developer.apple.com/design/human-interface-guidelines";
  assert.equal(normalizeUrl(`${root}/accessibility/?changes=1#vision`, root), `${root}/accessibility`);
  assert.equal(normalizeUrl("https://developer.apple.com/documentation/swiftui", root), null);
});

test("keeps conditional strength conservative", () => {
  assert.equal(normative("Consider showing a label").normative_level, "MAY");
  assert.equal(normative("Carefully consider showing a label").normative_level, "MAY");
  assert.equal(normative("In general, avoid duplicating a control").normative_level, "AVOID");
  assert.equal(normative("As much as possible, avoid duplicating a control").normative_level, "AVOID");
  assert.equal(normative("For apps with tabs, consider adding shortcuts").normative_level, "MAY");
  assert.equal(normative("Within a grouped form, consider using a mini switch").normative_level, "MAY");
  assert.equal(normative("In general, don’t replace a checkbox").normative_level, "AVOID");
  assert.equal(normative("Try to avoid overlapping controls").normative_level, "AVOID");
  assert.equal(normative("If a modal state applies, consider alternate controls").normative_level, "MAY");
  assert.equal(normative("Prefer the standard control").normative_level, "SHOULD");
  assert.equal(normative("Never hide the recovery action").normative_level, "MUST_NOT");
  assert.equal(normative("You must support multiple windows").normative_level, "MUST");
  assert.equal(normative("You must not hide the recovery action").normative_level, "MUST_NOT");
});

test("paraphrases common imperative leads", () => {
  const result = paraphrase("Support larger text sizes", "Accessibility");
  assert.equal(result.en, "Ensure the experience accommodates larger text sizes.");
  assert.notEqual(result.en.toLowerCase(), "support larger text sizes");
  assert.equal(paraphrase("In general, avoid duplicating a control", "Menus").en, "Exclude duplicating a control from the applicable experience.");
  assert.equal(paraphrase("Refer to a panel by title", "Panels").en, "Refer to a panel by title.");
  assert.equal(paraphrase("Define a clear scroll area", "Scroll views").en, "Define a clear scroll area explicitly.");
  assert.equal(paraphrase("Present a sheet in a reasonable size", "Sheets").en, "Present a sheet in a reasonable size in the documented context.");
});

test("recognizes actionable plain-list guidance", () => {
  assert.equal(isActionable({ text: "Identify the core functionality", section_path: [], source_sentence_hash: "a".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "Break up multistep workflows", section_path: [], source_sentence_hash: "b".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "Avoiding animating depth changes", section_path: [], source_sentence_hash: "c".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "Always On", section_path: [], source_sentence_hash: "d".repeat(64), word_count: 2 }), false);
  assert.equal(isActionable({ text: "Tracking requests", section_path: [], source_sentence_hash: "e".repeat(64), word_count: 2 }), false);
  assert.equal(isActionable({ text: "Help buttons", section_path: [], source_sentence_hash: "f".repeat(64), word_count: 2 }), false);
  assert.equal(isActionable({ text: "Carefully consider a custom layout", section_path: [], source_sentence_hash: "g".repeat(64), word_count: 5 }), true);
  assert.equal(isActionable({ text: "Refer to a panel by title", section_path: [], source_sentence_hash: "h".repeat(64), word_count: 6 }), true);
  assert.equal(isActionable({ text: "Define a clear scroll area", section_path: [], source_sentence_hash: "i".repeat(64), word_count: 5 }), true);
  assert.equal(isActionable({ text: "Present a sheet in a reasonable size", section_path: [], source_sentence_hash: "j".repeat(64), word_count: 7 }), true);
  assert.equal(isActionable({ text: "Represent common actions consistently", section_path: [], source_sentence_hash: "k".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "Determine the display order", section_path: [], source_sentence_hash: "l".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "As much as possible, support drag and drop", section_path: [], source_sentence_hash: "m".repeat(64), word_count: 8 }), true);
  assert.equal(isActionable({ text: "Require one modifier key", section_path: [], source_sentence_hash: "n".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "Reserve the setting for app-level options", section_path: [], source_sentence_hash: "o".repeat(64), word_count: 7 }), true);
  assert.equal(isActionable({ text: "For apps with tabs, consider adding shortcuts", section_path: [], source_sentence_hash: "p".repeat(64), word_count: 8 }), true);
  assert.equal(isActionable({ text: "Because the menu is hidden, ensure access", section_path: [], source_sentence_hash: "q".repeat(64), word_count: 7 }), true);
  assert.equal(isActionable({ text: "Clearly identify the affected setting", section_path: [], source_sentence_hash: "r".repeat(64), word_count: 5 }), true);
  assert.equal(isActionable({ text: "Accurately reflect the current state", section_path: [], source_sentence_hash: "s".repeat(64), word_count: 5 }), true);
  assert.equal(isActionable({ text: "Outside of a list, use a toggle button", section_path: [], source_sentence_hash: "t".repeat(64), word_count: 8 }), true);
  assert.equal(isActionable({ text: "Within a grouped form, consider using a mini switch", section_path: [], source_sentence_hash: "u".repeat(64), word_count: 9 }), true);
  assert.equal(isActionable({ text: "In general, don’t replace a checkbox", section_path: [], source_sentence_hash: "v".repeat(64), word_count: 6 }), true);
  assert.equal(isActionable({ text: "To present one setting, prefer a checkbox", section_path: [], source_sentence_hash: "w".repeat(64), word_count: 7 }), true);
  assert.equal(isActionable({ text: "Try to prevent window clipping", section_path: [], source_sentence_hash: "x".repeat(64), word_count: 5 }), true);
  assert.equal(isActionable({ text: "If a modal state applies, consider alternate controls", section_path: [], source_sentence_hash: "y".repeat(64), word_count: 8 }), true);
  assert.equal(isActionable({ text: "Feature new content", section_path: [], source_sentence_hash: "z".repeat(64), word_count: 3 }), true);
  assert.equal(isActionable({ text: "Personalize people’s favorite content", section_path: [], source_sentence_hash: "0".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "Showcase compelling dynamic content", section_path: [], source_sentence_hash: "1".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "If fallback content is unavailable, supply one image", section_path: [], source_sentence_hash: "2".repeat(64), word_count: 8 }), true);
  assert.equal(isActionable({ text: "If you need text, add it to the image", section_path: [], source_sentence_hash: "3".repeat(64), word_count: 9 }), true);
  assert.equal(paraphrase("If you need text, add it to the image", "Top Shelf").en, "When you need text, add it to the image.");
  assert.equal(isActionable({ text: "Retain the glass background", section_path: [], source_sentence_hash: "4".repeat(64), word_count: 4 }), true);
  assert.equal(isActionable({ text: "In general, use dynamic scaling", section_path: [], source_sentence_hash: "5".repeat(64), word_count: 5 }), true);
  assert.equal(isActionable({ text: "Take advantage of the default appearance", section_path: [], source_sentence_hash: "6".repeat(64), word_count: 6 }), true);
  assert.equal(paraphrase("In general, use dynamic scaling", "Windows").en, "Generally, use dynamic scaling.");
  assert.equal(isActionable({ text: "You must support multiple windows", section_path: [], source_sentence_hash: "7".repeat(64), word_count: 5 }), true);
  assert.equal(paraphrase("You must support multiple windows", "Windows").en, "Require support multiple windows.");
  assert.equal(isActionable({ text: "In an immersive experience, help people maintain comfort", section_path: [], source_sentence_hash: "8".repeat(64), word_count: 8 }), true);
  assert.equal(isActionable({ text: "Recognize that people may prefer tinted mode", section_path: [], source_sentence_hash: "9".repeat(64), word_count: 7 }), true);
  assert.equal(paraphrase("In an immersive experience, help people maintain comfort", "Color").en, "In an immersive experience, help people maintain comfort.");
  assert.equal(isActionable({ text: "Specify a succinct term", section_path: [], source_sentence_hash: "a".repeat(64), word_count: 4 }), true);
  assert.equal(paraphrase("Specify a succinct term", "Icons").en, "Specify a succinct term.");
  assert.equal(isActionable({ text: "Indicate the purpose of an exit control", section_path: [], source_sentence_hash: "b".repeat(64), word_count: 7 }), true);
  assert.equal(paraphrase("Indicate the purpose of an exit control", "Immersive experiences").en, "Indicate the purpose of an exit control.");
  assert.equal(isActionable({ text: "If tracking stops, fade out virtual hands", section_path: [], source_sentence_hash: "c".repeat(64), word_count: 7 }), true);
  assert.equal(paraphrase("If tracking stops, fade out virtual hands", "Immersive experiences").en, "When tracking stops, fade out virtual hands.");
  assert.equal(normative("If passthrough is visible, avoid obscuring it").normative_level, "AVOID");
  assert.equal(normative("Always avoid edge motion").normative_level, "MUST_NOT");
  assert.equal(normative("Be sure to lower the soundscape volume").normative_level, "MUST");
  assert.equal(normative("Avoiding animating depth changes").normative_level, "AVOID");
});

test("scopes platform-consideration rules more narrowly than their page", () => {
  const page = {
    platforms: ["ios", "ipados", "macos", "visionos", "watchos"],
  } as SourcePage;
  const candidate = {
    section_path: ["Buttons", "Platform considerations", "macOS", "Push buttons"],
  } as GuidanceCandidate;
  assert.deepEqual(platformsForCandidate(page, candidate), ["macos"]);
});

test("detects normative strength changes across likely rule replacements", () => {
  const source = { url: "https://developer.apple.com/design/human-interface-guidelines/buttons", section_path: ["Buttons", "Best practices"], source_sentence_hash: "a".repeat(64) };
  const base = { statement: { en: "Favor clear labels.", ja: "明確なラベルを優先する。" }, status: "active" as const, source };
  const previous = [{ ...base, id: "HIG-COMPONENTS-BUTTONS-0001", title: "Consider using clear labels", normative_level: "MAY" as const }];
  const current = [{ ...base, id: "HIG-COMPONENTS-BUTTONS-0002", title: "Always use clear labels", normative_level: "MUST" as const }];
  const result = diffRuleSnapshots(previous satisfies RuleSnapshot[], current satisfies RuleSnapshot[]);
  assert.equal(result.normative_strength_changes.length, 1);
  assert.equal(result.normative_strength_changes[0]?.from, "MAY");
  assert.equal(result.normative_strength_changes[0]?.to, "MUST");
});

test("current canonical rules and source pages satisfy schemas", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const addFormats = addFormatsModule as unknown as (instance: Ajv2020) => Ajv2020;
  addFormats(ajv);
  const validateRule = ajv.compile(ruleSchema);
  const validatePage = ajv.compile(sourcePageSchema);
  const rules = await loadRules({ includeDeprecated: true });
  const pages = await loadSourcePages();
  assert.ok(rules.length > 0);
  assert.ok(pages.length > 0);
  for (const rule of rules) assert.equal(validateRule(rule), true, JSON.stringify(validateRule.errors));
  for (const page of pages) assert.equal(validatePage(page), true, JSON.stringify(validatePage.errors));
});

test("keeps mixed-strength reviewed guidance atomic", async () => {
  const rules = await loadRules();
  const required = rules.find((rule) => rule.id === "HIG-COMPONENTS-LIVE-ACTIVITIES-0015");
  const optional = rules.find((rule) => rule.id === "HIG-COMPONENTS-LIVE-ACTIVITIES-0030");
  assert.equal(required?.normative_level, "MUST");
  assert.doesNotMatch(required?.statement.en ?? "", /consider/i);
  assert.equal(optional?.normative_level, "MAY");
  assert.match(optional?.statement.en ?? "", /custom dismissal time/i);
  assert.equal(required?.source.source_sentence_hash, optional?.source.source_sentence_hash);
});

test("keeps exact duplicate reviews aligned with canonical source traces", async () => {
  const rules = (await loadRules()).filter((rule) => rule.status === "active");
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const groups = findExactDuplicateGroups(rules);
  assert.deepEqual(
    groups.map(duplicateGroupKey).sort(),
    duplicateReview.groups.map((review) => duplicateGroupKey(review.rule_ids)).sort(),
  );
  for (const review of duplicateReview.groups) {
    const groupRules = review.rule_ids.map((id) => ruleById.get(id)).filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));
    assert.equal(groupRules.length, review.rule_ids.length);
    assert.equal(sha256(normalizeRuleStatement(groupRules[0]!.statement.en)), review.normalized_statement_hash);
    assert.equal(duplicateSourceTraceHash(groupRules), review.source_trace_hash);
  }
});

test("excludes source-reviewed normative rules from the prioritized review queue", async () => {
  const rules = await loadRules();
  const normativeReviewed = rules.filter((rule) => ["MUST", "MUST_NOT"].includes(rule.normative_level));
  assert.ok(normativeReviewed.length > 0);
  assert.equal(normativeReviewed.every((rule) => !rule.review_required), true);
  const pending = pendingRuleReviews(rules);
  const batch = nextReviewBatch(rules);
  assert.equal(pending.some((rule) => ["MUST", "MUST_NOT"].includes(rule.normative_level)), false);
  assert.ok(batch.length > 0);
  assert.equal(batch.every((rule) => rule.priority_rank === batch[0]?.priority_rank), true);
  assert.equal(batch.every((rule) => rule.source.url === batch[0]?.source.url), true);
});

test("keeps general source reviews aligned with canonical traces", async () => {
  const rules = await loadRules();
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  for (const [id, review] of Object.entries(sourceReview.rules)) {
    const rule = ruleById.get(id);
    assert.ok(rule);
    assert.equal(rule.source.source_hash, review.source.source_hash);
    assert.equal(rule.source.source_sentence_hash, review.source.source_sentence_hash);
    assert.deepEqual(rule.source.section_path, review.source.section_path);
    assert.equal(rule.review_required, false);
  }
  const reviewedBatchIds = new Set<string>();
  const explicitReviews = sourceReview.rules as Record<string, { confidence?: string; review_required?: boolean }>;
  for (const batch of sourceReview.batches) {
    const pageByUrl = new Map(batch.pages.map((page) => [page.url, page]));
    for (const id of batch.rule_ids) {
      assert.equal(reviewedBatchIds.has(id), false);
      reviewedBatchIds.add(id);
      const rule = ruleById.get(id);
      assert.ok(rule);
      assert.equal(rule.source.source_hash, pageByUrl.get(rule.source.url)?.source_hash);
      assert.equal(rule.review_required, explicitReviews[id]?.review_required ?? batch.review_required);
      assert.equal(rule.confidence, explicitReviews[id]?.confidence ?? batch.confidence);
    }
  }
});
