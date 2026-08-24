# AUREVANE — Phase 3 Signature Buildcraft Foundation Tickets

**Status:** Next major implementation specification after explicit Phase-2 closure.

**Created/Reconciled:** 2026-08-23

**Authority:** Derived from `docs/GAME_MASTER_PLAN.md`, `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, `docs/ROADMAP.md`, `docs/COMBAT.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/COMBAT_AI_TRAINING.md`, `docs/ROADMAP_PRODUCT_VALIDATION.md`, and the engineering/governance standards. If a conflict exists, the higher canonical authority wins.

This document exists so the instruction **“Phase 2 is done; code Phase 3”** has one precise execution meaning.

---

# 1. Owner transition instruction

The Owner may explicitly transition the project into Phase 3 with wording equivalent to:

- “Phase 2 is done.”
- “We are done with Phase 2; start Phase 3.”
- “Code Phase 3.”
- “Proceed to Phase 3.”

When that instruction is given in the current conversation/work item, treat it as **explicit Owner authorization to close the current Phase-2 feature phase and begin the Phase-3 execution sequence**.

Do not ask the Owner to repeat the authorization merely because older documents still show Phase 2 as open.

Before writing Phase-3 runtime code, perform the transition protocol below.

## Phase-transition protocol

1. Inspect current `main`, recent commits, open implementation PRs/issues, `TASKS.md`, `docs/ROADMAP.md`, and applicable canonical domain specs.
2. Confirm there is no unresolved merge/integration state that would make the starting baseline ambiguous.
3. Reconcile `TASKS.md` from Phase-2 testing to Phase-3 active work.
4. Record Phase 2 as closed by Owner decision. If PV-1 evidence exists, reference it. **Never invent tester counts, ratings or metrics that were not actually collected.**
5. If a PV-1 issue remains open, reconcile it factually through the available repository workflow before or alongside the transition.
6. Preserve Phase-2 battle/PvP/spectator infrastructure; audit and reuse it.
7. Start with **P3.1**. Do not jump directly to content volume or supernatural systems.
8. A Phase-3 coding authorization is **not** deployment authorization. Vercel deployment still requires a separate explicit Owner request.

---

# 2. Phase-3 goal

Turn the proven AUREVANE battle platform into the game's signature character-build system.

The phase must prove this mature core relationship:

```text
PLAYER-ASSIGNED ATTRIBUTES
+
PRIMARY DISCIPLINE BASE PROFILE
+
OPTIONAL MASTERED SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
PURE ESSENCE OR MIXED RESONANCE
+
EQUIPMENT / EQUIPMENT-SKILL COMPATIBILITY
```

Phase 3 is about **build grammar and meaningful identity**, not roster scale.

Do not pull the Phase-5 Soulmark/Severance/Mantle catalog into Phase 3 merely to make builds look richer.

---

# 3. Permanent Phase-3 invariants

Every Phase-3 ticket must preserve these rules:

- server owns all persistent build legality;
- Primary contributes the active Discipline base-stat profile;
- player-assigned Might/Finesse/Vitality/Agility/Intellect/Resolve remain separately owned;
- Secondary contributes no second base-stat profile;
- Primary and Secondary changes use independent server-owned attunement cooldowns;
- mature Discipline target is exactly eight learnable Discipline Skills;
- pure build capacity is up to eight Primary Discipline Skills plus one Essence Skill outside that cap;
- mixed build capacity is six total Discipline Skills across Primary + Secondary plus a Resonance passive;
- a mixed build has no pure-path Essence while Secondary is equipped;
- no separate player-facing Trait, Reaction, Movement Art or Ultimate slot systems are reintroduced;
- all usable non-basic Skills use the canonical combat targeting/requirement/effect grammar where applicable;
- cooldowns are server-authoritative and persist correctly across reconnect;
- Basic Attack, Guard and movement remain basic combat commands rather than Discipline Skills;
- Profile is the persistent build headquarters;
- battle screens consume a committed legal build snapshot rather than becoming a respec editor;
- saved loadouts never bypass attunement cooldowns, mastery, item ownership or other legality;
- AI obeys the same Skill/cooldown/build legality as players;
- existing PvP uses legal build snapshots rather than parallel PvP-only copies of the build system;
- current 100-AP combat authority remains governed by `docs/COMBAT.md` unless later explicitly revised.

---

# 4. Ticket sequence

Only one implementation ticket is active at a time unless the Owner explicitly authorizes a wider coherent batch.

Canonical Phase-3 sequence:

```text
P3.1  Discipline build authority + Primary profiles
  ↓
P3.2  Secondary Discipline + independent attunement cooldowns
  ↓
P3.3  Mature Skill schema + generic cooldown engine
  ↓
P3.4  Profile Skill configuration + pure/mixed capacity
  ↓
P3.5  Resonance framework + first representative mixed build
  ↓
P3.6  Essence framework + first representative pure build
  ↓
P3.7  Build snapshots across AI / PvP / saved loadouts
  ↓
P3.8  Representative buildcraft slice + PV-2 readiness
```

P3.5 and P3.6 may share reusable primitives, but neither may be skipped: Phase 3 must end with both mixed and pure identity represented.

---

# P3.1 — Discipline Build Authority + Primary Base Profiles

## Goal

Create one authoritative persistent build-state boundary and make Primary Discipline mechanically meaningful through versioned base-stat profiles without corrupting player-assigned attributes.

## Scope

Implement or reconcile:

- canonical persistent active-build representation;
- versioned Discipline definitions needed by the build system;
- Primary Discipline identity;
- versioned Primary base-stat profile data;
- authoritative derived-stat recomputation from base profile + player-assigned attributes + existing valid modifiers;
- server command for legal Primary selection/change;
- clear preview shape for current versus proposed Primary;
- no duplication/loss of assigned attribute points;
- source/provenance fields sufficient for audit/debug/support;
- Profile presentation required to inspect current Primary and proposed stat effect;
- stable IDs suitable for Skills, Resonance, Essence, AI, PvP and content tooling later.

## Explicitly deferred

- Secondary selection;
- full Skill loadout editing;
- Resonance/Essence;
- Soulmarks/Mantles;
- roster-scale content authoring;
- Phase-8 matchmaking/ranking.

## Verification

- changing Primary cannot alter stored player-assigned attribute investment;
- derived stats recompute deterministically;
- invalid/unknown/disabled Discipline fails closed;
- browser cannot write the active Primary directly;
- versioned definition changes do not silently corrupt existing character state;
- Profile preview matches committed server result.

## Acceptance

A character can authoritatively inspect and change a valid Primary Discipline and see a predictable base-profile/derived-stat change while their separately assigned attributes remain intact.

---

# P3.2 — Secondary Discipline + Independent Attunement Cooldowns

## Goal

Add the optional mastered Secondary Discipline and the commitment rules that prevent frictionless build-flipping from erasing identity.

## Scope

Implement:

- optional Secondary slot;
- mastery/eligibility validation for Secondary;
- independent server-owned Primary and Secondary attunement cooldowns;
- current production default of 4 hours for each timer unless a higher authority has changed it;
- trusted server timestamps;
- preview versus commit separation;
- clear remaining-time/lock presentation;
- ability to remove/replace Secondary only through legal authoritative commands;
- safe behavior across logout, reconnect, device change and browser clock manipulation;
- future Master Panel configurability boundary without building the full panel;
- telemetry/audit fields needed to understand changes and rejected attempts.

## Verification

- Primary change starts only Primary timer;
- Secondary change starts only Secondary timer;
- changing both through an approved combined workflow starts both;
- preview starts no timer;
- saved client timestamps cannot shorten a timer;
- logout/reconnect cannot bypass a timer;
- unmastered/illegal Secondary is rejected;
- concurrent build-change attempts resolve deterministically.

## Acceptance

A mastered Secondary can be equipped/changed under independent authoritative commitment timers that are understandable in Profile and cannot be bypassed by the client.

---

# P3.3 — Mature Skill Schema + Generic Cooldown Engine

## Goal

Create the reusable Skill grammar that every mature Discipline can use without one-off combat implementations.

## Scope

Implement/reconcile a versioned Skill definition containing, where applicable:

- stable Skill ID and content version;
- player-facing name/description reference;
- source Discipline;
- mastery/unlock requirement;
- AP cost through current Action Economy;
- target specification;
- requirement specification;
- deterministic effect sequence;
- tags;
- cooldown definition;
- AI legality/valuation metadata;
- PvE/PvP override hooks;
- media hooks;
- authoring/validation metadata.

Implement generic server-authoritative cooldown state and lifecycle.

Baseline rule:

- usable non-basic Skills have cooldowns;
- movement, Basic Attack and Guard remain basic exemptions;
- Recover/Heal cooldown follows current canonical design when this ticket is implemented; verify rather than copying a stale historical constant.

## Verification

- cooldown cannot be manipulated by client state;
- reconnect preserves cooldown state;
- AI sees/obeys the same cooldown legality;
- stale/disabled Skill versions fail safely;
- effect/target legality remains shared with combat authority;
- a Skill cannot be used twice through retry/race behavior when cooldown should block the second use;
- battle log/replay state can explain cooldown use/readiness.

## Acceptance

At least a small representative set of Discipline Skills can be defined as data, legally used through the existing combat engine, enter cooldown, reconnect, and become available again under deterministic server rules.

---

# P3.4 — Profile Skill Configuration + Pure/Mixed Capacity

## Goal

Make Character Profile the real build headquarters and enforce the central 8-versus-6 Discipline Skill contract.

## Scope

Implement:

- Profile sections for Attributes, Disciplines and Skills using the current product experience system;
- browse/inspect learned Skills;
- source labeling;
- pure Primary-only loadout capacity of up to eight Discipline Skills;
- mixed Primary + Secondary loadout capacity of six total Discipline Skills across the pair;
- authoritative validation of every equipped Skill source;
- duplicate/disabled/unlearned Skill rejection;
- atomic build-save command;
- clear invalid-state explanations;
- responsive desktop/mobile configuration UX;
- battle snapshot consumes committed build state rather than live Profile draft state;
- extension slots for Resonance/Essence, Equipment, future Supernatural and future Prestige without pretending those future catalogs exist.

## Verification

- pure cannot equip Secondary Skills;
- mixed cannot exceed six total Discipline Skills;
- pure cannot exceed eight Discipline Skills;
- only learned/eligible Skills may be equipped;
- client cannot spoof Skill source or count;
- concurrent saves do not create illegal hybrid state;
- combat reads a stable committed snapshot.

## Acceptance

A player can build a legal pure or mixed Discipline Skill loadout in Profile on desktop/mobile, and the authoritative battle snapshot matches that committed configuration.

---

# P3.5 — Resonance Framework + First Representative Mixed Build

## Goal

Prove that mixing Primary + Secondary creates a memorable passive interaction rather than merely six Skills from two lists.

## Scope

Implement:

- versioned Resonance definitions;
- pairing eligibility keyed by stable Discipline IDs;
- initial default assumption of one canonical unordered-pair Resonance unless a reviewed directional exception is approved;
- server-authoritative resolution from current Primary + Secondary;
- no Resonance when Secondary is absent;
- passive typed interaction hooks using existing combat tags/events/effects where practical;
- support for readable Skill-order/sequence interactions without introducing a separate Trait/Reaction system;
- Profile explanation and battle-context indicator;
- AI awareness where the Resonance changes legal/valuable decisions;
- PvP snapshot inclusion;
- first small representative Resonance set sufficient to test the concept.

## Verification

- illegal/missing pair cannot fabricate a Resonance;
- changing either Discipline resolves the correct new/empty Resonance under attunement rules;
- Resonance cannot be client-selected independently of the pair;
- passive triggers are deterministic and bounded;
- no recursive/unbounded trigger chain;
- battle logs can explain meaningful Resonance activations.

## Acceptance

At least one representative mixed build plays differently because of its Resonance, and the interaction is understandable from Profile/battle feedback without reading developer documentation.

---

# P3.6 — Essence Framework + First Representative Pure Build

## Goal

Give Primary-only builds a positive identity rather than treating the absence of Secondary as an unfinished build.

## Scope

Implement:

- versioned Discipline Essence definitions;
- one Essence Skill for each representative pure build included in the Phase-3 proof set;
- automatic legal Essence eligibility only while no Secondary is equipped;
- Essence Skill sits outside the normal eight Discipline Skill capacity;
- canonical Skill/AP/cooldown/target/effect grammar reuse;
- source labeling as Essence Skill;
- Profile explanation and battle presentation;
- AI legality/valuation support;
- PvP snapshot inclusion;
- removal/invalidation when Secondary becomes active.

## Verification

- mixed build cannot retain/use pure Essence;
- removing Secondary restores the correct eligible Essence only under authoritative build state;
- Essence does not consume one of the eight Discipline slots;
- reconnect/build switching cannot ghost-bind an old Essence;
- Essence follows normal cooldown and combat authority;
- Essence cannot become an unbounded disguised universal Ultimate outside balancing constraints.

## Acceptance

At least one representative Primary-only build has a clear, useful Essence identity and provides a real reason to remain pure relative to the mixed Resonance alternative.

---

# P3.7 — Build Snapshots Across AI, PvP and Saved Loadouts

## Goal

Make the build system reusable across the battle platform that already exists rather than creating separate single-player and multiplayer rule paths.

## Scope

Implement/reconcile:

- immutable/committed battle build snapshot shape;
- Primary/Secondary identity;
- equipped Discipline Skills;
- resolved Resonance or Essence;
- cooldown initialization/state rules;
- compatible existing equipment/equipment-skill references where currently supported;
- AI consumption of the same legal build snapshot;
- direct-PvP consumption of the same legal build snapshot;
- no mid-battle Profile respec;
- saved loadout foundation that stores only legal supported build fields;
- saved-loadout activation through one authoritative atomic command;
- attunement cooldown protection;
- telemetry/version identifiers sufficient for later balance analysis.

## Verification

- AI and human battle callers receive the same legality for identical build state;
- PvP cannot inject unavailable Skills/Resonance/Essence;
- saved loadout cannot bypass Primary/Secondary timers;
- mid-battle Profile changes do not mutate the active battle snapshot;
- reconnect restores the same battle build identity;
- battle logs/analytics can identify content/build versions used.

## Acceptance

The same character build can enter AI Sparring and the existing direct-PvP platform with one shared authoritative snapshot and no duplicate build-rule implementation.

---

# P3.8 — Representative Buildcraft Slice + PV-2 Readiness

## Goal

Finish Phase 3 with a small polished slice that can prove AUREVANE's signature buildcraft thesis before Phase 4 scales the roster.

## Representative slice

Use approximately four representative Disciplines or the smallest set that honestly proves:

- materially different Primary identities;
- Secondary mixing;
- legal 8-pure versus 6-mixed Skill selection;
- multiple real Skills/cooldowns;
- at least representative Resonance coverage;
- representative pure Essence coverage;
- small equipment interactions that change decisions where current item foundations support them;
- AI legality;
- direct-PvP legality;
- clear Profile configuration and comparison.

Soulmark/Mantle content is **not required** for the Phase-3 buildcraft proof. That supernatural fork belongs to the later world/story phase.

## Product evidence to enable

PV-2 should be able to test whether players:

- can explain Primary versus Secondary;
- understand the Primary base-stat consequence;
- understand pure 8 + Essence versus mixed 6 + Resonance;
- voluntarily try multiple builds/pairings;
- observe strategy changes from those build changes;
- ask curiosity-driven questions such as “what happens if I pair X with Y?”;
- understand cooldowns and Skill sources;
- can configure a build without excessive study/friction;
- can recover from a bad experiment without feeling permanently trapped;
- identify dominant, pointless, unreadable or redundant combinations.

## Acceptance / Phase-3 gate

Phase 3 is implementation-complete when:

- core Primary/Secondary authority is stable;
- Skills/cooldowns are reusable and server-authoritative;
- Profile supports legal pure and mixed build configuration;
- first Resonance and Essence frameworks are playable;
- AI and direct PvP consume the same legal snapshots;
- representative automated/database/browser tests are green;
- no known high-severity build-legality exploit remains;
- the representative slice is ready for the PV-2 product decision before Phase-4 roster expansion.

A Phase-3 implementation completion does not itself fabricate a PV-2 PASS. Product validation is recorded separately under `docs/ROADMAP_PRODUCT_VALIDATION.md`.

---

# 5. Explicitly deferred beyond Phase 3

Do not use Phase 3 to prematurely implement:

- broad 16/36 Discipline roster production;
- large Resonance matrix content volume;
- Soulmark catalog;
- the Severance story rite;
- Mantle catalog;
- world/quest/event engine expansion;
- co-op party systems;
- Expeditions;
- mature ranked/matchmaking/seasons/tournaments;
- Colosseum public discovery;
- full economy/crafting/marketplace;
- complete Master Panel;
- final production art/audio catalog.

Phase 3 may create only the minimum authoring/validation hooks needed to safely support its own buildcraft content.

---

# 6. Ticket implementation standard

Before each P3.x ticket:

1. inspect current `main`, `TASKS.md`, open PRs/issues and recent changes;
2. read the applicable canonical specs;
3. identify existing services/types/tables/components to reuse;
4. state exact data migration/compatibility implications;
5. state security/authority boundaries;
6. state automated tests;
7. state desktop/mobile manual acceptance where player-facing;
8. state product-evidence question protected/enabled;
9. implement the smallest coherent change;
10. reconcile `TASKS.md` after merge/completion.

Never deploy merely because a Phase-3 ticket is complete. Deployment remains Owner-controlled and separately authorized.