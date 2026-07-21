export type Category =
  | "getting-started"
  | "foundations"
  | "patterns"
  | "components"
  | "inputs"
  | "technologies"
  | "unclassified";

export type ProcessingStatus =
  | "discovered"
  | "fetched"
  | "parsed"
  | "classified"
  | "rules_extracted"
  | "validated"
  | "skipped"
  | "blocked";

export interface InventoryPage {
  url: string;
  canonical_url: string;
  slug: string;
  title: string;
  category: Category;
  parent_url: string | null;
  depth: number;
  page_kind: "root" | "category" | "subcategory" | "guidance" | "unknown";
  status: ProcessingStatus;
  status_history: Array<{ status: ProcessingStatus; at: string; reason?: string }>;
  discovered_at: string;
  retrieved_at: string | null;
  source_hash: string | null;
  section_count: number;
  candidate_count: number;
  rule_count: number;
  error: string | null;
}

export interface Inventory {
  schema_version: "1.0.0";
  source_root: string;
  generated_at: string;
  discovery_method: string;
  categories: string[];
  pages: InventoryPage[];
}

export interface GuidanceCandidate {
  text: string;
  section_path: string[];
  source_sentence_hash: string;
  word_count: number;
}

export interface SourcePage {
  schema_version: "1.0.0";
  url: string;
  canonical_url: string;
  slug: string;
  title: string;
  category: Category;
  page_kind: InventoryPage["page_kind"];
  platforms: string[];
  retrieved_at: string;
  source_hash: string;
  summary: { en: string; ja: string };
  section_paths: string[][];
  guidance_candidates: GuidanceCandidate[];
  reference_notes: Array<{ section_path: string[]; note: string }>;
  related_hig_urls: string[];
}

export type NormativeLevel = "MUST" | "SHOULD" | "MAY" | "AVOID" | "MUST_NOT";
export type Portability =
  | "universal"
  | "apple-platform"
  | "platform-specific"
  | "apple-component-specific"
  | "technology-specific";

export interface Rule {
  id: string;
  title: string;
  category: Exclude<Category, "unclassified">;
  topic: string;
  subtopic: string;
  statement: { en: string; ja: string };
  normative_level: NormativeLevel;
  confidence: "high" | "medium" | "low";
  review_required: boolean;
  polarity: "require" | "recommend" | "permit" | "discourage" | "prohibit";
  scope: {
    portability: Portability;
    platforms: string[];
    devices: string[];
    components: string[];
    modalities: string[];
  };
  conditions: string[];
  exceptions: string[];
  rationale: { en: string; ja: string };
  checks: { automated: string[]; manual: string[] };
  testability: "automated" | "manual" | "hybrid";
  severity: "error" | "warning" | "info";
  anti_patterns: string[];
  positive_examples: string[];
  source: {
    url: string;
    page_title: string;
    section_path: string[];
    retrieved_at: string;
    source_hash: string;
    source_sentence_hash: string;
    evidence_paraphrase: string;
  };
  apple_native_rule?: string;
  portable_interpretation?: string;
  tags: string[];
  priority_rank: number;
  status: "active" | "deprecated";
  deprecated_at?: string;
}
