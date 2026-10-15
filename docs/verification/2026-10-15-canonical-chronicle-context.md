# Pinned canonical Chronicle context — October 15

## Confirmed failures and behavior

Actual viewer-safe battle-log context still derived its fallback effect description from a canonical Skill’s stale native adapter. The default narration helper could likewise announce a legacy Summon that the canonical Skill never performs. A root-level canonical Essence was also narrated through its native nested adapter instead of the actual execution adapter.

Pinned canonical Skill fallback descriptions now use the registered labels and authored magnitudes from that exact Ability. Exact-cardinality authored explanation arrays from the same pinned record are preserved; mismatched native arrays cannot replace the canonical effects. The descriptor does not infer inherited timing from today’s global policy, serialize raw Ability groups, or add private command/source identifiers. Native historical Skills retain their previous descriptions and narration.

Canonical default narration is neutral: `{actor} uses {ability}.` Explicit valid authored battle text retains precedence. Essence fallback narration passes through the existing `essenceCombatSkill` adapter, so root and nested canonical definitions share execution’s actual source choice. Source identity, outer/nested versions and viewer visibility continue to be checked before optional context enrichment; current content cannot substitute for a pinned source.

## Verification

The first real service regression fails by announcing the stale Verdant Stalker summon for a canonical healing Skill. The independent core narration regression also fails on a stale companion. With canonical narration corrected but the old description path temporarily restored, two description regressions fail (native damage instead of `Heal [17]`, and a mismatched stale explanation). Restoring the fix passes while preserving the matching captured Owner note. A separate root-Ability Essence case first fails on native attack narration, then passes through the real Essence adapter; native and nested canonical cases remain green.

Four covering web files pass91 tests, including real pinned context, recorded outcomes, viewer privacy and clipboard behavior. The core narration suite passes four cases. These assertions retain version12/17 identities, reject unrelated version99/event-copy prose and retain private fingerprint/metadata omission. Existing authored-text, actor pronoun, legacy, hidden-source and source-version tests remain unchanged. The final Python-waited `pnpm check` exits0, with an explicit persisted exit receipt:6,140 Vitest plus seven Node checks, formatting, lint, all eight typechecks and both production build tasks pass. The first capture/session ended without a completion receipt; it is not used as full-gate evidence. The unchanged-source verified run is `canonical-chronicle-verified-check.log` with `canonical-chronicle-check-exit.json`. No product edits follow the successful gate before saving. Exact new-head CI remains pending at checkpoint save.

## Scope and remaining acceptance

No combat outcome, cost, movement, targeting, layout, artwork, stored event, publication, migration or live deployment changes. This is a bounded Task7 Chronicle-context correction; it does not close the complete twelve-surface audit, canonical Basic/Summon log metadata, versioned Tag prose, all conditional/reaction/maintenance reader cases, the creative rebalance or final release. New roster definitions and their authored text still require the approved design and execution tests.
