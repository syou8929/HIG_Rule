import { readdir, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import config from "../src/config/hig.json" with { type: "json" };
import { launchBrowser, openRenderedPage } from "../src/lib/browser.js";
import type { Inventory, SourcePage } from "../src/lib/types.js";
import { normalizeUrl, now, readJson, sha256, truncateWords, wordCount, writeJson } from "../src/lib/util.js";

const inventoryPath = resolve("src/sources/apple-hig/inventory.json");
const pagesDir = resolve("src/sources/apple-hig/pages");
const inventory = await readJson<Inventory>(inventoryPath);
const browser = await launchBrowser();
const context = await browser.newContext({ locale: "en-US" });

const DEFAULT_APPLE_PLATFORMS = ["ios", "ipados", "macos", "tvos", "visionos", "watchos"];

function inferPlatforms(supportedPlatforms: string[], sectionPaths: string[][], slug: string): string[] {
  const designedFor = slug.match(/^designing-for-(ios|ipados|macos|tvos|visionos|watchos)$/)?.[1];
  if (designedFor) return [designedFor];

  const result = new Set(supportedPlatforms);
  if (slug === "carplay" || sectionPaths.some((path) => path.some((part) => /\bcarplay\b/i.test(part)))) {
    result.add("carplay");
  }
  return result.size ? Array.from(result) : DEFAULT_APPLE_PLATFORMS;
}

async function ingest(record: Inventory["pages"][number]): Promise<void> {
  if (record.status === "blocked") return;
  const page = await context.newPage();
  try {
    await openRenderedPage(page, record.url);
    const data = await page.evaluate(
      ({ root }) => {
        const main = document.querySelector("main");
        if (!main) throw new Error("Rendered page has no main element");
        const mainText = (main.textContent || "").replace(/\s+/g, " ").trim();
        const title = (main.querySelector("h1")?.textContent || "").replace(/\s+/g, " ").trim()
          || document.title.replace(/ \| Apple.*$/, "").replace(/\s+/g, " ").trim();
        const sectionStack: string[] = [];
        const sections: string[][] = [];
        const candidates: Array<{ fullText: string; sectionPath: string[]; fragment?: string }> = [];
        const numericTableSections: string[][] = [];
        const nodes = Array.from(main.querySelectorAll(
          "h2, h3, h4, p > strong:first-child, li > strong:first-child, li > p:first-child:not(:has(> strong:first-child)), aside p, table",
        ));
        for (const node of nodes) {
          const value = (node.textContent || "").replace(/\s+/g, " ").trim();
          if (!value) continue;
          if (/^H[234]$/.test(node.tagName)) {
            const level = Number(node.tagName.slice(1)) - 2;
            sectionStack.splice(level);
            sectionStack[level] = value;
            const sectionPath = [title, ...sectionStack.filter(Boolean)];
            sections.push(sectionPath);
            if (level >= 1 && value.length <= 260) candidates.push({ fullText: value, sectionPath });
          } else if (node.tagName === "TABLE") {
            const sectionPath = [title, ...sectionStack.filter(Boolean)];
            if (/\d/.test(value) && !sectionPath.some((part) => /^(change log|resources)$/i.test(part))) {
              numericTableSections.push(sectionPath);
            }
          } else if (value.length <= 260) {
            const sectionPath = [title, ...sectionStack.filter(Boolean)];
            candidates.push({ fullText: value, sectionPath });
            const paragraph = (node.closest("p, li, aside")?.textContent || value).replace(/\s+/g, " ").trim();
            const sentences = paragraph.split(/(?<=[.!?])\s+/);
            for (const sentence of sentences) {
              const direct = sentence.replace(/^(?:also|in particular),\s*/i, "").trim();
              if (/^(?:always|be sure to|do not|don['’]t|make sure|never)\b/i.test(direct)) {
                candidates.push({ fullText: paragraph, sectionPath, fragment: direct });
              }
              if (!/^if you must\b/i.test(direct)) {
                for (const match of direct.matchAll(/\byou must(?: not)?\b[^.!?]*(?=[.!?]|$)/gi)) {
                  const explicit = (match[0] || "").trim();
                  if (explicit) candidates.push({ fullText: paragraph, sectionPath, fragment: `${explicit[0]?.toUpperCase()}${explicit.slice(1)}` });
                }
              }
            }
          }
        }
        const related = Array.from(main.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .map((anchor) => {
            const url = new URL(anchor.href, location.href);
            url.search = "";
            url.hash = "";
            url.pathname = url.pathname.replace(/\/$/, "");
            return url.toString();
          });
        const locationValue = new URL(location.href);
        locationValue.search = "";
        locationValue.hash = "";
        locationValue.pathname = locationValue.pathname.replace(/\/$/, "");
        const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
        const canonicalValue = new URL(canonical || location.href, location.href);
        canonicalValue.search = "";
        canonicalValue.hash = "";
        canonicalValue.pathname = canonicalValue.pathname.replace(/\/$/, "");
        const supportedPlatforms = Array.from(document.querySelectorAll(".supported-platforms .platform-list > .active .platform-icon"))
          .flatMap((element) => Array.from(element.classList))
          .map((className) => className.match(/^(ios|ipados|macos|tvos|visionos|watchos)-icon$/)?.[1])
          .filter((platform): platform is string => Boolean(platform));
        return {
          title,
          mainText,
          canonicalUrl: canonicalValue.toString(),
          sections,
          candidates,
          numericTableSections,
          supportedPlatforms: Array.from(new Set(supportedPlatforms)),
          related: Array.from(new Set(related.filter((url) => url !== locationValue.toString() && (url === root || url.startsWith(`${root}/`))))),
        };
      },
      { root: config.sourceRoot },
    );
    const unique = new Map<string, SourcePage["guidance_candidates"][number]>();
    for (const candidate of data.candidates) {
      const fragments = [candidate.fragment ?? candidate.fullText];
      for (const fragment of fragments) {
        const shortText = truncateWords(fragment.replace(/\s*[.:;]+$/, ""), 19);
        if (wordCount(shortText) < 2) continue;
        const key = `${candidate.sectionPath.join("/")}::${shortText.toLowerCase()}`;
        unique.set(key, {
          text: shortText,
          section_path: candidate.sectionPath,
          source_sentence_hash: sha256(candidate.fullText),
          word_count: wordCount(shortText),
        });
      }
    }
    const usedSections = new Set(Array.from(unique.values()).map((candidate) => candidate.section_path.join("/")));
    const referenceNotes = data.sections
      .filter((path) => !usedSections.has(path.join("/")))
      .map((sectionPath) => ({ section_path: sectionPath, note: "Section recorded for human review; no short atomic guidance lead was detected." }));
    for (const sectionPath of data.numericTableSections) {
      const note = "Structured numeric table detected; preserve its platform and context conditions during human source review.";
      if (!referenceNotes.some((item) => item.note === note && item.section_path.join("/") === sectionPath.join("/"))) {
        referenceNotes.push({ section_path: sectionPath, note });
      }
    }
    const sourcePage: SourcePage = {
      schema_version: "1.0.0",
      url: record.url,
      canonical_url: normalizeUrl(data.canonicalUrl, config.sourceRoot) || record.url,
      slug: record.slug,
      title: data.title,
      category: record.category,
      page_kind: record.page_kind,
      platforms: inferPlatforms(data.supportedPlatforms, data.sections, record.slug),
      retrieved_at: now(),
      source_hash: sha256(data.mainText),
      summary: {
        en: `${data.title} organizes Apple design guidance across ${Math.max(data.sections.length, 1)} documented section path${data.sections.length === 1 ? "" : "s"}.`,
        ja: `${data.title}に関するAppleの設計ガイダンスを、${Math.max(data.sections.length, 1)}件のセクション階層で整理した記録です。`,
      },
      section_paths: data.sections.length ? data.sections : [[data.title, "Overview"]],
      guidance_candidates: Array.from(unique.values()),
      reference_notes: referenceNotes,
      related_hig_urls: data.related,
    };
    await writeJson(resolve(pagesDir, `${record.slug}.json`), sourcePage);
    record.canonical_url = sourcePage.canonical_url;
    record.title = sourcePage.title;
    record.retrieved_at = sourcePage.retrieved_at;
    record.source_hash = sourcePage.source_hash;
    record.section_count = sourcePage.section_paths.length;
    record.candidate_count = sourcePage.guidance_candidates.length;
    record.status = "parsed";
    record.status_history.push({ status: "parsed", at: now() });
    record.error = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record.status = "blocked";
    record.status_history.push({ status: "blocked", at: now(), reason: message });
    record.error = message;
  } finally {
    await page.close();
  }
}

const queue = inventory.pages.slice();
const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
  while (queue.length) {
    const record = queue.shift();
    if (record) await ingest(record);
  }
});
await Promise.all(workers);

const bestByCanonical = new Map<string, Inventory["pages"][number]>();
for (const record of inventory.pages) {
  const existing = bestByCanonical.get(record.canonical_url);
  if (!existing) {
    bestByCanonical.set(record.canonical_url, record);
    continue;
  }
  const existingScore = (existing.category === "unclassified" ? 100 : 0) + existing.url.length;
  const candidateScore = (record.category === "unclassified" ? 100 : 0) + record.url.length;
  if (candidateScore < existingScore) bestByCanonical.set(record.canonical_url, record);
}
const deduplicated = Array.from(bestByCanonical.values()).sort((a, b) => a.url.localeCompare(b.url));
const duplicateCount = inventory.pages.length - deduplicated.length;
for (const record of deduplicated.filter((item) => inventory.pages.filter((candidate) => candidate.canonical_url === item.canonical_url).length > 1)) {
  await ingest(record);
}
inventory.pages = deduplicated;

const expectedFiles = new Set(inventory.pages.map((record) => `${record.slug}.json`));
for (const entry of await readdir(pagesDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".json") && !expectedFiles.has(basename(entry.name))) {
    await unlink(resolve(pagesDir, entry.name));
  }
}
await context.close();
await browser.close();
inventory.generated_at = now();
await writeJson(inventoryPath, inventory);
console.log(`Parsed ${inventory.pages.filter((page) => page.status === "parsed").length} canonical pages; ${inventory.pages.filter((page) => page.status === "blocked").length} blocked; ${duplicateCount} aliases normalized.`);
