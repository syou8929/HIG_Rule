import type { Rule } from "./types.js";

const normativeRisk: Record<Rule["normative_level"], number> = {
  MUST_NOT: 1,
  MUST: 2,
  AVOID: 3,
  SHOULD: 4,
  MAY: 5,
};

export function pendingRuleReviews(rules: Rule[]): Rule[] {
  return rules
    .filter((rule) => rule.status === "active" && rule.review_required)
    .sort((a, b) =>
      a.priority_rank - b.priority_rank
      || normativeRisk[a.normative_level] - normativeRisk[b.normative_level]
      || a.category.localeCompare(b.category)
      || a.topic.localeCompare(b.topic)
      || a.id.localeCompare(b.id));
}

export function nextReviewBatch(rules: Rule[]): Rule[] {
  const pending = pendingRuleReviews(rules);
  const priority = pending[0]?.priority_rank;
  return priority === undefined ? [] : pending.filter((rule) => rule.priority_rank === priority);
}
