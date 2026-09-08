import assert from "node:assert/strict";
import test from "node:test";
import { parseQueryArgs, queryRules } from "../src/lib/query.js";
import type { Rule } from "../src/lib/types.js";

function fixture(index: number, overrides: Partial<Rule> = {}): Rule {
  return {
    id: `HIG-COMPONENTS-QUERY-${String(index).padStart(4, "0")}`,
    title: `Query guidance ${index}`,
    category: "components",
    topic: "query",
    subtopic: "general",
    statement: { en: `Keep action ${index} clear.`, ja: `操作${index}を明確にする。` },
    normative_level: "SHOULD",
    confidence: "high",
    review_required: false,
    polarity: "recommend",
    scope: {
      portability: "platform-specific",
      platforms: ["ios"],
      devices: ["iphone"],
      components: ["buttons"],
      modalities: ["touch"],
    },
    conditions: ["When the action is available."],
    exceptions: ["Unless the action is unavailable."],
    rationale: { en: "People can identify the action.", ja: "操作を識別できる。" },
    checks: { automated: [], manual: ["Inspect the action label."] },
    testability: "manual",
    severity: "warning",
    anti_patterns: ["An unclear action."],
    positive_examples: ["A clear action."],
    source: {
      url: "https://developer.apple.com/design/human-interface-guidelines/buttons",
      page_title: "Buttons",
      section_path: ["Buttons", `Guidance ${index}`],
      retrieved_at: "2026-09-06T00:00:00.000Z",
      source_hash: "a".repeat(64),
      source_sentence_hash: String(index).padStart(64, "0"),
      evidence_paraphrase: "Keep the action identifiable.",
    },
    tags: ["actions"],
    priority_rank: 4,
    status: "active",
    ...overrides,
  };
}

interface Envelope {
  total: number;
  returned: number;
  offset: number;
  next_offset: number | null;
  has_more: boolean;
  bytes: number;
  max_bytes: number;
  minimum_required_bytes?: number;
  projected_returned?: number;
  projected_bytes?: number;
  requested_bytes?: number;
  rules?: Array<Record<string, unknown>>;
  sources?: Record<string, Omit<Rule["source"], "section_path" | "source_sentence_hash" | "evidence_paraphrase">>;
}

function query(rules: Rule[], args: string[] = []) {
  const result = queryRules(rules, parseQueryArgs(args));
  const envelope = JSON.parse(result.output) as Envelope;
  assert.ok(result.output.endsWith("\n"), "machine output includes its final newline");
  assert.equal(envelope.bytes, Buffer.byteLength(result.output, "utf8"));
  assert.ok(envelope.bytes <= envelope.max_bytes, "the entire envelope respects its byte cap");
  return { ...result, envelope };
}

function ids(envelope: Envelope): unknown[] {
  return (envelope.rules ?? []).map((rule) => rule.id);
}

test("query defaults bound broad active results and represent zero matches explicitly", () => {
  const rules = Array.from({ length: 15 }, (_, index) => fixture(index + 1));
  rules.push(fixture(99, { status: "deprecated", deprecated_at: "2026-09-01T00:00:00.000Z" }));
  const broad = query(rules);
  assert.equal(broad.exitCode, 0);
  assert.equal(broad.envelope.total, 15);
  assert.equal(broad.envelope.returned, 10);
  assert.equal(broad.envelope.max_bytes, 12000);
  assert.equal(broad.envelope.offset, 0);
  assert.equal(broad.envelope.next_offset, 10);
  assert.equal(broad.envelope.has_more, true);
  assert.equal(broad.envelope.rules?.[0]?.statement, rules[0]?.statement.en);
  const zero = query(rules, ["--task", "nonexistentword"]);
  assert.equal(zero.envelope.total, 0);
  assert.equal(zero.envelope.returned, 0);
  assert.deepEqual(zero.envelope.rules, []);
  assert.equal(zero.envelope.has_more, false);
  assert.equal(zero.envelope.next_offset, null);
  const beyondEnd = query(rules, ["--offset", "99"]);
  assert.equal(beyondEnd.envelope.total, 15);
  assert.equal(beyondEnd.envelope.returned, 0);
  assert.equal(beyondEnd.envelope.has_more, false);
});

test("query rejects malformed, missing, unknown, and out-of-range arguments", () => {
  for (const args of [
    ["--unknown"], ["--limit"], ["--platform", "--limit", "1"], ["stray"],
    ["--limit", "0"], ["--limit", "51"], ["--limit", "1.5"], ["--limit", "1e1"],
    ["--offset", "-1"], ["--offset", "1.5"], ["--offset", "NaN"],
    ["--max-bytes", "1023"], ["--max-bytes", "32001"], ["--max-bytes", "Infinity"],
    ["--language", "fr"], ["--format", "yaml"], ["--task", "！？ -- …"], ["--id", ""],
  ]) {
    assert.throws(() => parseQueryArgs(args), Error, args.join(" "));
  }
  assert.doesNotThrow(() => parseQueryArgs(["--limit", "50", "--offset", "0", "--max-bytes", "1024"]));
  assert.equal(query([], ["--format", "json"]).envelope.max_bytes, 32000);
});

test("query normalizes multilingual task text and combines every token with AND", () => {
  const matching = fixture(1, {
    title: "ＴＯＵＣＨ targets",
    topic: "ラベル",
    tags: ["café"],
    statement: { en: "Keep a button clear.", ja: "ボタンの選択状態を明確に示す。" },
  });
  const unrelated = fixture(2);
  const rules = [unrelated, matching];
  for (const task of ["選択状態", "TOUCH 選択状態", "ｂｕｔｔｏｎ ラベル cafe\u0301"]) {
    const result = query(rules, ["--task", task]);
    assert.deepEqual(ids(result.envelope), [matching.id], task);
  }
  assert.equal(query(rules, ["--task", "選択状態 missingword"]).envelope.total, 0);
  assert.equal(query(rules, ["--task", "存在しない語句"]).envelope.total, 0);
});

test("query combines exact scope and classification filters without prefix matching", () => {
  const matching = fixture(1);
  const rules = [
    matching,
    fixture(2, { scope: { ...matching.scope, platforms: ["ipados"] } }),
    fixture(3, { category: "patterns" }),
    fixture(4, { scope: { ...matching.scope, components: ["buttons-extra"] } }),
    fixture(5, { scope: { ...matching.scope, modalities: ["touchpad"] } }),
    fixture(6, { scope: { ...matching.scope, devices: ["iphone-extra"] } }),
    fixture(7, { normative_level: "MAY" }),
    fixture(8, { confidence: "low" }),
  ];
  const result = query(rules, [
    "--platform", "ios", "--category", "components", "--component", "buttons",
    "--modality", "touch", "--device", "iphone", "--normative", "SHOULD", "--confidence", "high",
  ]);
  assert.deepEqual(ids(result.envelope), [matching.id]);
});

test("query hydrates repeated and comma-separated IDs and rejects unknown or deprecated IDs", () => {
  const rules = [fixture(1), fixture(2), fixture(3, { status: "deprecated" })];
  const result = query(rules, ["--id", `${rules[1]!.id},${rules[0]!.id}`, "--id", rules[1]!.id]);
  assert.deepEqual(ids(result.envelope), [rules[0]!.id, rules[1]!.id]);
  assert.equal(result.envelope.total, 2);
  for (const id of ["HIG-COMPONENTS-QUERY-9999", rules[2]!.id]) {
    assert.throws(() => queryRules(rules, parseQueryArgs(["--id", id])));
  }
});

test("query sorts conflict priority first, platform specificity second, and IDs deterministically", () => {
  const broad = fixture(1, { scope: { ...fixture(1).scope, platforms: ["ios", "macos"] } });
  const narrow = fixture(2);
  const urgent = fixture(3, { priority_rank: 1, scope: broad.scope });
  const narrowLater = fixture(4);
  const rules = [narrowLater, narrow, broad, urgent];
  const originalOrder = rules.map((rule) => rule.id);
  assert.deepEqual(ids(query(rules, ["--platform", "ios"]).envelope), [urgent.id, narrow.id, narrowLater.id, broad.id]);
  assert.deepEqual(ids(query(rules).envelope), [urgent.id, broad.id, narrow.id, narrowLater.id]);
  assert.deepEqual(rules.map((rule) => rule.id), originalOrder, "querying does not reorder the caller's array");
  const statementHit = fixture(1, { statement: { en: "Keep selection clear.", ja: "選択を明確にする。" } });
  const titleHit = fixture(2, { title: "Selection" });
  assert.deepEqual(ids(query([statementHit, titleHit], ["--task", "selection"]).envelope), [titleHit.id, statementHit.id]);
});

test("query paginates every matching rule once when both row and byte limits apply", () => {
  const rules = Array.from({ length: 17 }, (_, index) => fixture(index + 1));
  const seen: unknown[] = [];
  let offset = 0;
  for (let page = 0; page <= rules.length; page += 1) {
    const result = query([...rules].reverse(), ["--limit", "3", "--max-bytes", "2400", "--offset", String(offset)]);
    const envelope = result.envelope;
    assert.equal(result.exitCode, 0);
    assert.equal(envelope.total, rules.length);
    assert.equal(envelope.offset, offset);
    assert.ok(envelope.returned > 0 && envelope.returned <= 3);
    seen.push(...ids(envelope));
    if (!envelope.has_more) {
      assert.equal(envelope.next_offset, null);
      break;
    }
    assert.equal(envelope.next_offset, offset + envelope.returned);
    offset = envelope.next_offset!;
  }
  assert.deepEqual(seen, rules.map((rule) => rule.id));
  assert.equal(new Set(seen).size, rules.length);
});

test("query counts UTF-8 bytes and truncates only between complete rules", () => {
  const japanese = "選択😀".repeat(110);
  const rules = Array.from({ length: 6 }, (_, index) => fixture(index + 1, {
    statement: { en: "Keep the selection clear.", ja: japanese },
  }));
  const result = query(rules, ["--language", "ja", "--limit", "50", "--max-bytes", "4096"]);
  assert.equal(result.exitCode, 0);
  assert.ok(result.envelope.returned > 0 && result.envelope.returned < rules.length);
  assert.equal(result.envelope.has_more, true);
  assert.ok(result.envelope.bytes > result.output.length, "multibyte text uses bytes, not UTF-16 length");
  for (const rule of result.envelope.rules ?? []) assert.equal(rule.statement, japanese);
});

test("query reports an actionable size when the first complete record cannot fit", () => {
  const rules = [fixture(1, { statement: { en: "Action ".repeat(700), ja: "操作を表示する。" } })];
  const result = query(rules, ["--max-bytes", "1024"]);
  assert.equal(result.exitCode, 2);
  assert.equal(result.envelope.total, 1);
  assert.equal(result.envelope.returned, 0);
  assert.equal(result.envelope.has_more, true);
  assert.equal(result.envelope.next_offset, null);
  assert.ok((result.envelope.minimum_required_bytes ?? 0) > 1024);
  assert.deepEqual(result.envelope.rules, []);
  const recovered = query(rules, ["--max-bytes", String(result.envelope.minimum_required_bytes)]);
  assert.equal(recovered.exitCode, 0);
  assert.deepEqual(ids(recovered.envelope), [rules[0]!.id]);
});

test("compact rules retain decision context and source traces while full JSON retains every field", () => {
  const rules = [fixture(1, { confidence: "low", review_required: true }), fixture(2)];
  const compact = query(rules, ["--language", "ja"]).envelope;
  assert.equal(Object.keys(compact.sources ?? {}).length, 1, "shared page provenance is emitted once");
  for (const [index, selected] of (compact.rules ?? []).entries()) {
    const original = rules[index]!;
    assert.equal(selected.statement, original.statement.ja);
    for (const key of ["id", "normative_level", "confidence", "review_required", "scope", "conditions", "exceptions", "priority_rank"] as const) {
      assert.deepEqual(selected[key], original[key], key);
    }
    const source = selected.source as { ref: string; section_path: string[]; source_sentence_hash: string; evidence_paraphrase: string };
    assert.deepEqual({
      ...compact.sources?.[source.ref],
      section_path: source.section_path,
      source_sentence_hash: source.source_sentence_hash,
      evidence_paraphrase: source.evidence_paraphrase,
    }, original.source);
    assert.equal(selected.rationale, undefined, "compact mode omits the full rule body");
  }
  assert.deepEqual(query(rules, ["--format", "json", "--language", "ja"]).envelope.rules, rules);
});

test("preflight reports bounded counts without exposing rule bodies", () => {
  const secretMarker = "RULE_BODY_SENTINEL_あいうえお";
  const rules = [fixture(1, { statement: { en: secretMarker, ja: secretMarker } }), fixture(2)];
  const result = query(rules, ["--preflight", "--max-bytes", "1024"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.envelope.total, 2);
  assert.ok(!result.envelope.rules || result.envelope.rules.length === 0);
  assert.equal(result.output.includes(secretMarker), false);
  assert.ok((result.envelope.projected_bytes ?? 0) > 0);
  assert.ok((result.envelope.projected_bytes ?? Infinity) <= result.envelope.max_bytes);
  assert.ok((result.envelope.requested_bytes ?? 0) > 0);
  const roomy = query(rules, ["--preflight", "--max-bytes", "32000"]);
  assert.equal(roomy.envelope.projected_returned, rules.length);
});

test("Markdown warns that candidates need detailed review and remains byte bounded", () => {
  const options = parseQueryArgs(["--format", "markdown", "--max-bytes", "1024"]);
  const result = queryRules([fixture(1)], options);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /candidate/i);
  assert.match(result.output, /review|JSON/i);
  assert.ok(result.output.endsWith("\n"));
  assert.ok(Buffer.byteLength(result.output, "utf8") <= 1024);
});
