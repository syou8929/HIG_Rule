import type { NormativeLevel, Rule } from "./types.js";

export type RuleSnapshot = Pick<Rule, "id" | "title" | "normative_level" | "statement" | "status"> & {
  source: Pick<Rule["source"], "url" | "section_path" | "source_sentence_hash">;
};

const LEAD_WORDS = new Set([
  "adopt", "always", "apply", "avoid", "choose", "consider", "do", "don", "ensure", "favor", "generally",
  "keep", "make", "must", "never", "offer", "prefer", "provide", "show", "support", "use", "verify", "when",
]);

function tokens(title: string): Set<string> {
  return new Set(title.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !LEAD_WORDS.has(word)));
}

function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  return [...a].filter((word) => b.has(word)).length / union.size;
}

export interface NormativeStrengthChange {
  previous_id: string;
  current_id: string;
  from: NormativeLevel;
  to: NormativeLevel;
  source_url: string;
  section_path: string[];
}

export function diffRuleSnapshots(previous: RuleSnapshot[], current: RuleSnapshot[]) {
  const previousActive = previous.filter((rule) => rule.status === "active");
  const currentActive = current.filter((rule) => rule.status === "active");
  const previousById = new Map(previousActive.map((rule) => [rule.id, rule]));
  const currentById = new Map(currentActive.map((rule) => [rule.id, rule]));
  const added = currentActive.filter((rule) => !previousById.has(rule.id));
  const removed = previousActive.filter((rule) => !currentById.has(rule.id));

  const normativeStrengthChanges: NormativeStrengthChange[] = [];
  const statementChanges: Array<{ id: string; source_url: string; section_path: string[] }> = [];
  for (const rule of currentActive) {
    const old = previousById.get(rule.id);
    if (!old) continue;
    if (old.normative_level !== rule.normative_level) {
      normativeStrengthChanges.push({
        previous_id: old.id,
        current_id: rule.id,
        from: old.normative_level,
        to: rule.normative_level,
        source_url: rule.source.url,
        section_path: rule.source.section_path,
      });
    }
    if (old.statement.en !== rule.statement.en || old.statement.ja !== rule.statement.ja) {
      statementChanges.push({ id: rule.id, source_url: rule.source.url, section_path: rule.source.section_path });
    }
  }

  const unmatchedRemoved = new Set(removed.map((rule) => rule.id));
  const replacements: Array<{ previous_id: string; current_id: string; similarity: number; source_url: string; section_path: string[] }> = [];
  for (const rule of added) {
    const candidates = removed
      .filter((old) => unmatchedRemoved.has(old.id)
        && old.source.url === rule.source.url
        && JSON.stringify(old.source.section_path) === JSON.stringify(rule.source.section_path))
      .map((old) => ({ old, score: similarity(old.title, rule.title) }))
      .sort((a, b) => b.score - a.score);
    const match = candidates[0];
    if (!match || match.score < 0.45) continue;
    unmatchedRemoved.delete(match.old.id);
    replacements.push({
      previous_id: match.old.id,
      current_id: rule.id,
      similarity: Number(match.score.toFixed(3)),
      source_url: rule.source.url,
      section_path: rule.source.section_path,
    });
    if (match.old.normative_level !== rule.normative_level) {
      normativeStrengthChanges.push({
        previous_id: match.old.id,
        current_id: rule.id,
        from: match.old.normative_level,
        to: rule.normative_level,
        source_url: rule.source.url,
        section_path: rule.source.section_path,
      });
    }
  }

  const replacedNewIds = new Set(replacements.map((item) => item.current_id));
  const reviewQueue = Array.from(new Set([
    ...added.map((rule) => rule.id),
    ...removed.map((rule) => rule.id),
    ...statementChanges.map((change) => change.id),
    ...normativeStrengthChanges.flatMap((change) => [change.previous_id, change.current_id]),
  ])).sort();

  return {
    added_rule_ids: added.filter((rule) => !replacedNewIds.has(rule.id)).map((rule) => rule.id).sort(),
    removed_or_deprecated_rule_ids: [...unmatchedRemoved].sort(),
    replacements,
    statement_changes: statementChanges,
    normative_strength_changes: normativeStrengthChanges,
    review_queue: reviewQueue,
  };
}
