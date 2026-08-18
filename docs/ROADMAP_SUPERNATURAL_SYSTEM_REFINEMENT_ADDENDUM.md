# AUREVANE — Roadmap Addendum: Mantle Charge, Anomaly Stacking & Owner-Exclusive Soulmarks

**Authority:** Binding roadmap integration for `docs/SUPERNATURAL_SYSTEM_REFINEMENT_ADDENDUM.md`.

**Direction approved:** 2026-08-18.

This roadmap extends `docs/ROADMAP_SUPERNATURAL_SYSTEM_REFINEMENT.md` and supersedes the earlier one-active-Mantle anomaly assumption.

---

# Current Phase 2 / PV-1

Do not implement Soulmarks, Mantles, Anomaly stacking, Owner-exclusive Soulmarks, or information-concealment build effects during the current PV-1 correction loop.

Compatibility only:

- combat state should support server-owned delayed/scheduled state transitions;
- visibility projection should remain viewer-specific rather than assuming every combat field is globally public;
- temporary stat/passive modifiers should be typed;
- battle snapshots should be able to represent multiple simultaneous temporary states without granting them to ordinary characters.

---

# Phase 3 — Engine Compatibility

As the redesigned Skill/cooldown/build grammar is implemented:

- add generic typed support for delayed/scheduled effect resolution suitable for future Mantle Charge;
- ensure Skill/passive effects can modify bounded resource maxima and capacities;
- define viewer-safe combat information projections so later conceal/reveal effects do not require rewriting battle state;
- ensure AI reads through a Knowledge/Visibility Filter rather than unrestricted battle internals;
- preserve 6/8 Discipline Skill capacity independently from extra system Skills and passive resource changes.

No player-facing Mantle/Soulmark expansion is required here.

---

# Phase 5 — First Soulmarks, First Mantle Charge, Information Control Proof

When Soulmarks and the Severance first become player-facing:

## Mantle Charge

The first ordinary Mantle I implementation includes the full state sequence:

```text
READY -> CHARGING -> MANIFESTED -> AFTERSTRAIN -> RECOVERED
```

Initial baseline:

- player selects Mantle + attained Manifestation level;
- charge begins authoritatively;
- transformation normally completes at the beginning of the character's next activation;
- charge is clearly telegraphed;
- reconnect/animation skipping cannot bypass charge;
- any interrupt/accelerate rule must be explicitly authored.

Playtest whether the one-activation anticipation window is tactically interesting rather than too punitive. If it fails, tune the timing through data rather than removing the authoritative charge concept.

## Information-control proof

At least one representative supernatural/equipment/passive effect should prove viewer-specific information control, for example:

- conceal exact MP;
- reveal extra information;
- hide selected derived stats;
- show a bounded resource band instead of an exact value.

Requirements:

- server keeps exact truth;
- AI respects the same knowledge boundary;
- legal-action-critical facts remain visible;
- ranked rules can normalize/disable the effect.

## Resource-pool proof

Validate bounded effects that alter MP/HP or another approved capacity without changing Discipline Skill-slot limits.

---

# Phase 7 — Advanced Soulmark Mutation + Mantle Charge Interactions

As advanced Soulmark mechanics and Mantle II arrive:

- support authored interactions with Mantle Charge such as protection, delay, acceleration, or interruption only when the mechanic has explicit counterplay;
- support Soulmarks that mutate existing Skills, summons, teleports, DoTs, elemental conversions, AoE shapes, healing/defense rules, and information visibility;
- add hard caps for cooldown/resource/Action Economy interactions;
- validate charge/Afterstrain timing in long Expedition encounters.

Mantle II still grants no Skills and remains a stronger enhancement package with serious Afterstrain.

---

# Phase 8 — Competitive Visibility Rules

Before information-control effects and Mantles enter serious PvP:

- publish mode-specific rules for what information is public, concealed, or revealable;
- ensure AI/spectator/replay projections use the same authoritative visibility policy;
- prevent concealment from hiding target legality, objective state, position, or required Mantle telegraphs;
- allow queue configuration to disable/normalize specific concealment effects;
- record active conceal/reveal mechanics in battle versions for replay correctness.

---

# Phase 9 — Catalog Scale

As Soulmarks scale:

- include multiple information-control identities only when they play differently;
- include resource-capacity identities without turning every Soulmark into percentage stat inflation;
- continue requiring real strengths/weaknesses and counterplay;
- do not count Owner-exclusive Soulmarks toward ordinary rollable-pool completeness.

The normal catalog remains quality-gated; Owner-exclusive content is a separate exceptional catalog.

---

# Phase 10 — Profile Presentation

Character Profile supernatural presentation adds:

- Mantle Charge/Manifestation explanations;
- attained Mantle invocation levels;
- Soulmark branch/package details;
- information-control effects described in readable terms;
- the public **ANOMALY** badge when an active anomaly override exists;
- clear separation between Anomaly badge and staff Official Badges.

An Owner-exclusive Soulmark may be shown or hidden according to its publication metadata.

---

# Phase 13 — Owner Soulmark Studio + Full Anomaly Stacking

Phase 13 expands the Owner-only operations layer.

## Owner Soulmark Studio

GAME OWNER can:

- create/edit/version Soulmarks;
- mark a definition `NORMAL_SOULMARK` or `OWNER_EXCLUSIVE_SOULMARK`;
- exclude Owner-exclusive definitions from all normal acquisition pools;
- define branches/passives/Skills/acquisition/public visibility;
- preview/simulate;
- publish/rollback/emergency-disable;
- grant/revoke Owner-exclusive Soulmarks to exact characters;
- inspect holders and anomaly interactions.

Owner-exclusive Soulmark create/grant/revoke is non-delegable and fully audited.

## Anomaly Badge

Implement badge derivation from active anomaly entitlement state.

The badge:

- appears on Profile/public character card where badges are supported;
- cannot be equipped cosmetically;
- carries no staff authority;
- disappears when all anomaly overrides are revoked.

## Simultaneous Dual Mantles

`DUAL_MANTLE` now explicitly permits **two simultaneous active Mantles**.

Required engine/Owner tooling:

- two independently tracked charge states;
- two independently selected Manifestation levels;
- simultaneous active-state support;
- explicit effect stacking policy per modifier;
- independent duration and Afterstrain;
- overlapping Afterstrain handling;
- hard caps for Action Economy/cooldown/turn/resource multipliers;
- preview of combined effective stats/effects before Owner grant/test;
- anomaly-only battle telemetry separated from ordinary balance data.

Standard Ranked/tournaments reject the anomaly state by default.

## Mantle Level III

Existing Owner-only Transcendent Manifestation rules remain.

A Dual-Mantle Anomaly may be granted Level III on one or both Mantles. If two Level-III Mantles are simultaneously manifested in an explicitly allowed anomaly ruleset, all stacking caps and severe Afterstrain rules still apply.

---

# Phase 14 — Presentation

Create distinct readable VFX for:

- Mantle Charging;
- Tempered / Full / Transcendent intensity;
- simultaneous anomaly Mantles without obscuring battlefield readability;
- Anomaly badge;
- Owner-exclusive Soulmark icon/VFX packages where commissioned.

---

# Phase 15 — Hardening

Explicitly test:

- charge bypass through reconnect/client timing;
- scheduled-state race conditions;
- simultaneous Mantle stacking overflows;
- double Afterstrain ordering;
- duplicate Owner-exclusive Soulmark grants;
- unauthorized access to hidden Owner-only Soulmark definitions;
- roll-pool contamination by Owner-exclusive definitions;
- Anomaly badge spoofing;
- concealment leaks through API, AI, spectator, replay, logs, or client payloads;
- hidden-info effects that accidentally hide target-legality facts;
- queue rejection of anomaly builds;
- rollback/revoke safety.
