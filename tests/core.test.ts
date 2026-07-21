import assert from "node:assert/strict";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import ruleSchema from "../schemas/rule.schema.json" with { type: "json" };
import sourcePageSchema from "../schemas/source-page.schema.json" with { type: "json" };
import { loadRules, loadSourcePages } from "../src/lib/store.js";
import { normative, paraphrase, platformsForCandidate } from "../src/lib/rules.js";
import type { GuidanceCandidate, SourcePage } from "../src/lib/types.js";
import { normalizeUrl } from "../src/lib/util.js";
import { diffRuleSnapshots, type RuleSnapshot } from "../src/lib/rule-diff.js";

test("normalizes HIG URLs and rejects out-of-scope URLs", () => {
  const root = "https://developer.apple.com/design/human-interface-guidelines";
  assert.equal(normalizeUrl(`${root}/accessibility/?changes=1#vision`, root), `${root}/accessibility`);
  assert.equal(normalizeUrl("https://developer.apple.com/documentation/swiftui", root), null);
});

test("keeps conditional strength conservative", () => {
  assert.equal(normative("Consider showing a label").normative_level, "MAY");
  assert.equal(normative("Prefer the standard control").normative_level, "SHOULD");
  assert.equal(normative("Never hide the recovery action").normative_level, "MUST_NOT");
});

test("paraphrases common imperative leads", () => {
  const result = paraphrase("Support larger text sizes", "Accessibility");
  assert.equal(result.en, "Ensure the experience accommodates larger text sizes.");
  assert.notEqual(result.en.toLowerCase(), "support larger text sizes");
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
