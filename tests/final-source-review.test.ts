import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { duplicateSourceTraceHash, normalizeRuleStatement } from "../src/lib/duplicates.js";
import { parseQueryArgs, queryRules } from "../src/lib/query.js";
import type { Rule, SourcePage } from "../src/lib/types.js";
import { sha256 } from "../src/lib/util.js";

type ReviewedFields = Partial<Pick<Rule,
  "statement" | "normative_level" | "polarity" | "severity" | "scope"
>>;
type SourceDecision = ReviewedFields & {
  source: Pick<Rule["source"], "source_hash" | "source_sentence_hash" | "section_path">;
};
interface DuplicateDecision {
  rule_ids: string[];
  normalized_statement_hash: string;
  source_trace_hash: string;
  disposition: string;
}
interface SourceEvidence {
  source_hash: string;
  previous_source_hash: string;
}
interface QueryEnvelope {
  total: number;
  returned: number;
  has_more: boolean;
  rules: Array<{ id: string }>;
}

const walletId = (suffix: string) => `HIG-TECHNOLOGIES-WALLET-${suffix}`;
const siriId = (suffix: string) => `HIG-TECHNOLOGIES-SIRI-${suffix}`;
const mlId = (suffix: string) => `HIG-TECHNOLOGIES-MACHINE-LEARNING-${suffix}`;
const identityIds = ["0029", "0030", "0031", "0032", "0035", "0036", "0060", "0061"].map(walletId);
const mayIds = [
  ...["0001", "0002", "0003", "0004"].map((suffix) => `HIG-FOUNDATIONS-IMMERSIVE-EXPERIENCES-${suffix}`),
  ...["0039", "0040", "0041", "0081", "0082"].map(mlId),
  ...["0014", "0015", "0016"].map((suffix) => `HIG-PATTERNS-FILE-MANAGEMENT-${suffix}`),
];
const siriStrengths = new Map<string, Rule["normative_level"]>([
  ...["0006", "0010", "0015", "0017", "0018", "0020", "0021", "0027"].map((suffix) => [siriId(suffix), "MUST"] as const),
  ...["0003", "0022", "0024", "0025", "0026", "0028"].map((suffix) => [siriId(suffix), "MUST_NOT"] as const),
]);

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8")) as T;
}

async function loadFixture() {
  const [immersive, file, ml, siri, wallet, normative, sourceReview, duplicateReview, mlPage, siriPage, mlEvidence, siriEvidence] = await Promise.all([
    json<Rule[]>("src/rules/foundations/immersive-experiences.json"),
    json<Rule[]>("src/rules/patterns/file-management.json"),
    json<Rule[]>("src/rules/technologies/machine-learning.json"),
    json<Rule[]>("src/rules/technologies/siri.json"),
    json<Rule[]>("src/rules/technologies/wallet.json"),
    json<{ overrides: Record<string, ReviewedFields> }>("src/config/normative-review.json"),
    json<{ rules: Record<string, SourceDecision> }>("src/config/source-review.json"),
    json<{ groups: DuplicateDecision[] }>("src/config/duplicate-review.json"),
    json<SourcePage>("src/sources/apple-hig/pages/machine-learning.json"),
    json<SourcePage>("src/sources/apple-hig/pages/siri.json"),
    json<SourceEvidence>("docs/audits/2026-09-08/machine-learning-trace-evidence.json"),
    json<SourceEvidence>("docs/audits/2026-09-08/siri-trace-evidence.json"),
  ]);
  const byId = new Map([...immersive, ...file, ...ml, ...siri, ...wallet].map((rule) => [rule.id, rule]));
  function rule(id: string): Rule {
    const value = byId.get(id);
    assert.ok(value, `missing reviewed rule: ${id}`);
    assert.equal(value.status, "active", id);
    return value;
  }
  return { rule, ml, siri, wallet, normative, sourceReview, duplicateReview, mlPage, siriPage, mlEvidence, siriEvidence };
}

// Load only the five named pages. No source fetches, regeneration, or file writes;
// these checks preserve reviewed decisions, not prove present-day source freshness.
let fixturePromise: ReturnType<typeof loadFixture> | undefined;
const fixture = () => fixturePromise ??= loadFixture();

function assertSourceBinding(rule: Rule, decision: SourceDecision): void {
  assert.equal(decision.source.source_hash, rule.source.source_hash, rule.id);
  assert.equal(decision.source.source_sentence_hash, rule.source.source_sentence_hash, rule.id);
  assert.deepEqual(decision.source.section_path, rule.source.section_path, rule.id);
}

function query(rules: Rule[], ids: string[], platform: string): QueryEnvelope {
  const result = queryRules(rules, parseQueryArgs([
    "--id", ids.join(","), "--platform", platform, "--limit", "10", "--max-bytes", "32000",
  ]));
  assert.equal(result.exitCode, 0, `${platform}: query failed`);
  const envelope = JSON.parse(result.output) as QueryEnvelope;
  assert.equal(envelope.has_more, false, `${platform}: expected a complete bounded result`);
  assert.equal(envelope.returned, envelope.total, platform);
  return envelope;
}

test("twelve reviewed capabilities remain MAY / permit / info in canonical and source decisions", async () => {
  const { rule, sourceReview } = await fixture();
  assert.equal(mayIds.length, 12);
  assert.equal(new Set(mayIds).size, 12);
  for (const id of mayIds) {
    const current = rule(id);
    const decision = sourceReview.rules[id];
    assert.ok(decision, `missing source-reviewed capability: ${id}`);
    for (const fields of [current, decision]) {
      assert.equal(fields.normative_level, "MAY", id);
      assert.equal(fields.polarity, "permit", id);
      assert.equal(fields.severity, "info", id);
    }
    assertSourceBinding(current, decision);
  }
});

test("Wallet identity guidance is iPhone-only and excluded from every other platform query", async () => {
  const { rule, wallet, sourceReview } = await fixture();
  assert.equal(identityIds.length, 8);
  for (const id of identityIds) {
    const current = rule(id);
    const decision = sourceReview.rules[id];
    assert.ok(decision?.scope, `missing individual scope override: ${id}`);
    for (const scope of [current.scope, decision.scope]) {
      assert.deepEqual(scope.platforms, ["ios"], id);
      assert.deepEqual(scope.devices, ["iphone"], id);
    }
    assertSourceBinding(current, decision);
  }
  assert.deepEqual(query(wallet, identityIds, "ios").rules.map((entry) => entry.id).sort(), [...identityIds].sort());
  for (const platform of ["ipados", "macos", "tvos", "visionos", "watchos"]) {
    const excluded = query(wallet, identityIds, platform);
    assert.equal(excluded.total, 0, platform);
    assert.deepEqual(excluded.rules, [], platform);
  }
  // Narrowing identity verification must not remove the unrelated pass guidance.
  for (const platform of ["ipados", "macos", "visionos", "watchos"]) {
    assert.deepEqual(query(wallet, [walletId("0001")], platform).rules.map((entry) => entry.id), [walletId("0001")]);
  }
});

test("all fourteen Siri strict decisions are explicit ID-keyed overrides, not title-derived strength", async () => {
  const { rule, siri, normative } = await fixture();
  assert.equal(siriStrengths.size, 14);
  assert.deepEqual(
    siri.filter((entry) => entry.status === "active" && ["MUST", "MUST_NOT"].includes(entry.normative_level)).map((entry) => entry.id).sort(),
    [...siriStrengths.keys()].sort(),
  );
  // Assert fixed expected IDs and explicit fields; do not infer a level from any
  // edited display title or derive the expected set from canonical strict rules.
  for (const [id, expected] of siriStrengths) {
    const current = rule(id);
    const override = normative.overrides[id];
    assert.ok(override, `missing normative override: ${id}`);
    assert.equal(Object.hasOwn(override, "normative_level"), true, id);
    assert.equal(override.normative_level, expected, id);
    assert.equal(current.normative_level, expected, id);
    for (const fields of [current, override]) {
      assert.equal(fields.polarity, expected === "MUST" ? "require" : "prohibit", id);
      assert.equal(fields.severity, "error", id);
    }
    assert.equal(current.review_required, false, id);
  }
});

test("Siri strict source-review bindings match the reviewed page and candidate sections", async () => {
  const { rule, sourceReview, siriPage, siriEvidence } = await fixture();
  assert.equal(siriPage.source_hash, siriEvidence.source_hash);
  for (const id of siriStrengths.keys()) {
    const current = rule(id);
    const decision = sourceReview.rules[id];
    assert.ok(decision, `missing Siri source review: ${id}`);
    assertSourceBinding(current, decision);
    assert.equal(current.source.url, siriPage.canonical_url, id);
    assert.equal(current.source.source_hash, siriPage.source_hash, id);
    assert.ok(siriPage.guidance_candidates.some((candidate) =>
      candidate.source_sentence_hash === current.source.source_sentence_hash
      && JSON.stringify(candidate.section_path) === JSON.stringify(current.source.section_path)), id);
    if (decision.normative_level !== undefined) assert.equal(decision.normative_level, siriStrengths.get(id), id);
  }
});

test("the retained Machine learning duplicate fingerprint binds both contexts to the new source", async () => {
  const { rule, duplicateReview, sourceReview, mlPage, mlEvidence } = await fixture();
  const ids = [mlId("0005"), mlId("0034")];
  const groups = duplicateReview.groups.filter((entry) => [...entry.rule_ids].sort().join("\n") === [...ids].sort().join("\n"));
  assert.equal(groups.length, 1);
  const decision = groups[0]!;
  const rules = ids.map(rule);
  assert.equal(decision.disposition, "retained_contextual_duplicate");
  assert.equal(mlPage.source_hash, mlEvidence.source_hash);
  assert.notEqual(mlEvidence.source_hash, mlEvidence.previous_source_hash);
  for (const current of rules) {
    assert.equal(current.source.source_hash, mlPage.source_hash, current.id);
    assert.equal(current.source.url, mlPage.canonical_url, current.id);
    assert.equal(current.normative_level, "MUST", current.id);
    const binding = sourceReview.rules[current.id];
    assert.ok(binding, current.id);
    assertSourceBinding(current, binding);
    assert.equal(sha256(normalizeRuleStatement(current.statement.en)), decision.normalized_statement_hash, current.id);
  }
  assert.notDeepEqual(rules[0]!.source.section_path, rules[1]!.source.section_path);
  assert.equal(duplicateSourceTraceHash(rules), decision.source_trace_hash);
  const stale = rules.map((current) => ({ ...current, source: { ...current.source, source_hash: mlEvidence.previous_source_hash } }));
  assert.notEqual(duplicateSourceTraceHash(stale), decision.source_trace_hash, "the prior source cannot reuse the refreshed approval");
});

test("Wallet image-content restrictions and accessible text delivery remain separate commands", async () => {
  const { rule, sourceReview } = await fixture();
  const visual = rule(walletId("0033"));
  const text = rule(walletId("0052"));
  for (const current of [visual, text]) {
    assert.equal(current.normative_level, "MUST", current.id);
    const decision = sourceReview.rules[current.id];
    assert.ok(decision, current.id);
    assertSourceBinding(current, decision);
    assert.deepEqual(current.statement, decision.statement, current.id);
  }
  assert.notEqual(normalizeRuleStatement(visual.statement.en), normalizeRuleStatement(text.statement.en));
  assert.notEqual(visual.statement.ja, text.statement.ja);
  assert.match(visual.statement.en, /images.*visual content.*rather than.*textual/i);
  assert.match(visual.statement.ja, /文字情報を埋め込まない/u);
  assert.doesNotMatch(visual.statement.en, /text fields|semantic tags/i);
  assert.match(text.statement.en, /textual pass information.*text fields and semantic tags/i);
  assert.match(text.statement.ja, /テキストフィールド.*セマンティックタグ.*提供/u);
  assert.doesNotMatch(text.statement.en, /reserve.*images|rather than.*images/i);
  assert.equal(visual.source.source_hash, text.source.source_hash);
  assert.deepEqual(visual.source.section_path, text.source.section_path);
  assert.notEqual(visual.source.source_sentence_hash, text.source.source_sentence_hash, "distinct existing source commands retain separate bindings");
});
