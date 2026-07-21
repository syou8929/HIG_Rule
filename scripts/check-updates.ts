import { resolve } from "node:path";
import { discoverInventory } from "../src/lib/discovery.js";
import { loadRules } from "../src/lib/store.js";
import type { Inventory } from "../src/lib/types.js";
import { now, readJson, writeJson, writeText } from "../src/lib/util.js";

const previous = await readJson<Inventory>(resolve("src/sources/apple-hig/inventory.json"));
const current = await discoverInventory();
const oldByUrl = new Map(previous.pages.map((page) => [page.canonical_url, page]));
const newByUrl = new Map(current.pages.map((page) => [page.canonical_url, page]));
const added = current.pages.filter((page) => !oldByUrl.has(page.canonical_url)).map((page) => page.canonical_url).sort();
const removed = previous.pages.filter((page) => !newByUrl.has(page.canonical_url)).map((page) => page.canonical_url).sort();
const changed = current.pages.filter((page) => {
  const old = oldByUrl.get(page.canonical_url);
  return old && old.source_hash !== page.source_hash;
}).map((page) => page.canonical_url).sort();
const changedSet = new Set([...removed, ...changed]);
const affectedRules = (await loadRules()).filter((rule) => changedSet.has(rule.source.url)).map((rule) => rule.id).sort();
const blocked = current.pages.filter((page) => page.status === "blocked").map((page) => ({ url: page.url, reason: page.error }));
const report = { schema_version: "1.0.0", generated_at: now(), added, removed, changed, affected_rules: affectedRules, blocked, review_queue: [...added, ...removed, ...changed] };
await writeJson(resolve("dist/reports/update-diff.json"), report);
await writeText(resolve("dist/reports/update-diff.md"), `# HIG update diff\n\n- Added pages: ${added.length}\n- Removed pages: ${removed.length}\n- Changed pages: ${changed.length}\n- Affected active rules: ${affectedRules.length}\n- Blocked pages: ${blocked.length}\n\n## Added\n\n${added.length ? added.map((url) => `- ${url}`).join("\n") : "None."}\n\n## Removed\n\n${removed.length ? removed.map((url) => `- ${url}`).join("\n") : "None."}\n\n## Changed\n\n${changed.length ? changed.map((url) => `- ${url}`).join("\n") : "None."}\n\nUncertain changes stay in the review queue; this command does not overwrite canonical rules.`);
console.log(`Update diff: ${added.length} added, ${removed.length} removed, ${changed.length} changed, ${blocked.length} blocked.`);
