# AUREVANE — C4 Audit, Combat Kernel v2 & Roadmap Amendment

**Status:** Owner-approved authoritative roadmap amendment.  
**Approved:** 2026-09-13.  
**Applies to:** Phase 4 and later phases where noted.  
**Branch at approval:** `agent/combat-effect-taxonomy-rework`.

This document records the Owner-approved outcome of the comprehensive TNR Core 4 audit and updates AUREVANE's forward development direction.

It must be read with:

- `docs/GAME_MASTER_PLAN.md`;
- `docs/ROADMAP.md`;
- `docs/COMBAT.md`;
- `docs/PHASE_4_TICKETS.md`;
- `docs/MASTER_PANEL.md`;
- `docs/OWNER_OVERRIDE.md`;
- the current combat-effect taxonomy/reaction/authoring specifications under `docs/superpowers/specs/`;
- `docs/superpowers/plans/2026-09-13-master-panel-combat-content-authoring.md`.

Where older roadmap sequencing conflicts specifically with the Owner-approved changes in this amendment, this amendment wins until the consolidated roadmap is reconciled. It does **not** mark planned work as already implemented.

The Core 4 audit is a reference for mature live-game problems and lessons. It is **not** permission to copy TNR source code, terminology, Naruto-specific assumptions, progression grind, architecture or balance equations. AUREVANE must independently implement the useful ideas in its own cleaner tactical architecture.

---

# 1. Strategic conclusion

C4's main advantage is not its damage formula. Its real maturity comes from years of solving combat and persistent-RPG edge cases:

- broad effect vocabulary;
- explicit effect ordering;
- barriers, drains, leech, reflect/recoil and penetration;
- cleanse/immunity/prevention interactions;
- action injection and summons;
- effect provenance;
- AI using real legal actions;
- battle snapshots and optimistic concurrency;
- authoring validation;
- combat analytics;
- versioned content/live operations;
- PvP/tournament/raid reliability;
- economy anti-duplication/concurrency safeguards.

AUREVANE already has stronger or more ambitious foundations in areas that should remain central to its identity:

- elevation, facing, terrain and positioning;
- explicit player-facing action forecasts;
- Primary/Secondary/Resonance/Essence buildcraft;
- deterministic server-authoritative tactical battle state;
- richer long-term tactical AI direction;
- future objective-heavy Expeditions and boss encounters;
- stronger intended art/audio presentation;
- versioned content tooling and Master Panel direction;
- the Unwritten Reach and Rekindling identity.

The approved strategy is:

> **Harvest C4's mature systemic lessons without importing its architectural baggage. Build the machine that can eventually express more depth with fewer special cases.**

AUREVANE is not becoming "TNR with better graphics." The goal is to surpass it through cleaner systems, stronger tactical combat, better tooling, better presentation and more sustainable content production.

---

# 2. Protected existing foundations

The audit does **not** reopen Phase 2 from scratch.

Preserve unless an explicit newer ticket changes a rule:

1. server-authoritative combat;
2. deterministic/versioned battle state;
3. expected-version/idempotency/concurrency protections;
4. shared legality across player/AI/PvP;
5. facing, elevation, terrain and board geometry;
6. Action Economy/AP model;
7. authoritative targeting/forecast boundaries;
8. immutable/pinned battle build state;
9. direct PvP, multi-combatant and spectator foundations;
10. existing approved Discipline/buildcraft contracts.

Existing work on `agent/combat-effect-taxonomy-rework` is credited toward this amendment. Do not throw it away or restart the redesign from zero.

First migration passes should preserve behavior where practical. Balance changes must be isolated, measurable and explicit rather than hidden inside architecture migrations.

---

# 3. Approved damage direction

## 3.1 Keep AUREVANE's readable defense curve

The current diminishing-return defense relationship remains the preferred foundation:

```text
DamageAfterDefense = max(1, floor(RawDamage * 100 / (100 + EffectiveDefense)))
```

Armor, Ward or a later explicitly typed defense kind supplies `EffectiveDefense` after bounded penetration or other approved modifications.

This is deliberately easier to reason about than the legacy C3 exponential/compressed formula.

## 3.2 Add explicit offensive progression

Ordinary authored combat Skills should move toward:

```text
RawDamage = AuthoredBasePower + OffensiveScaling
```

Representative ordinary scaling:

```text
OffensiveScaling = floor(SelectedOffensivePower * SkillScalingCoefficient)
```

A Skill must explicitly declare its scaling source/profile. Do not infer scaling from flavor text or presentation tags.

Approved typed scaling sources may include, where a Skill identity justifies them:

- Physical Power;
- Mystic Power;
- a named universal attribute;
- maximum HP;
- missing HP;
- distance;
- target state/status;
- approved stacks/resources;
- summon/support potency;
- another bounded typed source approved later.

No single universal stat should silently improve every property of every Skill.

## 3.3 Canonical high-level damage flow

The intended direction is:

```text
authored base power + explicit offensive scaling
→ penetration / effective defense
→ Armor/Ward diminishing-return mitigation
→ tactical modifiers (facing/elevation/terrain/element where applicable)
→ outgoing/incoming modifiers
→ barrier / redirect / interception
→ committed HP damage
→ post-damage reactions
```

Use deterministic integer or fixed-point arithmetic. Do not introduce hidden floating-point nondeterminism between live/server/test/client forecast paths.

## 3.4 C4 target-TTK idea becomes a balancing tool

Do **not** copy C4's attacker-level HP baseline into normal runtime damage merely to force a fixed number of hits.

Instead, the Balance Harness/Balance Lab will evaluate target TTK against benchmark level/stat/loadout profiles and report the result. Designers tune authored power/scaling coefficients from evidence while the runtime equation remains understandable.

---

# 4. Combat Kernel v2 — clean mechanical grammar

C4 demonstrates that a mature RPG needs many combat interactions. AUREVANE should not answer this by creating one giant "everything is a tag" runtime union.

Separate four concepts.

## 4.1 Effect Operation

An immediate authoritative state mutation, such as:

```text
damage
healing
resource-change
apply-status
remove-status
displace
create-terrain
spawn-entity
despawn-entity
barrier-change
```

Only add a new operation when it is a genuinely distinct mutation that cannot cleanly be composed from a status/trigger/modifier.

## 4.2 Status

A versioned state attached to a combat entity with explicit:

- duration/expiry;
- stack rules;
- categories;
- modifiers;
- triggers;
- provenance;
- cleanse/dispel/immunity rules;
- visibility/privacy rules.

## 4.3 Gameplay Tag

A semantic fact used by requirements, interactions, AI, player presentation and authoring validation, for example:

```text
Wet
Burning
Bleeding
Guarded
Exposed
Covert
Revealed
```

A gameplay tag is not automatically executable behavior.

## 4.4 Trigger / Modifier

A typed rule that reacts to a named lifecycle event or modifies one named calculation stage.

Examples:

```text
afterDamageDealt -> recover bounded qualifying HP
beforeHpDamage -> absorb through barrier
afterDamageReceived -> reflect bounded qualifying damage
endTurn -> periodic damage
beforeActionLegality -> block an action category
beforeDamage -> modify damage if an approved condition matches
```

This lets lifesteal, poison, recoil, reflection, execute-like payoffs and future interactions share one deterministic framework instead of becoming unrelated special-case engines.

---

# 5. Canonical versioned combat-resolution pipeline

Combat Kernel v2 must define and regression-test one explicit ordering. The approved conceptual stages are:

```text
1.  command validation / actor authority
2.  AP/MP/cost/target/LoS/geometry legality
3.  resolve target set and action context
4.  accuracy / evade / guaranteed-hit rules where applicable
5.  pre-hit reactions and prevention
6.  build raw potency from authored power + typed scaling
7.  penetration and Armor/Ward/effective defense
8.  tactical modifiers: facing/elevation/terrain/element
9.  outgoing and incoming modifiers
10. barrier / redirect / interception
11. commit HP/resource mutation
12. on-hit / after-damage triggers
13. bounded lifesteal / recoil / reflect / retaliation
14. status / terrain / tactical-entity consequences
15. defeat / objective / round / battle-state checks
16. event log / analytics / replay metadata
```

Implementation may split these stages more finely, but the ordering must be explicit, versioned and tested. Never depend on incidental array/import order for rules semantics.

---

# 6. Trigger-chain and recursion safety

Before reaction mechanics multiply, add engine-level safety:

- causal `triggerChainId` or equivalent;
- bounded trigger depth;
- per-instance execution guards where required;
- reaction budget where required;
- explicit policy for whether triggered damage may trigger another reaction;
- deterministic simultaneous-trigger ordering;
- source/action/controller provenance;
- hard tests for reflect↔reflect, lifesteal-from-reflect, redirect cycles, summon loops and similar chains.

Ordinary Master Panel configuration must never be able to create an infinite combat loop.

---

# 7. Effect provenance

A combat effect/status instance must be able to retain enough provenance to answer who caused it and which content version produced it.

The model should be able to represent the equivalent of:

```text
instance ID
definition ID
definition/content version
ruleset version
source combatant
controller/owner
source Skill/item/Resonance/Essence/Soulmark/Mantle/scenario action
target
created round/turn
remaining duration
stacks
trigger-chain provenance
copied-from / inherited-from where applicable
```

This supports kill/quest credit, Copy/Mirror, summons, cleansing, debugging, PvP adjudication, analytics and exact replay.

---

# 8. Generic effect categories instead of bespoke prevention sprawl

Prefer category capabilities over a large set of one-off `PreventX` effects.

Initial categories should include or cleanly represent:

```text
Damage
Healing
Control
Movement
ForcedMovement
Buff
Debuff
DamageOverTime
HealingOverTime
Barrier
Summon
Resource
Stealth
Mark
Terrain
Transformation
```

Examples:

```text
immuneTo: [Control]
cleanse: [Debuff, DamageOverTime]
prevent: [ForcedMovement]
```

The Interaction Linter must reject unknown or mechanically impossible category interactions.

---

# 9. Advanced mechanic primitives approved for the kernel

Engine support may exist before broad content use. Every primitive must be typed, deterministic and bounded.

Approved high-value families:

- barriers/shields;
- bounded penetration/pierce;
- HP/MP/resource drain;
- bounded lifesteal/recovery-from-damage;
- recoil/self-cost damage;
- bounded reflect/retaliation;
- redirect/interception/protection;
- heal amplification/reduction where approved;
- resource-cost modification with floors/caps;
- range modification with legality recalculation;
- category cleanse/immunity/prevention;
- temporary action grants/injection;
- controlled Copy/Mirror capability for future identity Skills;
- typed periodic damage/recovery;
- weakness/condition modifiers through the shared modifier path.

Establish explicit ruleset ceilings for powerful stacking families, including where applicable:

- maximum damage reduction;
- maximum reflection;
- maximum recovery-from-damage;
- maximum penetration;
- barrier limits;
- minimum resource/AP/MP costs;
- trigger depth/budget;
- tactical-entity/summon limits.

Caps are authoritative rules, not UI hints.

---

# 10. Tactical Entity foundation

Do not model future summons only as a `Summoned` tag. The battle kernel should eventually support typed tactical entities such as:

```text
Combatant
Summon
Deployable
Destructible Object
Objective Entity
Trap/Hazard
```

Not every tactical entity needs a full initiative turn.

Prefer owner-linked/bounded-command designs where appropriate so larger battles do not become summon turn-bloat.

A tactical entity must define:

- authority/controller;
- team/allegiance;
- occupancy/pathing interaction;
- targetability;
- lifetime/despawn rules;
- whether/how it acts;
- action/resource budget if applicable;
- kill/reward/credit provenance;
- AI visibility/evaluation.

This foundation is intentionally brought forward because Phase 6 co-op and Phase 7 Expeditions/bosses will need it.

---

# 11. Unified Action Source model

All granted actions should feed the same legal action enumeration instead of one-off UI handlers.

Conceptual action sources:

```text
Basic
Primary Discipline
Secondary Discipline
Essence
Equipment
Soulmark
Mantle
Status-granted
Tactical entity / object interaction
Scenario / objective
Temporary encounter grant
```

A granted action still uses normal authoritative cost, target, condition, repeat-use/cooldown and legality checks.

This supports equipment Skills, Mantles, Soulmarks, levers, boss mechanics, rescue actions, scenario interactions and temporary encounter mechanics cleanly.

---

# 12. AI amendment

Keep AUREVANE's stronger long-term AI direction. Do not replace it with generic player auto-combat.

Add a declarative policy/rule layer to the deterministic legal AI architecture:

```text
hard encounter rules
+ utility scoring
+ tactical search/lookahead where the AI tier permits
+ personality/risk weights
+ deterministic tie-breaking
```

AI rules may inspect only legitimate knowledge.

Every new Combat Kernel mechanic must have:

- legality support;
- player forecast/presentation support where visible;
- AI candidate/scoring support, or an explicit documented reason it does not apply;
- regression coverage for hidden-information/non-cheating boundaries.

---

# 13. Snapshot and replay-grade data foundation

Preserve this invariant:

> A combat command should not depend on surprise mutable gameplay reads halfway through deterministic resolution. Relevant mutable combat data belongs in the pinned battle snapshot or a deliberate deterministic boundary.

Move the **data foundation** for replays earlier even though polished player-facing replays remain Phase 8.

A mature battle should be reproducible from the equivalent of:

```text
ruleset version
content bundle/version references
map version
committed participant/build snapshots
initial deterministic seed/RNG state
ordered command stream
explicit external-result receipts where such a boundary is unavoidable
```

This enables exact replays, tournament adjudication, exploit investigation, AI regression testing and balance debugging.

---

# 14. TypeScript hardening is now a cross-phase engineering requirement

TypeScript is a first-class engineering priority beginning immediately in Phase 4.

## Required standard

New authoritative gameplay systems must use:

- strict TypeScript;
- runtime validation at trust boundaries;
- discriminated unions for gameplay variants;
- exhaustive handling of combat unions;
- typed/versioned battle snapshots/content definitions;
- typed result/error contracts;
- database result typing;
- zero unresolved TypeScript errors at ticket completion.

Use branded/opaque IDs where they materially prevent mistakes, for example:

```text
BattleId
CombatantId
SkillId
StatusDefinitionId
TacticalEntityId
ContentVersionId
```

## Unsafe escapes

Do not introduce `any`, broad unvalidated casts, or non-null assertions in authoritative combat/economy/progression code merely to satisfy the compiler.

If a legacy compatibility bridge is unavoidable:

1. isolate it at the boundary;
2. runtime-validate it;
3. document why it exists;
4. create an explicit retirement path.

## Phase-4 hardening pass

Prioritize the highest-risk weak boundaries rather than cosmetically rewriting the whole repository:

- combat command/event/effect/status unions;
- battle snapshots;
- content definitions and versions;
- server request/response contracts;
- IDs/entity references;
- database JSON payload validation;
- AI candidate/result types;
- Master Panel draft/publish types.

Adding a new effect union member should cause compile-time failures in authoritative places that forgot to handle it rather than silently doing nothing.

---

# 15. Master Panel moves forward — Combat Operations Foundation only

Do **not** move the entire Phase-13 panel into Phase 4.

Phase 4 now owns the minimum safe operating system required to scale combat content responsibly:

- Combat Content Studio;
- Effect/Status Catalog;
- Discipline combat-definition tooling where needed;
- Essence/Resonance editing where compatible with current authority;
- AI profile/rule inspection and tuning;
- Balance Lab v1 / simulation surfaces;
- Battle Inspector and replay/debug metadata inspection;
- draft → validate → semantic diff → preview → publish;
- immutable published versions;
- rollback through publication pointers rather than history mutation;
- combat-content kill switches/disable controls with audit metadata;
- Interaction Linter results;
- basic combat analytics and content-usage telemetry.

The existing detailed plan `docs/superpowers/plans/2026-09-13-master-panel-combat-content-authoring.md` remains useful for the versioned authoring implementation, but its authorization model is superseded by the Owner-only rule below.

Phase 13 becomes the **complete consolidated game-operations suite**, adding later world/story/economy/social/support/event systems to the operating foundation that begins in Phase 4.

---

# 16. Owner-only Master Panel identity and security

The Owner has explicitly required that the Master Panel be attached **only to the Owner's account**.

Because this repository is public, the Owner's private login email must **not** be hard-coded or committed into repository source/documentation.

Use the following secure design:

1. Keep the Owner-supplied login email in a **server-only deployment/bootstrap secret**, conceptually `AUREVANE_OWNER_EMAIL`.
2. During protected bootstrap, resolve that exact authenticated Supabase account to its immutable `auth.users.id` UUID.
3. Pin/store the canonical Owner UUID in a protected server-only configuration/owner-identity record, or use an equivalent server-only owner-ID secret.
4. Runtime `/master` authorization compares the authenticated `auth.uid()`/session user ID against the canonical Owner UUID.
5. The email is a bootstrap locator, **not** the recurring authorization primitive.
6. No browser-visible variable, `NEXT_PUBLIC_*` value, hidden UI flag, client role or user-editable profile field may grant Master Panel access.
7. No ordinary role/permission row may grant `/master` access to another account.
8. Every Master Panel route, server action, API/RPC and privileged mutation must independently enforce Owner identity server-side.
9. Unauthorized users receive no privileged data even if they guess a route or call an endpoint directly.
10. High-risk Owner Override actions additionally require explicit confirmation, reason and re-authentication where appropriate.
11. Owner access changes/recovery are break-glass operations with immutable audit; they are never delegated through ordinary staff UI.

### Current delegation ruling

Older Master Panel documents anticipated staff roles and delegated panel permissions. Until the Owner explicitly changes this ruling:

> **Only the designated Owner account may access `/master` or Master Panel privileged APIs.**

Future staff/moderation/content workflows may be designed later, but they must not silently weaken this Owner-only Master Panel boundary. If delegated operations are later approved, use a separately explicit security design and Owner authorization.

The detailed Master Panel authoring plan's older test wording that allowed "Owner/content staff" is therefore superseded: Phase-4 Master Panel combat authoring/publishing is Owner-only.

---

# 17. Interaction Linter moves earlier

Schema-valid content can still be mechanically impossible.

The Interaction Linter must grow to reject or explicitly warn about cases such as:

- summon/spawn effect with impossible target geometry;
- lifesteal without qualifying damage;
- recursive reflect/redirect configuration;
- stacks exceeding status maximum;
- facing/rear payoff on an impossible target relationship;
- tactical object missing occupancy/lifetime rules;
- unknown cleanse/immunity category;
- temporary action grant referencing missing/disabled content;
- unbounded modifier stacking;
- new effect lacking AI/forecast support;
- content requiring combat data that is absent from the pinned snapshot.

Run the same semantic validation in CI/content tests and the Master Panel publish flow.

---

# 18. Balance Harness v1 moves forward

Before significantly increasing combat-content volume again, build a headless deterministic simulation harness over the **same game-core combat rules** used by live battles.

Minimum inputs:

- build/team definitions;
- level/stat benchmark profiles;
- equipment/content bundle version;
- map/version;
- AI policy/tier;
- PvE/PvP ruleset;
- deterministic seed range;
- iteration count.

Minimum outputs:

- win rate;
- turns/actions to kill;
- damage/action;
- damage/AP;
- healing/resource efficiency;
- Skill/action usage;
- status uptime;
- barrier/reflect/leech contribution where applicable;
- resource exhaustion;
- first-player advantage;
- map/side bias;
- matchup matrix;
- crash/illegal-action/outlier counts.

Simulation is evidence, not proof of fun. Human tactical/visual/listening acceptance remains required where the roadmap calls for it.

---

# 19. Revised Phase-4 execution gate

Phase 4 remains active, but before major additional combat-content scale it now includes a **Combat Grammar & Operations Gate**.

Recommended sequence:

```text
P4.K0  Reconcile live branch/runtime truth + TypeScript risk audit
P4.K1  Canonical Effect / Status / Gameplay Tag / Trigger domain types
P4.K2  Stat-Scaled Potency v2 + compatibility fixtures
P4.K3  Versioned resolution pipeline + trigger safety + provenance
P4.K4  Advanced primitives and generic effect categories
P4.K5  Tactical Entity foundation
P4.K6  AI legality/policy/scoring integration
P4.K7  Interaction Linter / semantic validation
P4.K8  Balance Harness v1
P4.K9  Replay-grade command/ruleset/content provenance
P4.M   Owner-only Master Panel Combat Operations Foundation
P4.K10 Behavior-preserving migration of currently published content
P4.K11 Controlled balance pass using simulation + human evidence
P4.K12 Combat grammar/operations acceptance gate
```

This ordering may be split into smaller safe tickets. Do not publish broad new mechanic families before their kernel, legality, forecast, AI and authoring-validation support exists.

The existing effect-taxonomy/reaction work on the active branch is part of this program and should be reconciled against these requirements rather than discarded.

---

# 20. Later roadmap amendments from the audit

## Phase 5 — Living World / Story / Supernatural Identity

Add these requirements:

- combat emits authoritative domain events instead of directly knowing every quest/world system;
- scenario/objective actions use the unified Action Source model;
- story/world authoring inherits versioned draft/validate/publish patterns;
- important encounters pin content versions where reproducibility matters;
- Soulmark/Mantle combat mechanics reuse Combat Kernel v2 rather than parallel bespoke engines.

## Phase 6 — Party & Co-op

Add explicit requirements for:

- per-player command ownership;
- reconnect-safe ownership;
- tactical-entity controller/ownership rules;
- ally redirect/protection/interception semantics;
- shared objective actions through normal legality;
- deterministic reaction ordering in larger teams;
- team-AI coordination tests without hidden information.

## Phase 7 — Expeditions / Boss PvE / Deep Frontier

Add explicit requirements for:

- Tactical Entities powering destructible objects, hazards, boss components and objectives;
- declarative boss policy/rules layered over legal AI;
- replay/reproduction metadata for long runs and boss failures;
- transactionally safe rewards and anti-duplication receipts;
- suspend/reconnect correctness across ruleset/content versions;
- boss/objective scenarios in the Balance Harness.

## Phase 8 — Competitive PvP / Seasons / Tournaments

Player-facing replay polish remains here but inherits the earlier replay-grade data foundation.

Add:

- immutable competitive build/content snapshots;
- ruleset/content-version adjudication;
- map/side/first-player bias reports;
- action/effect usage telemetry;
- impossible-command/version-mismatch exploit flags;
- spectator/replay privacy for hidden-information mechanics;
- safe content-disable/rollback without rewriting completed matches.

## Phase 9 — Roster / Combat Content Expansion

Content expansion is gated by evidence from the Master Panel, Interaction Linter and Balance Lab.

Every new mechanic family must demonstrate:

- typed engine support;
- authoritative legality;
- AI handling;
- player readability/forecast handling;
- semantic linting;
- balance/simulation coverage;
- counterplay;
- VFX/SFX/media budget.

Do not expand merely because the schema makes authoring easy.

## Phase 10 — Social World

No major combat-architecture change from the audit. Preserve moderation/auditability and allow safe battle/replay references for build sharing, guild activity and competitive identity without leaking hidden information.

## Phase 11 — Economy / Crafting / Trade

Import C4's hard-earned integrity lessons, but use PostgreSQL/Supabase-native architecture rather than copying its implementation.

Explicitly require:

- no item duplication under concurrent use/trade/craft;
- guarded/transactional balance mutations;
- no negative currency/resource state;
- idempotent reward/fulfillment receipts;
- immutable item provenance where required;
- stale-snapshot protection;
- safe compensation/recovery for interrupted multi-step workflows;
- inventory/economy concurrency property tests;
- economy telemetry and anomaly detection.

## Phase 12 — Nations / Large-Group Identity

Use authoritative domain events/receipts from combat and world systems rather than coupling combat resolution directly to nation logic. War/campaign contribution must be idempotent and auditable.

## Phase 13 — Complete Master Panel & Long-Horizon Operations

Phase 13 now **consolidates and expands** the operating system begun in Phase 4.

It adds the complete world/story/event/economy/Expedition/PvP/support/media/feature-flag/owner-override operations surfaces rather than building combat tooling from scratch.

The Owner-only access rule remains in force unless the Owner explicitly authorizes a future delegation redesign.

## Phase 14 — Production Presentation

Combat mechanics added through Kernel v2 require production-grade visual/audio grammar so players can understand categories such as barriers, reflection, control, stealth/reveal, summons, drains, terrain changes and triggered reactions without reading raw logs.

## Phase 15 — Security / Scale / Exploit Hardening

Add focused adversarial testing for:

- reaction recursion/cycles;
- content-version mismatch;
- replay tampering;
- Master Panel Owner-identity bypass;
- direct privileged endpoint access;
- battle snapshot races;
- summon/entity ownership exploits;
- double reward/loot claims;
- inventory/currency duplication;
- PvP hidden-information leakage;
- authoring rollback/version abuse;
- malformed legacy content/type escape paths.

---

# 21. Engineering execution rules for this program

1. Use the current live branch/repository truth before each ticket; other AUREVANE work may continue concurrently.
2. No force-push/reset of shared history.
3. Use small coherent tickets and test-driven development for runtime changes.
4. Architecture migration and rebalance are separate concerns where practical.
5. Server authority remains absolute for combat, rewards, inventory, progression, PvP, economy and Master Panel operations.
6. Validate every external input server-side.
7. Use atomic/transactional mutation for multi-row state where required.
8. Reuse existing types/services before creating parallel systems.
9. Historical battle/content snapshots are never rewritten merely because current definitions change.
10. New mechanic support is incomplete until legality, AI, forecast, tests and authoring validation agree.
11. `pnpm check`/current equivalent repository quality gates and focused coverage must pass before completion claims.
12. Verification-before-completion is mandatory; evidence before assertion.
13. No Vercel Production or Preview deployment unless the Owner separately and explicitly authorizes it.

---

# 22. Immediate next step

The approved immediate direction is now:

```text
CURRENT PHASE-4 COMBAT EFFECT/TAXONOMY WORK
        ↓
RECONCILE AGAINST THIS AMENDMENT
        ↓
P4.K0 — TYPE/RUNTIME RISK AUDIT
        ↓
P4.K1+ — COMBAT KERNEL v2 FOUNDATION
        ↓
P4.M — OWNER-ONLY COMBAT MASTER PANEL FOUNDATION
        ↓
BALANCE HARNESS + CONTROLLED MIGRATION/BALANCE PASS
        ↓
PHASE-4 ACCEPTANCE GATE
        ↓
PHASE 5
```

AUREVANE's objective is not feature parity with TNR. The objective is to absorb the lessons of a mature browser RPG while building a substantially cleaner, more tactical, more expressive and easier-to-operate game platform.

## P4.K3 Combat Kernel provenance boundary — 2026-09-15

P4.K3 defines the behavior-preserving deterministic resolution/provenance substrate used by later advanced combat mechanics. `COMBAT_RESOLUTION_PIPELINE_VERSION = 1` fixes the following stage order: `command-validation`, `legality`, `target-context`, `accuracy`, `pre-hit-reactions`, `raw-potency`, `defense`, `tactical-modifiers`, `damage-modifiers`, `barrier-redirect`, `commit-mutation`, `after-damage-triggers`, `bounded-reactions`, `consequences`, `battle-state-checks`, `metadata`. Changing the semantic order requires a versioned contract change rather than silently reinterpreting V1.

Trigger chains are bounded and deterministic. Current infrastructure defaults are maximum depth 8, reaction budget 32, and triggered damage policy `non-reactive`; an effect instance may execute at most once per chain under the duplicate-instance guard. These are kernel safety ceilings, not a claim that every future reactive mechanic is implemented.

An optional `CombatResolutionContext` carries immutable command provenance and the trigger guard through authoritative execution. The historical four-argument `executeCombatAction(...)` shape remains valid and does not add provenance fields to historical state. When a K3 context is supplied, newly committed persistent status, ongoing recovery, Poison, Bleed, and Burn rows receive deterministic `CombatEffectInstanceProvenance` after the existing authoritative resolver completes. Provenance identifies the originating command/ruleset/controller/trigger chain, target, zero-based effect ordinal, and pre-command round/turn, with reserved copied/inherited lineage links for later typed Copy/Mirror work.

Historical snapshots may omit K3 provenance. Omitted provenance remains valid; if provenance is present, it is validated fail-closed. K3 does not alter damage values, AP/MP costs, targeting, accuracy, DoT values, durations, published content, or battle UX, and it does not by itself implement Barrier, Reflect, Absorb, lifesteal, redirect/interception, or other K4 mechanics. Those mechanics must consume this shared versioned pipeline and provenance model rather than create competing resolver or provenance paths.
