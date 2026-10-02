# Nexus copy, spacing and inherent effect consistency

Owner-requested 2026-10-02. Base: current Main `0d14912667e8d2270dcb9a0d23af8ff91c1cc6f3`. Branch: `agent/nexus-copy-spacing-20261002`.

## Scope

- Remove only the Nexus subtitle “Master disciplines. Refine techniques. Prepare for what comes.” The Items subtitle and section selector remain.
- Add `0.65rem` after the Nexus technique/support summary, before Manage Techniques. Artwork sizes remain unchanged.
- Remove the duplicate Legal range prose from authored Skill details and the historical battle fallback. Preserve the standard Range field, area dimensions, recipient rules and all engine constraints. Reconcile the minimum report contract with this Owner refinement.
- Share effect label/magnitude/duration markup between authored Skills and inherent actions. Support Actions and basic Move/Attack use canonical formula-based summaries and labeled explanation bullets in Nexus and shared PvP/PvE command information. Guard's independent two-turn cooldown and Recovery's shared two-turn cooldown are preserved.

No migration, content activation, game-core rule, server mutation or combat layout change.

## Verification

- Four existing Skill-report tests failed specifically on the removed duplicate Legal range text before the implementation. After the shared helper changes, 53 focused tests across five files passed, retaining all ten field/order and mechanical-value assertions.
- The mounted Support preview reproduced zero rich-effect markers and zero explanation bullets before the fix. It now has one summary and one labeled bullet. Existing Move/Attack explanation tests failed before their missing descriptions were added; subsequent focused checks passed.
- Full local `TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1 pnpm check` passed after final application edits: formatting, lint, typecheck, 3,229 Vitest tests, seven Node checks and Production builds. A first check stopped on a formatting-only issue; it was corrected before the successful full rerun.
- Actual `CharacterArsenalShell`, header and production CSS mounted in Chromium: four desktop sizes (1280×720, 1366×768, 1536×614, 1920×1080), three Support choices and empty/equipped Skill rows — 24 states. Each had at least 10.39 px between summary and button, no panel/document vertical overflow, no runtime errors and unchanged art size. The removed subtitle was absent.
- Actual Techniques component: all three Support choices at those four desktop sizes plus 390×844 — 15 states. Each retained ten fields, exactly one explanation bullet, no Legal range prose, cream effect labels, gold magnitude and teal duration. Desktop preview/dialog dimensions remained identical when focus changed, with zero overflow.
- Existing inherent battle parameter tests exercise the real shared command and parameter rendering while replacing only the popup shell. They assert all ten fields, canonical Guard magnitude/duration/cooldown, Recovery resource percentages/shared cooldown and rich effect/bullet structure for Move, Attack and all Support choices.

Mounted local fixtures replace Next routing/image adapters; authenticated route/persistence and complete browser coverage are delegated to existing exact-head CI. Production private gameplay is not claimed by public smoke checks.

## Integration and release

Exact-head CI, merge, deployment and live verification pending. Keep Git deployments locked until the authorized verified release; restore the lock after readiness.
