import { resolve } from "node:path";
import YAML from "yaml";
import config from "../src/config/hig.json" with { type: "json" };
import { makeCoverage } from "../src/lib/coverage.js";
import { loadRules } from "../src/lib/store.js";
import type { Inventory, Rule } from "../src/lib/types.js";
import { now, readJson, sha256, writeJson, writeText } from "../src/lib/util.js";

const inventory = await readJson<Inventory>(resolve("src/sources/apple-hig/inventory.json"));
const allRules = await loadRules({ includeDeprecated: true });
const active = allRules.filter((rule) => rule.status === "active");
const coverage = makeCoverage(inventory, allRules);

const runtime = `1. Identify the target Apple platform, device, and input methods.
2. Identify the primary user task and relevant product constraints.
3. Query only the relevant rules by category, platform, component, modality, and task.
4. Review accessibility first, then privacy and explicit user intent.
5. Apply platform-specific guidance before Apple-common and universal guidance.
6. Select components and patterns that fit the platform context.
7. Review empty, loading, error, denied-permission, and offline states.
8. Check relevant settings such as Dynamic Type, VoiceOver, keyboard access, pointer input, and Reduce Motion.
9. Review interaction, hierarchy, writing, and state transitions — not only appearance.
10. Report evidence, conflicts, exceptions, unresolved questions, and rule confidence.

Do not claim authoritative HIG compliance. Report what was checked and what remains unverified.`;

const conflict = config.conflictPriority.map((item, index) => `${index + 1}. ${item}`).join("\n");
const basePrompt = `# Apple HIG rule runtime

This adapter is generated from ${active.length} active, source-traceable atomic rules. The canonical store is under \`src/rules/\`; do not hand-edit generated adapters.

## Runtime procedure

${runtime}

## Conflict priority

${conflict}

When product requirements differ from HIG guidance, explain the difference and risk instead of silently replacing the product requirement. Treat low-confidence rules as review prompts, not settled facts.

## Retrieval

Run \`npm run query -- --platform ios --category components --task review\` and add \`--component <slug>\`, \`--modality keyboard\`, \`--normative MUST\`, \`--confidence low\`, or \`--limit <n>\` as needed.`;

function rulesMarkdown(rules: Rule[]): string {
  const sections: string[] = ["# Apple HIG AI Rules", "", `Generated ${now()}. ${active.length} active rules; ${rules.filter((rule) => rule.status === "deprecated").length} deprecated rules.`, ""];
  for (const category of config.topCategories) {
    const categoryRules = rules.filter((rule) => rule.category === category);
    if (!categoryRules.length) continue;
    sections.push(`## ${category}`, "");
    let currentTopic = "";
    for (const rule of categoryRules) {
      if (rule.topic !== currentTopic) {
        currentTopic = rule.topic;
        sections.push(`### ${currentTopic}`, "");
      }
      sections.push(`- **${rule.id} · ${rule.normative_level} · ${rule.confidence}** — ${rule.statement.en} ([source](${rule.source.url}))`);
    }
    sections.push("");
  }
  return sections.join("\n");
}

function checklist(title: string, rules: Rule[]): string {
  const lines = [`# ${title}`, "", "Use this generated checklist with the source trace and confidence level; it is not a compliance certificate.", ""];
  for (const rule of rules) lines.push(`- [ ] ${rule.id} — ${rule.statement.en} (${rule.normative_level}, ${rule.confidence}; [source](${rule.source.url}))`);
  return lines.join("\n");
}

const accessibility = active.filter((rule) => ["accessibility", "voiceover", "inclusion"].includes(rule.topic) || rule.tags.includes("accessibility"));
const implementation = active.filter((rule) => ["components", "inputs", "patterns"].includes(rule.category));
const design = active.filter((rule) => ["getting-started", "foundations", "patterns", "components"].includes(rule.category));

await writeJson(resolve("dist/apple-hig-rules.json"), allRules);
await writeText(resolve("dist/apple-hig-rules.yaml"), YAML.stringify(allRules, { lineWidth: 0 }));
await writeText(resolve("dist/apple-hig-rules.md"), rulesMarkdown(allRules));
await writeText(resolve("dist/agents/system-prompt.md"), basePrompt);
await writeText(resolve("dist/agents/AGENTS.md"), `${basePrompt}\n\n## Codex repository behavior\n\nInspect project-local AGENTS.md files first. Make HIG-driven changes only within the requested scope and validate the resulting behavior.`);
await writeText(resolve("dist/agents/CLAUDE.md"), `${basePrompt}\n\n## Claude Code behavior\n\nRetrieve the smallest relevant rule subset before proposing or editing UI code.`);
await writeText(resolve("dist/agents/GEMINI.md"), `${basePrompt}\n\n## Gemini behavior\n\nCite rule IDs and source URLs for every material HIG finding.`);
await writeText(resolve("dist/agents/copilot-instructions.md"), `${basePrompt}\n\n## GitHub Copilot behavior\n\nApply these rules while generating and reviewing UI code; flag unresolved manual checks.`);
await writeText(resolve("dist/agents/apple-hig.mdc"), `---\ndescription: Apply source-traceable Apple HIG rules to UI design and implementation\nalwaysApply: false\n---\n\n${basePrompt}`);
await writeText(resolve("AGENTS.md"), `${basePrompt}\n\n## Repository maintenance contract\n\n- Treat \`src/rules/**/*.json\` as the canonical rule store and rebuild every adapter from it.\n- Use only Apple official HIG pages as primary sources.\n- Never persist full source-page prose, images, video, or design resources.\n- Keep evidence fragments below 20 words and preserve source URL, section path, retrieval time, and hashes.\n- Do not raise conditional language to MUST without explicit support; route uncertainty to review.\n- Preserve stable rule IDs through \`src/config/rule-id-map.json\`; deprecate removed rules before deletion.\n- Run \`npm run ci\` after rule, schema, generator, or adapter changes.\n- Report blocked pages and pages without rules explicitly; never infer missing source content.`);
await writeText(resolve("CLAUDE.md"), `${basePrompt}\n\n## Claude Code behavior\n\nRetrieve the smallest relevant rule subset before proposing or editing UI code.`);
await writeText(resolve("GEMINI.md"), `${basePrompt}\n\n## Gemini behavior\n\nCite rule IDs and source URLs for every material HIG finding.`);
await writeText(resolve(".github/copilot-instructions.md"), `${basePrompt}\n\n## GitHub Copilot behavior\n\nApply these rules while generating and reviewing UI code; flag unresolved manual checks.`);
await writeText(resolve(".cursor/rules/apple-hig.mdc"), `---\ndescription: Apply source-traceable Apple HIG rules to UI design and implementation\nalwaysApply: false\n---\n\n${basePrompt}`);
await writeText(resolve("dist/checklists/design-review.md"), checklist("UI design review checklist", design));
await writeText(resolve("dist/checklists/implementation-review.md"), checklist("Implementation review checklist", implementation));
await writeText(resolve("dist/checklists/accessibility-review.md"), checklist("Accessibility review checklist", accessibility));
await writeJson(resolve("src/sources/apple-hig/coverage.json"), coverage);
await writeJson(resolve("dist/reports/coverage.json"), coverage);
const list = (values: string[]) => values.length ? values.map((value) => `- ${value}`).join("\n") : "None.";
await writeText(resolve("dist/reports/coverage.md"), `# Coverage report

- Discovered canonical pages: ${coverage.totals.discovered}
- Fetched pages: ${coverage.totals.fetched}
- Blocked pages: ${coverage.totals.failed}
- Classified pages: ${coverage.totals.classified}
- Pages with rules: ${coverage.totals.rules_extracted_pages}
- Active atomic rules: ${coverage.totals.rules}
- Pages without rules: ${coverage.pages_without_rules.length}
- Low-confidence rules: ${coverage.low_confidence_rules.length}
- Rules requiring human review: ${coverage.review_required_rules.length}

## Rules by category

${Object.entries(coverage.by_category).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Normative levels

${Object.entries(coverage.by_normative_level).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Rules by platform

${Object.entries(coverage.by_platform).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Rules by testability

${Object.entries(coverage.by_testability).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

## Blocked pages

${coverage.blocked_page_details.length ? coverage.blocked_page_details.map((page) => `- ${page.url} — ${page.reason}`).join("\n") : "None."}

## Pages without rules

${list(coverage.pages_without_rules)}

## Low-confidence rules

${list(coverage.low_confidence_rules)}

## Rules requiring human review

${list(coverage.review_required_rules)}
`);

const canonicalHash = sha256(JSON.stringify(allRules));
await writeJson(resolve("dist/manifest.json"), {
  schema_version: "1.0.0",
  generated_at: now(),
  canonical_rule_count: allRules.length,
  active_rule_count: active.length,
  canonical_hash: canonicalHash,
  source_inventory_hash: sha256(JSON.stringify(inventory.pages.map((page) => [page.canonical_url, page.source_hash]))),
  generated_from: ["src/rules/**/*.json", "src/sources/apple-hig/inventory.json"],
});

console.log(`Built JSON, YAML, Markdown, ${6} AI adapters, and ${3} checklists from ${active.length} active rules.`);
