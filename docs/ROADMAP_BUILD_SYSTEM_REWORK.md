# AUREVANE — Roadmap Integration: Build System

**Status:** Binding build-system sequencing companion to `docs/ROADMAP.md` and `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`.

**Reconciled:** 2026-09-02

**Authority:** `docs/GAME_MASTER_PLAN.md` remains highest product authority. `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` defines the approved build contract. `docs/ROADMAP.md` defines current phase sequence. `docs/PHASE_3_TICKETS.md` defines the exact Phase-3 implementation order.

This version supersedes the earlier sequencing that placed the first Resonance and Essence proof in Phase 4. Under the reconciled roadmap, **Phase 3 now implements the complete signature buildcraft foundation, including first playable Resonance and Essence frameworks. Phase 4 scales and proves the roster/content built on that foundation.**

---

# 1. Canonical build vocabulary

Use:

```text
Primary Discipline
Secondary Discipline
Skill
Resonance
Essence / Discipline Essence
Soulmark
The Severance / Soul-Severed
Mantle
```

Retired player-facing build terms include:

```text
Current Discipline
Legacy Discipline
Art as the generic ability term
Confluence
separate Trait / Reaction / Movement Art / Ultimate slots
```

Internal compatibility aliases may exist temporarily during safe migrations, but new player-facing implementation and documentation use current terminology.

---

# 2. Mature build contract

```text
PLAYER-ASSIGNED ATTRIBUTES
+
PRIMARY DISCIPLINE BASE PROFILE
+
OPTIONAL MASTERED SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE-DISCIPLINE ESSENCE
+
SOULMARK OR SOUL-SEVERED MANTLE PATH
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE
```

## Pure build

```text
Primary only
8 Discipline Skills
+ 1 Essence Skill outside the Discipline cap
+ no Resonance
```

## Mixed build

```text
Primary + mastered Secondary
6 total Discipline Skills across the pair
+ Resonance passive
+ no pure Essence while Secondary is equipped
```

Primary supplies the active Discipline base-stat profile. Player-assigned attributes remain separately owned. Secondary supplies no second base-stat profile.

---

# 3. Phase-3 active boundary

Phase 2 is formally closed. Its mature battle/PvP/spectator/cockpit platform is frozen as reusable infrastructure unless a genuine regression is discovered.

Phase 3 is active and proceeds one canonical ticket at a time from `docs/PHASE_3_TICKETS.md`, beginning with P3.1. Compatible Phase-2 foundations receive reuse credit rather than being rebuilt.

The inherited platform already provides:

- the current 100-AP combat authority that later Skills will use;
- typed battle action/source foundations;
- persisted/reconnect-safe battle sessions;
- shared PvE/PvP battle presentation and authority;
- stable cockpit action categories and slot-owned hotkeys;
- selector-versus-execute behavior demonstrated by HP/MP Recovery swapping;
- AI, PvP and spectation foundations that later consume committed legal build snapshots.

Phase-3 work must extend these foundations without turning the battle screen into a persistent respec editor or reducing the full committed build to the four visible cockpit categories.

Production deployment remains a separate Owner-controlled action.

---

# 4. Phase 3 — Signature Buildcraft Foundation

Phase 3 is the primary implementation phase for the complete core build grammar.

It includes:

## Primary and Secondary

- versioned Primary base-stat profiles;
- authoritative Primary selection/change;
- optional mastered Secondary;
- independent server-owned Primary and Secondary attunement cooldowns;
- current planned production default of 4 hours per timer unless later changed by higher authority;
- Profile preview/confirmation;
- no loss/duplication of assigned attributes.

## Skills and cooldowns

- stable versioned Skill definitions;
- exactly eight learnable Skills per mature Discipline target;
- canonical AP/target/requirement/effect integration;
- server-authoritative cooldown engine;
- source labels;
- AI metadata;
- PvE/PvP override hooks;
- media hooks.

## Pure versus mixed capacity

- pure: up to eight Primary Discipline Skills;
- mixed: six total Discipline Skills across Primary + Secondary;
- authoritative loadout validation;
- Profile configuration;
- committed battle snapshots.

## Resonance — now Phase 3

Implement the first representative mixed-build Resonance framework/library in Phase 3.

Resonance is:

- resolved from an eligible Primary + Secondary pair;
- passive;
- versioned/data-driven;
- server-authoritative;
- readable in Profile and battle context;
- able to use typed Skill/tag/sequence interactions;
- not a generic percentage bonus by default.

Use one canonical unordered pair as the default authoring assumption unless a reviewed directional exception genuinely adds value.

## Essence — now Phase 3

Implement the first representative pure-build Essence framework/Skills in Phase 3.

Essence:

- exists for a Primary-only build;
- grants one special Essence Skill outside the normal eight Discipline Skill capacity;
- uses normal AP/cooldown/target/effect rules;
- is unavailable while Secondary is equipped;
- must create a real reason to remain pure rather than functioning as an automatic disguised Ultimate.

## Profile / integration

Phase 3 also establishes:

- Character Profile as build headquarters;
- saved-loadout foundation that cannot bypass attunement legality;
- AI consumption of legal build state;
- existing direct-PvP consumption of the same legal build snapshot;
- first minimum authoring/validation tools needed for build content;
- Discipline Mastery/Passive Training integration only when active Mastery behavior is ready.

Exact ticket sequencing is authoritative in `docs/PHASE_3_TICKETS.md`.

---

# 5. Phase 4 — First Playable Buildcraft Roster & Core Combat Content

Phase 4 no longer owns the first implementation of Resonance/Essence. It **scales, balances and proves** the Phase-3 systems across a staged representative roster.

Use staged expansion:

```text
4 representative Disciplines
  ↓ identity proof
6–8 Disciplines
  ↓ balance/content-production proof
12 Disciplines
  ↓ broader meta proof
16 Disciplines
  ↓ mature Closed Alpha target
```

Each released Discipline should earn its interaction cost through:

- differentiated Skill library;
- pure Essence coverage;
- relevant Resonance coverage;
- Mastery/acquisition rules;
- distinct tactical identity/counterplay;
- equipment interaction review;
- AI usage/regression coverage;
- PvE/PvP testing;
- VFX/SFX/media requirements;
- content-validation tooling.

Do not fill eight Skills with coefficient variants merely to satisfy a count.

---

# 6. Phase 5 — Supernatural Identity

Phase 5 is the first appropriate story/world phase for the permanent supernatural fork:

```text
UNAWAKENED
  ↓
SOULMARKED
or
SOUL_SEVERED
```

Implement a small high-quality first Soulmark set and a real Severance/Mantle route.

Rules:

- Soulmark is persistent supernatural identity;
- Severance permanently rejects the Soulmark path under current design;
- Soul-Severed characters gain Mantle access through legitimate acquisition;
- Mantles are temporary manifestations with duration, tradeoffs and Afterstrain;
- supernatural Skills sit outside the Discipline Skill cap where defined;
- no combat Soulmark/Mantle becomes cash-only power.

Do not pull this catalog back into Phase 3 merely for visual complexity.

---

# 7. Phase 6–7 integration

## Phase 6 — Co-op

Build summaries must communicate relevant Primary/Secondary, Resonance/Essence and later supernatural identity without exposing private competitive information.

The existing direct-multiplayer battle foundation should be reused for party/co-op authority rather than rebuilt.

## Phase 7 — Expeditions

Use long-form PvE to stress:

- pure versus mixed builds;
- Resonance interactions;
- Essence timing;
- equipment Skills;
- Soulmark/Mantle identity once released;
- cooldown pressure;
- party coordination.

Equipment-granted active Skills use the same canonical Skill/target/effect/cooldown grammar where practical.

---

# 8. Phase 8 — Competitive build safety

The existing Phase-2 direct-PvP foundation is inherited.

Phase 8 adds mature competitive requirements:

- legal committed build snapshot before match;
- no mid-match Profile respec;
- authoritative cooldown state;
- Resonance/Essence legality;
- Soulmark/Mantle legality once those systems exist;
- Equipment Skill/item snapshot validation;
- queue/ruleset overrides through shared definitions;
- Arena Tempering without erasing build identity;
- transparent opponent-information rules;
- ranked/matchmaking/seasons/tournament integration.

Do not create duplicate PvP-only copies of Skills or build definitions.

---

# 9. Phase 9+ catalog and long-horizon integration

## Phase 9

Scale toward the mature Discipline/Soulmark/Mantle catalogs only when interaction quality, tooling and content throughput support it.

Every mature Discipline eventually requires:

- eight Skills;
- Essence;
- relevant Resonance coverage;
- AI/PvP/PvE validation;
- media and documentation support.

## Rekindling / Veteran Edge

Rekindling preserves the character's supernatural path under current rules and should broaden long-term options rather than create uncapped raw-power stacking.

If Veteran Edge grants an active Skill, it remains a bounded separately sourced Skill outside the Discipline cap under the applicable competitive rules.

## Master Panel

The later complete Master Panel must operate the same versioned build definitions used by gameplay rather than inventing a separate content truth.

---

# 10. Validation rule

Phase 3 ends with a representative buildcraft slice ready for PV-2.

The key product question is whether players independently show **curiosity-driven build experimentation** and understand:

```text
Primary vs Secondary
8 pure vs 6 mixed Discipline Skills
Essence vs Resonance
Skill sources and cooldowns
```

Soulmark/Mantle comprehension is validated when that supernatural layer is actually introduced; it is not required to prove the Phase-3 core build thesis.

See `docs/ROADMAP_PRODUCT_VALIDATION.md` for the current evidence gate.
