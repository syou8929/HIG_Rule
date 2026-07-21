import type { Rule } from "./types.js";
import { sha256 } from "./util.js";

export function normalizeRuleStatement(statement: string): string {
  return statement.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function duplicateGroupKey(ruleIds: string[]): string {
  return [...ruleIds].sort().join("\n");
}

export function findExactDuplicateGroups(rules: Rule[]): string[][] {
  const normalizedStatements = new Map<string, string[]>();
  for (const rule of rules) {
    const normalized = normalizeRuleStatement(rule.statement.en);
    const matches = normalizedStatements.get(normalized) ?? [];
    matches.push(rule.id);
    normalizedStatements.set(normalized, matches);
  }
  return Array.from(normalizedStatements.values())
    .filter((matches) => matches.length > 1)
    .map((matches) => matches.sort());
}

export function duplicateSourceTraceHash(rules: Rule[]): string {
  const trace = [...rules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((rule) => [
      rule.id,
      rule.source.url,
      rule.source.section_path,
      rule.source.source_hash,
      rule.source.source_sentence_hash,
    ]);
  return sha256(JSON.stringify(trace));
}
