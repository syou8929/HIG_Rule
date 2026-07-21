# Apple HIG rule runtime

This adapter is generated from 2329 active, source-traceable atomic rules. The canonical store is under `src/rules/`; do not hand-edit generated adapters.

## Runtime procedure

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

Run `npm run query -- --platform ios --category components --task review` and add `--component <slug>`, `--modality keyboard`, `--normative MUST`, `--confidence low`, or `--limit <n>` as needed.

## GitHub Copilot behavior

Apply these rules while generating and reviewing UI code; flag unresolved manual checks.
