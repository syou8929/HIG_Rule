import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseQueryArgs, queryRules } from "../src/lib/query.js";
import { loadRules } from "../src/lib/store.js";
import type { Rule } from "../src/lib/types.js";

const rules = await loadRules();
const byId = new Map(rules.map((rule) => [rule.id, rule]));
// Fixed canonical-store cases: the reference selection is independent of CLI pagination/projection.
const cases: Array<{ name: string; args: string[]; expected: (rule: Rule) => boolean }> = [
  { name: "ios-buttons", args: ["--platform", "ios", "--component", "buttons"], expected: (r) => r.scope.platforms.includes("ios") && (r.topic === "buttons" || r.scope.components.includes("buttons")) },
  { name: "ipados-scroll-views", args: ["--platform", "ipados", "--component", "scroll-views"], expected: (r) => r.scope.platforms.includes("ipados") && (r.topic === "scroll-views" || r.scope.components.includes("scroll-views")) },
  { name: "macos-menus", args: ["--platform", "macos", "--component", "menus"], expected: (r) => r.scope.platforms.includes("macos") && (r.topic === "menus" || r.scope.components.includes("menus")) },
  { name: "tvos-playing-video", args: ["--platform", "tvos", "--component", "playing-video"], expected: (r) => r.scope.platforms.includes("tvos") && (r.topic === "playing-video" || r.scope.components.includes("playing-video")) },
  { name: "visionos-ornaments", args: ["--platform", "visionos", "--component", "ornaments"], expected: (r) => r.scope.platforms.includes("visionos") && (r.topic === "ornaments" || r.scope.components.includes("ornaments")) },
  { name: "watchos-notifications", args: ["--platform", "watchos", "--component", "notifications"], expected: (r) => r.scope.platforms.includes("watchos") && (r.topic === "notifications" || r.scope.components.includes("notifications")) },
  { name: "carplay", args: ["--platform", "carplay"], expected: (r) => r.scope.platforms.includes("carplay") },
  { name: "accessibility", args: ["--category", "foundations", "--component", "accessibility"], expected: (r) => r.category === "foundations" && (r.topic === "accessibility" || r.scope.components.includes("accessibility")) },
  { name: "permission", args: ["--task", "permission"], expected: (r) => englishText(r).includes("permission") || r.statement.ja.toLowerCase().includes("permission") },
  { name: "japanese-keyboard", args: ["--task", "キーボード", "--language", "ja"], expected: (r) => [englishText(r), r.statement.ja].join(" ").normalize("NFKC").includes("キーボード") },
  { name: "offline", args: ["--task", "offline"], expected: (r) => englishText(r).includes("offline") || r.statement.ja.toLowerCase().includes("offline") },
  { name: "zero-results", args: ["--task", "zzzznoquerymatchzzzz"], expected: () => false },
];

function englishText(rule: Rule): string {
  return [rule.title, rule.topic, rule.subtopic, rule.statement.en, ...rule.tags].join(" ").normalize("NFKC").toLowerCase();
}

const results = cases.map((item) => {
  const expected = rules.filter(item.expected).map((r) => r.id).sort();
  const seen: string[] = [];
  let offset = 0;
  let compactBytes = 0;
  let fullBytes = 0;
  let pages = 0;
  let contextChecks = 0;
  let maxPageBytes = 0;
  do {
    const args = [...item.args, "--offset", String(offset)];
    const result = queryRules(rules, parseQueryArgs(args));
    assert.equal(result.exitCode, 0, item.name);
    const response = JSON.parse(result.output);
    assert.equal(Buffer.byteLength(result.output), response.bytes);
    assert.ok(response.bytes <= 12_000);
    assert.equal(response.total, expected.length, item.name);
    pages++;
    compactBytes += response.bytes;
    maxPageBytes = Math.max(maxPageBytes, response.bytes);
    const originals = response.rules.map((record: { id: string }) => byId.get(record.id)!);
    fullBytes += Buffer.byteLength(`${JSON.stringify(originals, null, 2)}\n`);
    for (const record of response.rules) {
      const original = byId.get(record.id)!;
      seen.push(record.id);
      for (const key of ["scope", "conditions", "exceptions", "normative_level", "confidence", "review_required", "priority_rank"] as const) {
        assert.deepEqual(record[key], original[key], `${item.name}: ${record.id} ${key}`);
      }
      const { ref, ...section } = record.source;
      assert.deepEqual({ ...response.sources[ref], ...section }, original.source);
      assert.equal(record.statement, original.statement[item.args.includes("ja") ? "ja" : "en"]);
      for (const key of ["apple_native_rule", "portable_interpretation"] as const) assert.equal(record[key], original[key]);
      contextChecks++;
    }
    if (!response.has_more) break;
    assert.ok(response.returned > 0 && response.next_offset > offset, "Pagination must advance");
    offset = response.next_offset;
    assert.ok(pages <= rules.length + 1, "Pagination must terminate");
  } while (true);
  assert.equal(new Set(seen).size, seen.length, item.name);
  assert.deepEqual([...seen].sort(), expected, item.name);
  return {
    name: item.name, args: item.args, matched_rules: seen.length, pages,
    membership_preserved: true, decision_context_and_provenance_checks: contextChecks,
    max_page_bytes: maxPageBytes, compact_bytes: compactBytes, same_rules_legacy_json_bytes: fullBytes,
    reduction_percent: seen.length ? Math.round((1 - compactBytes / fullBytes) * 1000) / 10 : null,
  };
});

const defaultOutput = JSON.parse(queryRules(rules, parseQueryArgs([])).output);
const compared = results.filter((r) => r.matched_rules > 0);
const compactTotal = compared.reduce((sum, r) => sum + r.compact_bytes, 0);
const legacyTotal = compared.reduce((sum, r) => sum + r.same_rules_legacy_json_bytes, 0);
console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  canonical_hash: createHash("sha256").update(JSON.stringify(rules)).digest("hex"),
  cases: results,
  same_rule_reduction_percent: Math.round((1 - compactTotal / legacyTotal) * 1000) / 10,
  default_output: { matched: defaultOutput.total, returned: defaultOutput.returned, bytes: defaultOutput.bytes },
  limitations: [
    "Deterministic retrieval evaluation, not an Astra behavior or token-usage evaluation.",
    "Membership refers to the fixed filters, not a manually labeled semantic-relevance set.",
    "Compact omits fields such as rationale/checks; full JSON retains them. Savings are bytes, not tokens.",
    "The same-rule comparison includes every matching rule across all pages; empty queries are excluded from the aggregate.",
  ],
}, null, 2));
