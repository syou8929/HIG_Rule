import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { diffRuleSnapshots, type RuleSnapshot } from "../src/lib/rule-diff.js";
import { loadRules } from "../src/lib/store.js";
import { now, readJson, writeJson, writeText } from "../src/lib/util.js";

const baselinePath = resolve("dist/reports/.rule-update-baseline.json");
const baseline = await readJson<{ generated_at: string; rules: RuleSnapshot[] }>(baselinePath);
const current = (await loadRules({ includeDeprecated: true })) as RuleSnapshot[];
const changes = diffRuleSnapshots(baseline.rules, current);
const report = { schema_version: "1.0.0", generated_at: now(), baseline_generated_at: baseline.generated_at, ...changes };
const list = (values: string[]) => values.length ? values.map((value) => `- ${value}`).join("\n") : "None.";

await writeJson(resolve("dist/reports/rule-update-diff.json"), report);
await writeText(resolve("dist/reports/rule-update-diff.md"), `# HIG rule update diff

- Added rules: ${report.added_rule_ids.length}
- Removed or deprecated rules: ${report.removed_or_deprecated_rule_ids.length}
- Matched replacements: ${report.replacements.length}
- Statement changes with stable IDs: ${report.statement_changes.length}
- Normative strength changes: ${report.normative_strength_changes.length}

## Normative strength changes

${report.normative_strength_changes.length ? report.normative_strength_changes.map((change) => `- ${change.previous_id} → ${change.current_id}: ${change.from} → ${change.to} (${change.source_url})`).join("\n") : "None."}

## Added rules

${list(report.added_rule_ids)}

## Removed or deprecated rules

${list(report.removed_or_deprecated_rule_ids)}

## Review queue

${list(report.review_queue)}
`);
await unlink(baselinePath);
console.log(`Rule diff: ${report.added_rule_ids.length} added, ${report.removed_or_deprecated_rule_ids.length} removed/deprecated, ${report.normative_strength_changes.length} normative changes.`);
