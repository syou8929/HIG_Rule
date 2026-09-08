import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isActionable, ruleKey } from "../src/lib/rules.js";
import type { Rule, SourcePage } from "../src/lib/types.js";
import { slugify } from "../src/lib/util.js";

interface AdditionDecision {
  id: string;
  key: string;
  stable_id_key: string;
  candidate_index: number;
  source_row_index: number;
  source: Pick<Rule["source"], "url" | "source_hash" | "source_sentence_hash" | "section_path">;
  fields: Pick<Rule, "normative_level" | "scope" | "priority_rank">;
}

interface AdditionAudit {
  added_rule_ids: string[];
  added_strict_rule_ids: string[];
  removed_rule_ids: string[];
  existing_normative_strength_changes: unknown[];
  decisions: AdditionDecision[];
  source_pages: Array<{ slug: string; url: string; source_hash: string; evidence: string; added_rule_ids: string[] }>;
}

interface RowEvidence {
  index: number;
  kind: string;
  section_path: string[];
  source_sentence_hash: string;
}

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8")) as T;
}

async function loadFixture() {
  const audit = await json<AdditionAudit>("docs/audits/2026-09-08/coverage-additions-review.json");
  const pages = await Promise.all(audit.source_pages.map(async (entry) => {
    const page = await json<SourcePage>(`src/sources/apple-hig/pages/${entry.slug}.json`);
    const rules = await json<Rule[]>(`src/rules/${page.category}/${entry.slug}.json`);
    const evidence = await json<{ source_hash: string; rows: RowEvidence[] }>(`docs/audits/2026-09-08/${entry.evidence}`);
    return { entry, page, rules, evidence };
  }));
  const byId = new Map(pages.flatMap(({ rules }) => rules.map((rule) => [rule.id, rule] as const)));
  const decisions = new Map(audit.decisions.map((decision) => [decision.key, decision]));
  const idMap = await json<Record<string, string>>("src/config/rule-id-map.json");
  function decision(key: string): AdditionDecision {
    const result = decisions.get(key);
    assert.ok(result, `missing coverage decision: ${key}`);
    return result;
  }
  function rule(key: string): Rule {
    const result = byId.get(decision(key).id);
    assert.ok(result, `missing canonical addition: ${key}`);
    return result;
  }
  return { audit, pages, byId, idMap, decision, rule };
}

// Only these three reviewed pages are loaded; the suite does not fetch sources,
// run extraction, or treat a passing regression check as source-freshness proof.
let fixturePromise: ReturnType<typeof loadFixture> | undefined;
const fixture = () => fixturePromise ??= loadFixture();
const context = (rule: Rule) => rule.conditions.join(" ");

test("coverage additions retain 35 distinct active IDs without replacing earlier rules", async () => {
  const { audit, pages, byId } = await fixture();
  assert.equal(audit.added_rule_ids.length, 35);
  assert.equal(new Set(audit.added_rule_ids).size, 35);
  assert.equal(new Set(audit.decisions.map((entry) => entry.key)).size, 35);
  assert.deepEqual([...audit.decisions.map((entry) => entry.id)].sort(), [...audit.added_rule_ids].sort());
  assert.deepEqual(audit.removed_rule_ids, []);
  assert.deepEqual(audit.existing_normative_strength_changes, []);
  assert.deepEqual(Object.fromEntries(pages.map(({ entry }) => [entry.slug, entry.added_rule_ids.length])), {
    "apple-pay": 32, "tab-bars": 1, "app-icons": 2,
  });
  for (const id of audit.added_rule_ids) {
    const rule = byId.get(id);
    assert.ok(rule, id);
    assert.equal(rule.status, "active", id);
    assert.equal(rule.confidence, "high", id);
    assert.equal(rule.review_required, false, id);
  }
});

test("every coverage addition binds to its reviewed DOM row and actionable source candidate", async () => {
  const { audit, pages, byId } = await fixture();
  for (const decision of audit.decisions) {
    const target = pages.find(({ page }) => page.canonical_url === decision.source.url);
    assert.ok(target, decision.key);
    const { page, evidence } = target;
    const candidate = page.guidance_candidates[decision.candidate_index];
    const row = evidence.rows.find((entry) => entry.index === decision.source_row_index);
    const rule = byId.get(decision.id)!;
    assert.ok(candidate && row, decision.id);
    assert.equal(isActionable(candidate), true, decision.id);
    assert.doesNotMatch(row.kind, /^h[234]$/, decision.id);
    for (const source of [candidate, row, rule.source]) {
      assert.equal(source.source_sentence_hash, decision.source.source_sentence_hash, decision.id);
      assert.deepEqual(source.section_path, decision.source.section_path, decision.id);
    }
    assert.equal(rule.source.url, page.canonical_url, decision.id);
    assert.equal(rule.source.source_hash, page.source_hash, decision.id);
    assert.equal(page.source_hash, evidence.source_hash, decision.id);
    assert.equal(page.source_hash, decision.source.source_hash, decision.id);
    assert.equal(rule.normative_level, decision.fields.normative_level, decision.id);
    assert.deepEqual(rule.scope, decision.fields.scope, decision.id);
  }
});

test("source-sharing additions have distinct stable aliases and earlier Apple Pay aliases survive", async () => {
  const { audit, pages, idMap } = await fixture();
  for (const { page } of pages) {
    const counts = new Map<string, number>();
    for (const [index, candidate] of page.guidance_candidates.entries()) {
      if (!isActionable(candidate)) continue;
      const base = ruleKey(page, candidate);
      const ordinal = counts.get(base) ?? 0;
      counts.set(base, ordinal + 1);
      const sectionKey = `${base}#${candidate.section_path.map(slugify).join("/")}`;
      const expectedKey = ordinal === 0 ? base : ordinal === 1 ? sectionKey : `${sectionKey}#${slugify(candidate.text)}`;
      const addition = audit.decisions.find((entry) => entry.source.url === page.canonical_url && entry.candidate_index === index);
      if (!addition) continue;
      assert.equal(addition.stable_id_key, expectedKey, addition.id);
      assert.equal(idMap[expectedKey], addition.id, addition.id);
    }
  }
  assert.equal(new Set(audit.decisions.map((entry) => entry.stable_id_key)).size, 35);
  const oldAliases: Record<string, string> = {
    "77f1b74951612bbf3177b985b85acefda2ef0aee69c383a6c0410351aac24800": "0037",
    "6b866f82bd185f6990b158b56d70ae90c58ada6b158472bedb0903ae63af0a57": "0038",
    "b9349ca471325133daf0516b2843515b82e93989c1558845aed66c6e12ed5f21": "0039",
    "4b4d6122f66e02e45439290185763294106165a6649da3d038706900a0f46dd4": "0040",
    "e62defeaccc483188c31e23d76010e61bc12c36551c85d397195c17f2bd5fd2c": "0041",
    "94db3c1dd76a7a34bc5c2f7bd8f5723710e208820c28c28a531e5e30a9111e97": "0042",
    "e6736e42c15c5c3c0b1d3568b291c8fe5dfbbcd0ab071d2f9d03ad82cbaf1d56": "0043",
  };
  for (const [hash, suffix] of Object.entries(oldAliases)) {
    assert.equal(idMap[`https://developer.apple.com/design/human-interface-guidelines/apple-pay#${hash}`], `HIG-TECHNOLOGIES-APPLE-PAY-${suffix}`);
  }
});

test("single-item entry, purchase boundary, and post-purchase cart cleanup remain atomic", async () => {
  const { rule, decision } = await fixture();
  const keys = ["single-item-button", "single-item-purchase-boundary", "single-item-cart-reconciliation"];
  const [entry, boundary, cleanup] = keys.map(rule) as [Rule, Rule, Rule];
  assert.equal(new Set(keys.map((key) => decision(key).id)).size, 3);
  assert.equal(new Set(keys.map((key) => decision(key).stable_id_key)).size, 3);
  assert.equal(new Set(keys.map((key) => rule(key).source.source_sentence_hash)).size, 1);
  assert.deepEqual([entry.normative_level, boundary.normative_level, cleanup.normative_level], ["MAY", "MUST", "SHOULD"]);
  assert.match(entry.statement.en, /consider/i);
  assert.doesNotMatch(entry.statement.en, /remove/i);
  assert.match(boundary.statement.en, /only.*individual item.*exclude.*cart items/i);
  assert.doesNotMatch(boundary.statement.en, /remove/i);
  assert.match(cleanup.statement.en, /after.*purchase completes.*remove.*purchased item.*if.*already/i);
  assert.match(context(cleanup), /do not remove unrelated items/i);
});

test("conditional purchase guidance retains alternatives and limits its prerequisites", async () => {
  const { rule } = await fixture();
  const presentation = rule("payment-option-presentation");
  assert.equal(presentation.normative_level, "MAY");
  assert.match(presentation.statement.en, /first, larger, or/i);
  assert.match(context(presentation), /do not require every treatment/i);
  assert.match(rule("optional-data-outside-sheet").statement.en, /before checkout or after purchase/i);
  const authorization = rule("accurate-preauthorization");
  assert.equal(authorization.normative_level, "MUST");
  assert.match(authorization.statement.en, /^When preauthorizing a specific amount/i);
  assert.match(context(authorization), /not to every transaction/i);
  const change = rule("subscription_change_payment_sheet");
  assert.equal(change.normative_level, "SHOULD");
  assert.match(change.statement.en, /only when.*adds fees/i);
  assert.match(context(change), /decreases or remains unchanged/i);
});

test("iOS accessory minimization remains MAY and restores the bar through either action", async () => {
  const { rule } = await fixture();
  const minimization = rule("tab-bars-ios-accessory-minimization");
  assert.equal(minimization.normative_level, "MAY");
  assert.deepEqual(minimization.scope.platforms, ["ios"]);
  assert.deepEqual(minimization.scope.devices, ["iphone"]);
  assert.match(minimization.statement.en, /attached accessory.*consider minimizing.*downward scrolling/i);
  assert.match(context(minimization), /tapping a tab or scrolling to the top/i);
  assert.doesNotMatch(minimization.statement.en, /must|always|required/i);
});

test("alternate-icon obligations keep their distinct appearance and review scopes", async () => {
  const { rule, decision } = await fixture();
  const variants = rule("app-icons-alternate-appearance-variants");
  const review = rule("app-icons-alternate-variant-review-compliance");
  assert.equal(variants.normative_level, "MUST");
  assert.equal(review.normative_level, "MUST");
  assert.deepEqual(variants.scope.platforms, ["ios", "ipados"]);
  assert.match(variants.statement.en, /each alternate.*own dark, clear, and tinted/i);
  assert.match(context(variants), /does not mandate drawing every variant manually/i);
  assert.deepEqual(review.scope.platforms, ["ios", "ipados", "macos", "tvos", "visionos"]);
  assert.match(context(review), /Appearance variants apply on iOS, iPadOS, and macOS/i);
  assert.match(context(review), /compatible apps running in visionOS/i);
  assert.equal(review.scope.platforms.includes("watchos"), false);
  assert.equal(variants.source.source_sentence_hash, review.source.source_sentence_hash);
  assert.notEqual(decision("app-icons-alternate-appearance-variants").stable_id_key, decision("app-icons-alternate-variant-review-compliance").stable_id_key);
});

test("only the five independently reviewed explicit additions have strict normative levels", async () => {
  const { audit, rule } = await fixture();
  const strict = [
    ["single-item-purchase-boundary", "MUST"],
    ["accurate-preauthorization", "MUST"],
    ["apple_pay_name_form", "MUST_NOT"],
    ["app-icons-alternate-appearance-variants", "MUST"],
    ["app-icons-alternate-variant-review-compliance", "MUST"],
  ] as const;
  assert.deepEqual([...audit.added_strict_rule_ids].sort(), strict.map(([key]) => rule(key).id).sort());
  for (const [key, level] of strict) {
    assert.equal(rule(key).normative_level, level, key);
    assert.equal(rule(key).review_required, false, key);
  }
  assert.equal(rule("payment_button_corner_radius").normative_level, "MAY");
  assert.match(context(rule("payment_button_corner_radius")), /does not need changing/i);
  assert.equal(rule("apple_pay_checkout_registration_symbol").normative_level, "AVOID");
});

test("numeric targets, donation choice, and trademark conditions retain their qualifiers", async () => {
  const { rule } = await fixture();
  assert.match(context(rule("payment_validation_error_copy")), /Aim for 128 characters or fewer/i);
  assert.equal(rule("payment_validation_error_copy").normative_level, "SHOULD");
  const websiteIcon = rule("website-payment-icon").statement.en;
  assert.match(websiteIcon, /60×60 pt/);
  assert.match(websiteIcon, /120×120 px for 2×/);
  assert.match(websiteIcon, /180×180 px for 3×/);
  assert.match(context(rule("predefined_donation_amounts")), /examples, not required/i);
  assert.match(rule("custom_donation_amount").statement.en, /Other Amount.*alongside predefined/i);
  assert.match(rule("apple_pay_name_form").statement.en, /Never.*pluralize.*possessive/i);
  const registration = rule("apple_pay_us_registration_symbol");
  assert.match(registration.statement.en, /United States.*first body-text occurrence/i);
  assert.equal(registration.normative_level, "SHOULD");
  const capitalization = rule("apple_pay_capitalization");
  assert.match(capitalization.exceptions.join(" "), /only when necessary.*established typographic style/i);
  assert.equal(capitalization.priority_rank, 1);
});
