# Effect tags, beneficial Copy, battle readability and password recovery

Owner-requested continuation of the 2026-10-03 Nexus/Items and Battle Chronicle work. Branch `agent/instant-tags-discipline-selection-20261003` starts from fresh Main `d234a7b65d70ac0db3949e45c2a09d8176b53045`. The preceding header/watermark batch remains released; this document records the follow-up batch separately.

## Behavior

- Shared Skill, Support, Essence, Resonance and Master reports use the current tag timing policy; battle reports use immutable encounter policy. `[Instant]` retains magnitude/duration and excludes direct Dmg. Historical missing policy preserves original timing.
- Discipline editing uses a mint fill/stroke, inset selection strip and checkmark. Library selection has the same clear checkmark; card geometry stays fixed when switching slots.
- Every titled Chronicle action starts with the same decorative diamond. Outcomes remain beneath their action. Pending effects state the recorded activation round explicitly; missing records do not invent a round.
- Progression arrows remain between summarized actions. Final-facing summaries and player confirmation notices omit the direction glyph. Direction controls retain their functional icons.
- Copy transfers active beneficial effect tags from target to user without removing the donor's effects. Current encounters pin Copy policy 1; historical missing policy retains random temporary Skills at half AP. Copy eligibility, remaining lifetime/caps, typed persistent benefits and viewer privacy share engine authority. Authored stale temporary-Skill claims cannot override the current report.
- Battle effect summaries and descriptions use recorded potency; historical instances without potency retain their baseline. Differing strengths remain separate in aggregation.

## Password recovery

The login form adds **Forgot password?**, a compact email-only request and a generic confirmation. Recovery uses the existing confirmation callback URI, avoiding a new hosted redirect allow-list entry. A successful PKCE exchange identifies the trusted recovery flow and bypasses gameplay-session claim. The new-password page and POST verify the authenticated Supabase user plus a short-lived HttpOnly marker bound to that recovery session. The POST validates origin, password length and confirmation, updates through Supabase, and signs out before returning to normal sign-in. Invalid links have a friendly retry path. No schema change or client secret is introduced.

Local Docker is unavailable, so the actual Supabase/Inbucket email journey is assigned to the disposable Docker-backed CI browser runner. Unit and mounted presentation receipts are recorded below; successful live email delivery is not inferred from them.

## All-tag audit

| Family                                               | Verified contract                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Root                                                 | Pending allows movement; active blocks movement; attacks/Skills/facing remain legal; full affected-turn lifetime |
| Haste / Slow / Airborne                              | AP changes preserve Movement allowance; Airborne bypasses only Frozen surcharge                                  |
| Hastened / Delayed / Borrowed Hour                   | Bounded next-round Initiative only; no extra/skipped turns                                                       |
| Wet / Frozen / Conductive                            | Single storm bonus, Conductive consumption, fire removes setup statuses                                          |
| Frozen terrain / Steam                               | Both-team movement/sight effects, refresh and round-boundary expiry                                              |
| Guard / Expose / Off-guard                           | Pinned magnitude, stacking/caps and lifetime                                                                     |
| Inspire / Hex                                        | Outgoing cap; HP healing reduction including periodic recovery; MP unaffected                                    |
| Reckless / Fortified / Challenge / historical Marked | Linked tradeoffs and source/opponent conditions                                                                  |
| Mark / Blind                                         | Source-scoped accuracy, strongest eligible potency, automatic-hit preservation, cleanse/expiry                   |
| Warded                                               | Recognizes current typed Burn; active/pending/removed status condition boundaries                                |
| Burn / Bleed / Poison                                | Authored damage/duration, proper ticks/backlash, independent stacks, voluntary movement and lethal stop          |
| Ghost / Covert / Sensory / Revealed                  | Target selection, concealment break, viewer privacy, removal/reveal and doubled Skill AP                         |
| Displacement / Displaced / Revert                    | Bounded legal paths and Root/occupancy/elevation; no resource refund                                             |
| HP/MP recovery / Regeneration / MP Drain             | Activation timing, caps, recipient ticks and no revival                                                          |
| Barrier / Pierce                                     | Shield consumed before HP; Pierce does not bypass Barrier                                                        |
| Absorb HP/MP / Reflect / Vengeance                   | Committed damage basis, bounded ratios, no recursive reactions                                                   |
| Amplify / Curse / Cleanse / Dispel                   | Explicit eligibility, originals retained, typed DoT preservation, removal boundaries                             |
| Historical Summoned / current Summon                 | Historical protection preserved; actor joins next-round initiative and expires after completed turns             |
| Copy                                                 | Current beneficial tags and historical temporary-Skill version boundary                                          |

Three reproduced runtime defects were fixed: Poison forecasting used fixed damage 2 instead of authored power; Warded inspected only legacy status rows; any actor status with authored potency was mistakenly included in Blind's accuracy penalty. Root's authoritative pending-versus-active behavior was already correct. Regression coverage exercises both required and forbidden outcomes, including JSON reload and expiry. Supported kernel tag types do not imply publication in every static Skill.

## Verification receipts

- Real repository components and Production style imports mounted in a local browser harness. Four viewports (1366×768, 1536×614, 390×844, 320×568) passed slot/library selection, stable card geometry, configured Instant, constant Chronicle marker, explicit activation wording and horizontal fit. The initial 320px badge-wrap finding was corrected before the final pass. No runtime errors.
- Sixteen Nexus/Items header comparisons across eight viewports passed unchanged green selection, no added document height/horizontal overflow, no downward displacement, heading/tab separation and cross-route selector parity. These checks use the original pre-header baseline.
- Three management-dialog viewport checks passed watermark opacity/pointer isolation and controls, plus portrait modal regression flows inherited from the previous release.
- Current/historical Copy wording, timing policy propagation and stale authored override regressions are included.
- Password recovery presentation uses real components and Production style imports with mock Auth/network boundaries. Four viewports (1366×768, 1536×614, 390×844, 320×568) pass email-only request, exact existing callback URI, sign-in-only recovery control, password mismatch without submission, valid submission redirect, expired-link retry and horizontal fit. This presentation check does not replace the real local-mail CI journey.
- Independent final review is blocker-free after callback-failure retry, local test redirect port, Covert privacy, Copy provenance and legacy-fixture compatibility corrections. The focused Auth boundary suites pass 48 tests. Final mounted submit-hover checks retain the dark gradient at all four viewports; default sign-in also fits the 1536×614 short desktop.
- Real-mail CI exposed Next's internal `localhost` callback URL changing the browser's `127.0.0.1` origin, losing host-bound Auth/recovery cookies. Auth callback, claim, sign-out and reset POST now share validated browser-host resolution, reject unrelated/malformed hosts and ignore forwarded-host headers. Regression tests reproduce the redirect mismatch and POST 403 before the fix; seven focused suites pass 53 tests after it. Independent origin/security review has no Critical or Important findings. Real-mail E2E asserts exact origin and both cookie names; all six recovery cases run before the longer gameplay suite. Two representative-buildcraft assertions now match the current Instant and Guard cap/refresh prose.
- Full local `pnpm check` passes: formatting, lint, eight package type checks, 3,569 Vitest tests plus seven Node checks, and Production builds. Worker one-shot boot passes. Fresh Main remains `d234a7b65d70ac0db3949e45c2a09d8176b53045`; final diff check is clean. The first post-origin build exposed stale generated Turbopack modules; removing only generated `.next` output produced a clean successful build. The repeated full gate is the final receipt. Exact-head CI/release results are pending below. Authenticated browser coverage will use disposable CI accounts; no live account state is consumed by local presentation checks.

## Release boundary

The Owner requested all tasks live in one combined release and continued this related battle/Nexus work item. The candidate enables Main deployment only; other branches remain disabled. Require the full local gate, independent blocker-free review, passing exact-head GitHub workflows and a final Main freshness/tree comparison before merging. No schema migration or live content publication is required. Verify the Production revision and alias, then restore the full deployment lock in a configuration/documentation closeout.
