# Resonance report presentation — 2026-10-02

Owner request: give Resonance the same parameter presentation as Skills. Base Main: `979176da6dcfc79a2f581d1bbf8a93200ed4012a`; isolated branch `agent/resonance-report-format-20261002`.

## Change and boundaries

`ResonanceParameters` is shared by Nexus hover/click reports, battle cockpit inspection in PvP/PvE, and Master draft previews. It keeps the ten canonical fields and passive N/A/Unavailable semantics, highlights magnitudes/durations through the Skill effect renderer, preserves each Result recipient and shows explanation bullets. Mode/Setup/Trigger follow the required fields; unchanged Trigger targeting constraints remain below them. Historical versions and draft definitions remain the display source.

Wide readers retain aligned label/value rows instead of inline colon labels. Long phone/tablet reports retain the existing document-flow fallback without a nested scrollbar. No combat mechanics, authoring schema, publication, database, rewards or fixed battlefield/cockpit geometry changes.

The Owner's subsequent formal Battle Log redesign remains a separate image-review proposal: character-grouped story entries, restrained result colors, supernatural passages and standard effect tooltips. No log code or new narration/template mechanics are included in this candidate. Whole-screen refresh/return flicker remains open; authenticated Production reproduction is blocked by sign-in/native credential protection.

## Verification

- Red: the real Master regression and actual mounted Nexus Quarry Edge report failed for missing shared effect magnitude markup.
- Green: 17 focused report/adapter/Master/battle tests, including sequence/immediate recipients, magnitudes/durations, historical definitions and missing metadata. The source-only Nexus guard no longer requires retired direct adapter calls; rendered tests cover report semantics.
- Full local `pnpm check` passed: format, lint, typecheck, 3,291 Vitest tests, seven Node checks and Production builds. A synthetic status fixture initially lacked its required `stacks` property, and an old source-string assertion still expected direct adapter calls. Both were corrected before the passing gate.
- Mounted actual Nexus catalogue: 765 full Essence/Resonance reports across 1024×576, 1280×720, 1366×768, 1536×614 and 1920×1080. No inner scroll, viewport clipping or page errors; Escape closes.
- Mounted shared battle cockpit: eight PvP/PvE states across 1024×576, 1366×768, 1536×614 and 390×844. Aligned rows/effects, full explanation, unchanged board/cockpit geometry, Escape/outside click and no inner scrolling. Long mobile reports use document flow.
- Adjacent Skill catalogue: 408 reports across 1024×576, 768×600 and 640×640. Aligned values, no inner scrolling/clipping; document fallback retains long tablet reports.
- Independent review approved without Critical/Important findings. Its CSS-specificity observation was corrected and verified in mounted battle reports; the recommended tablet Skill matrix passed.
- Fresh Main remains the base above; deployment is locked (`**: false`). Remote CI, merge and release are pending. No Production release is claimed.

Local evidence: `/tmp/av-resonance-unit-red.log`, `/tmp/av-resonance-format-red.log`, `/tmp/av-resonance-unit-green.log`, `/tmp/av-resonance-report-tests.log`, `/tmp/av-resonance-fit.log`, `/tmp/av-resonance-battle.log`, `/tmp/av-resonance-adjacent-skill.log`, `/tmp/av-resonance-full-check.log`.
