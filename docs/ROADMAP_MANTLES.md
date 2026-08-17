# AUREVANE — Mantle System Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` for Mantle progression, specialization, combat integration, PvP safety, public documentation, media, and Master Panel operations.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/MANTLES.md` defines the Mantle system. `docs/COMBAT.md`, `docs/PROGRESSION_RETENTION.md`, `docs/BATTLE_INTERFACE.md`, `docs/PLAYER_MANUAL.md`, `docs/PUBLIC_NEWS_AND_MANUAL.md`, `docs/MEDIA_PIPELINE.md`, and `docs/MASTER_PANEL.md` remain authoritative where applicable.

**Direction approved:** 2026-08-16.

The roadmap principle is:

> **Rank I proves the transformation fantasy for everyone. Rank II proves specialization. Rank III proves deep specialization with real opportunity cost. Do not build all three ranks before the surrounding combat, buildcraft, world, and balance systems can support them.**

---

## 1. Non-Negotiable Sequencing

1. **No Mantle implementation in current P1.6 work.**
2. **P1.7 Public News + Adventurer's Guide remains next after P1.6.**
3. Mantles do not replace or reorder Phase 2 combat or Phase 3 buildcraft proof.
4. Rank II/III are never implemented as simple account-wide stat upgrades.
5. Every higher-rank implementation must validate both:
   - persistent progression eligibility;
   - active-build specialization/Dedication.
6. Generalist Rank I builds must remain viable after Rank II/III exist.
7. No paid Mantle power, account-tier advantage, or random paid unlock.

---

## 2. Phase 1 — Preserve Future Boundaries Only

Current Phase 1 does not implement Mantles.

Architecture should merely avoid assumptions that would make later temporary transformation states impossible.

No new UI, schema, progression bar, Mantle currency, or placeholder transformation button is required.

P1.6 and P1.7 remain focused on their approved scope.

---

## 3. Phase 2 — Tactical Combat Extension Points

Phase 2 still proves normal combat first.

The combat engine should naturally support concepts Mantles will later reuse without naming/implementing the feature prematurely:

- versioned temporary actor state;
- typed entry effects;
- finite-duration state;
- explicit non-generic state classifications;
- Afterstrain-like recovery effects expressible through the shared Effect/Requirement grammar;
- Action-based special-state activation;
- server-authoritative duration/readiness;
- UI ability to show important special state + remaining duration;
- AI legality over those state primitives.

**Do not add actual player Mantles to PV-1.**

PV-1 must answer whether ordinary movement + Action tactical combat is fun without transformation spectacle masking weaknesses.

---

## 4. Phase 3 — Buildcraft Compatibility

When Current + Legacy + Traits + Movement Art + Soulmark + Confluence + saved loadouts exist, establish the build-validation hooks Mantle Paths will later use.

This means:

- stable content/build tags;
- authoritative loadout validation;
- ability to express requirements over Current/Legacy/Traits/Movement/Soulmark/equipment metadata;
- atomic saved-loadout activation;
- clear warnings for invalid/disabled build components;
- future extension point for an equipped Mantle and Path without yet requiring it.

Do not contaminate PV-2 by using Mantles to make early buildcraft seem more exciting than Current + Legacy + Confluence actually is.

PV-2 must still prove AUREVANE's core identity on its own.

---

## 5. Phase 4 — Content Tag / Balance Preparation

As the first playable Discipline set expands:

- validate that released Disciplines expose coherent reusable tags/roles rather than one-off Mantle-specific exceptions;
- ensure Traits, Movement Arts, equipment, and Soulmark metadata can participate in later Path requirements cleanly;
- avoid designing Disciplines around future Mantles before Mantle Rank I itself has been playtested;
- begin internal prototype scenarios only if useful for systems validation, not public feature expansion.

No large Mantle catalog is authored here.

---

## 6. Phase 5 — First Rank I Mantle Proof

**First recommended player-facing Mantle implementation.**

Phase 5 has the world, quests, story, NPCs, locations, Archive, and live-world foundations needed to make unlocking a Mantle feel like an actual achievement rather than a settings toggle.

Implement a **small representative Rank I slice**, ideally 1–2 Mantles at most.

Required Rank I proof:

- dedicated Mantle Rite/acquisition content;
- server-authoritative ownership/provenance;
- one equipped Mantle in the Armory/build model;
- manual activation during combat;
- typed readiness requirement;
- entry effect;
- temporary active state;
- visible duration;
- Afterstrain;
- battle UI integration through the Signature area / Turn Economy context;
- readable VFX/SFX/media request package;
- AI understanding of legal activation;
- Manual article;
- News support for release/balance changes;
- first minimal owner operational controls if the feature is live.

### Rank I access rule

Every legitimate player/account tier must have equal gameplay access to Rank I progression.

Rank I may require meaningful play, but never payment.

### Rank I validation gate — M1

Before building Rank II:

- players understand when/how to activate the Mantle;
- the temporary state creates a real tactical timing decision;
- Afterstrain matters but does not make activation feel like a trap;
- Rank I improves identity without becoming mandatory for every battle;
- normal combat remains readable under transformation VFX;
- players can explain the difference between Mantle, Soulmark, Ultimate, and Confluence;
- the feature is exciting enough to justify deeper specialization.

If M1 fails, improve Rank I. Do not add Rank II complexity.

---

## 7. Phase 6 — Co-op Compatibility, Not Rank Inflation

As parties/co-op arrive:

- show party members' active Mantles cleanly in the Combat Rail;
- ensure one player's VFX does not obscure teammate decisions;
- validate cooperative timing and buff/debuff interactions;
- prevent stacking rules from making one Mantle compulsory in every party;
- ensure reconnect restores Mantle state/duration authoritatively.

Rank II development may remain internal until Expedition/build evidence supports it.

---

## 8. Phase 7 — Rank II / Mantle Path Proof

Expeditions and advanced PvE provide the first strong environment for **Mantle Path specialization**.

Implement the first representative Rank II Path(s).

Required Rank II systems:

- persistent Rank II/path qualification;
- active-build Path validation;
- explicit player-readable requirements;
- at least one meaningful Dedication cost;
- `earned_rank` vs `manifest_rank` distinction;
- Armory display explaining why a build manifests Rank I or II;
- saved specialist/generalist loadouts;
- path-specific acquisition/rite/challenge;
- AI and encounter validation;
- advanced PvE testing with and without specialist builds;
- analytics separating ownership from active manifestation.

### Rank II validation gate — M2

Rank II is successful only if:

- players recognize a Rank II build as intentionally specialized;
- Rank II builds give up real breadth/flexibility;
- generalist Rank I builds remain useful and sometimes preferable;
- there is more than one reasonable build route into the Path where intended;
- the Path is not reduced to one mandatory Current + Legacy pairing unless explicitly designed that way;
- specialist advantages are strongest inside their intended role rather than universally superior;
- changing to a generalist saved loadout cleanly drops effective manifestation back to Rank I without deleting earned progression.

If M2 fails, fix the specialization framework before Rank III.

---

## 9. Phase 8 — PvP Mantle Safety

Before Mantles become important in ranked competition:

- queue config can enable/disable Mantles;
- queue config can cap effective rank;
- Path legality and Dedications are validated server-side;
- season/version pinning exists;
- emergency-disable exists;
- public rules disclose effective-rank behavior;
- matchmaking/balance telemetry separates Mantle/Path/build context.

Early standard ranked may intentionally cap Mantles at Rank I or Rank II.

**Rank III is not automatically standard-ranked legal.**

PvP must never grant the Rank II/III upside while ignoring the build sacrifices that qualify it.

---

## 10. Phase 9 — Rank III / Deep Dedication Proof

Only after normal combat, buildcraft, world, Expeditions, and PvP all exist should AUREVANE implement the first genuine **Rank III** specialist path.

Do not launch Rank III for every Mantle simultaneously.

Start with one or a very small number of deeply authored examples.

Required Rank III framework:

- late-game persistent eligibility;
- complete Rank II prerequisite;
- Deep Dedication validation;
- at least one Hard Dedication with a visible loss of flexibility;
- signature Rank III rules beyond coefficient inflation;
- high-end rite/challenge that tests the exact specialist fantasy;
- robust AI/counterplay;
- PvE and PvP mode controls;
- distinctive but readable visual/audio treatment;
- Chronicle/social prestige support where useful;
- no permanent one-time-only combat availability.

### Rank III validation gate — M3

A Rank III build is acceptable only if playtesting can answer both questions clearly:

> **What is this build extraordinary at?**

and

> **What did this build give up to become extraordinary at it?**

Warning conditions:

- Rank III is best in almost every matchup;
- generalist builds have no compelling advantage;
- the sacrifice exists only on paper and is not felt in play;
- one exact build dominates the Path;
- Rank III becomes expected for ordinary progression;
- players believe they are permanently ruined for choosing a different build;
- visual spectacle harms tactical readability.

Any warning redirects work into Rank III balance/design rather than adding more Mantles.

---

## 11. Phases 10–12 — Social Prestige and World Depth

As social/economy/nation systems mature:

- profiles may show earned Mantle ranks/Paths without exposing secret acquisition conditions;
- Chronicle may record first achievements and exceptional rites;
- guild/nation/world content may contribute to selected Path qualifications where thematically appropriate;
- acquisition routes must remain recurring or otherwise fairly obtainable for combat power;
- Rank III should remain a recognizable specialization identity, not a generic veteran checkbox.

No guild/nation membership should universally gate Mantle power required for broad competitive viability.

---

## 12. First Full Endgame / Rekindling Integration

Before full first-cycle endgame is considered mature:

- at least one Mantle progression route has been validated across the long character journey;
- high-rank eligibility cannot be satisfied by calendar age alone;
- Rank III, where available, requires real build/progression accomplishment;
- Rekindling reset/preserve behavior for Mantle earned ranks/Paths is explicitly defined;
- no Rekindling outcome silently destroys paid cosmetics or historical prestige;
- any retained Mantle knowledge does not bypass the active-build Dedication requirements.

A future Rekindling cycle may let a player pursue a different deep Mantle Path, supporting long-term experimentation without permanent traps.

---

## 13. Phase 13 — Mantle Studio

The Complete Master Panel must include Mantle operations integrated with Character/Combat Content tooling.

Authorized staff can manage:

- Mantle definitions;
- Rank I/II/III;
- Paths;
- progression qualification;
- build requirements;
- Dedications / Hard Dedications;
- manifest-rank resolution;
- readiness;
- entry/sustained effects;
- duration;
- Afterstrain;
- PvE/PvP legality and rank caps;
- AI metadata;
- acquisition references;
- Manual/spoiler metadata;
- News impact;
- Asset IDs;
- analytics;
- staged publish;
- version diff;
- rollback;
- emergency disable;
- audited QA/support grants/corrections.

The editor uses typed validated content definitions, not arbitrary code or SQL.

---

## 14. Phase 14 — Mantle Art & Audio Polish

Mantles receive premium production treatment appropriate to their rarity:

- icons;
- manifestation animations/VFX;
- rank/path visual distinctions;
- active aura/state language;
- Afterstrain presentation;
- activation/expiration SFX;
- optional special Rank III music/stem treatment where earned;
- profile/Manual/News artwork where appropriate;
- reduced-motion alternatives;
- PvP readability review.

Media remains replaceable through stable Asset IDs and the Asset Studio.

Phase 14 polishes a system already proven mechanically; it does not rescue unreadable Mantle gameplay with spectacle.

---

## 15. Phase 15 — Hardening

Mantle hardening includes:

- ownership/rank/path authorization;
- loadout/manifest-rank manipulation tests;
- Dedication bypass attempts;
- atomic loadout activation;
- stale/disabled content handling;
- activation idempotency;
- duration/reconnect/replay tests;
- state-copy/cleanse classification tests;
- Afterstrain timing;
- PvP rank-cap/normalization tests;
- AI legality;
- rollback/version pinning;
- Master Panel permission/audit tests;
- high-VFX performance/readability;
- Manual/spoiler publication review;
- paid-entitlement separation tests;
- analytics verification distinguishing earned rank from manifested rank.

---

## 16. Roadmap Summary

```text
PHASE 1
no Mantles
        ↓
PHASE 2
combat-state primitives only
        ↓
PHASE 3–4
build/tag compatibility
        ↓
PHASE 5
RANK I PROOF — universal-access transformation fantasy
        ↓
M1
        ↓
PHASE 7
RANK II PROOF — Mantle Path specialization + Dedication
        ↓
M2
        ↓
PHASE 8
PvP caps / legality / normalization
        ↓
PHASE 9
RANK III PROOF — Deep Dedication + Hard Sacrifice
        ↓
M3
        ↓
PHASE 10–12
social/world/endgame integration
        ↓
PHASE 13
Mantle Studio
        ↓
PHASE 14
production art/audio polish
        ↓
PHASE 15
hardening
```

The system should grow only when the previous rank proves it creates better AUREVANE buildcraft and combat decisions.
