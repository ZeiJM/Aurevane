# Battle Chronicle and effect lifecycle — 2026-10-03

Owner-approved continuation of PR #809, based on Main `979176da6dcfc79a2f581d1bbf8a93200ed4012a`. The final approved parchment chronicle image governs presentation. The Owner explicitly approved merge and deployment after verification.

## Scope

- Shared text Chronicle groups complete viewer-authorized actions by actor identity within each global round. Ordinary movement, facing, end turn and expiry chatter are omitted from this view; saved history and exports retain their authority. Actual outcomes remain separate from short pinned authored narration. Names use charcoal, damage crimson, recovery green and special headings restrained gold.
- Existing versioned Skill, Essence and Resonance `flavorLine` authoring gains validated name, pronoun and explicit gender wording handlers. New encounters pin authoritative names and whitelisted pronouns; later profile edits do not rewrite those scenes. Missing immutable identity uses neutral wording. Gender remains neutral because character records contain no authoritative gender identity; appearance never determines gender. Live snapshots strip these narration pins. Verified effect-origin receipts permit exact special-result attribution; older untagged results retain their triggering technique.
- New battles pin a versioned effect timing policy: following global round by default, except direct damage and HP/MP recovery. Pending icons appear immediately; active durations expire after affected-character completed turns. Owner-only policy publication uses private append-only versions, a required reason and stale-version protection. Pre-policy battles keep legacy behavior; cooldown authority remains separate.
- Rail effects share canonical meanings, distinct short identifiers and truthful pending/active lifetime readers. Redundant targeting prose is removed, with mechanical facts retained in the ten canonical parameter fields.
- AI Battle Hall participant controls stay within the Arena control edges. A reproduced AI timeout document reload is replaced with authoritative in-place state reception.

## Verification

- Chronicle: eight focused RED→GREEN tests and adjacent feed/navigation tests; mounted actual shared PvP/PvE/spectator components in fifteen cases at 1024×576, 1366×768, 1536×614, 1920×1080 and 390×844. Canonical hover/click readers and Escape, fixed board/cockpit dimensions, full text outcomes and live follow/review anchoring pass.
- Arena: mounted production Battle Hall at seven desktop/tablet/phone widths, including 320px. The participant fieldset and white selects remain within the Arena select edges; linked ally/enemy limits retain the six-participant ceiling.
- AI timeout: six mounted cases cover playable AI and PvP, terminal defeat, a missing snapshot fallback and a failed fallback retry. There is one document and artwork request; authoritative state changes without replacing portrait nodes or paint. Terminal polling stops; foreign/stale/repeated snapshots cannot overwrite state.
- Retired log E2E contracts now assert the text Chronicle rather than removed toolbar/timeline controls. Mounted local checks cover fifteen layouts and deliberately reject a 40px map resize. Authenticated database-backed cases are part of remote CI.
- The dedicated timing migration is exercised with PGlite for Owner authorization, service-only access, immutable versions, malformed tags/modes and stale publication. Production application and permissions are verified below.
- Independent whole-change review reproduced five Important integration issues: delayed lethal boundary damage, originating-command privacy, removed summon references, typed active-icon continuity and delayed Covert bypassing Revealed. All five isolated reproduction tests now pass, with durable regression coverage. Additional checks cover activation-time Absorb/Reflect, pinned critical receipts, six-unit lethal transitions, area recipients surviving summon removal, JSON reload of terrain effects, and private provenance on the viewer's own rail. The first full quality gate passes 3,402 Vitest tests and seven Node checks, with formatting, lint, types and Production builds. A final gate follows the projected-pending movement fixes and browser contract updates.
- Real encounter → cast → activation → viewer projection → rendered rail tests cover finite and untuned Poison and Barrier depletion. Omitting active persistent projection reproduced all three failures. Ninety-one focused rail tests pass, with truthful until-removed and round-boundary lifetimes and unchanged two-row geometry. Sixty-one identity/privacy/factory/service tests and web typecheck pass. Chronicle pinned-name/pronoun regression passes alongside the original seven tests.

- Projected pending Root, Airborne, Covert and Revealed are excluded from shared gameplay readers until activation. Web movement and core sensory checks reproduced premature legality before the fix, then pass (22 web / 52 core focused tests).
- Earlier candidate CI identified a randomly seeded consecutive-AI fixture and obsolete Resonance effect-text assertions. The AI fixture now pins ID and RNG while retaining damage/hostile-team checks (15 tests plus three repeated composition matrices pass). Browser reports assert separate effect rows and the shared explanation list. Terrain and summon browser cases follow pending state into the next global round rather than expecting immediate activation.

Reproducible mounted commands:

```bash
pnpm --filter @aurevane/web exec node scripts/battle-launch-browser-regression.mjs
pnpm --filter @aurevane/web exec node scripts/ai-timeout-browser-regression.mjs
pnpm check
```

Local evidence includes `/tmp/av-chronicle-freeze-browser.log`, `/tmp/av-hall-freeze.log`, `/tmp/av-ai-timeout-freeze.log`, `/tmp/av-resonance-freeze-battle.log`, `/tmp/av-resonance-freeze-catalogue.log`, `/tmp/av-chronicle-full-check.log`, `/tmp/av-chronicle-contracts/report.json`, `/tmp/aurevane-preview-arena-green/geometry.json` and `/tmp/av-ai-timeout-final/evidence.json`.

## Limits

Broader roaming, manual-refresh or tab-return flicker has not been reproduced; the proven timeout reload is fixed. An authenticated Production visual smoke remains unavailable through the existing sign-in boundary. Local mounted checks and remote authenticated CI do not replace that evidence.

The earlier freeze `pnpm check` passed: 3,404 Vitest tests (core2,057, web1,202, db63, validation60, audio17, realtime3, worker2), seven Node checks, formatting, lint, all types and Production builds. Worker boot passes. Terrain/summon browser files pass type/lint/format checks and discover nine project cases (existing mobile summon skip retained); database-backed execution is delegated to exact-head remote CI. Final log: `/tmp/av-chronicle-final-check.log`.

The corrected candidate and Production release are verified below. This closeout restores the deployment lock.

## Exact-head CI correction

Published candidate `395b410e55e23130b8b1c7eb339925636c698735` (tree `8dfd48d84da216f6698aaeb5866d3b997a07ecde`) passed fourteen of sixteen workflows, including full quality, database authority, UI layout review, Desktop experience and Desktop page fit. Browser smoke and Representative Buildcraft caught missing delayed-terrain forecast descriptions and two stale effect-region selectors. No merge, migration or deployment occurred.

The forecast now reads canonical terrain projections without fabricating history events, and labels queued unit effects with their planned activation round and truthful lifetime. Two rendered tests reproduced the omission before the fix;32 adjacent renderer/interaction tests pass. Ten actual shared PvP/PvE cases show all nine projected terrain tiles, activation/duration/both-team rules, no inner scroll, Escape dismissal and fixed map/cockpit dimensions; desktop selection and full readers preserve the fixed strip. Existing mobile idle-to-selection strip reflow is unchanged. Source-specific queued projection purity and final broad gates follow.

The two E2E selectors now match the shared `combat effects` region. Unmodified selectors reproduced all four exact failures on real PvE/PvP mounts; corrected selectors pass, preserving all geometry and two-row/ten-column checks.

Correction freeze: three core forecast purity/scheduling regressions and the server transport regression pass, with 31 focused core / 18 service-PvP tests. The final corrected `pnpm check` passes 3,410 Vitest tests (core 2,060 / web 1,205), seven Node checks, formatting/lint/types and Production builds. Evidence `/tmp/av-chronicle-correction-check.log`, `/tmp/av-delayed-forecast-green.log`, `/tmp/av-delayed-forecast-browser.log`, `/tmp/av-rail-contracts/report.json`. All sixteen corrected exact-head workflows and the Production release passed; see the release evidence below.

## Release evidence

All sixteen exact-head workflows passed on candidate `990d6c3aa545adc5461c0c0b6fc997371d691d82`, tree `e8f5955a3599c36f2b389df12b5e014fabb6df5e`. Browser smoke run [37092872350](https://github.com/ZeiJM/Aurevane/actions/runs/37092872350) passed 65 focused, 302 full Chromium and ten Edge cases; intentional viewport skips remain. UI layout review passed 107 cases plus one directory case, Desktop experience 48, Desktop page fit eight and Representative Buildcraft 24. CI passed all 3,410 Vitest tests and seven Node checks, formatting, lint, types and Production builds.

Only the dedicated `combat_effect_timing_policy` migration was applied. Source filename `20261003015029_combat_effect_timing_policy.sql` is recorded by hosted migration history as `20261003040911`; the connector assigned the hosted timestamp, and historical migrations were not rewritten. Production read returns version 1 with empty modes (the approved default). RLS is enabled, anon/authenticated/service-role direct SELECT and UPDATE are denied, and only service-role can execute the fixed-search-path read/publish definer RPCs. Local database tests verify Owner assertion, reason, immutable versions and CAS. Security-advisor delta is only the expected INFO for the new private RLS table with no direct policies; existing findings are unchanged. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). No experimental policy publication, content activation, story/Drift migration or P5 migration occurred.

PR [#809](https://github.com/ZeiJM/Aurevane/pull/809) merged as `8a0f1f6da25a1bbadd1be80248fc8c5331d6aa44` with the identical tested tree. Configuration-only PR [#810](https://github.com/ZeiJM/Aurevane/pull/810) enabled only Main and released `96b468dc01e717e34f493849a18b49a4bcc3f453`. Vercel deployment `dpl_AFvAEsDpi49ovcvaS6XdnJmPZ1t9` reached READY at `2026-10-03T04:12:06.473Z`, with that exact source revision and root alias [aurevane.vercel.app](https://aurevane.vercel.app/). Public entry, Manual index, current Battle Hall guide, Rules and News return successful HTML responses. Deployment-scoped warning/error/fatal counts since creation are empty. The build-log connector reports UNAVAILABLE, so READY and the remote build gates are verified without claiming a separate Vercel build-log inspection. This closeout restores `deploymentEnabled: { "**": false }`.

Queued future destinations that become invalid cancel without a successful activation receipt; spent costs/cooldowns remain committed. Effects on dead/removed recipients are skipped. Authored narration is a short scene alongside recorded actual outcomes; it never determines mechanics.
