import type { GuidanceCandidate, NormativeLevel, Portability, Rule, SourcePage } from "./types.js";
import { slugify } from "./util.js";

const ACTIONABLE = /^(adopt|aim|allow|always|apply|ask|augment|avoid|avoiding|be|bear in mind|break up|carefully consider|choose|communicate|confirm|consider|convey|create|defer|define|describe|design|display|distinguish|do not|don['’]t|enable|encourage|ensure|favor|follow|give|help|identify|in general, avoid|include|integrate|keep|let|make|maintain|match|minimize|never|offer|optimize|place|position|prefer|present|preserve|prioritize|provide|reduce|refer to|remove|replacing|respect|respond|show|simplify|strive|support|test|tightening|track|tracking|treat|use|verify|warn|write)\b/i;

export function isActionable(candidate: GuidanceCandidate): boolean {
  const text = candidate.text.trim();
  if (/^(Always On|Tracking requests|Help buttons)$/i.test(text)) return false;
  return ACTIONABLE.test(text) && !/^Resources?\b/i.test(text);
}

export function normative(text: string): Pick<Rule, "normative_level" | "confidence" | "review_required" | "polarity" | "severity"> {
  const value = text.toLowerCase();
  if (/^(never|must not)\b/.test(value)) return { normative_level: "MUST_NOT", confidence: "medium", review_required: true, polarity: "prohibit", severity: "error" };
  if (/^(avoid|avoiding|do not|don't|don’t|in general, avoid)\b/.test(value)) return { normative_level: "AVOID", confidence: "low", review_required: true, polarity: "discourage", severity: "warning" };
  if (/^(carefully consider|consider|may)\b/.test(value)) return { normative_level: "MAY", confidence: "low", review_required: true, polarity: "permit", severity: "info" };
  if (/^(always|ensure|make sure|must|required)\b/.test(value)) return { normative_level: "MUST", confidence: "medium", review_required: true, polarity: "require", severity: "error" };
  return { normative_level: "SHOULD", confidence: "low", review_required: true, polarity: "recommend", severity: "warning" };
}

function tail(text: string, expression: RegExp): string {
  return text.replace(expression, "").replace(/^[,.:;\s]+/, "").replace(/[.:;\s]+$/, "");
}

function lowerFirst(value: string): string {
  return value ? `${value[0]?.toLowerCase()}${value.slice(1)}` : value;
}

function upperFirst(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value;
}

export function paraphrase(candidate: string, pageTitle: string): { en: string; ja: string } {
  const patterns: Array<{ match: RegExp; en: (value: string) => string; ja: (value: string) => string }> = [
    { match: /^support\b/i, en: (v) => `Ensure the experience accommodates ${lowerFirst(v)}.`, ja: (v) => `${v}を利用できる設計にする。` },
    { match: /^use\b/i, en: (v) => `Choose or apply ${lowerFirst(v)} in the documented context.`, ja: (v) => `該当する状況では${v}を採用する。` },
    { match: /^(avoid|avoiding|do not|don['’]t|never|in general, avoid)\b/i, en: (v) => `Exclude ${lowerFirst(v)} from the applicable experience.`, ja: (v) => `該当する体験では${v}を避ける。` },
    { match: /^bear in mind\b/i, en: (v) => `Account for ${lowerFirst(v)} in the design.`, ja: (v) => `${v}を設計上考慮する。` },
    { match: /^break up\b/i, en: (v) => `Divide ${lowerFirst(v)} into focused steps.`, ja: (v) => `${v}を集中しやすい手順に分割する。` },
    { match: /^identify\b/i, en: (v) => `Determine ${lowerFirst(v)} explicitly.`, ja: (v) => `${v}を明確に特定する。` },
    { match: /^define\b/i, en: (v) => `Define ${lowerFirst(v)} explicitly.`, ja: (v) => `${v}を明確に定義する。` },
    { match: /^refer to\b/i, en: (v) => `Refer to ${lowerFirst(v)}.`, ja: (v) => `${v}という名称で参照する。` },
    { match: /^integrate\b/i, en: (v) => `Connect the experience with ${lowerFirst(v)}.`, ja: (v) => `${v}と体験を連携する。` },
    { match: /^tightening\b/i, en: (v) => `Use tighter ${lowerFirst(v)}.`, ja: (v) => `${v}をより引き締める。` },
    { match: /^tracking\b/i, en: (v) => `Keep ${lowerFirst(v)} synchronized.`, ja: (v) => `${v}を同期させる。` },
    { match: /^replacing\b/i, en: (v) => `Substitute ${lowerFirst(v)}.`, ja: (v) => `${v}へ置き換える。` },
    { match: /^(carefully consider|consider)\b/i, en: (v) => `Evaluate whether ${lowerFirst(v)} is appropriate for the current context.`, ja: (v) => `${v}が現在の状況に適切か検討する。` },
    { match: /^(prefer|favor)\b/i, en: (v) => `Favor ${lowerFirst(v)} when the documented conditions apply.`, ja: (v) => `該当条件では${v}を優先する。` },
    { match: /^always\b/i, en: (v) => `${upperFirst(v)} in every applicable case.`, ja: (v) => `該当するすべての場合に${v}を実行する。` },
    { match: /^(ensure|make sure|verify)\b/i, en: (v) => `Verify that ${lowerFirst(v)}.`, ja: (v) => `${v}を満たしていることを確認する。` },
    { match: /^(provide|offer)\b/i, en: (v) => `Make ${lowerFirst(v)} available when applicable.`, ja: (v) => `必要な場合に${v}を利用可能にする。` },
    { match: /^let people\b/i, en: (v) => `Preserve people’s ability to ${lowerFirst(v)}.`, ja: (v) => `利用者が${v}できる状態を保つ。` },
    { match: /^keep\b/i, en: (v) => `Maintain ${lowerFirst(v)}.`, ja: (v) => `${v}を維持する。` },
    { match: /^(display|present|show)\b/i, en: (v) => `Present ${lowerFirst(v)} in the documented context.`, ja: (v) => `該当する状況で${v}を表示する。` },
  ];
  for (const pattern of patterns) {
    if (pattern.match.test(candidate)) {
      const value = tail(candidate, pattern.match);
      return { en: pattern.en(value), ja: pattern.ja(value) };
    }
  }
  return {
    en: `Apply the documented ${pageTitle} guidance to ${lowerFirst(candidate)}.`,
    ja: `「${pageTitle}」において「${candidate}」の指針を適用する。`,
  };
}

export function portability(page: SourcePage): Portability {
  if (page.category === "technologies") return "technology-specific";
  if (page.category === "components") return "apple-component-specific";
  if (page.slug.startsWith("designing-for-") || page.platforms.length <= 2) return "platform-specific";
  if (page.slug === "design-principles") return "universal";
  return "apple-platform";
}

export function modalitiesFor(text: string): string[] {
  const value = text.toLowerCase();
  const result: string[] = [];
  if (/keyboard|key command|shortcut/.test(value)) result.push("keyboard");
  if (/voiceover|screen reader/.test(value)) result.push("screen-reader");
  if (/touch|tap|swipe/.test(value)) result.push("touch");
  if (/pointer|cursor|mouse|trackpad/.test(value)) result.push("pointer");
  if (/voice|siri|speech/.test(value)) result.push("voice");
  if (/gaze|eyes|look/.test(value)) result.push("gaze");
  if (/gesture|pinch|swipe/.test(value)) result.push("gesture");
  if (/remote/.test(value)) result.push("remote-control");
  if (/game control/.test(value)) result.push("game-controller");
  if (/digital crown/.test(value)) result.push("digital-crown");
  return Array.from(new Set(result));
}

export function automatedChecksFor(page: SourcePage, candidate: GuidanceCandidate, modalities: string[]): string[] {
  const text = `${page.title} ${candidate.text}`.toLowerCase();
  const checks: string[] = [];
  if (modalities.includes("screen-reader") || /accessibility label|accessibility tree/.test(text)) {
    checks.push("Inspect the platform accessibility tree for nonempty names, roles, values, and states on scoped elements.");
  }
  if (modalities.includes("keyboard")) {
    checks.push("Run keyboard-only traversal and assert that every scoped interactive element can receive focus and be activated.");
  }
  if (/larger text|text size|dynamic type/.test(text)) {
    checks.push("Run UI tests at the platform’s largest supported text setting and detect clipped, truncated, or overlapping essential text.");
  }
  if (/contrast/.test(text)) {
    checks.push("Measure foreground/background contrast in every supported appearance against the project’s source-scoped accessibility threshold.");
  }
  if (/reduce motion|reduced motion/.test(text)) {
    checks.push("Enable Reduce Motion in UI tests and assert that the scoped reduced-motion path is used.");
  }
  return checks;
}

export function devicesFor(platforms: string[]): string[] {
  const mapping: Record<string, string> = {
    ios: "iphone", ipados: "ipad", macos: "mac", tvos: "apple-tv", watchos: "apple-watch", visionos: "apple-vision-pro", carplay: "carplay-display",
  };
  return Array.from(new Set(platforms.map((platform) => mapping[platform]).filter((device): device is string => Boolean(device))));
}

export function platformsForCandidate(page: SourcePage, candidate: GuidanceCandidate): string[] {
  const sectionContext = candidate.section_path.slice(1).join(" ");
  const patterns: Array<[string, RegExp]> = [
    ["ios", /\bios\b/i],
    ["ipados", /\bipados\b/i],
    ["macos", /\bmacos\b/i],
    ["tvos", /\btvos\b/i],
    ["visionos", /\bvisionos\b/i],
    ["watchos", /\bwatchos\b/i],
    ["carplay", /\bcarplay\b/i],
  ];
  const scoped = patterns.filter(([, pattern]) => pattern.test(sectionContext)).map(([platform]) => platform);
  return scoped.length ? scoped : page.platforms;
}

export function priorityFor(page: SourcePage, platforms = page.platforms): number {
  if (["accessibility", "voiceover", "inclusion"].includes(page.slug)) return 2;
  if (page.slug === "privacy") return 3;
  if (portability(page) === "platform-specific" || platforms.length <= 2) return 4;
  if (page.category === "inputs") return 5;
  if (portability(page) === "apple-platform") return 6;
  if (portability(page) === "universal") return 7;
  return 6;
}

export function ruleKey(page: SourcePage, candidate: GuidanceCandidate): string {
  return `${page.canonical_url}#${candidate.source_sentence_hash}`;
}

export function makeTitle(candidate: GuidanceCandidate): string {
  const normalized = candidate.text
    .replace(/^Avoiding\b/i, "Avoid")
    .replace(/^Tightening\b/i, "Tighten")
    .replace(/^Tracking\b/i, "Track")
    .replace(/^Replacing\b/i, "Replace");
  return normalized.length <= 110 ? normalized : `${normalized.slice(0, 107)}…`;
}

export function tagsFor(page: SourcePage, candidate: GuidanceCandidate): string[] {
  return Array.from(new Set([page.category, page.slug, ...candidate.section_path.slice(1).map(slugify), ...modalitiesFor(candidate.text)])).filter(Boolean);
}
