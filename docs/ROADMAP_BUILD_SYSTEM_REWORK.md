# AUREVANE — Roadmap Addendum: Build System Rework

**Authority:** Binding roadmap integration for `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`, `docs/ROADMAP_PRODUCT_VALIDATION.md`, `docs/ROADMAP_MANTLES.md`, `docs/PROGRESSION_RETENTION.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, and related combat/buildcraft documents.

**Direction approved:** 2026-08-18.

This roadmap integrates the Owner-approved redesign of Disciplines, Skills, Resonance, the pure-Discipline path, Soulmarks, the Soul-Severed/Mantle fork, equipment-granted Skills, cooldowns, Character Profile build configuration, and Rekindling/Veteran Edge compatibility.

Where older roadmap text assumes Current/Legacy, Traits, Reactions, Movement Arts, Ultimates, Confluence, or simultaneous Soulmark + Mantle ownership, this addendum governs the intended future implementation.

---

# Current Phase 2 / PV-1 — Do Not Pull the Rework Into the Active Combat Correction

AUREVANE is still proving the basic tactical combat experience.

Do **not** destabilize the active PV-1 correction path by implementing the full build-system redesign during the current validation ticket.

Current compatibility requirements only:

- the 100-point Action Economy direction can later price all non-basic Skills;
- combat state can represent cooldowns server-side;
- skill sources can be tagged without hardcoding `Art`, `Trait`, `Reaction`, or `Movement Art` as permanent engine assumptions;
- battle UI can later group Discipline, Equipment, Soulmark/Essence, Mantle, and Veteran Edge Skills without turning into one flat giant command row;
- character identity remains separate from build configuration;
- current Profile routing work should remain capable of becoming the build headquarters.

PV-1 still passes or fails on normal combat usability. Do not use future Soulmark/Mantle spectacle to hide basic combat problems.

---

# Phase 3 — Primary/Secondary Discipline + Skill/Cooldown Foundation

**Primary implementation phase for the redesigned class/build grammar.**

## A. Rename and data migration

Replace future player-facing concepts:

```text
Current Discipline  → Primary Discipline
Legacy Discipline   → Secondary Discipline
Art                 → Skill
Confluence          → Resonance
```

Do not create new player-facing Trait, Reaction, Movement Art, or Ultimate slots.

Existing prototype/internal field names may be migrated safely rather than destructively renamed in one risky database operation if the architecture benefits from compatibility aliases.

## B. Primary Discipline stat profile

Implement versioned Discipline base-stat profiles.

Requirements:

- Primary determines base distribution;
- player-assigned attribute investment remains separately owned and unchanged;
- Secondary contributes no base-stat profile;
- derived stats recompute authoritatively;
- profile preview shows before/after effects before commitment;
- changing Primary cannot duplicate/drop assigned attribute points.

## C. Independent 4-hour Discipline attunement cooldowns

Implement two server-owned timers:

```text
Primary change:   4h production default
Secondary change: 4h production default
```

Requirements:

- independent timers;
- changing one does not start the other;
- changing both starts both;
- trusted server time;
- logout/device/browser clock cannot bypass;
- saved loadouts cannot bypass;
- preview does not start cooldown;
- clear Profile confirmation and remaining-time display;
- Master Panel configurable later.

## D. Eight-Skill Discipline library

Define schema/content grammar for exactly eight learnable Skills per mature Discipline.

Implement:

- stable skill IDs;
- mastery unlock requirements;
- Action Economy cost;
- cooldown;
- target spec;
- effect sequence;
- tags;
- AI valuation/legality metadata;
- PvE/PvP override hooks;
- media hooks.

No Discipline Ultimate field is required.

## E. Pure versus mixed Skill capacity

Implement authoritative loadout validation:

```text
Primary only:
8 Discipline Skills

Primary + Secondary:
6 Discipline Skills total
```

The exact internal Primary/Secondary distribution among the six remains validation-tunable; source labels must always be visible.

## F. Generic cooldown engine

Every usable non-basic Skill has a cooldown.

Basic exemptions:

- Move;
- Basic Attack;
- Guard.

Baseline Heal/Recover:

```text
2 own-turn cooldown
```

Prove:

- cooldown decrement timing;
- reconnect persistence;
- battle replay/log correctness;
- disabled/changed skill version behavior;
- no duplicate action during cooldown;
- AI obeys the same cooldown state;
- no client cooldown manipulation.

## G. Character Profile as build headquarters

Add/prepare Profile sections for:

- Attributes;
- Disciplines;
- Skills;
- Resonance/pure-path slot;
- Equipment;
- Loadouts;
- future Supernatural;
- future Prestige.

Persistent build writes happen here/out of combat under authoritative validation.

### Phase-3 gate / PV-2 input

Before broad content expansion:

- players understand Primary versus Secondary;
- players understand why Primary changes base stats;
- the 4-hour timers feel like commitment rather than an accidental trap;
- 8 pure / 6 mixed Skill rules are clear;
- all non-basic Skills visibly obey cooldowns;
- Profile build editing is usable on desktop/mobile;
- server cannot be tricked into illegal skill count, secondary mastery, stat profile, or cooldown bypass.

---

# Phase 4 — First Full Discipline Set + Resonance + Pure-Path Proof

## A. Eight complete Skills per representative Discipline

The first playable Discipline cohort must each receive eight genuinely differentiated Skills.

Avoid filling eight slots with minor coefficient variants merely to satisfy the count.

Each representative Discipline should cover multiple tactical functions appropriate to its identity.

## B. Resonance proof

Implement the first meaningful Resonance pair set.

Resonance is:

- generated by Primary + Secondary pairing;
- passive;
- data-driven;
- server-authoritative;
- readable in Profile and battle context;
- capable of typed skill-order/tag combos;
- no generic `+5% everything` default.

Test whether one core unordered-pair Resonance is sufficient while Primary direction supplies the major asymmetry.

## C. Pure-Discipline counterpart proof

Implement the pure-path system under the working name **Essence** unless Owner renames it before the ticket opens.

For each representative Primary-only Discipline:

- grant one special Essence Skill outside the normal eight;
- enforce no Secondary;
- apply the damage-versus-effect budget;
- give the Skill a normal AE cost/cooldown;
- surface it as a distinct source in battle UI.

## D. Pure versus mixed balance validation

PV-2/buildcraft testing must include:

```text
PURE
8 Discipline Skills + Essence Skill

versus

MIXED
6 Discipline Skills + Resonance passive
```

Pass only if both produce real reasons to exist.

Warning signs:

- mixed always wins because Resonance is free power;
- pure always wins because nine active Skills create overwhelming breadth;
- players choose Secondary only for a passive and never use its Skill library;
- Primary base-stat profile creates one obvious meta Primary regardless of playstyle;
- Essence Skills become disguised Ultimates with no meaningful tradeoff.

## E. Combo sequence grammar

Prove typed, readable skill-order interactions without reintroducing a separate Trait/Reaction system.

Examples can originate from Resonance or early equipment effects.

---

# Phase 5 — Supernatural Fork + First Soulmarks + First Mantle

This is the first appropriate story/world phase for the permanent supernatural identity decision.

## A. Awakening / Severance story state

Implement:

```text
UNAWAKENED
SOULMARKED
SOUL_SEVERED
```

Requirements:

- explicit story/rite;
- strong confirmation;
- server-owned irreversible state;
- ordinary respec cannot cross the fork;
- simply being Unawakened does not permit Mantle acquisition;
- state survives reconnect and future Rekindling.

## B. First Soulmark vertical slice

Start with a deliberately small high-quality set rather than chasing 100 immediately.

Prove multiple package shapes:

- passive + Skill;
- two passives/no Skill;
- two Skills/no passive;
- risk/reward strength + weakness;
- movement/Jump/utility identity rather than only elemental percentage bonuses.

Prove 1-branch and 2-branch examples; a 3-branch Soulmark may be included only if it adds meaningful validation value.

## C. Soulmark power-budget tooling

Create internal balance metadata for:

- passive strength;
- active strength;
- cooldown;
- AE cost;
- condition/setup;
- drawback credit;
- encounter flexibility.

Do not pretend all effects can be perfectly reduced to one number; use the budget as review support plus simulation/playtesting.

## D. Soulmark Skill slots

Any Soulmark Skills sit outside the 6/8 Discipline cap.

Battle UI must show source and cooldown clearly.

## E. First Soul-Severed Mantle proof

The first live Severance choice must not strand Soul-Severed characters with no supernatural payoff.

Ship at least one valid Mantle acquisition route alongside or shortly after the first meaningful Severance decision.

Prove:

- only Soul-Severed characters can earn/equip it;
- manual manifestation;
- large temporary stat/rule boost;
- short duration;
- stat scaling from legitimate character values;
- temporary Mantle Skills if authored;
- Afterstrain vulnerability;
- readable timer/state;
- Soulmarked character rejected by server.

## F. Monetization boundary

No combat Soulmark or Mantle is sold as cash-only power under the current anti-pay-to-win rules.

Cosmetic Soulmark/Mantle VFX/presentation may later be monetized separately.

### Phase-5 supernatural gate

Players must be able to explain:

- Resonance = two-Discipline passive;
- Essence = pure-Discipline extra Skill;
- Soulmark = persistent supernatural identity;
- Severance = permanent rejection of Soulmarks;
- Mantle = temporary transformation available to the Severed.

If those concepts blur together in testing, fix presentation/mechanics before adding catalog volume.

---

# Phase 6 — Co-op Compatibility + Social Build Readability

Add:

- party inspection of public build summaries where permitted;
- clear Primary/Secondary identity;
- compact Resonance/Essence indicator;
- Soulmark or Soul-Severed/Mantle identity;
- cooldown/readiness communication where allies legitimately need it;
- no hidden enemy/private loadout leakage;
- combo interactions across allies using the same typed tag system where authored.

The 4-hour Discipline timers remain per character and are not bypassed by party state.

---

# Phase 7 — Equipment Skills + Expedition Build Depth + Mantle Expansion

## A. Equipment Skills

Implement mature active skills from designated gear sources:

- Main Hand;
- Off Hand / shield;
- Armor.

Each granted active Equipment Skill:

- sits outside 6/8 Discipline capacity;
- has an AE cost;
- has a cooldown;
- uses normal effects/targeting/forecasting;
- is removed when the granting item is unequipped;
- cannot remain ghost-bound through a saved loadout or battle exploit.

Accessories default to passives/effects unless specifically reviewed.

## B. Expedition skill/build interactions

Use Expedition encounters to test:

- Resonance combos;
- pure Essence builds;
- Soulmark package differences;
- Soul-Severed Mantle timing;
- equipment Skill tradeoffs;
- cooldown pressure over longer fights.

## C. Six-Mantle catalog expansion

Expand toward the mature target of **six distinct Mantles**.

Do not automatically recreate old Rank I/II/III complexity.

Each Mantle must have:

- clear identity;
- distinct stat/rule emphasis;
- transformation duration;
- Afterstrain identity;
- counters/tradeoffs;
- public readable description;
- no universal `best Mantle` outcome.

---

# Phase 8 — PvP Competitive Safety

Before the mature build system enters ranked PvP:

- Primary/Secondary change locks are snapshotted before queue/match;
- no mid-match Profile build switching;
- all cooldown state is authoritative;
- Resonance/Essence legality is validated;
- Soulmark branch/package is pinned for the battle;
- Soul-Severed/Mantle eligibility is validated;
- Mantle duration/Afterstrain cannot be reset by reconnect;
- Equipment Skills are item-snapshot validated;
- queue rules can disable/normalize individual Skills, Resonances, Soulmarks, Mantles, equipment effects, or Veteran Edge where needed;
- public opponent information policy defines what build identity is visible pre-match.

Arena Tempering may adjust coefficients but must not erase build identity.

---

# Phase 9 — Catalog Scale: Disciplines, Soulmarks, Mantles

## A. Full Discipline roster scaling

As the Discipline roster approaches its mature target:

- each mature Discipline has eight high-quality Skills;
- every meaningful pair has Resonance coverage before publication;
- every Discipline has a pure-path Essence Skill;
- no unresolved missing pair silently produces a blank/broken build.

## B. Soulmark catalog scaling

Grow based on quality and data:

- early proof: small set;
- broad release: ~24–36;
- mature catalog: ~48–72;
- long-term: architecture/content workflow capable of 100+.

Every added Soulmark must justify itself through a meaningful identity, branch package, combo space, acquisition story, or tactical behavior.

## C. Soulmark branch scale

Support:

- 1 branch for focused marks;
- 2 for most;
- 3 for rare/complex marks.

Load-test/profile-test the branch catalog without requiring the browser to load all global Soulmark content at once.

## D. Six Mantles complete

By the mature high-level build stage, all six planned Mantles should exist or have an explicit later-content reason for deferral.

---

# Phase 10 — Mature Profile, Social Identity & Build Sharing

Character Profile becomes a polished build headquarters.

Add mature presentation for:

- base-versus-assigned stats;
- Primary/Secondary timers;
- eight-Skill libraries;
- six/eight equipped capacity;
- Resonance/Essence explanation;
- Soulmark branch or Soul-Severed/Mantle state;
- equipment-granted Skills;
- saved loadouts;
- build comparison;
- shareable/public build cards where privacy allows;
- social profile summary that never exposes private hidden competitive information.

Titles/Vowbond/chat systems remain separate identity/social layers and do not modify build power by default.

---

# Phase 11 — Economy / Crafting / Enchantment Integration

When crafting and Trade House exist:

- crafted/equipped gear may grant approved Equipment Skills;
- item provenance shows the granting skill/effect clearly;
- deterministic crafting/enchantment preview includes active-skill effects;
- crafted skill-granting items remain balanced sidegrades rather than automatic best-in-slot;
- Trade House listing previews granted Skills/cooldowns accurately;
- unequip/list/escrow operations cannot leave the Skill active;
- enchantments may modify existing Skills only through bounded typed effects and must not create infinite cooldown loops.

Friendship/referrals never bypass equipment/economy authority.

---

# Phase 12 — Nations / Homestead Build Convenience

Homestead may provide convenient access to the same Profile/build configuration surfaces, but it does not bypass:

- 4-hour Primary/Secondary cooldowns;
- Soulmark permanence;
- the Severance;
- Mantle eligibility;
- equipment ownership;
- PvP queue restrictions.

Trophy/display systems may reflect Soulmark, Mantle, Rekindling, or famous build accomplishments cosmetically.

---

# First Full Endgame / Rekindling Integration

Before first-cycle prestige is considered mature, explicitly reconcile the redesigned build systems.

## Persistent supernatural identity

Rekindling preserves:

- Soulmarked versus Soul-Severed state;
- current Soulmark identity unless a separate legitimate replacement occurs;
- Severance history;
- earned Mantle provenance/knowledge according to final progression rules.

Rekindling never exists as a workaround for crossing from Soulmarked to Soul-Severed or vice versa.

## Prestige benefits

Keep the strongest long-term benefits horizontal/bounded:

- Hall of Selves;
- evolving profile/cosmetic prestige;
- Memory Carryover;
- one standard Veteran Edge slot;
- more Edge choices across additional Rekindlings rather than more simultaneous power;
- saved-loadout/build-history convenience;
- veteran rites/challenges/world recognition.

If Veteran Edge grants an active Skill, it is a separately tagged extra Skill outside the 6/8 Discipline cap, uses a cooldown, and remains single-slot/bounded in standard competitive play.

Do not introduce uncapped `+X% damage per Rekindling` progression.

---

# Phase 13 — Build Studio / Master Panel

The Complete Master Panel consolidates:

## Discipline Studio

- Primary base-stat profiles;
- mastery;
- eight Skills;
- AE cost;
- cooldown;
- unlocks;
- Primary/Secondary 4h defaults;
- preview/version/publish/rollback.

## Resonance Studio

- pair mapping;
- passive triggers;
- combo sequences;
- typed effects;
- caps/cooldowns where relevant;
- PvP overrides;
- analytics.

## Essence Studio

- pure-path skill per Discipline;
- damage/effect budget;
- AE/cooldown;
- targeting/effects;
- balance analytics.

## Soulmark Studio

- acquisition;
- branch count;
- package structure;
- passives/Skills;
- strengths/weaknesses;
- AE/cooldowns;
- balance-budget metadata;
- PvP rules;
- event availability;
- art/audio;
- analytics.

## Mantle Studio

- six Mantles;
- acquisition/eligibility;
- stat scaling;
- manifestation duration;
- temporary Skills;
- Afterstrain;
- PvP legality;
- emergency disable;
- media;
- analytics.

## Prestige Studio

- Rekindling rewards;
- Memory Carryover;
- Veteran Edge;
- mode legality;
- Hall of Selves presentation.

No arbitrary SQL/code editor.

---

# Phase 14 — Presentation / Art / Audio

Polish:

- Discipline identity/profile art;
- Skill icon language by source;
- cooldown/readiness presentation;
- Resonance pairing visual language;
- pure Essence presentation;
- Soulmark icons/branch art/VFX;
- explicit Soulmark weaknesses where relevant;
- the Severance story/ritual presentation;
- six distinct Mantle transformation silhouettes/VFX;
- Mantle countdown and Afterstrain clarity;
- Equipment Skill icon/source readability;
- prestige/Hall of Selves presentation;
- reduced-motion/accessibility equivalents.

The player must be able to identify where a Skill came from without reading a debug label.

---

# Phase 15 — Security / Balance / Abuse Hardening

Dedicated hardening must cover:

### Disciplines

- Primary/Secondary timer bypass;
- dual-slot race conditions;
- client clock manipulation;
- saved-loadout cooldown bypass;
- illegal Secondary without mastery;
- base-stat profile duplication/loss;
- illegal >6 or >8 Discipline Skills.

### Cooldowns

- duplicate use;
- reconnect refresh;
- turn-count desync;
- cooldown-reduction loops;
- stale content versions;
- AI cheating;
- replay mismatch.

### Resonance / Essence

- receiving both simultaneously;
- blank/missing pair;
- combo trigger loops;
- pure-path Skill retained after adding Secondary;
- Resonance retained after removing Secondary;
- damage/effect budget regressions.

### Soulmarks

- two Soulmarks simultaneously;
- replacement race/rollback;
- Soul-Severed acquiring Soulmark;
- fake drawback/free-power builds;
- branch entitlement manipulation;
- event/acquisition duplication;
- Soulmark Skill duplication;
- unauthorized combat-power premium entitlement.

### Mantles

- Soulmarked Mantle acquisition;
- Unawakened state exploit;
- duration reset;
- Afterstrain removal/reconnect bypass;
- temporary Skill persistence after transformation;
- stat-snapshot abuse;
- PvP enable/disable bypass.

### Equipment Skills

- ghost Skill after unequip/trade/escrow;
- duplicate item-skill grants;
- loadout races;
- cooldown reset by gear swapping;
- invalid skill source spoofing.

### Prestige

- multiple Veteran Edge slots;
- Rekindling stat stacking;
- supernatural-fork reset exploit;
- Memory Carryover bypassing level/world requirements.

---

# Canonical Sequence

```text
CURRENT PV-1
prove ordinary combat first
        ↓
PHASE 3
Primary/Secondary + base-stat profiles + 8-Skill libraries + 6/8 capacity + cooldown engine + 4h attunement
        ↓
PHASE 4
Resonance + pure-path Essence proof + full first Discipline Skills + combo grammar
        ↓
PHASE 5
Soulmark awakening / Severance + first Soulmarks + first Mantle
        ↓
PHASE 7
Equipment Skills + deeper Mantle/Expedition validation
        ↓
PHASE 8
PvP legality/normalization
        ↓
PHASE 9
scale to full Discipline coverage, mature Soulmark catalog, six Mantles
        ↓
FIRST ENDGAME / REKINDLING
horizontal/bounded prestige integration
        ↓
PHASE 13
complete Build/Soulmark/Mantle/Prestige Master Panel
        ↓
PHASE 14
premium presentation
        ↓
PHASE 15
security/balance/load hardening
```

The redesign succeeds only if it creates many distinct builds **without forcing players to manage a dozen unrelated slot systems**.
