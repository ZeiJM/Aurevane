# Character Creation workspace checkpoint

## Scope

Task branch: `agent/creation-workspace-repair`, based on the verified roster source at `c893d8ca8dacc82080f9e9e2fdf7954649f0387c`. Main and the earlier `agent/character-creation-hq-continuation` tooling checkpoint remain untouched. This is a UI-only checkpoint, not a release or acceptance of the entire 29-screen suite.

The supplied `aurevane_character_creation_screen.png` is the visual target. The real Identity workspace now leads with the forty-portrait library and square selected preview; name, Presentation and Starter appearance follow. Identity / Discipline / Confirm retain their existing state and server submission. Phones put the compact preview before the scrollable gallery and stack the fields and actions. Long content may scroll rather than being clipped or scaled into unreadable text.

## Reproduced defects

An obsolete global rule hid `fieldset:nth-of-type(2)` on Identity and the fifth confirmation fact. After the visible pronoun field had already been removed, those positions belonged to the portrait library and Portrait summary. Remove this rule at its source, rather than adding another override. A source guard and browser regression cover the regression.

The actual encoded portrait bytes failed Chromium decoding for 22 and 25-40: seventeen failures, despite the catalog containing forty entries. The existing saved repair recovers those same identities from the approved sheet. Portrait 01 uses the matching 400x400 preview; other repaired derivatives are 96x96. IDs and the catalog are unchanged. The source hash, crop boxes and derivative hashes are in `apps/web/src/media/starter-portrait-restoration.json`. Optional Python recovery/decoding tools state their dependencies and do not modify gameplay.

## Verification boundaries

Before implementation, an offline fixture of the real component with all application CSS reproduced the hidden gallery and the standalone Chromium decode guard failed for seventeen entries. After implementation, local Chromium 144 decoded all forty, and the component/page fixture passed nine viewport checks and Identity/Discipline/Confirm state-retention, keyboard, validation, budget, pending and same-key retry checks with zero page errors. Local fixture authentication, Next navigation/image and the request transport were stand-ins: those checks alone are NOT authenticated backend evidence.

The added `creation-layout-regression.pw.ts` runs against disposable local Supabase in the existing UI workflow. It creates and signs into an account, checks all forty real registered images, nine viewport sizes, keyboard portrait selection, all three steps, invalid name and attribute budget, retained choices, one explicitly injected 503, then a REAL API retry and persisted character after reload. Existing account, roster, Creation, deletion, Profile, Training, Hall, spectator, Adventurers and Battle regressions remain included. The injected failure is not a claim of a real service outage.

Obtain final exact-head CI/browser results and screenshots from the PR. No remote pass is claimed by this pre-run note. Local formatting and whitespace checks passed; full locked-dependency gates are additional.

## Preserved and remaining

No domain/catalog/API/schema changes. Hidden pronoun compatibility, presentation and appearance choices, all six attributes, available Disciplines, auth/slot routing and the creation request/idempotency implementation remain. Early name feedback reuses the existing domain validator. The deployment lock remains disabled for every branch. No merge, Production mutation or deployment was performed.

Decoding is not final art-quality acceptance: several original small portraits remain soft, and portrait 07 shows visible source artifacts. This checkpoint repairs loading and workspace behavior, not a newly generated high-resolution portrait set. Final Owner visual acceptance, remaining roster states/dialog accessibility, the other screen audit and deliberate reconciliation with newer main work remain separate.
