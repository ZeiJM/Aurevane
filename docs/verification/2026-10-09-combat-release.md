# October 9 combat release

Released for testing at https://aurevane.vercel.app on **2026-10-09 at 19:39:19.428 UTC**. Human gameplay acceptance remains pending the [Owner checklist](2026-10-09-owner-test-checklist.md). Start new battles; saved battles retain their captured rules. Profile rebuilds are unnecessary for the new default Skill versions.

## Exact release

- [PR #854](https://github.com/ZeiJM/Aurevane/pull/854) merged as `dedb3d52876b494aaa7bafa916e42d7a5a7ad5b8`.
- All 16 applicable workflows passed on native head `294c498061f7fccbac36c9dffb998ae3a91abf7e`. Its tree, local reviewed `d1add5733c3dedb41e85f3e93aef2001988da050`, and the fetched merge tree all equal `1bd2e0cccff217ebba6b645bc3aee3e59244e50d`. Main stayed `8b7646ff7b3143c915fb13e8c3f943b6c8521634` until this merge; freshness was checked again before deployment.
- Production `dpl_4cv2DhwMGceW5jv6dwCk7Ct5AdSN` is READY from that exact merge SHA. The canonical alias resolves to this deployment. Automatic Git deployment remains disabled; this was one explicitly requested production deployment.
- The prior READY deployment `dpl_Bf3k5k72q9XMW96n1DTBxCWvxQv3`, source `e68c1b66e8608b13ef791ce592920a6b6b0fe69c`, remains the previous release reference.

## Verification

- Final-source `NODE_OPTIONS=--max-old-space-size=2048 pnpm check` exited 0: **4,720 Vitest tests plus seven Node checks**, formatting, full lint, eight-package types and production build. Game-core had 2,717 tests; web had 1,843.
- Actual mounted production-component matrices passed: targeting 76, elemental 24, summons 10, Suppress 14 plus 12 Chronicle popup interactions, and 16 new elemental Battle/summon popup openings. Desktop/mobile, current/historical policies, reduced motion, containment and browser errors were covered. Representative rendered Steam and corrected readers were visually inspected.
- Final native [Browser smoke run](https://github.com/ZeiJM/Aurevane/actions/runs/37972715604) passed its dedicated feature matrices, 4 authoring/movement, 6 reset, 3 battle-experience, 73 composition, 322 broad browser and 10 Edge cases. Existing project exclusions remained 21, 221 and 2 skips in their respective groups. No tests or assertions were disabled or weakened.
- Task reviews, the whole-branch review and its scoped reader fix review approved the changes. The subsequent mechanical wrapper and terminal-boundary reviews also approved specification and quality with no open findings.
- Seven production routes returned HTTP 200: `/`, `/manual`, `/manual/battle-hall`, `/rules`, `/news`, `/api/foundation/auth-status`, `/auth/reset-password`. Auth status correctly reported signed out. The Battle Hall Manual serves current Drenched, Chilled and Jump descriptions.
- Grouped production warning/error/fatal logs showed no entries in the bounded initial window **19:39:19.428–19:40:09.196 UTC**. This is an initial smoke observation, not a guarantee about later sessions.

## Release-gate corrections

The first native run passed the actual 76-case targeting matrix but its Playwright wrapper still expected 72. Two strict expected-count literals were corrected; real wrapper RED/GREEN proof passed with 76 cases and no errors. All other assertions, commands and workflow configuration stayed intact.

The next run exposed a genuine mobile AI team surrender error with two allies. A valid current-policy service fixture with player Initiative 19, Recruits 21, seed 9 and preceding Recruit turns reproduced terminal Initiative validation failure. This matches the native topology without claiming knowledge of its private seed. Active order pins the current actor and acted prefix; after clearing the current turn, terminal state requires canonical global sorting. Surrender, abort and terminal current-actor defeat now use the existing ordering helper before validation. Historical behavior, resources, RNG, exact completion receipts and absence of phantom turns are guarded. The independent reviewer passed 39 service plus 45 adjacent cases and reproduced base RED/head GREEN for the adjacent exits.

## Hosted migration

Committed `supabase/migrations/20261009151412_combat_suppress_timing.sql` was applied to project `luazfeupwfgnilohfsya` as hosted migration **20261009193628 / combat_suppress_timing**. The provider records its own application version; no migration metadata was rewritten.

The final hosted function body exactly matches the committed SQL, differing from the previous function only by the appended Suppress allowlist entry. All seven published Owner timing rows retained identical hashes; no policy version was published. Security definer, empty search path, Owner/CAS/lock/history validation and service-only execution grants remain unchanged. Anonymous/authenticated execution stays denied. No new security-advisor groups appeared. Elemental default publication pointers were empty at the immediate preflight; custom publications were not changed. Local PGlite regression gates covered publication authorization, version history, stale CAS and invalid input before application.

## Rulings I made

| Decision, in chronological order                                                                                             | Reason                                                                       | Cost if wrong                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Elemental debuffs require positive hostile HP loss after Barrier and a surviving recipient.                                  | Reuse canonical hit and removal semantics.                                   | Revise trigger policy and tests.                                               |
| Implicit elemental debuffs default to Instant and two affected turn ends; captured Master overrides prevail.                 | No new duration was specified.                                               | Retune defaults and new-policy readers/tests.                                  |
| Drenched reduces base Initiative plus current-round tempo by 10%, rounded once.                                              | Keep one effective Initiative calculation.                                   | Revise composition formula and tests.                                          |
| Area Fire uses optional `ground:true` with an Enemies/Ground choice.                                                         | Extend existing direction/activation intent compatibly.                      | Revise intent grammar and UI.                                                  |
| New Suppress authoring defaults to 25% for two turns.                                                                        | Stay within the requested ranges where no default was supplied.              | Change newly authored defaults.                                                |
| Initial exclusion of Suppress from new percentage-DoT basis was superseded before release.                                   | It would contradict existing actual-HP capture.                              | A contrary choice needs a hypothetical damage pipeline and coordinated rework. |
| New percentage DoTs capture actual settled HP loss after Suppress/modifiers/Barrier/HP cap; captured ticks remain unchanged. | Preserve the canonical formula and zero-damage basis.                        | Intentionally redefine capture with coordinated code, reader and test changes. |
| Static readers show conditional recipient profiles when selectors can overlap.                                               | Captured definitions lack encounter identities; avoid duplicating targeting. | Supply safe resolved recipient context or revise wording.                      |

No Suppress was assigned to existing Skills, Essences, summons or rosters. SMTP/auth configuration was preserved. This documentation follow-up does not require another production deployment.
