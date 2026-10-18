# Attached Move command checkpoint — October 14

This is a nonshipping Task 3A engine checkpoint. It does not complete editable
Basics/Support Actions, the battle controller, Master editors or the overhaul.
The accepted targeting base is `1b3152144e025ebd38139b1c84a6d0544e3f8f7b`.

## Owner cost correction

An Attack or Utility Skill includes its attached Move effect in its overall
authored cost. There is no additional traversal AP, MP or HP payment, no walking
AP reservation and no traversal-price field on the Move payload. With 100 AP,
an 11 AP / 2 MP Skill leaves 89 AP / 18 MP after walking and attacking. A 100 AP Skill can
walk and attack after its single payment leaves 0 AP. An optional 60 AP modifier
and the 11 AP root cost 71 AP together; movement adds nothing.

The existing standalone native Basic Move still pays its own walking cost,
including terrain/status adjustments and its per-tile minimum. This preserves
historical behavior while the editable Basic resolver/capture is still pending.
An attached Move remains bound by its 1–20 entered-tile cap, remaining Movement,
orthogonal adjacency, terrain, occupancy, Jump/Airborne and Root.

## Implemented command boundary

- The registered payload is `move`, `recipient: actor`, `maximumTiles: 1–20`.
  It is first/once-only in a Manual action group, Instant only; Automatic,
  Ongoing, modifier and combined Summon routing remain unsupported.
- `CombatAbilityCommandInput.movementPath` carries only Ground references,
  separately from the unchanged follow-up selection. Origin, bounds, safe
  integers, field allowlist, adjacency and cap are validated before payment.
- Quotes use a pure planned-position projection. Wrapper/effect/modifier
  Requirements retain original pre-payment subjects and captured eligibility.
- One immutable paid capability binds the walking path. Before-use reactions
  happen after the single atomic participant payment. No walking repayment,
  re-composition or target reselection occurs.
- `combat-walking.ts` contains the single shared native step walker and pure
  movement legality/modifiers. The existing PV1F facade delegates to it and
  retains its native payment, repeat-history and consequence ordering. The
  canonical command reuses that walker with its already paid capability and
  existing parent native hooks/outcome queue.
- Actual steps stop at changed live legality, Root or defeat. Follow-up range
  uses the reached position. A defeated actor performs no follow-up; the paid
  interruption retains the overall Skill cost and resolves native consequences.
- Walking receipts inherit the original Covert command visibility without
  replacing an event's existing source visibility.

## Observed verification

The original registration/routing tests failed before implementation. The
included-cost focused suite passes 15/15. It covers quotes without mutation,
valid walking/follow-up, full 100 AP payment, affordable modifiers, AP/MP/HP atomic
payment, invalid/no-Move paths, remaining Movement, pure Utility Move, original
effect Requirements, Root interruption, historical Poison defeat at the actual
entered prefix, Covert visibility and unchanged standalone native 20 AP walking.
The Covert regression used a valid status capture and failed on missing
team-only visibility before the correction.

The initial wider run exposed a new module initialization cycle through the
PV1F catalog. Movement was extracted into the shared catalog-independent
helper; the five affected core import suites and the expensive neutral-stack
regression, together with Move, then pass 134/134 across 7 files. Fixture-only
errors in early Covert/Poison/AP100 attempts were corrected without weakening
source immutability or state validation. Those errors are not product RED proof.

Final checks pass on the saved code:

| Check | Observed result |
| --- | --- |
| Full core, `pnpm exec vitest run --maxWorkers=2` | 3,021 tests / 156 files |
| Full web plus Node checks, `pnpm --filter @aurevane/web test` | 2,443 tests / 293 files; 7 Node checks |
| Full DB unit suite, `pnpm exec vitest run` | 94 tests / 15 files |
| `pnpm typecheck` | All 8 packages |
| ESLint and Prettier on all 11 changed core files; `git diff --check` | Pass |

The initial simultaneous wider run also timed out the neutral-stack test under
contention. Its focused run and the complete core run with two workers pass;
no timeout threshold or gameplay calculation was weakened. One earlier core
launcher produced only its command banner, without a test result; it is not
counted as a passing run. The explicit Vitest command above supplied the full
3,021-test result.

Actual
transport/service persistence, PvE/PvP/AI/controller and native browser acceptance
for Move are still pending; this checkpoint does not claim them.

## Resume on High

Continue Task 3A with the actual editable Basic resolver, immutable new/old
encounter captures and every `SUPPORT_ACTION_IDS` option: `basic.guard`,
`basic.recover`, `basic.recover.mp`. Preserve one equipped Support slot 3 and four
Discipline slots. Basic Move's content identity is `basic.move`, its existing
catalog `actionId` is null and its native intent is `move`; `unarmed.basic`
content identity is distinct from `basic.attack.unarmed.basic` command identity.

Carry the reference-only path through shared activation/request validation,
preview/commit services, actual AI and both battle controllers. Basic zero-AP
offensive follow-up stays once per acting turn, including a miss; invalid intent
and free priming do not consume it. Stat-derived Basic Attack uses the higher
committed Physical/Mystic family, with Physical ties and positive authored AP.
Preserve Guard's independent cooldown and HP/MP Recovery's shared cooldown.
Controlled readiness, complete editors/public readers, World Environment,
map loading and the final all-tag creative balance/release remain later work.

Keep Account portrait work on its separate draft PR #902 branch. Its current
source is `03cd57b80ecc8eaa2f689fedd648c505291f5c6d`,
tree `6f274448f52dc50b9651a6824ce7ed47e5119ea9`. CI, Desktop experience,
Desktop page fit and UI layout pass; broader Browser is still running at the
last check. Targeting draft PR #899's accepted source now passes all six workflows,
including the complete Browser run 38546655759. Neither draft is newly live.
