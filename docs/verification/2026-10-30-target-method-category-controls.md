# Target Method range and category controls

Status: local implementation, not live. Baseline main: `35ec32504ed23dcaac18b3916af2750ad27c2990`.

## Scope

- Eight-row full reports combine saved maximum range with Target Method, omitting a bracket for All. Movement retains its committed allowance beside Path. Missing captured shapes remain Unavailable; immutable history never resolves from current catalogue data. Shape-specific radius/length stay in help.
- Requirements no longer have a duplicate Target Requirement aim conversion dropdown. Use Range & Area to select Single, then the Requirements subject control selects Target when a unit aim exists. Keep selected-unit, tile-only, conditional and whole-action validation guards.
- Category activation/type controls are visible and disabled for Discipline Skills/Essences and Resonances. Preserve existing trigger and ongoing mechanics; new Resonance groups use the automatic passive starter. Basic and future container editors retain their existing choices.
- Fire element companions are generated with specified Chilled-only Conditional Cleanse. Current authoring labels consolidate old Chilled-only payloads, while captured historical identities and combat execution remain unchanged.

## Verification map

Shared render adapters, Master wrappers, native browser reader expectations and the current Manual are affected. Run focused display/editor/gating regressions first, then the web suite, core effect-authoring/elemental regressions, typecheck/lint/format and production build. Configured GitHub gates remain mandatory. Database schema, migrations, publication and World/movement/presence execution are unchanged; do not alter their tests or deploy resources as part of implementation. Native browser runs must verify desktop/mobile readers and Range & Area save/reload on GitHub if local Chrome remains unavailable. Do not claim local browser coverage without execution evidence.

Historical battle definitions and all Owner drafts remain untouched by this code patch. No content republication or database change is needed. Production remains the verified PR #992 build until a separately authorized release.

## Additional Owner requests in this batch

- Fix editable status duration/potency through the current authoring and strict save path. Generated elemental statuses retain authored duration and potency on unrelated edits; elemental companion validation accepts explicit durations 1–4 while retaining exactly-one unconditional matching companion, one stack and existing potency rules. Numeric duration/percentage controls allow clearing/replacing input without rewriting it to a default.
- Compact effect forms into four desktop columns, two narrower columns and one mobile column; align labels and inputs, reduce card padding, remove under-field guidance and move tag explanations into an i popup using the shared effect explanation.
- Omit Once per round from preview usage bullets; keep the captured limit and runtime enforcement unchanged.
- Long information popups retain normal width and a single-column report. Constrain height to the viewport and scroll inside the popup, preserving battle body locking, linked references, keyboard handling and modal portals.
- Current authored Pierce has no element selector, and Save/Commit strips any old Pierce element. Ordinary Damage keeps its selector. Direct Pierce receipts carry additive damageKind=piercing through sanitized log template values; compact, detailed and copied/Chronicle readers say piercing damage. Historical receipts lacking the marker retain their recorded wording.
- Existing category-incompatible modifier or Manual Resonance drafts have explicit repair guidance. Current create/commit validation and saved-publication checks enforce category rules; compatible trigger/ongoing behavior and historical validators are preserved. Basic actions remain independent.

Local Chrome launch was attempted with the available binary and fails before opening a page because socket creation is denied (Operation not permitted). Local unit/type/build results do not claim browser execution; retain strict desktop/mobile/short-viewport checks for GitHub.

## Skill sound repair

The canonical source admission path dropped selected audioCueKey metadata, and canonical cast events only carried uploaded audio. Add an optional strictly validated captured cue key, preserve absent historical metadata versus explicit null silence, and emit it from canonical Skill/Essence/Resonance and Basic use. Native Skill and Resonance events retain explicit silence and authored cue selection. Uploaded audio keeps priority; static assignment fallback remains available only for old receipts with no captured selection. Tests cover real capture → serialize/restore → activation → audio cue selection, capture immutability, malformed keys, neutral groups and silence. Browser audio unlock/mute/volume and physical audible playback remain acceptance checks.

Current-source projections and additive captured audio metadata require the new application reader. A future authorized deployment must retain all nine routing retirement rules and narrow allowed previous pins/hosts after promotion, as for the previous Line15 release, before allowing new captures. No database migration or content publication is requested by this patch.

## Skill names and final authoring refinements

Battle admission previously derived selected Skill labels from IDs. Both PvE and PvP now use the pinned definition's saved name via the shared display adapter, with a neutral fallback for unnamed UUID identities. The Kaio-ken regression reproduces the supplied identity/name mismatch. Current catalogue names never replace missing captured names.

Apply-status fields use a readable Status selector instead of a raw Status ID input. Internal payload IDs remain unchanged. Editor tabs gain explicit top padding and spacing.

Commit Now runs a synchronous conservative corrector on the authoritative complete-record create/commit boundary, followed by all existing strict parse, permission, revision, catalogue and publication checks. Nearby out-of-bounds power, status duration/potency and Reveal duration entries are rounded/clamped within the current rules; modern Line/Circle reach follows its chosen geometry. Missing required element companions are appended without deleting or rewriting authored conditional effects. Effect descriptions remain aligned by behavior/effect identity, including root-owned Essence mechanics. Each repair appears in the commit notice. Large numeric deviations, unsupported tags, ambiguous targeting, passive triggers and incompatible effects stay intact for explicit validation errors. No prose-to-mechanics model, new provider or background request is involved. Tests cover immutability, idempotence, note alignment, intent preservation, malformed recognized tags returning 400 and rejection before persistence.

Category rules apply to current writes/publication, while retained read-only preview simulations keep their valid historical activation modes. The validation endpoint also reports current category conflicts explicitly.

## Final local verification

- `pnpm check` passes: format, lint, all workspace types, 13,865 Vitest tests plus seven Node checks, and production builds. Final source includes the root-owned Essence description alignment regression; the last preview-guard delta also passes focused 204 preview/formula tests and targeted ESLint.
- Additional focused corrector/Pierce/complete-record/service regressions pass 152 tests, including malformed recognized payload rejection and original-input preservation.
- Shared Master parameter-palette and simple Requirements production browser fixtures compile successfully with their documented compile-only flags.
- Read-only code review found and verified fixes for companion description alignment and malformed-payload error handling; the final delta has no identified blocker.
- `git diff --check` passes. Fresh `origin/main` remains baseline `35ec32504ed23dcaac18b3916af2750ad27c2990`; no reconciliation was needed.
- Local Chromium execution remains blocked by `socket() failed: Operation not permitted`. Native desktop/mobile, popup geometry, actual zoom and browser audio interaction checks require the configured exact-head GitHub workflows. No local browser/listening pass is claimed.

No deployment, database mutation, content republication, history rewrite or Owner draft mutation was performed. Production remains the previously verified PR #992 release.
