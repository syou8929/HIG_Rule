# Apple HIG rule runtime

This adapter is generated from 3742 active, source-traceable atomic rules. The canonical store is under `src/rules/`; do not hand-edit generated adapters.

## Runtime procedure

Apply this procedure to Apple UI design, implementation, and review. For repository maintenance, use the maintenance contract; determine platform/device details only when they affect the requested change.

1. Identify the target Apple platform, device, and input methods.
2. Identify the primary user task and relevant product constraints.
3. Query only the relevant rules by category, platform, component, modality, and task.
4. Review accessibility first, then privacy and explicit user intent.
5. Apply platform-specific guidance before Apple-common and universal guidance.
6. Select components and patterns that fit the platform context.
7. Review empty, loading, error, denied-permission, and offline states.
8. Check relevant settings such as Dynamic Type, VoiceOver, keyboard access, pointer input, and Reduce Motion.
9. Review interaction, hierarchy, writing, and state transitions — not only appearance.
10. Report evidence, conflicts, exceptions, unresolved questions, and rule confidence.

Do not claim authoritative HIG compliance. Report what was checked and what remains unverified.

## Conflict priority

1. life-safety-security-legal
2. accessibility
3. privacy-and-explicit-intent
4. platform-specific-hig
5. input-and-device-constraints
6. apple-platform-common
7. universal-design-principles
8. product-design-system
9. decorative-preference

When product requirements differ from HIG guidance, explain the difference and risk instead of silently replacing the product requirement. Treat low-confidence rules as review prompts, not settled facts.

## Retrieval

Start with 10 or fewer rules and filters for the actual target. Preview counts and bytes with `npm run --silent query -- --platform ios --category components --component buttons --limit 10 --preflight`; omit `--preflight` to retrieve them.

- Never load the full rule store, exported rules, or broad checklists into model context. Use scripts for counts and filtering; return only the selected rules and a short summary.
- Filters combine with AND. `--task` matches every Unicode keyword against English/Japanese text; it does not translate or perform semantic search. Do not use `--task review` to request a review workflow.
- Results sort by conflict priority, requested-platform specificity, keyword relevance, then ID. Inspect `total`, `returned`, and `has_more`; continue with `--offset <next_offset>`, keeping filters and the source snapshot fixed. Query applicable accessibility and privacy guidance separately from component filters and report coverage gaps.
- Default compact output retains scope, conditions, exceptions, confidence, review status, and source trace. Resolve each rule's `source.ref` through the response's `sources` table. Use `--id <rule-id> --format json` for full fields, including rationale and checks. Markdown lists candidates only.
- The CLI limits each response to 10 rules by default (maximum 50) and enforces 12,000 bytes for compact output or 32,000 for full JSON, including metadata. `--max-bytes` may set 1,024–32,000 bytes. If one rule cannot fit, retrieval exits 2 with `minimum_required_bytes`; adjust the budget within the ceiling or inspect it locally. Never skip that rule silently. These are response-byte limits, not total token limits.

## Codex / GPT-6 Astra execution

- Use established user intent and authorization for routine, reversible work. Ask only when missing information materially changes correctness or scope. Keep HIG guidance distinct from user requirements and report conflicts.
- Before bulk fetching or source review, announce the scope, batch size, available usage reading, and stopping conditions. Start with at most 3 pages and 50 rules per batch, splitting long pages by section. Expand only after reporting observed effort and a revised plan.
- Use at most one helper for a bounded independent subtask when it saves time or improves quality. Give it only the needed context and request a short evidence-based report.
- When usage readings are available, check at batch boundaries. Unless the user sets another budget, defer the next batch if usage rises by 5 percentage points from the run's baseline or remaining capacity reaches 30%. Save completed IDs, unresolved issues, evidence, and the next step. Without readings, retain small batches and disclose that consumption is unmeasured. Shared or delayed usage readings are not a hard token limit.
- Run required checks once per change set; repeat for new changes, failures, or unresolved concerns. A successful local build does not establish current Apple-source freshness. Verify freshness separately when requested; page hash changes require review before updating source-bound decisions.
- Report the outcome, evidence, checks, and remaining work concisely. Do not claim measured token savings or Astra optimization without comparison results.

## Repository maintenance contract

- Treat `src/rules/**/*.json` as the canonical rule store and rebuild every adapter from it.
- Use only Apple official HIG pages as primary sources.
- Never persist full source-page prose, images, video, or design resources.
- Keep evidence fragments below 20 words and preserve source URL, section path, retrieval time, and hashes.
- Do not raise conditional language to MUST without explicit support; route uncertainty to review.
- Preserve stable rule IDs through `src/config/rule-id-map.json`; deprecate removed rules before deletion.
- Treat review registries under `src/config/` as source-trace-bound; require re-review when hashes or candidate sets become stale.
- Run `npm run ci` after rule, schema, generator, or adapter changes.
- Report blocked pages and pages without rules explicitly; never infer missing source content.
