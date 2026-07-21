import { resolve } from "node:path";
import { loadRules } from "../src/lib/store.js";
import type { RuleSnapshot } from "../src/lib/rule-diff.js";
import { now, writeJson } from "../src/lib/util.js";

const rules = (await loadRules()).map<RuleSnapshot>((rule) => ({
  id: rule.id,
  title: rule.title,
  normative_level: rule.normative_level,
  statement: rule.statement,
  status: rule.status,
  source: {
    url: rule.source.url,
    section_path: rule.source.section_path,
    source_sentence_hash: rule.source.source_sentence_hash,
  },
}));

await writeJson(resolve("dist/reports/.rule-update-baseline.json"), { generated_at: now(), rules });
console.log(`Snapshotted ${rules.length} active rules for post-sync comparison.`);
