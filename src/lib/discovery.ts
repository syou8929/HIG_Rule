import config from "../config/hig.json" with { type: "json" };
import { launchBrowser, openRenderedPage } from "./browser.js";
import type { Category, Inventory, InventoryPage, ProcessingStatus } from "./types.js";
import { normalizeUrl, now, sha256, slugFromUrl } from "./util.js";

interface ObservedPage {
  canonicalUrl: string;
  title: string;
  mainText: string;
  sectionCount: number;
  gridLinks: string[];
  allHigLinks: string[];
}

function statusEntry(status: ProcessingStatus, reason?: string) {
  return { status, at: now(), ...(reason ? { reason } : {}) };
}

async function observe(page: import("playwright-core").Page, url: string): Promise<ObservedPage> {
  await openRenderedPage(page, url);
  return page.evaluate(
    ({ root }) => {
      const main = document.querySelector("main");
      if (!main) throw new Error("Rendered page has no main element");
      const links = Array.from(main.querySelectorAll<HTMLAnchorElement>("a[href]"));
      const gridLinks = links
        .filter((anchor) => anchor.closest(".column"))
        .map((anchor) => {
          const value = new URL(anchor.href, location.href);
          value.search = "";
          value.hash = "";
          value.pathname = value.pathname.replace(/\/$/, "");
          return value.toString();
        });
      const allHigLinks = links
        .map((anchor) => {
          const value = new URL(anchor.href, location.href);
          value.search = "";
          value.hash = "";
          value.pathname = value.pathname.replace(/\/$/, "");
          return value.toString();
        })
        .filter((href) => href === root || href.startsWith(`${root}/`));
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
      const canonicalValue = new URL(canonical || location.href, location.href);
      canonicalValue.search = "";
      canonicalValue.hash = "";
      canonicalValue.pathname = canonicalValue.pathname.replace(/\/$/, "");
      return {
        canonicalUrl: canonicalValue.toString(),
        title: main.querySelector("h1")?.textContent?.trim() || document.title.replace(/ \| Apple.*$/, ""),
        mainText: (main.textContent || "").replace(/\s+/g, " ").trim(),
        sectionCount: main.querySelectorAll("h2, h3, h4").length,
        gridLinks: Array.from(new Set(gridLinks)),
        allHigLinks: Array.from(new Set(allHigLinks)),
      };
    },
    { root: config.sourceRoot },
  );
}

function kindFor(slug: string, depth: number, sectionCount: number, gridCount: number): InventoryPage["page_kind"] {
  if (depth === 0) return "root";
  if (config.topCategories.includes(slug)) return "category";
  if (gridCount > 0 && sectionCount === 0) return "subcategory";
  if (sectionCount > 0) return "guidance";
  return "unknown";
}

export async function discoverInventory(): Promise<Inventory> {
  const browser = await launchBrowser();
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  const records = new Map<string, InventoryPage>();
  const related = new Set<string>();
  const queue: Array<{ url: string; category: Category; parent: string | null; depth: number }> = [];
  const startedAt = now();

  const visit = async (item: { url: string; category: Category; parent: string | null; depth: number }) => {
    const normalized = normalizeUrl(item.url, config.sourceRoot);
    if (!normalized || records.has(normalized)) return [] as string[];
    const slug = slugFromUrl(normalized);
    const discovered: InventoryPage = {
      url: normalized,
      canonical_url: normalized,
      slug,
      title: slug === "human-interface-guidelines" ? "Human Interface Guidelines" : slug,
      category: item.category,
      parent_url: item.parent,
      depth: item.depth,
      page_kind: "unknown",
      status: "discovered",
      status_history: [statusEntry("discovered")],
      discovered_at: startedAt,
      retrieved_at: null,
      source_hash: null,
      section_count: 0,
      candidate_count: 0,
      rule_count: 0,
      error: null,
    };
    records.set(normalized, discovered);
    try {
      const observed = await observe(page, normalized);
      discovered.canonical_url = normalizeUrl(observed.canonicalUrl, config.sourceRoot) || normalized;
      discovered.title = observed.title;
      discovered.retrieved_at = now();
      discovered.source_hash = sha256(observed.mainText);
      discovered.section_count = observed.sectionCount;
      discovered.page_kind = kindFor(slug, item.depth, observed.sectionCount, observed.gridLinks.length);
      discovered.status = "classified";
      discovered.status_history.push(statusEntry("fetched"), statusEntry("classified"));
      observed.allHigLinks.forEach((link) => related.add(link));
      return observed.gridLinks;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      discovered.status = "blocked";
      discovered.status_history.push(statusEntry("blocked", message));
      discovered.error = message;
      return [] as string[];
    }
  };

  try {
    const rootLinks = await visit({ url: config.sourceRoot, category: "getting-started", parent: null, depth: 0 });
    const rootRecord = records.get(config.sourceRoot);
    const rootUrl = rootRecord?.url ?? config.sourceRoot;
    const categoryLinks = rootLinks.filter((url) => config.topCategories.includes(slugFromUrl(url)));
    for (const category of config.topCategories) {
      const url = categoryLinks.find((candidate) => slugFromUrl(candidate) === category) ?? `${config.sourceRoot}/${category}`;
      queue.push({ url, category: category as Category, parent: rootUrl, depth: 1 });
    }

    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const children = await visit(item);
      for (const child of children) {
        if (!records.has(child)) queue.push({ url: child, category: item.category, parent: item.url, depth: item.depth + 1 });
      }
    }

    for (const url of Array.from(related).sort()) {
      if (!records.has(url)) await visit({ url, category: "unclassified", parent: config.sourceRoot, depth: 1 });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const bestByCanonical = new Map<string, InventoryPage>();
  for (const record of records.values()) {
    const existing = bestByCanonical.get(record.canonical_url);
    if (!existing) {
      bestByCanonical.set(record.canonical_url, record);
      continue;
    }
    const existingScore = (existing.category === "unclassified" ? 100 : 0) + existing.url.length;
    const candidateScore = (record.category === "unclassified" ? 100 : 0) + record.url.length;
    if (candidateScore < existingScore) bestByCanonical.set(record.canonical_url, record);
  }

  return {
    schema_version: "1.0.0",
    source_root: config.sourceRoot,
    generated_at: now(),
    discovery_method: "Rendered recursive navigation using Playwright Core and local Chrome",
    categories: config.topCategories,
    pages: Array.from(bestByCanonical.values()).sort((a, b) => a.url.localeCompare(b.url)),
  };
}
