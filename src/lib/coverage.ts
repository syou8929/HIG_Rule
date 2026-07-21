import type { Inventory, Rule } from "./types.js";
import { now } from "./util.js";

function countBy(values: string[]): Record<string, number> {
  return Object.fromEntries(Array.from(new Set(values)).sort().map((value) => [value, values.filter((candidate) => candidate === value).length]));
}

export function makeCoverage(inventory: Inventory, rules: Rule[]) {
  const active = rules.filter((rule) => rule.status === "active");
  return {
    schema_version: "1.0.0" as const,
    generated_at: now(),
    totals: {
      discovered: inventory.pages.length,
      fetched: inventory.pages.filter((page) => page.retrieved_at).length,
      failed: inventory.pages.filter((page) => page.status === "blocked").length,
      classified: inventory.pages.filter((page) => page.category !== "unclassified").length,
      rules_extracted_pages: inventory.pages.filter((page) => page.rule_count > 0).length,
      rules: active.length,
    },
    by_category: countBy(active.map((rule) => rule.category)),
    by_platform: countBy(active.flatMap((rule) => rule.scope.platforms)),
    by_normative_level: countBy(active.map((rule) => rule.normative_level)),
    by_testability: countBy(active.map((rule) => rule.testability)),
    blocked_pages: inventory.pages.filter((page) => page.status === "blocked").map((page) => page.url).sort(),
    blocked_page_details: inventory.pages
      .filter((page) => page.status === "blocked")
      .map((page) => ({ url: page.url, reason: page.error ?? "No blocker reason was recorded." }))
      .sort((a, b) => a.url.localeCompare(b.url)),
    pages_without_rules: inventory.pages.filter((page) => page.rule_count === 0).map((page) => page.url).sort(),
    low_confidence_rules: active.filter((rule) => rule.confidence === "low").map((rule) => rule.id).sort(),
    review_required_rules: active.filter((rule) => rule.review_required).map((rule) => rule.id).sort(),
  };
}
