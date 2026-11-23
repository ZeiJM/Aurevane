# Canonical Summon command routing — October 15

## Implemented contract

Canonical Manual Summon groups now use the shared command's quote, atomic AP/MP/HP payment, usage/cooldown checks and interruption handling. A private prepared packet captures the exact source/version/profile, eligible S0 condition, selected empty Ground tile, facing, timing and cast visibility. The command resolves preceding compatible packets first, then the Summon, before after-action reactions. A successful spawn preserves the new combatant, placement, status/effect collections, deferred initiative and stat profile together; the stat-driven facade no longer overwrites the new profile with its original bridge.

Instant and explicitly or policy-scheduled Summons use the existing spawn/pending/lifetime engines. Queued casts retain their immutable profile, actual activation round and original source visibility. No second payment occurs at activation. A defeated/interrupted caster does not spawn or queue a Summon after paying. Existing cooldowns prevent replay. Actor HP payment cannot make an S0 conditional spawn newly eligible. Previews reuse commit's placement validator and do not construct an entity, mutate input or consume RNG. Impassable Ground is a failed quote before payment.

The supported combination is one final Summon packet in a Manual action group, targeting one single empty tile. Typed compatibility rejects middle-of-group, plural/area, Controlled, Automatic and Ongoing Summons; existing Move/Summon incompatibility remains. Preceding compatible actor effects remain ordered and supported. Explicit queued casts require a captured timing policy and current stat bridge; a missing historical policy fails before payment. These limits do not alter historical native Summon definitions or enable an unsupported combination through prose.

The standard build-aware AI now values an actual active/pending Summon outcome, discounts its delay and can select and commit it from exact captured sources after JSON reconnect. This is a bounded summon-utility addition, not a claim that the full creative roster's AI/balance acceptance is complete.

The actual Master preview reports the selected canonical profile and authored abilities rather than borrowing the native envelope. Only this canonical Summon fixture gains an explicit immediate-default timeline; authored packet timing overrides it. Legacy preview fixtures and live global timing rules are preserved. Existing public projection still strips execution metadata; the previously verified exact-profile Chronicle reader consumes the same pinned definition.

## Verification

The initial corrected fixture run has seven expected failures: six specialized-routing errors and the missing final-packet compatibility guard. Further witnessed regressions cover missing timing policy, passability quote behavior, three canonical Master preview cases, two standard-AI decisions and two unsupported target combinations. Invalid exploratory fixtures using non-self Rewind and Automatic Displace were rejected by existing rules; neither combination was enabled or counted as an engine defect.

Nine covering core files pass232 tests, including18 canonical Summon cases and existing native Summon, pending, lifetime, command, modifier, definition and AI regressions. Seven covering web files pass209 tests across real Master preview/service/handler and battle forecast/log/privacy/live projection boundaries. The canonical cases cover current and historical capture identity, later same-version catalogue mutation, one-time multicost payment, quote/replay immutability, no RNG draw, S0 conditional gates, inherited/explicit timing, original Covert visibility, paid defeat interruption, preceding effects and after-action reaction order, deferred activation and complete no-input lifetime cleanup.

The first full quality run stopped on test-only event typing: the public Pv1f transition deliberately exposes unknown receipts. The test now checks structured receipt shape before reading relevant fields; gameplay interfaces were not weakened. Core typecheck then passes. The verified Python-waited `pnpm check` exits0:6,170 Vitest tests plus seven Node checks, formatting, lint, all eight package typechecks and both build tasks pass. Its complete output is `canonical-summon-verified-check.log` with an explicit `canonical-summon-verified-exit.json` receipt. No product edits follow that gate before saving. New-head CI remains pending at checkpoint save.

No roster publication, hosted data/schema mutation, layout, artwork, merge or deployment change. The creative roster and final complete acceptance/release remain open.

## Inventory correction for the creative pass

The prior raw inventory contains136 Skills,17 Essences,136 Resonances,5 Basics,19 typed Tag entries and21 Phase4 statuses. The actual `PV1F_COMBAT_CONTENT.statuses` authority has26 entries: it additionally includes Guarded, Lowered Guard, Exposed, Covert and Revealed. The creative coverage manifest must classify all26, including automatic/system-only and compatibility status behavior, rather than assuming the21-entry subset is the complete live registry. The separate future equipment Armor boundary for Pierce remains unchanged; Physical/Mystic Defense is not equipment Armor.
