# Essence and Resonance identity restoration

**LIVE for testing:** combined PR #946/source `2ace05d9684a3cef9f35c527db93c834ee4d50ec`; production READY06:47:42.438UTC and catalogue readback verified October19. See [combined release receipt](../../verification/2026-10-19-combined-owner-release.md). The following sections preserve the pre-release design/investigation and focused evidence; the combined receipt supersedes their pending release status.

Owner direction: October 19, 2026. This is a proposed content and execution design; it is not a release receipt.

## Intended experience

An Essence is a castable culmination of one Discipline. A Resonance changes how the two equipped Disciplines interact: a real setup, sacrifice or exploited opening produces a payoff. The Owner explicitly requests creative and memorable mechanics, permits HP costs and self-inflicted negative effects as meaningful tradeoffs, and generally excludes independent direct-damage Resonance buttons. A qualified tagged attack against a prepared target may receive a damage or persistent-damage rider.

Audit all 17 Essences and 136 Resonances. Retain a definition only when its actual execution meets this brief and has a distinct useful identity. Preserve stable IDs, eligibility, media references, unlocks, immutable published history and historical battle captures. Do not rewrite the ordinary 136 Skills or five Basics.

## Authoring rules

- Use registered native effects and executable requirement trees. Names and prose never implement mechanics.
- Resonances contain Automatic or Ongoing behavior, never a player-selected Manual activation. An Ongoing effect must fit the engine's existing maintained modifier capability.
- Bind every causal interaction to the intended actor and recipient. Targeting Self does not prove that the owner performed the global triggering event.
- Prefer conversion, rescue, resource circulation, status exploitation, risk management and disruption to additional damage. A damage rider must require a specific eligible attack and a meaningful target or owner state.
- Give every pair an individual reason for both Disciplines to matter. Evaluate differences in decisions, recipient, timing, geometry, resources, counterplay and outcome, rather than different status names alone.
- Use finite cooldowns and appropriate per-action, per-owner-turn or per-round activation limits. Never create self-sustaining recovery/resource/status reaction loops.
- HP payments are real costs, leave at least one HP and do not count as damage. Price them against actual current maximum resources. An intended self-debuff must not be removed by the same effect sequence or rendered irrelevant by global timing.
- Respect the current global timing policy. Do not create per-definition timing overrides or restore retired statuses. Barrier uses maximum-HP percentages. Nonzero target elevation remains a deliberate uncommon exception.
- Descriptions state the central interaction concisely. The shared modular report remains authoritative for values, requirements, costs, cooldowns and targets.

## Small shared engine addition

The audit identifies a missing causal relation predicate. Add one reusable `subject-relation` requirement comparing two existing roles (`owner`, `triggering`, `selected`, `affected`). Relations are `same-unit`, `ally` and `enemy`; ally excludes the same unit. Comparison uses server-derived combatant identity and team. Missing or ambiguous roles fail closed. This does not introduce distance, history, facing, stack-count or arbitrary expressions.

Populate identity/team only from native encounter subjects and immutable event frames. Treat relation predicates as state filters, not independent event pulses. A non-owner relation used by an Automatic action requires a supported event/action/crossing anchor in every satisfying branch. Integrate validation, requirement evaluation, native event dispatch, shared reports and the existing typed Master requirement editor. Existing definitions and captured battles remain unchanged.

No per-pair handlers, compatibility-trigger fallback or generic sequence-memory subsystem is included. If a proposed memorable interaction cannot be expressed by existing effects and this small predicate, redesign it or document and separately evaluate the necessary shared capability before implementation.

## Publication and verification

Create a new append-only proposal manifest with exact prior definition digests and individual design rationale. Do not alter the already released October 18 manifest. Validate every proposed record through the core schema and actual Master authoring service. Verify pure/mixed eligibility, stable identity and immutable history through actual publication/resolution paths. Cover negative trigger cases, unrelated actors, misses, rejected commands, replay, terminal states, activation limits, affordability, timing and viewer privacy. Exercise representative maximum outcomes and legal mixed/pure builds; inspect all records for duplicated mechanical recipes.

Refresh the hosted current-version/digest inventory before generating publication SQL. Use existing owner-authorized transactional CAS publication and exact readback; retain all historical versions and avoid character/build resets. After successful exact-source gates and review, merge and deploy the backward-compatible relation reader first, verify READY and the canonical source, and only then publish definitions that use the new predicate. A rollback to an older application must first restore compatible current catalogue pointers without deleting history. The earlier Account, movement, Barrier, Covert and Cleanse fixes continue independently and may release first.

Catalogue pointer rollback does not remove new predicates from existing battle captures. Keep a compatible application reader, or backport it, when serving those captures; restoring old current pointers alone does not permit an older application to read them.
