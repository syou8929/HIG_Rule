import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Rule } from "../src/lib/types.js";

async function fixtures() {
  const read = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
  const rules = await read("src/rules/technologies/generative-ai.json") as Rule[];
  const audit = await read("docs/audits/2026-09-08/generative-additions-review.json") as { decisions: Array<{ key: string; id: string }> };
  const byId = new Map(rules.map(rule => [rule.id, rule]));
  const rule = (suffix: string) => {
    const value = byId.get(`HIG-TECHNOLOGIES-GENERATIVE-AI-${suffix}`);
    assert.ok(value);
    return value;
  };
  const added = (key: string) => {
    const decision = audit.decisions.find(item => item.key === key);
    assert.ok(decision);
    const value = byId.get(decision.id);
    assert.ok(value);
    return value;
  };
  return { rules, rule, added, audit };
}

test("AI licensing and split personal-data choices retain independent priorities", async () => {
  const { rule } = await fixtures();
  assert.equal(rule("0044").normative_level, "MUST");
  assert.equal(rule("0044").priority_rank, 1);
  assert.equal(rule("0057").normative_level, "MUST");
  assert.equal(rule("0057").priority_rank, 3);
  assert.equal(rule("0044").source.source_sentence_hash, rule("0057").source.source_sentence_hash);
  assert.notDeepEqual(rule("0044").statement, rule("0057").statement);
  assert.equal(rule("0056").priority_rank, 3);
  assert.match(rule("0056").statement.en, /always.*opt out/i);
});

test("irreversible-task permission is separate from consideration, general confirmation and avoidance", async () => {
  const { rule, added } = await fixtures();
  const permission = added("permission-before-irreversible-task");
  assert.equal(permission.normative_level, "MUST");
  assert.match(permission.statement.en, /before.*irreversible or potentially problematic/i);
  assert.equal(rule("0010").normative_level, "MAY");
  assert.equal(rule("0049").normative_level, "SHOULD");
  assert.match(rule("0049").statement.en, /^Generally/);
  assert.equal(rule("0048").normative_level, "AVOID");
  assert.match(permission.conditions.join(" "), /does not erase.*0048/i);
});

test("new AI privacy and feedback guidance keeps conditional and optional boundaries", async () => {
  const { added, audit } = await fixtures();
  assert.equal(audit.decisions.length, 8);
  assert.equal(new Set(audit.decisions.map(item => item.id)).size, 8);
  assert.match(added("third-party-privacy").statement.en, /^When sharing/);
  assert.match(added("sensitive-output-awareness").statement.en, /possibility.*inadvertently/i);
  assert.match(added("own-model-retraining").statement.en, /^If you train your own model/);
  for (const key of ["quick-positive-negative-feedback", "detailed-feedback-complex-issues"]) {
    assert.equal(added(key).normative_level, "MAY");
    assert.equal(added(key).review_required, false);
  }
  assert.match(added("quick-positive-negative-feedback").conditions.join(" "), /examples, not required.*voluntary/i);
  assert.equal(added("feedback-issue-resolution").normative_level, "SHOULD");
});
