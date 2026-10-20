# Barrier casting, effective HP and Cleanse report correction — 19 October 2026

**LIVE for testing:** combined PR #946/source `2ace05d9684a3cef9f35c527db93c834ee4d50ec`; production READY06:47:42.438UTC and catalogue readback verified October19. See [combined release receipt](2026-10-19-combined-owner-release.md). The following sections preserve the pre-release design/investigation and focused evidence; the combined receipt supersedes their pending release status.

Local source verification only. Branch `agent/barrier-cast-hp-20261019`, base/main `8624c49a3853493cbea5f6b4855330bf0cd99117`. No publication, migration, hosted mutation or deployment is included. Final combined-branch quality, review and browser gates belong to the integrating release owner.

## Reproduction and root cause

The supplied Aegis report matches the current immutable correction definition: Aegis v7, recovery classification, 35 AP / 4 MP, two-owner-turn cooldown, Self/Ally, range 2, elevation 0 and 20% maximum-HP Barrier. Lifebinder Barrier v6 has the same relevant rules.

Real current-cohort captures already pass canonical native command preparation and settlement on self and ally at full HP. Each target remains at 1000 ordinary HP / 1000 maximum HP and gains a separate 200 Barrier pool. Full HP is not a cast-denial condition, and neither Barrier execution nor max-HP arithmetic required a mechanical change.

The battle page still categorizes both Skills as `defense` from their retained `cockpit:defense` tags. Their actual captured Manual behavior is `recovery`, so selecting either arms recovery. The controller recognized a recovery group outside the recovery menu only after an explicit behavior choice. These single-group Skills require no explicit choice. As a result, the selected Aegis/Barrier ID fell out of the active recovery selection and became Basic Recovery or an empty ID. The focused regression reproduced the empty ID before the fix.

The controller now provides the owned action's applicable captured groups to the existing recovery resolver. A single applicable recovery group keeps the selected Skill; explicit group choices remain respected and an ambiguous or missing group still falls back. There is no identity-specific Aegis exception.

Current source discrepancy retained deliberately: Aegis v7's legacy flat `effects` still contains Guarded, two turns, potency 1200; Lifebinder Barrier v6's flat `effects` contains Guarded, two turns, potency 1100. Their authoritative modular `ability.behaviors[].effects` contains 20% maximum-HP Barrier. The correction cohort already publishes the correct modular mechanics, and the runtime uses them. This patch changes no catalogue definition or historical capture and requires no new catalogue publication.

## Effective HP presentation and viewer privacy

The shared playable/spectator combatant card previously printed raw HP only and anchored a grey Barrier strip at the far right using Barrier / ordinary maximum. For a wounded unit, that strip could be separated from the red HP; at full HP it covered some red without showing the added effective health.

The card now displays ordinary HP + authorized active Barrier over the ordinary maximum. Red HP and grey Barrier are contiguous, with display capacity `max(ordinary maximum, HP + Barrier)` so protection above maximum remains visible inside the unchanged card dimensions. For example:

- 152 HP / 152 maximum + 38 Barrier renders `190/152`, red 80%, grey 20%.
- 35 HP / 80 maximum + 30 Barrier renders `65/80`, red 43.75%, grey 37.5%, followed by the empty remainder.

Accessible meter values follow effective health while the label also gives ordinary HP and Barrier separately. Ordinary HP, max HP, healing limits, HP costs, damage absorption and Pierce are unchanged. Pending grants do not count as active Barrier.

The component still reads only viewer-projected status rows. Four native projection-to-card regressions cover self, ally, opponent and spectator. Self/allies see the authorized pool. For opposing/spectator viewers inspecting a Covert holder, the complete card markup is identical with and without the hidden Barrier, including effective text, fills, ARIA, tooltips and data attributes. No authoritative hidden Barrier state is consulted by the card.

## Cleanse report polish

The supplied trailing status enumeration belongs to the following conditional recovery packet. Its executable requirement remains intact. The reader suppresses only a positive status-presence OR list that exactly repeats a preceding unconditional same-recipient Cleanse's eligible statuses, including Suppress, on a percentage-recovery packet. Other conditions remain visible. Recovery's explanation retains the dependency: “Applies only if the recipient has an effect that Cleanse can remove.”

Exact shared Effects rows from the actual current cohort, with Cleanse set to Instant:

| Skill | Before | After |
| --- | --- | --- |
| Field Remedy | `Cleanse [Instant], If (Burn [Self] or Bleed [Self] or Poison [Self] or Slow [Self] or Rooted [Self] or Vulnerable [Self] or Marked [Self] or Taunted [Self] or Suppress [Self]): HP Recovery [9%] [Instant]` | `Cleanse [Instant], HP Recovery [9%] [Instant]` |
| Dawn's Oath | `Cleanse [Instant], If (Burn or Bleed or Poison or Slow or Rooted or Vulnerable or Marked or Taunted or Suppress): HP Recovery [14%] [Instant], Guard [15%] [2 Turns]` | `Cleanse [Instant], HP Recovery [14%] [Instant], Guard [15%] [2 Turns]` |

The unchanged Cleanse explanation lists Burn, Bleed, Poison, Slow, Rooted, Vulnerable, Marked, Taunted and Suppress. Recovery's full resulting explanation is: “Restore HP based on the recipient’s maximum when this Skill is used. Healing Down reduces recovery. Cannot exceed the maximum or revive a defeated unit. Applies only if the recipient has an effect that Cleanse can remove.” Readers leave the supplied definition unchanged.

## Verification

Before implementation, focused routing/card tests failed in five assertions: lost implicit Aegis selection, wounded effective-HP text, and full-HP effective health across local/selected/acting card roles. They pass after the smallest routing/paint changes.

- Six focused/adjacent game-core files: **392 tests passed**. Includes actual current-cohort full-HP self/ally Barrier, Barrier damage/Pierce and historical captures, Blindside and attached secondary healing.
- Fourteen focused/adjacent web files: **182 tests passed**. Includes current-cohort owner projection → recovery selection → legal self/ally intent → native command settlement, real payment and cooldown rejection; shared cards; Covert projection/card equality; explicit/ambiguous group controls; full shared readers and remaining conditional/linked requirements.
- Focused ESLint passes for all changed web TS/TSX files with zero warnings, and the changed game-core test passes the root package lint configuration.
- Prettier passes for every changed source/test/CSS file. `git diff --check` passes.
- Final upstream refresh retains main `8624c49a`; no reconciliation was necessary within this task.

A root-level direct ESLint invocation initially skipped app files under the repository's root ignore rules; it was rerun successfully from the web package using its own configuration. The existing Vite CommonJS config-loader warning appears during Vitest, without failed tests.

No full quality/build/browser process ran concurrently with the integration owner's active World gate. Full `pnpm check`, whole-branch review and native browser acceptance remain required on the final combined candidate. Native Chromium/Docker are absent here and the existing hosted credential-observation boundary was not bypassed. No live gameplay acceptance is claimed.

Integration review added five direct negative reader guards: a conditional preceding Cleanse, another recipient, another requirement subject, a different status list, and ordinary non-percentage healing all retain the visible recovery condition. The focused file passes19tests. This closes the review's requested near-miss coverage without changing runtime behavior.
