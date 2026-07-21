import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import config from "../config/hig.json" with { type: "json" };
import type { Rule, SourcePage } from "./types.js";
import { readJson } from "./util.js";

export async function loadRules(options: { includeDeprecated?: boolean } = {}): Promise<Rule[]> {
  const rules: Rule[] = [];
  for (const category of config.topCategories) {
    const directory = resolve("src/rules", category);
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        rules.push(...await readJson<Rule[]>(resolve(directory, entry.name)));
      }
    } catch {
      // Empty categories are represented in coverage rather than failing the store loader.
    }
  }
  return rules
    .filter((rule) => options.includeDeprecated || rule.status === "active")
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function loadSourcePages(): Promise<SourcePage[]> {
  const directory = resolve("src/sources/apple-hig/pages");
  const pages: SourcePage[] = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.endsWith(".json")) pages.push(await readJson<SourcePage>(resolve(directory, entry.name)));
  }
  return pages;
}
