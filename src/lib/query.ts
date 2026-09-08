import config from "../config/hig.json" with { type: "json" };
import type { Rule } from "./types.js";

export const MAX_QUERY_BYTES = 32_000;
export const MAX_QUERY_RULES = 50;

export interface QueryOptions {
  category?: string | undefined;
  platform?: string | undefined;
  component?: string | undefined;
  modality?: string | undefined;
  device?: string | undefined;
  normative?: string | undefined;
  confidence?: string | undefined;
  task?: string | undefined;
  ids: string[];
  terms: string[];
  limit: number;
  offset: number;
  maxBytes: number;
  format: "compact" | "json" | "markdown";
  language: "en" | "ja";
  preflight: boolean;
  help: boolean;
}

const normalize = (value: string): string => value.normalize("NFKC").toLowerCase();
const valueFlags = new Set([
  "category", "platform", "component", "modality", "device", "normative", "confidence",
  "task", "id", "limit", "offset", "max-bytes", "format", "language",
]);

export function parseQueryArgs(args: string[]): QueryOptions {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  const ids: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    const flag = arg.startsWith("--") ? arg.slice(2) : "";
    if (flag === "preflight" || flag === "help") {
      if (switches.has(flag)) throw new Error(`Duplicate option: --${flag}`);
      switches.add(flag);
      continue;
    }
    if (!valueFlags.has(flag)) throw new Error(`Unknown option: ${arg.slice(0, 80)}. Use --help.`);
    const value = args[++index];
    if (!value?.trim() || value.startsWith("--")) throw new Error(`Missing value for --${flag}`);
    if (flag === "id") {
      const parts = value.split(",").map((id) => id.trim());
      if (parts.some((id) => !id)) throw new Error("--id requires nonempty rule IDs");
      ids.push(...parts);
    } else {
      if (values.has(flag)) throw new Error(`Duplicate option: --${flag}`);
      values.set(flag, value.trim());
    }
  }
  const choice = (flag: string, choices: readonly string[], fallback?: string): string | undefined => {
    const value = values.get(flag) ?? fallback;
    if (value !== undefined && !choices.includes(value)) throw new Error(`--${flag} must be one of: ${choices.join(", ")}`);
    return value;
  };
  const integer = (flag: string, fallback: number, minimum: number, maximum: number): number => {
    const raw = values.get(flag);
    const value = raw === undefined ? fallback : Number(raw);
    if ((raw !== undefined && !/^\d+$/.test(raw)) || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new Error(`--${flag} must be an integer from ${minimum} to ${maximum}`);
    }
    return value;
  };
  const format = choice("format", ["compact", "json", "markdown"], "compact") as QueryOptions["format"];
  const task = values.get("task");
  const terms = normalize(task ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (task !== undefined && !terms.length) throw new Error("--task must contain searchable letters or numbers");
  return {
    category: choice("category", config.topCategories), platform: choice("platform", config.platforms),
    component: values.get("component"), modality: choice("modality", config.modalities), device: choice("device", config.devices),
    normative: choice("normative", ["MUST", "MUST_NOT", "SHOULD", "MAY", "AVOID"]),
    confidence: choice("confidence", ["high", "medium", "low"]), task, terms, ids: [...new Set(ids)],
    limit: integer("limit", 10, 1, MAX_QUERY_RULES), offset: integer("offset", 0, 0, Number.MAX_SAFE_INTEGER),
    maxBytes: integer("max-bytes", format === "json" ? MAX_QUERY_BYTES : 12_000, 1024, MAX_QUERY_BYTES),
    format, language: choice("language", ["en", "ja"], "en") as QueryOptions["language"],
    preflight: switches.has("preflight"), help: switches.has("help"),
  };
}

function relevance(rule: Rule, terms: string[]): number {
  const title = normalize(rule.title);
  const statements = normalize(`${rule.statement.en} ${rule.statement.ja}`);
  return terms.reduce((score, term) => score + (title.includes(term) ? 4 : 0) + (statements.includes(term) ? 1 : 0), 0);
}

function matchRules(rules: Rule[], options: QueryOptions): Rule[] {
  const active = rules.filter((rule) => rule.status === "active");
  const knownIds = new Set(active.map((rule) => rule.id));
  const unknown = options.ids.filter((id) => !knownIds.has(id));
  if (unknown.length) throw new Error(`Unknown active rule ID: ${unknown.join(", ").slice(0, 200)}`);
  const wanted = new Set(options.ids);
  return active.filter((rule) => {
    if (wanted.size && !wanted.has(rule.id)) return false;
    if (options.category && rule.category !== options.category) return false;
    if (options.platform && !rule.scope.platforms.includes(options.platform)) return false;
    if (options.component && !rule.scope.components.includes(options.component) && rule.topic !== options.component) return false;
    if (options.modality && !rule.scope.modalities.includes(options.modality)) return false;
    if (options.device && !rule.scope.devices.includes(options.device)) return false;
    if (options.normative && rule.normative_level !== options.normative) return false;
    if (options.confidence && rule.confidence !== options.confidence) return false;
    const text = normalize([rule.title, rule.topic, rule.subtopic, rule.statement.en, rule.statement.ja, ...rule.tags].join(" "));
    return options.terms.every((term) => text.includes(term));
  }).sort((a, b) => a.priority_rank - b.priority_rank ||
    (options.platform ? a.scope.platforms.length - b.scope.platforms.length : 0) ||
    relevance(b, options.terms) - relevance(a, options.terms) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function compactRules(rules: Rule[], language: QueryOptions["language"]) {
  const keys = new Map<string, string>();
  const sources: Record<string, Pick<Rule["source"], "url" | "page_title" | "retrieved_at" | "source_hash">> = {};
  const records = rules.map((rule) => {
    const { url, page_title, retrieved_at, source_hash, section_path, source_sentence_hash, evidence_paraphrase } = rule.source;
    const page = { url, page_title, retrieved_at, source_hash };
    const key = JSON.stringify(page);
    let ref = keys.get(key);
    if (!ref) { ref = `s${keys.size + 1}`; keys.set(key, ref); sources[ref] = page; }
    return {
      id: rule.id, statement: rule.statement[language], normative_level: rule.normative_level,
      confidence: rule.confidence, review_required: rule.review_required, scope: rule.scope,
      conditions: rule.conditions, exceptions: rule.exceptions, priority_rank: rule.priority_rank,
      ...(rule.apple_native_rule !== undefined ? { apple_native_rule: rule.apple_native_rule } : {}),
      ...(rule.portable_interpretation !== undefined ? { portable_interpretation: rule.portable_interpretation } : {}),
      source: { ref, section_path, source_sentence_hash, evidence_paraphrase },
    };
  });
  return { sources, rules: records };
}

// Count the bytes field itself and the final newline as part of stdout.
function withByteCount(render: (bytes: number) => string): { output: string; bytes: number } {
  let bytes = 0;
  for (;;) {
    const output = `${render(bytes)}\n`;
    const actual = Buffer.byteLength(output, "utf8");
    if (actual === bytes) return { output, bytes };
    bytes = actual;
  }
}

function renderPage(options: QueryOptions, total: number, rules: Rule[], minimumRequiredBytes?: number) {
  const hasMore = options.offset + rules.length < total;
  const metadata = {
    schema_version: "2.0.0", format: options.format, language: options.language, total, returned: rules.length,
    offset: options.offset, next_offset: hasMore && rules.length ? options.offset + rules.length : null,
    has_more: hasMore, limit: options.limit, max_bytes: options.maxBytes,
    sort: "priority,platform-specificity,relevance,id",
    ...(minimumRequiredBytes !== undefined ? {
      minimum_required_bytes: minimumRequiredBytes,
      warning: `The next rule cannot fit. Increase --max-bytes up to ${MAX_QUERY_BYTES} or inspect the rule locally.`,
    } : {}),
  };
  if (options.format === "markdown") {
    return withByteCount((bytes) => [
      "# HIG query candidates", "",
      `total: ${total}; returned: ${rules.length}; offset: ${options.offset}; next_offset: ${metadata.next_offset ?? "null"}; has_more: ${hasMore}; bytes: ${bytes}; max_bytes: ${options.maxBytes}`,
      "", "Candidate listing only. Use --format compact or --format json for scope, conditions, exceptions, confidence, and source trace.",
      ...(minimumRequiredBytes !== undefined ? [`minimum_required_bytes: ${minimumRequiredBytes}. ${metadata.warning}`] : []),
      "", ...rules.map((rule) => `- ${rule.id} · ${rule.normative_level} — ${rule.statement[options.language]} (${rule.source.url})`),
    ].join("\n"));
  }
  const payload = options.format === "compact" ? compactRules(rules, options.language) : { rules };
  return withByteCount((bytes) => JSON.stringify({ ...metadata, bytes, ...payload }, null, options.format === "json" ? 2 : undefined));
}

export function queryRules(rules: Rule[], options: QueryOptions): { output: string; exitCode: number } {
  const matches = matchRules(rules, options);
  const requested = matches.slice(options.offset, options.offset + options.limit);
  const requestedPage = renderPage(options, matches.length, requested);
  let selected = requested;
  let page = requestedPage;
  while (selected.length && page.bytes > options.maxBytes) {
    selected = selected.slice(0, -1);
    page = renderPage(options, matches.length, selected);
  }
  const blocked = requested.length > 0 && selected.length === 0;
  let minimumRequiredBytes: number | undefined;
  if (blocked) {
    let minimum = renderPage(options, matches.length, requested.slice(0, 1)).bytes;
    for (;;) {
      const actual = renderPage({ ...options, maxBytes: minimum }, matches.length, requested.slice(0, 1)).bytes;
      if (minimum === actual) break;
      minimum = actual;
    }
    minimumRequiredBytes = minimum;
    page = renderPage(options, matches.length, [], minimumRequiredBytes);
  }
  if (options.preflight) {
    const summary = {
      schema_version: "2.0.0", preflight: true, format: options.format, total: matches.length, returned: 0,
      offset: options.offset, limit: options.limit, max_bytes: options.maxBytes,
      requested_bytes: requestedPage.bytes, projected_returned: selected.length, projected_bytes: page.bytes,
      next_offset: selected.length && options.offset + selected.length < matches.length ? options.offset + selected.length : null,
      has_more: options.offset + selected.length < matches.length,
      ...(minimumRequiredBytes !== undefined ? { minimum_required_bytes: minimumRequiredBytes } : {}),
    };
    page = withByteCount((bytes) => JSON.stringify({ ...summary, bytes }));
  }
  if (page.bytes > options.maxBytes) throw new Error("Response metadata exceeds --max-bytes");
  return { output: page.output, exitCode: blocked && !options.preflight ? 2 : 0 };
}

export const QUERY_HELP = `Usage: npm run --silent query -- [options]

--platform <slug> --category <slug> --component <slug> --modality <slug>
--device <slug> --normative <level> --confidence <high|medium|low>
--task <text>          Unicode keyword AND search over English/Japanese text
--id <id[,id...]>      Active rule details; repeatable, combines with filters
--format <compact|json|markdown>  Default: compact; json includes full rules
--language <en|ja>     Compact/Markdown statement language; default: en
--limit <1..50>        Default: 10
--offset <n>           Continue with next_offset, same filters and snapshot
--max-bytes <1024..32000>  Stdout ceiling, including metadata and final newline
                         Default: 12000 (compact/markdown), 32000 (json)
--preflight            Counts and exact page sizes without rule bodies
--help

Output contract v2: JSON envelope with total, returned, next_offset, has_more,
bytes, rules, and a source table for compact results. Byte limits are not tokens.
Sort: conflict priority, platform specificity, keyword relevance, then stable ID.
Markdown lists candidates only. No stemming, translation, or semantic search.
Exit codes: 0 success (including preflight), 1 invalid arguments/input,
2 next rule exceeds the budget during retrieval.
`;
