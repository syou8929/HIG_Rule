import type { Page } from "playwright-core";
import config from "../config/hig.json" with { type: "json" };
import type { GuidanceCandidate } from "./types.js";
import { normalizeUrl, sha256, truncateWords, wordCount } from "./util.js";

export type InspectionRowKind = "h2" | "h3" | "h4" | "p" | "li" | "table" | "strong" | "figcaption";

/** Raw DOM data is transient source prose. Do not log or persist this object. */
export interface SourceInspectionSnapshot {
  url: string;
  canonical_url: string | null;
  h1: string | null;
  document_title: string;
  main_text: string;
  rows: Array<{ kind: InspectionRowKind; text: string; parent_index: number | null }>;
  links: string[];
}

export interface InspectedSourceRow {
  index: number;
  kind: InspectionRowKind;
  section_path: string[];
  text: string;
  source_sentence_hash: string;
  word_count: number;
  parent_index: number | null;
  /** An equal-text ancestor is retained for hash compatibility, but is not new content. */
  redundant_with: number | null;
}

/** Contains complete source text in memory; persist only createSourceEvidence() output. */
export interface SourceInspection {
  url: string;
  canonical_url: string;
  title: string;
  retrieved_at: string;
  source_hash: string;
  main_text: string;
  section_paths: string[][];
  related_hig_urls: string[];
  rows: InspectedSourceRow[];
}

export interface SourceRowEvidence {
  index: number;
  kind: InspectionRowKind;
  section_path: string[];
  source_sentence_hash: string;
  word_count: number;
  excerpt: string;
  parent_index: number | null;
  redundant_with: number | null;
  matched_candidate_indexes: number[];
}

export interface CandidateSourceMatch {
  candidate_index: number;
  section_path: string[];
  source_sentence_hash: string;
  status: "matched" | "section-mismatch" | "hash-not-found";
  matched_row_indexes: number[];
  /** Diagnostic only: the hash occurs, but under a different exact section path. */
  other_section_row_indexes: number[];
}

export interface SourceInspectionEvidence {
  url: string;
  canonical_url: string;
  title: string;
  retrieved_at: string;
  source_hash: string;
  section_paths: string[][];
  related_hig_urls: string[];
  rows: SourceRowEvidence[];
  candidates: CandidateSourceMatch[];
  matched_candidate_count: number;
  unmatched_candidate_count: number;
  /** A source-presence match is not a semantic or normative review decision. */
  match_basis: "exact normalized-text hash and exact section path; not semantic support";
}

/** Deliberately no NFKC/case folding: ingestion hashes whitespace-normalized textContent. */
export function normalizeSourceText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Pure normalization and section tracking, separately testable without a browser. */
export function inspectSourceSnapshot(
  snapshot: SourceInspectionSnapshot,
  retrievedAt: string,
  sourceRoot = config.sourceRoot,
): SourceInspection {
  const url = normalizeUrl(snapshot.url, sourceRoot);
  if (!url) throw new Error("Inspection URL is outside the official Apple HIG source root");
  const canonical = snapshot.canonical_url ? new URL(snapshot.canonical_url, snapshot.url).toString() : url;
  const canonicalUrl = normalizeUrl(canonical, sourceRoot) ?? url;
  const title = normalizeSourceText(snapshot.h1 ?? "")
    || normalizeSourceText(snapshot.document_title.replace(/ \| Apple.*$/, ""));
  const mainText = normalizeSourceText(snapshot.main_text);
  const stack: string[] = [];
  const sectionPaths: string[][] = [];
  const rows: InspectedSourceRow[] = [];
  const originalToIndex = new Map<number, number>();
  for (const [originalIndex, row] of snapshot.rows.entries()) {
    const text = normalizeSourceText(row.text);
    if (!text) continue;
    if (row.parent_index !== null && (!Number.isInteger(row.parent_index) || row.parent_index < 0 || row.parent_index >= originalIndex)) {
      throw new Error(`Row ${originalIndex} must reference an earlier parent row`);
    }
    if (/^h[234]$/.test(row.kind)) {
      const level = Number(row.kind.slice(1)) - 2;
      stack.splice(level);
      stack[level] = text;
      sectionPaths.push([title, ...stack.filter(Boolean)]);
    }
    const sectionPath = [title, ...stack.filter(Boolean)];
    let originalParent = row.parent_index;
    // Empty DOM rows may have been removed. Keep the closest surviving ancestor.
    while (originalParent !== null && !originalToIndex.has(originalParent)) {
      const ancestor = snapshot.rows[originalParent];
      if (!ancestor || (ancestor.parent_index !== null && ancestor.parent_index >= originalParent)) {
        throw new Error(`Row ${originalIndex} has an invalid parent chain`);
      }
      originalParent = ancestor.parent_index;
    }
    const parentIndex = originalParent === null ? null : originalToIndex.get(originalParent)!;
    let ancestorIndex = parentIndex;
    let redundantWith: number | null = null;
    while (ancestorIndex !== null) {
      const ancestor = rows[ancestorIndex]!;
      if (ancestor.text === text && JSON.stringify(ancestor.section_path) === JSON.stringify(sectionPath)) {
        redundantWith = ancestor.index;
        break;
      }
      ancestorIndex = ancestor.parent_index;
    }
    const index = rows.length;
    originalToIndex.set(originalIndex, index);
    rows.push({
      index, kind: row.kind, section_path: sectionPath, text,
      source_sentence_hash: sha256(text), word_count: wordCount(text),
      parent_index: parentIndex, redundant_with: redundantWith,
    });
  }
  const related = snapshot.links.flatMap((link) => {
    let resolved: string;
    try { resolved = new URL(link, snapshot.url).toString(); } catch { return []; }
    const normalized = normalizeUrl(resolved, sourceRoot);
    return normalized && normalized !== url && normalized !== canonicalUrl ? [normalized] : [];
  });
  return {
    url, canonical_url: canonicalUrl, title, retrieved_at: retrievedAt,
    source_hash: sha256(mainText), main_text: mainText,
    section_paths: sectionPaths.length ? sectionPaths : [[title, "Overview"]],
    related_hig_urls: [...new Set(related)], rows,
  };
}

/**
 * Inspect an already-rendered page. This does not navigate, fetch, write, or approve source changes.
 * Leading strong nodes are included because existing ingestion hashes those leads independently
 * from their enclosing p/li; full paragraphs also cover ingestion's explicit-clause candidates.
 * Figure captions retain text-only evidence for manually recovered pattern mappings, not media.
 */
export async function captureSourceInspection(
  page: Pick<Page, "evaluate">,
  options: { retrievedAt?: string; sourceRoot?: string } = {},
): Promise<SourceInspection> {
  const snapshot = await page.evaluate((): SourceInspectionSnapshot => {
    const main = document.querySelector("main");
    if (!main) throw new Error("Rendered page has no main element");
    const nodes = Array.from(main.querySelectorAll(
      "h2, h3, h4, p, li, table, figcaption, p > strong:first-child, li > strong:first-child",
    ));
    const indexes = new Map(nodes.map((node, index) => [node, index]));
    return {
      url: location.href,
      canonical_url: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
      h1: main.querySelector("h1")?.textContent ?? null,
      document_title: document.title,
      main_text: main.textContent ?? "",
      rows: nodes.map((node) => {
        let parent = node.parentElement;
        while (parent && !indexes.has(parent)) parent = parent.parentElement;
        return {
          kind: node.tagName.toLowerCase() as InspectionRowKind,
          text: node.textContent ?? "",
          parent_index: parent ? indexes.get(parent)! : null,
        };
      }),
      links: Array.from(main.querySelectorAll<HTMLAnchorElement>("a[href]")).map((anchor) => anchor.href),
    };
  });
  return inspectSourceSnapshot(snapshot, options.retrievedAt ?? new Date().toISOString(), options.sourceRoot);
}

/**
 * Pure, prose-bounded evidence projection. No full row/main text or candidate prose is returned.
 * All candidates receive an explicit match status; equal hashes in different sections never match.
 */
export function createSourceEvidence(
  inspection: SourceInspection,
  candidates: readonly GuidanceCandidate[] = [],
): SourceInspectionEvidence {
  const byHash = new Map<string, InspectedSourceRow[]>();
  for (const row of inspection.rows) {
    const bucket = byHash.get(row.source_sentence_hash) ?? [];
    bucket.push(row);
    byHash.set(row.source_sentence_hash, bucket);
  }
  const candidateMatches: CandidateSourceMatch[] = candidates.map((candidate, candidateIndex) => {
    const hashMatches = byHash.get(candidate.source_sentence_hash) ?? [];
    const sectionKey = JSON.stringify(candidate.section_path);
    const matchingRows = hashMatches.filter((row) => JSON.stringify(row.section_path) === sectionKey);
    return {
      candidate_index: candidateIndex, section_path: [...candidate.section_path],
      source_sentence_hash: candidate.source_sentence_hash,
      status: matchingRows.length ? "matched" : hashMatches.length ? "section-mismatch" : "hash-not-found",
      matched_row_indexes: matchingRows.map((row) => row.index),
      other_section_row_indexes: hashMatches.filter((row) => JSON.stringify(row.section_path) !== sectionKey).map((row) => row.index),
    };
  });
  const candidatesByRow = new Map<number, number[]>();
  for (const candidate of candidateMatches) for (const rowIndex of candidate.matched_row_indexes) {
    const indexes = candidatesByRow.get(rowIndex) ?? [];
    indexes.push(candidate.candidate_index);
    candidatesByRow.set(rowIndex, indexes);
  }
  const matchedCandidateCount = candidateMatches.filter((candidate) => candidate.status === "matched").length;
  return {
    url: inspection.url, canonical_url: inspection.canonical_url, title: inspection.title,
    retrieved_at: inspection.retrieved_at, source_hash: inspection.source_hash,
    section_paths: inspection.section_paths.map((path) => [...path]),
    related_hig_urls: [...inspection.related_hig_urls],
    rows: inspection.rows.map((row) => ({
      index: row.index, kind: row.kind, section_path: [...row.section_path],
      source_sentence_hash: row.source_sentence_hash, word_count: row.word_count,
      excerpt: truncateWords(row.text, 19), parent_index: row.parent_index,
      redundant_with: row.redundant_with,
      matched_candidate_indexes: candidatesByRow.get(row.index) ?? [],
    })),
    candidates: candidateMatches, matched_candidate_count: matchedCandidateCount,
    unmatched_candidate_count: candidates.length - matchedCandidateCount,
    match_basis: "exact normalized-text hash and exact section path; not semantic support",
  };
}
