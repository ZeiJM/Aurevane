# Aurevane combat release — 2026-10-07

Released at https://aurevane.vercel.app/ under the Owner’s standing authorization to publish fully completed work. Start a new battle when checking the current targeting, DoT and elevation rules; existing encounters retain pinned contracts/maps.

## Exact release receipt

- Product PR: https://github.com/ZeiJM/Aurevane/pull/845; merged commit `144aed0f60e4defd068921894aa6039dc01b7c64`.
- Tested candidate: `36fff0401d83bf8602a4ef6846d2c3f3dc7ef205`; tested and merged tree: `9340b09d074d2a781e7a793e34bb8b34e1dce9ca`. Native verification head `6efd58d70b789f38526f2c8953312280eaf90069` has that same tree.
- Production deployment: `dpl_6aow4Lf9w3PbZvBViZ5fSodxqvxk`, READY observed `2026-10-07T10:16:31.896Z`. Deployment metadata identifies the merged commit and the canonical `aurevane.vercel.app` alias.
- Public smoke at `2026-10-07T10:17:37.509Z`: `/`, `/manual`, `/rules`, `/api/foundation/auth-status` all returned HTTP 200; the unauthenticated auth-status response correctly reported `authenticated:false`.
- Exact-deployment warning/error/fatal log scan from `10:16:31.896Z` to `10:17:43.248Z` returned no logs. This is a bounded observation, not a long-term monitoring claim.
- Git-triggered deployment remains disabled in `apps/web/vercel.json`; this documentation closeout does not create another application deployment.

## Verification evidence

Fresh combined combat and scoped elevation reviews completed. The final `corepack pnpm check` passed formatting, lint, types, 4,259 Vitest tests, seven Node checks and the production build. Native completion receipts recorded C8 (`d5b5c6d..6efd58d`), D7 (`d5b5c6d..6efd58d`) and E3 (`e019df5..6efd58d`), each with a successful `corepack pnpm check`.

All 17 workflows succeeded on the exact tested candidate. Final Browser smoke: https://github.com/ZeiJM/Aurevane/actions/runs/37598004857 (job `112715235000`). Actual browser results: four repeated early critical cases; six mail-recovery and three training cases; 73 focused Chromium passes with 21 existing skips; 322 full Chromium passes with 221 existing skips; ten Edge passes with two existing skips. No retries or newly added skips; the full suites stayed enabled. The early repeated Master case and full-suite Master case all passed, proving disposable Owner-fixture cleanup is repeatable.

Focused rendered matrices passed 42 current/historical targeting cases, 60 percentage reader cases, 28 rail/privacy cases and 54 completion-fit cases. Final full-suite Master percentage/elevation screenshots at 1366px and 390px were inspected: fields fit, the review dock does not obscure inputs, and actual publication/reload values match. Final spectator report/rail screenshots and desktop Line, blue buff and green heal targeting screenshots were inspected. The mobile Line screenshot was scrolled to the command deck with the map outside the viewport; mobile geometry acceptance comes from the rendered assertions, not a claimed visual inspection of that map.

Evidence artifacts for the same final run:

| Artifact | ID | SHA-256 |
| --- | --- | --- |
| Compact combat release screenshots | 11473979787 | `4fe83d1ab56a1a26fbd331cdd7ea2b3665587807e51b1185701565cfc29dab19` |
| Targeting screenshots | 11474392825 | `e8d0e5e7f3ce18550874e8e72208b0eba36e1c67db9890ec44f38ae461277149` |

## Production database receipt

Applied only `supabase/migrations/20261007034319_battlefield_elevation_policy.sql`, source SHA-256 `18a200e95bf07f4981efb7e6d9ab4e1e3b992bbe092cc1b1e3af7c35b02e007a`. Hosted migration name `battlefield_elevation_policy`, actual hosted version `20261007101310` (distinct from the source filename timestamp). Verified policy version 1 with basis-point weights 6000/3000/1000, RLS enabled, both client roles denied read/publication RPC access, and service-role read/publication RPC access granted. The seed audit reason records approved 60/30/10 defaults; absence of a seed publisher is intentional.

Security advisors changed from 44 to 45 INFO no-policy entries solely because this private server-only table intentionally has no client RLS policy. The existing single leaked-password WARN was unchanged. No unrelated migration/history repair, production account changes or experimental settings publication occurred. Final read-only Skill/Essence publication override query returned an empty list; no content conversion writes were needed.

The deployed tree also includes earlier released rounds A/B (PRs #843/#844): duration/idle handling, inherent-action metadata, identity colors, effect readers, animated VS, canonical Cleanse and damage/critical Chronicle receipts. Their earlier ledger notes are historical checkpoints; this receipt covers their current deployed state.

## Owner testing checklist

1. Open an Essence such as Aether Nova: bottom explanations include Damage and every authored effect.
2. Read Damage: clear Skill Power 1–20 explanation, no repeated per-Skill Power sentence; elemental interactions appear when authored.
3. Check Guard, Vulnerable and Defenseless through their full affected rounds, including initiative changes; rail tags do not expire early.
4. Time out after successfully moving or acting: no Lowered Guard. Fully idle timeout applies it; manual End Turn does not.
5. Open Move: 20 AP, N/A requirements, Move [1]/Instant, range from Move and target elevation from Jump; concise description. Terrain may change actual AP cost.
6. Compare Basic Attack with higher Physical/Mystic stats; equal stats choose Physical.
7. Compare lobby and battle VS: shared larger animated flames; reduced motion stays readable.
8. Start several new maps: independently rolled raised heights 1/2/3 default to 60/30/10; adjacent heights can differ.
9. In Master → Combat Settings change elevation percentages, totaling 100%; publish with a reason. New Battle Hall/PvP/world encounters use them; an existing battle keeps its map. Restore preferred settings afterward.
10. Start equal-initiative battles: first actor is randomly chosen at battle creation and stays pinned on reload. Chronicle order follows actual initiative each round.
11. Effect popup descriptions have no black highlight; Skill popups have no redundant arm-move footer.
12. Compare each character’s portrait borders and facing arrows on the rail/grid: identity colors stay consistent.
13. Pending effects are yellow; live beneficial effects green and debuffs red.
14. Popup explanations identify Root, Slow and other named tags individually.
15. Chronicle identifies actual elemental damage and critical hits. Check Damage Up against noncritical hits with otherwise equal conditions.
16. Cleanse matches across Skill/Essence/Resonance: Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked and Taunted.
17. Arm Basic Attack with no enemy adjacent: four cardinal potential tiles glow red.
18. Arm damaging Skills/Essences: full potential geometry remains visible when a target enters range; automatic detection does not remove other glows.
19. Aim Line in each cardinal direction: the whole lane glows and every eligible occupant can be affected; occupants do not block the lane.
20. Circle 1 covers eight external squares; Circle 2 covers 24 including inner rings. All follows authored ally/enemy/ground policy across the field.
21. Ordinary self buffs fill the tile blue outside the portrait/border. A healing/HP or MP recovery tag uses green; targeting does not disturb texture or input.
22. Percentage DoT descriptions agree across Skill, Essence and rail popups. Active rows show captured attack damage and next-tick HP; pending rows show timing and authored profile.
23. Burn/Poison valid reapplications replace and restart; Bleeds remain independent. Miss/resist/zero hostile HP loss does not apply or replace.
24. Burn decays by its authored percentage points and causes two-HP backlash once per damaging command. Poison adds a tick every five traversed tiles; movement carries between turns.
25. Copy Debuffs retains the donor basis/profile/remaining ticks and Burn stage without changing the donor. Cleanse/removal/defeat ends the appropriate applications.
26. Master → Combat Content percentage publication keeps precise values, rejects invalid definitions/stale versions and leaves existing battles pinned.
27. Check desktop/mobile PvE, PvP and spectators; reading/aiming does not spend AP, mutate state or reroll. Historical battles retain their pinned rules.

## Verification limits

Automated bounded DoT measurements are not an optimal-build, twelve-round reference or human playtest acceptance. Disposable authenticated browser tests do not claim a playtest against the Owner’s production account. The earlier account-specific login issue was not reproduced or claimed fixed.

## Rulings I made

- Ruling: refresh docs branch from current Main while retaining approved plan/spec — prior release metadata differs with identical product trees — cost if wrong: empty pre-implementation product diff required.
- Task 1: Ruling: skip fixed-power tuning for explicit percentage Bleed, finish value estimates in Task4 — authored profiles must survive — cost if wrong: estimates deferred only until roster step.
- Task 6: Ruling: render parity at final frozen browser gate — targeting plan changes same surfaces — cost if wrong: release blocked until actual browsers pass.
- Task 8: Ruling: combine browser/review/CI/release with targeting plan — shared combat surfaces, Owner requested overall live — cost if wrong: both plans pass shared gate.
- Task 8: Ruling: original C worktree detached at identical combined head for shared verification — preserve branch reference and one candidate — cost if wrong: exact tree identity and both gates required.
- Task 8: Ruling: after workspace reset both plan workspaces use restored combined checkout but own separate ignored ledger directories — published candidate preserves source; original local commit metadata was not uploaded — cost if wrong: no source reimplementation and fresh source/CI verification mandatory.
- Final: Ruling: fixture projects only its public non-concealed rows through the same core helpers, and compares them with the actual server spectator projection — importing server-only authority into the browser fixture would blur the client boundary — cost if wrong: ten parity cases and real 60-case browser checks gate release.
- Final: Ruling: correct stale Manual recipient-only glow wording as Important — it contradicts the later potential-footprint request — cost if wrong: documentation-only clarification; no targeting mechanic change.
- Final: Ruling: upload an additional compact success-screenshot artifact alongside the full archives — the final percentage archive is 42MB and full browser evidence exceeds the authorized downloader's 32MiB limit; direct file access was unavailable — cost if wrong: small extra CI storage only; preserve all original evidence and checks, and inspect the compact Master/spectator PNGs before release.
- Ruling: retain approved targeting docs and take product files from verified DoT branch — prior metadata differs but product trees match — cost if wrong: require empty product diff before implementation.
- Ruling: combine C/D final review/browser/CI/release — shared combat readers and Owner wants overall task live — cost if wrong: both plans must pass before release.
- Task 1: Ruling: extend exhaustive All reader/selection-key branches with type contract — type consumers need exhaustiveness — cost if wrong: subsequent focused AI/readers remain mandatory.
- Task 3: Ruling: allow version2 All range0 in V5.1 before roster step — required for canonical AI evaluation — cost if wrong: Task5 must reject contradictory LoS/range.
- Task 4: Ruling: keep historical V5.1 median-range baseline on pre-geometry versions and add current conversion counts — caster-centered geometry deliberately changes range meaning — cost if wrong: verify current shape limits separately.
- Task 6: Ruling: defer real Chromium to exact-head CI after missing executable/invalid download — local source/unit checks are not visual acceptance — cost if wrong: release blocked on real browser evidence.
- Task 7: Ruling: All Unit paints eligible units, All Ground eligible board, Line/Circle full footprints; Single healing excludes occupied enemies — approved spec distinguishes global recipients and healing parity — cost if wrong: adjust informational paint only, not canonical recipients.
- Task 7: Ruling: review frozen implementation before completing release task — merge/deploy must follow review — cost if wrong: no release before findings and CI settle.
- Task 7: Ruling: restore from identical published candidate after workspace reset, reconstruct ledgers from conversation — all source persisted on PR845 — cost if wrong: exact tree check and fresh corrected-source gate mandatory.
- Final: Ruling: regrade stale COMBAT authority as Important and explicitly supersede old Copy caps/stage rules — designated authority otherwise instructs mechanics conflicting with current policy — cost if wrong: documentation-only clarification, no saved-state change.
- Final: Ruling: missing browser finding is an evidence gap; add actual rendered and persisted tests rather than fabricate an arithmetic RED — current feature already exists — cost if wrong: corrected-head actual browser assertions and screenshot inspection remain release gates.
- Final: Ruling: elevation-percent controls are separately still authorized; DoT controls do not satisfy that original request — approved C/D do not explicitly revoke it — cost if wrong: retain60/30/10 defaults and apply settings only to new battles.
- Final: Ruling: keep full-offense balance report bounded, not twelve-round/optimal/human acceptance — measurements differ from that reference — cost if wrong: need specified reference/human study for further balance decisions.
- Final: Ruling: preserve historical optional provenance — conversions must not rewrite saved encounters; new dependency state validates — cost if wrong: historical trace detail stays at prior level.
- Final: Ruling: preserve Owner-spec Markdown hard breaks — spaces format supplied grids — cost if wrong: formatting only.
- Final: Ruling: preserve inherited self-damage legality while using a valid All Any buff fixture — CI exposed that the synthetic all-units attack included caster damage expressly deferred by the engine; global recipient geometry is independent of effect legality — cost if wrong: expanding self-defeat lifecycle requires a separate authorized mechanic change. Actual kernel probe confirmed legal All Any buff with four recipients after explicit elevation metadata.
- Final: Ruling: align the rapid Basic Attack browser assertion with its authored elevation limit after movement — CI37577162835 mobile asserted all neighboring heights were hittable, while independent level 2/3 tiles can exceed the unchanged one-level attack limit — cost if wrong: corrected-head real browser must still prove every eligible empty cardinal tile glows and both rapid attacks commit; no production mechanic change.
- Ruling: Complete the original editable elevation chance request without another approval stall — the Owner explicitly requested Master controls and repeatedly instructed implementation of all remaining work — costs a narrowly scoped settings extension if the earlier percentage reference was intended only for DoTs.
- Ruling: Accept percentages to two decimals including zero and 100, with an exact 100 total — basis points reuse the established precision and allow disabling a height — whole-percent-only expectations would merely expose extra precision.
- Ruling: Combine actual SQL and authenticated editor acceptance with Task 3 release CI — this execution host has no Docker server or working Chromium archive, whereas required CI provides both — publication remains blocked until that real acceptance passes.
- Ruling: remove stale timing editor claim that all active durations count owner turns — ordinary statuses now cover global rounds while DoTs have their own tick lifecycle — cost if wrong: copy-only removal of an inaccurate generalization.
- Ruling: include the existing world-encounter caller in combat policy propagation — exhaustive generator caller search found a fourth actual creation path; it otherwise ignores saved elevation chances and omits current timing/percentage policy — cost if wrong: a small combat-only integration in world-battle.ts; no travel, safety, eligibility, rewards or P5 content changes. Added actual world service→PvP constructor→persisted snapshot test with real geometry/build authority, mocked repositories.
- Final: Ruling: keep prior reviewed C/D and unrelated world authority outside elevation review — separate existing review and combat-only propagation cover scope — cost if wrong: exact-head combined browser/DB gates remain mandatory.
- Final: Ruling: update old Chilling Mist browser contract to caster-centered activation and own per-target hit chance — CI37567980787 failed obsolete selected-ground assertion; current approved Circle has no selected ground anchor — cost if wrong: actual canonical server forecast and browser matrix must agree before release.
- Final: Ruling: execute the already-authorized verified merge, additive elevation migration and production release without another finishing menu — Owner explicitly said completed tasks can be made live, and later asked to finish up — cost if wrong: remain inside this reviewed combat/elevation task and exact-head release gates.
- Final: Ruling: correct the Master arena selector and terrain-priced keyboard assertions — CI37579406419 reached 320 full passes but the inherited Arena label timed out before publication and the second one-step move correctly cost 40 AP on terrain instead of 20 — cost if wrong: actual Master publication and command-count/movement-budget/AP authority assertions must pass; production mechanics remain unchanged.
- Final: Ruling: run the two actual release-critical browser cases before long suites and preserve their success PNGs — the first complete browser run exposed stale test contracts after almost an hour, and later Playwright runs clear screenshots — cost if wrong: two extra early checks and small retained evidence; keep the full suite enabled and mandatory.
- Final: Ruling: assert the Master semantic diff's changed effects path, retaining exact 1234 basis-point publication and 12.34 reload assertions — CI37586647498 proved the established diff intentionally lists paths rather than values — cost if wrong: actual publish/reload/rollback acceptance remains mandatory; no production UI change.
- Final: Ruling: retry test-only surrender cleanup only after confirmed STALE_VERSION, refreshing authoritative battle version with a five-attempt bound — CI37589052886 passed both percentage layouts and desktop elevation publication/reload/audit/old-new pinning, then Recruit advancement made the new battle's create version stale — cost if wrong: other 409 failures remain fatal and every successful surrender still must advance the exact submitted version; production behavior is unchanged.
- Final: Ruling: correct inherited responsive Master review-dock cascade before release — actual390px screenshot hides the percentage field under a desktop sticky third column; matching selector specificity and final narrow grid rules restore normal flow — cost if wrong: no publication mechanics change, final mobile geometry assertion and screenshot inspection remain mandatory.
- Final: Ruling: revoke only the disposable Master test account's Owner role and advance its access version in finally — CI37590534383 passed the early Master and WASD cases,73 focused and321 full cases; its repeated Master test violated the intended single-enabled-Owner constraint because early fixture authority remained enabled — cost if wrong: preserve the production uniqueness rule and full repeated acceptance; no production accounts or permission changes.

## Deferred minors

None: the stale authoritative DoT documentation was regraded Important and corrected.
