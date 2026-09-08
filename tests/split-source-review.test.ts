import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { Inventory, Rule, SourcePage } from "../src/lib/types.js";

const repository = fileURLToPath(new URL("../", import.meta.url));
const tsxLoader = import.meta.resolve("tsx");
const baseId = "HIG-TECHNOLOGIES-GENERATIVE-AI-0044";
const splitId = "HIG-TECHNOLOGIES-GENERATIVE-AI-0057";
const ruleFile = "src/rules/technologies/generative-ai.json";
const pageFile = "src/sources/apple-hig/pages/generative-ai.json";
const inventoryFile = "src/sources/apple-hig/inventory.json";
const idMapFile = "src/config/rule-id-map.json";
const sourceReviewFile = "src/config/source-review.json";
const normativeReviewFile = "src/config/normative-review.json";

interface NormativeReviewFixture {
  overrides: Record<string, unknown>;
  additional_rules: Array<{ base_rule_id: string; split_key: string }>;
}

interface SourceReviewFixture {
  rules: Record<string, unknown>;
  batches: Array<{
    rule_ids: string[];
    id?: string;
    pages?: Array<{ url: string; source_hash: string }>;
    scope?: Rule["scope"];
    confidence?: Rule["confidence"];
    review_required?: boolean;
    review_note?: string;
  }>;
}

function readFixtureJson<T>(fixture: string, relativePath: string): T {
  return JSON.parse(readFileSync(join(fixture, relativePath), "utf8")) as T;
}

function writeFixtureJson(fixture: string, relativePath: string, value: unknown): void {
  const target = resolve(fixture, relativePath);
  assert.ok(target.startsWith(`${fixture}/`), "test writes must stay inside its temporary copy");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function extract(fixture: string): Rule[] {
  const result = spawnSync(process.execPath, ["--import", tsxLoader, join(fixture, "scripts/extract-rules.ts")], {
    cwd: fixture,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  assert.equal(result.error, undefined, "isolated extraction must finish before timeout");
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /from 1 pages\./, "the fixture must extract only the selected page");
  return readFixtureJson<Rule[]>(fixture, ruleFile);
}

function selectedRule(rules: Rule[], id: string): Rule {
  const matches = rules.filter((rule) => rule.id === id && rule.status === "active");
  assert.equal(matches.length, 1, `${id} must retain one active stable ID`);
  return matches[0]!;
}

test("reviewed split rules honor their own normative and source overrides without changing the base or repository", { timeout: 30_000 }, () => {
  // Copy just one source page and its existing canonical rules. No full source prose is fetched
  // or persisted; the existing page stores only bounded ingestion candidates and metadata.
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), "hig-split-source-review-test-")));
  const files = [
    "package.json", "tsconfig.json", "scripts/extract-rules.ts",
    normativeReviewFile, sourceReviewFile, idMapFile, inventoryFile, pageFile, ruleFile,
  ];
  const originals = new Map(files.map((path) => [path, readFileSync(join(repository, path))]));
  try {
    assert.notEqual(fixture, realpathSync(repository));
    for (const path of files) {
      const destination = join(fixture, path);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(join(repository, path), destination);
    }
    cpSync(join(repository, "src/lib"), join(fixture, "src/lib"), { recursive: true });
    symlinkSync(realpathSync(join(repository, "node_modules")), join(fixture, "node_modules"), "dir");

    const inventory = readFixtureJson<Inventory>(fixture, inventoryFile);
    inventory.pages = inventory.pages.filter((page) => page.slug === "generative-ai");
    assert.equal(inventory.pages.length, 1);
    inventory.categories = ["technologies"];
    writeFixtureJson(fixture, inventoryFile, inventory);

    const normativeReview = readFixtureJson<NormativeReviewFixture>(fixture, normativeReviewFile);
    const sourceReview = readFixtureJson<SourceReviewFixture>(fixture, sourceReviewFile);
    // The test stays valid when production reviews for this split are added or revised.
    delete normativeReview.overrides[splitId];
    delete sourceReview.rules[splitId];
    for (const batch of sourceReview.batches) batch.rule_ids = batch.rule_ids.filter((id) => id !== splitId);
    writeFixtureJson(fixture, normativeReviewFile, normativeReview);
    writeFixtureJson(fixture, sourceReviewFile, sourceReview);

    const baseline = extract(fixture);
    const base = selectedRule(baseline, baseId);
    const split = selectedRule(baseline, splitId);
    const page = readFixtureJson<SourcePage>(fixture, pageFile);
    assert.equal(split.source.source_hash, page.source_hash);
    assert.equal(split.source.source_sentence_hash, base.source.source_sentence_hash);
    assert.deepEqual(split.source.section_path, base.source.section_path);
    assert.ok(page.guidance_candidates.some((candidate) =>
      candidate.source_sentence_hash === split.source.source_sentence_hash
      && JSON.stringify(candidate.section_path) === JSON.stringify(split.source.section_path)));

    const splitDefinition = normativeReview.additional_rules.find((extra) => extra.base_rule_id === baseId);
    assert.ok(splitDefinition, "the existing personal-data choice must remain a reviewed split");
    const stableKey = `${page.canonical_url}#${base.source.source_sentence_hash}#split-${splitDefinition.split_key}`;
    const baselineIds = readFixtureJson<Record<string, string>>(fixture, idMapFile);
    assert.equal(baselineIds[stableKey], splitId);

    const normativeStatement = {
      en: "Permit this split-only synthetic review scenario.",
      ja: "この分割ルールだけの合成テスト条件では許可する。",
    };
    const normativeConditions = ["Only the synthetic normative-review condition applies."];
    normativeReview.overrides[splitId] = {
      title: "Synthetic split normative review",
      statement: normativeStatement,
      normative_level: "MAY", polarity: "permit", severity: "info",
      confidence: "high", review_required: false,
      conditions: normativeConditions,
      exceptions: ["Synthetic normative exception."],
      review_note: "Fixture-only override: exercise the actual additional_rules regeneration path.",
    };
    writeFixtureJson(fixture, normativeReviewFile, normativeReview);

    const normativeRules = extract(fixture);
    const normativeSplit = selectedRule(normativeRules, splitId);
    assert.deepEqual(normativeSplit.statement, normativeStatement);
    assert.deepEqual(normativeSplit.conditions, normativeConditions);
    assert.equal(normativeSplit.normative_level, "MAY");
    assert.equal(normativeSplit.polarity, "permit");
    assert.equal(normativeSplit.severity, "info");
    assert.deepEqual(selectedRule(normativeRules, baseId), base, "split override must not mutate its base");

    const reviewedStatement = {
      en: "Apply this independently source-reviewed split scenario.",
      ja: "独立した出典レビューを受けた分割ルールのテスト条件を適用する。",
    };
    const reviewedConditions = ["Only this split's source-reviewed condition applies."];
    const reviewedPriority: Rule["priority_rank"] = base.priority_rank === 3 ? 2 : 3;
    const batchScope: Rule["scope"] = {
      portability: "technology-specific", platforms: ["ios", "ipados"],
      devices: ["iphone", "ipad"], components: [], modalities: [],
    };
    const individualScope: Rule["scope"] = {
      ...batchScope, platforms: ["ios"], devices: ["iphone"],
    };
    sourceReview.batches.push({
      id: "synthetic-split-scope", rule_ids: [splitId],
      pages: [{ url: page.canonical_url, source_hash: page.source_hash }],
      scope: batchScope, confidence: "high", review_required: false,
      review_note: "Fixture-only batch scope conflicts with the narrower individual scope.",
    });
    sourceReview.rules[splitId] = {
      source: {
        source_hash: split.source.source_hash,
        source_sentence_hash: split.source.source_sentence_hash,
        section_path: split.source.section_path,
      },
      title: "Synthetic split source review",
      statement: reviewedStatement,
      conditions: reviewedConditions,
      exceptions: [],
      scope: individualScope,
      priority_rank: reviewedPriority,
      confidence: "high", review_required: false,
      review_note: "Fixture-only source-bound override for the split, not its shared-source base.",
    };
    writeFixtureJson(fixture, sourceReviewFile, sourceReview);

    const reviewedRules = extract(fixture);
    const reviewedSplit = selectedRule(reviewedRules, splitId);
    assert.deepEqual(reviewedSplit.statement, reviewedStatement, "source review must run after normative review");
    assert.equal(reviewedSplit.title, "Synthetic split source review");
    assert.deepEqual(reviewedSplit.conditions, reviewedConditions);
    assert.deepEqual(reviewedSplit.exceptions, [], "an empty reviewed exception list must clear the prior one");
    assert.equal(reviewedSplit.priority_rank, reviewedPriority);
    assert.notEqual(reviewedSplit.priority_rank, base.priority_rank, "split priority must not be inherited from its base");
    assert.deepEqual(reviewedSplit.scope, individualScope, "the individual split scope must override its batch and base");
    assert.equal(reviewedSplit.normative_level, "MAY", "fields absent from source review must retain normative review");
    assert.equal(reviewedSplit.source.evidence_paraphrase, reviewedStatement.en);
    assert.ok(reviewedSplit.checks.manual.some((check) => check.includes(reviewedStatement.en)));
    if (split.apple_native_rule) assert.equal(reviewedSplit.apple_native_rule, reviewedStatement.en);
    assert.equal(reviewedSplit.source.source_hash, split.source.source_hash);
    assert.equal(reviewedSplit.source.source_sentence_hash, split.source.source_sentence_hash);
    assert.deepEqual(reviewedSplit.source.section_path, split.source.section_path);
    assert.deepEqual(selectedRule(reviewedRules, baseId), base, "source review must affect only the split ID");
    assert.equal(reviewedRules.length, baseline.length, "reviewing a split must not create another rule");
    assert.deepEqual(readFixtureJson<Record<string, string>>(fixture, idMapFile), baselineIds, "all stable aliases must survive");

    delete (sourceReview.rules[splitId] as { scope?: Rule["scope"] }).scope;
    writeFixtureJson(fixture, sourceReviewFile, sourceReview);
    const batchScopedRules = extract(fixture);
    assert.deepEqual(selectedRule(batchScopedRules, splitId).scope, batchScope, "batch scope applies when the individual scope is absent");
    assert.deepEqual(selectedRule(batchScopedRules, baseId), base, "a split-only batch must not change its base");
    assert.deepEqual(readFixtureJson<Record<string, string>>(fixture, idMapFile), baselineIds);

    for (const [path, original] of originals) {
      assert.equal(readFileSync(join(repository, path)).equals(original), true, `isolated extraction must not write repository ${path}`);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
