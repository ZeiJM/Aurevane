# Endure attack lock and feedback implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this authorized bug-fix batch.

**Goal:** Make Endure's attack restriction visible and authoritative, explain empty expiry, and shorten its application and popup prose.

**Architecture:** Retain the existing private Endure ledger and shared action classifier. Project only a safe per-action restriction flag for the controlled owner; consume it in buttons and command handlers. Record an optional, qualitative expiry result without publishing stored damage.

**Tech stack:** TypeScript game-core, server projection, React shared PvE/PvP components and Vitest.

**Spec:** Owner's November 1 Endure screenshot and four follow-up requests in this conversation; existing Endure authority in `docs/COMBAT.md` remains in force.

## Constraints and review focus

- Preserve movement, healing, support, pending casts, automatic reactions, recasting and private numeric ledgers.
- Do not infer empty stored power from missing historical data or from an out-of-range target.
- Keep mouse, keyboard, controlled preparation, multiple behaviors and direct commits consistent.
- Do not charge AP/HP/MP or advance RNG on rejected attacks.
- Preserve pending versus active timing, natural expiry versus defeat/surrender, current/historical captures and participant/spectator privacy.

## Tasks

- [x] Reproduce zero-base/scaled manual attack and UI availability gaps; add focused negative and allowed-support guards.
- [x] Extend the shared Endure classifier to every direct damage packet and project `endureBlocked` for owned captured manual actions. Honor this flag in selection, priming and Basic/Skill/Essence buttons while retaining noncast inspection.
- [x] Add qualitative `endureOutcome` to natural Endure expiry only: `empty` or `no-targets`. Project it through the existing safe log service, Chronicle and clipboard; retain historical silence when no receipt exists.
- [x] Replace application prose with a duration-aware sentence about locked attacks and stored damage; shorten captured and generic popup help. Test exact saved percentages/clocks without publishing stored totals.
- [x] Run focused core/projection/rendered/Chronicle tests, native desktop/mobile interaction fixture when available, then one full quality gate because the shared combat boundary changes. Refresh main, review the final diff and push a focused PR. CI must pass before any later release.

PR #999 is closed as superseded documentation after its merge conflicted with newer records; no deployment or application change was involved.

## Owner follow-ups incorporated November 2

- Highlight the entire legal tile footprint for non-damaging Single skills, retaining existing effect colors, range/LOS/elevation and recipient legality.
- Shorten all committed status execution prose and pending timing; Blind omits minimum Accuracy explanations while preserving percentage-point strength.
- Keep Reversal preparation family private from opponent/spectator logs and status popovers.
- Apply the attack lock to armed Reversal and Strain, including inherent Basic Attack (explicitly supersedes the earlier Strain fallback); keep support, movement and cancellation.
- Verification expands to canonical Reversal/Controlled authority, Basic/Discipline/Essence controls, historical Chronicle/clipboard, viewer privacy and exact footprint tests. Full `pnpm check` remains the final gate. The default Chromium install returned truncated archives, but the retained Chromium Headless Shell151 binary was recovered for native component verification.

## Verification receipts

- Endure zero-base damage and empty expiry were RED before their production fixes. Reversal/Controlled lock regressions were RED 3 before removing the Strain Basic exemption and blocking new offensive primes. Four focused core files now pass166 tests.
- Non-damaging Single reach produced14 expected mounted failures before the render predicate fix; focused spatial/palette/selection coverage passes145 tests.
- Concise narration was RED 41/44 before the helper rewrite; all44 direct cases pass. Chronicle/clipboard/context wording integration passes67 tests; full historical/current lifecycle coverage is included in the combined gate.
- Reversal family privacy was RED 5, including2 paired-cast context leaks after the visible-line fix;7 adjacent viewer/log tests pass175 cases, preserving Covert, owner/ally details, historical clocks and cost receipts.
- Generic control flags were RED 3; mixed cancellation was RED 1. Eight focused web files pass178 tests, including actual core → owner projection → rendered PvE/PvP Basic/Discipline/Essence locks with support, Move, End Turn and cancellation retained. Web TypeScript, scoped ESLint, Prettier and diff checks pass.
- Current main refreshed at91e9e0ed847fd74a9fd0532c52560cdc24c22095; no concurrent main changes at this checkpoint.
- Independent final review found no issues, including a follow-up review of three tests updated for intentionally retired verbose text. The full command-feedback browser fixture exits 0 using the retained Chromium Headless Shell151 binary: desktop/mobile PvE/PvP gestures, keyboard focus, proposed costs, duplicate guards and spectators pass with the final zero-page-error assertion. Authenticated hosted/device acceptance remains unrun. No hosted application deployment or content publication occurred. The combined quality gate exposed 8 obsolete wording assertions across 3 web test files; all 71 focused cases now pass and a final combined rerun will reuse unchanged package evidence.

### Final source checkpoint

The final `pnpm check` exits 0: formatting, lint, all package types, 15,477 Vitest tests (6,718 core; 8,138 web; 490 database; 131 other package cases), seven web Node checks and production build pass. Unchanged packages reused the successful first-run cache after the retired prose assertions were corrected; all web tests ran on the final source. The full native command-feedback fixture also exits 0 with zero page errors. Independent review found no issues, including the follow-up assertion review. Main remains `91e9e0ed847fd74a9fd0532c52560cdc24c22095`; source uses `agent/endure-attack-lock-feedback`. No merge or production deployment is included. Subsequent Ground authoring/animation work is isolated in a separate branch.
