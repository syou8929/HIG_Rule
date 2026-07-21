import { loadRules } from "../src/lib/store.js";

const args = process.argv.slice(2);
const valueFor = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const category = valueFor("--category");
const platform = valueFor("--platform");
const component = valueFor("--component");
const modality = valueFor("--modality");
const normative = valueFor("--normative");
const confidence = valueFor("--confidence");
const task = valueFor("--task");
const limit = Number(valueFor("--limit") ?? 100);
const format = valueFor("--format") ?? "json";
const terms = (task ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const rules = (await loadRules()).filter((rule) => {
  if (category && rule.category !== category) return false;
  if (platform && !rule.scope.platforms.includes(platform)) return false;
  if (component && !rule.scope.components.includes(component) && rule.topic !== component) return false;
  if (modality && !rule.scope.modalities.includes(modality)) return false;
  if (normative && rule.normative_level !== normative) return false;
  if (confidence && rule.confidence !== confidence) return false;
  if (terms.length) {
    const haystack = `${rule.title} ${rule.topic} ${rule.subtopic} ${rule.statement.en} ${rule.tags.join(" ")}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  return true;
}).slice(0, Number.isFinite(limit) ? Math.max(1, limit) : 100);

if (format === "markdown") {
  console.log(rules.map((rule) => `- ${rule.id} · ${rule.normative_level} — ${rule.statement.en} (${rule.source.url})`).join("\n"));
} else {
  console.log(JSON.stringify(rules, null, 2));
}
