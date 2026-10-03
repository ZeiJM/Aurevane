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
- The dedicated timing migration is exercised with PGlite for Owner authorization, service-only access, immutable versions, malformed tags/modes and stale publication. Production application remains pending.
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

## Limits and release gate

Broader roaming, manual-refresh or tab-return flicker has not been reproduced; the proven timeout reload is fixed. An authenticated Production visual smoke remains unavailable through the existing sign-in boundary. Local mounted checks and remote authenticated CI do not replace that evidence.

The frozen final `pnpm check` passed: 3,404 Vitest tests (core2,057, web1,202, db63, validation60, audio17, realtime3, worker2), seven Node checks, formatting, lint, all types and Production builds. Worker boot passes. Terrain/summon browser files pass type/lint/format checks and discover nine project cases (existing mobile summon skip retained); database-backed execution is delegated to exact-head remote CI. Final log: `/tmp/av-chronicle-final-check.log`.

Exact-head CI, dedicated Production migration, merge, deployment source/alias verification and deployment-lock restoration remain pending. No new Production release is claimed here.
