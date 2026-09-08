import assert from "node:assert/strict";
import test from "node:test";
import {
  captureSourceInspection, createSourceEvidence, inspectSourceSnapshot, normalizeSourceText,
  type SourceInspectionSnapshot,
} from "../src/lib/source-inspection.js";
import type { GuidanceCandidate } from "../src/lib/types.js";
import { sha256, wordCount } from "../src/lib/util.js";

const root = "https://developer.apple.com/design/human-interface-guidelines";
const retrievedAt = "2026-09-08T00:00:00.000Z";

function snapshot(overrides: Partial<SourceInspectionSnapshot> = {}): SourceInspectionSnapshot {
  return {
    url: `${root}/playing-audio/?language=en#volume`,
    canonical_url: `${root}/playing-audio/`,
    h1: " Playing\n audio ",
    document_title: "Playing audio | Apple Developer Documentation",
    main_text: " Playing\n audio\t Best practices\u00a0Keep controls visible. ",
    rows: [
      { kind: "h2", text: "Best practices", parent_index: null },
      { kind: "p", text: " Keep\n controls visible. ", parent_index: null },
    ],
    links: [],
    ...overrides,
  };
}

function candidate(text: string, sectionPath: string[]): GuidanceCandidate {
  return { text, section_path: sectionPath, source_sentence_hash: sha256(normalizeSourceText(text)), word_count: wordCount(text) };
}

test("inspection hashes exactly ingestion-style whitespace-normalized main and row text", () => {
  const result = inspectSourceSnapshot(snapshot(), retrievedAt);
  assert.equal(result.title, "Playing audio");
  assert.equal(result.main_text, "Playing audio Best practices Keep controls visible.");
  assert.equal(result.source_hash, sha256("Playing audio Best practices Keep controls visible."));
  assert.equal(result.rows[1]?.source_sentence_hash, sha256("Keep controls visible."));
  assert.equal(result.rows[1]?.word_count, 3);
  assert.equal(result.retrieved_at, retrievedAt);
  assert.equal(normalizeSourceText("ＴＯＵＣＨ  touch"), "ＴＯＵＣＨ touch", "do not introduce NFKC/case changes into ingestion hashes");
  const withoutH1 = inspectSourceSnapshot(snapshot({ h1: " \n " }), retrievedAt);
  assert.equal(withoutH1.title, "Playing audio");
});

test("inspection tracks heading levels, including skipped levels and heading-row own sections", () => {
  const result = inspectSourceSnapshot(snapshot({ rows: [
    { kind: "p", text: "Overview text.", parent_index: null },
    { kind: "h2", text: "Best practices", parent_index: null },
    { kind: "h3", text: "Controls", parent_index: null },
    { kind: "h4", text: "Volume", parent_index: null },
    { kind: "p", text: "Show volume controls.", parent_index: null },
    { kind: "h3", text: "Playback", parent_index: null },
    { kind: "table", text: "Mode Value", parent_index: null },
    { kind: "h2", text: "Resources", parent_index: null },
    { kind: "h4", text: "Related guidance", parent_index: null },
  ] }), retrievedAt);
  assert.deepEqual(result.rows.map((row) => row.section_path), [
    ["Playing audio"],
    ["Playing audio", "Best practices"],
    ["Playing audio", "Best practices", "Controls"],
    ["Playing audio", "Best practices", "Controls", "Volume"],
    ["Playing audio", "Best practices", "Controls", "Volume"],
    ["Playing audio", "Best practices", "Playback"],
    ["Playing audio", "Best practices", "Playback"],
    ["Playing audio", "Resources"],
    ["Playing audio", "Resources", "Related guidance"],
  ]);
  assert.equal(result.section_paths.length, 6);
  assert.deepEqual(inspectSourceSnapshot(snapshot({ rows: [] }), retrievedAt).section_paths, [["Playing audio", "Overview"]]);
});

test("inspection normalizes canonical URLs and related links, excluding non-HIG and self links", () => {
  const result = inspectSourceSnapshot(snapshot({
    canonical_url: `${root}/playing-audio/?canonical=1#section`,
    links: [
      `${root}/playing-audio#same`, `${root}/buttons/?x=1#x`, `${root}/buttons`,
      "./menus?x=1", "https://example.com/design/human-interface-guidelines/buttons",
      "https://developer.apple.com/documentation/avfoundation", "http://[invalid", root,
    ],
  }), retrievedAt);
  assert.equal(result.url, `${root}/playing-audio`);
  assert.equal(result.canonical_url, result.url);
  assert.deepEqual(result.related_hig_urls, [`${root}/buttons`, `${root}/playing-audio/menus`, root]);
  assert.equal(inspectSourceSnapshot(snapshot({ canonical_url: "https://example.com/wrong" }), retrievedAt).canonical_url, result.url);
  assert.throws(() => inspectSourceSnapshot(snapshot({ url: "https://example.com/wrong" }), retrievedAt), /outside/);
});

test("nested duplicate rows remain available for candidate hashes and are explicitly redundant", () => {
  const result = inspectSourceSnapshot(snapshot({ rows: [
    { kind: "h2", text: "Best practices", parent_index: null },
    { kind: "li", text: "Keep controls visible.", parent_index: null },
    { kind: "p", text: "Keep controls visible.", parent_index: 1 },
    { kind: "strong", text: "Keep controls visible.", parent_index: 2 },
    { kind: "p", text: "A distinct paragraph. More details follow.", parent_index: null },
    { kind: "strong", text: "A distinct paragraph.", parent_index: 4 },
  ] }), retrievedAt);
  assert.deepEqual(result.rows.map((row) => row.redundant_with), [null, null, 1, 2, null, null]);
  const evidence = createSourceEvidence(result, [
    candidate("Keep controls visible.", ["Playing audio", "Best practices"]),
    candidate("A distinct paragraph.", ["Playing audio", "Best practices"]),
    candidate("A distinct paragraph. More details follow.", ["Playing audio", "Best practices"]),
  ]);
  assert.deepEqual(evidence.candidates.map((match) => match.matched_row_indexes), [[1, 2, 3], [5], [4]]);
  assert.equal(evidence.matched_candidate_count, 3);
});

test("evidence matches exact hash AND section, with explicit diagnostics for every unmatched candidate", () => {
  const result = inspectSourceSnapshot(snapshot({ rows: [
    { kind: "h2", text: "Best practices", parent_index: null },
    { kind: "p", text: "Keep controls visible.", parent_index: null },
    { kind: "h2", text: "Resources", parent_index: null },
    { kind: "p", text: "Keep controls visible.", parent_index: null },
  ] }), retrievedAt);
  const evidence = createSourceEvidence(result, [
    candidate("Keep controls visible.", ["Playing audio", "Best practices"]),
    candidate("Keep controls visible.", ["Playing audio", "Missing section"]),
    candidate("Different text.", ["Playing audio", "Best practices"]),
    candidate("Keep controls visible.", ["Playing audio/Best practices"]),
  ]);
  assert.deepEqual(evidence.candidates.map((match) => match.status), ["matched", "section-mismatch", "hash-not-found", "section-mismatch"]);
  assert.deepEqual(evidence.candidates[0]?.matched_row_indexes, [1]);
  assert.deepEqual(evidence.candidates[0]?.other_section_row_indexes, [3]);
  assert.deepEqual(evidence.candidates[1]?.other_section_row_indexes, [1, 3]);
  assert.deepEqual(evidence.rows[1]?.matched_candidate_indexes, [0]);
  assert.deepEqual(evidence.rows[3]?.matched_candidate_indexes, []);
  assert.equal(evidence.matched_candidate_count, 1);
  assert.equal(evidence.unmatched_candidate_count, 3);
  assert.match(evidence.match_basis, /not semantic support/);
});

test("figure-caption text supports manually recovered mappings without retaining media", () => {
  const result = inspectSourceSnapshot(snapshot({ rows: [
    { kind: "h2", text: "Platform considerations", parent_index: null },
    { kind: "h3", text: "Example platform", parent_index: null },
    { kind: "h4", text: "Pattern", parent_index: null },
    { kind: "figcaption", text: " Example\n A sample mapping. ", parent_index: null },
  ] }), retrievedAt);
  const evidence = createSourceEvidence(result, [candidate("Example A sample mapping.", ["Playing audio", "Platform considerations", "Example platform", "Pattern"])]);
  assert.equal(evidence.matched_candidate_count, 1);
  assert.equal(evidence.rows[3]?.kind, "figcaption");
  assert.equal(evidence.rows[3]?.source_sentence_hash, sha256("Example A sample mapping."));
  assert.equal(Object.hasOwn(evidence.rows[3]!, "text"), false);
});

test("evidence retains only a maximum 19-word excerpt and never copies full prose fields", () => {
  const longText = Array.from({ length: 30 }, (_, index) => `word${index + 1}`).join(" ");
  const raw = snapshot({ main_text: `FULL_MAIN_SENTINEL ${longText}`, rows: [
    { kind: "p", text: longText, parent_index: null },
  ] });
  const result = inspectSourceSnapshot(raw, retrievedAt);
  const original = structuredClone(result);
  const supplied = [candidate(longText, ["Playing audio"])];
  const originalCandidates = structuredClone(supplied);
  const evidence = createSourceEvidence(result, supplied);
  assert.equal(evidence.rows[0]?.word_count, 30);
  assert.equal(wordCount(evidence.rows[0]!.excerpt), 19);
  assert.equal(evidence.rows[0]?.excerpt, longText.split(" ").slice(0, 19).join(" "));
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes("FULL_MAIN_SENTINEL"), false);
  assert.equal(serialized.includes("word20"), false);
  assert.equal(Object.hasOwn(evidence, "main_text"), false);
  assert.equal(Object.hasOwn(evidence.rows[0]!, "text"), false);
  assert.deepEqual(result, original, "evidence projection does not mutate inspection data");
  assert.deepEqual(supplied, originalCandidates, "evidence projection does not mutate candidates");
});

test("empty rows are removed without losing surviving parent relationships", () => {
  const result = inspectSourceSnapshot(snapshot({ rows: [
    { kind: "li", text: "Outer text.", parent_index: null },
    { kind: "p", text: " ", parent_index: 0 },
    { kind: "strong", text: "Inner text.", parent_index: 1 },
  ] }), retrievedAt);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1]?.parent_index, 0);
  assert.throws(() => inspectSourceSnapshot(snapshot({ rows: [
    { kind: "p", text: "Bad parent.", parent_index: 0 },
  ] }), retrievedAt), /earlier parent/);
});

test("capture inspects an existing Page using one read-only evaluation and no navigation", async () => {
  let evaluations = 0;
  const page = {
    evaluate: async () => { evaluations++; return snapshot(); },
  } as unknown as Parameters<typeof captureSourceInspection>[0];
  const result = await captureSourceInspection(page, { retrievedAt });
  assert.equal(evaluations, 1);
  assert.equal(result.title, "Playing audio");
  assert.equal(result.retrieved_at, retrievedAt);
});
