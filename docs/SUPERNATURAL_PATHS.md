# AUREVANE — Ascension & Severence

**Status:** Owner-approved canonical supernatural-path specification.

**Direction approved:** 2026-09-20.

**Authority:** Subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to the current combat, progression, PvP, Master Panel, Manual, art/audio and roadmap specifications.

This document replaces the retired **Soulmark / Soulmarked / Mantle / Soul-Severed / Severance** terminology.

> **Canonical AUREVANE terminology: Ascension and Severence. Characters are Ascended or Severed.**
>
> **Severence** is the intentional AUREVANE spelling. Do not auto-correct it to “Severance” in player-facing text, design documents, code comments, content labels or future schemas.

---

## 1. The supernatural fork

A character begins supernatural progression as **Unawakened** and later makes one permanent ordinary-path choice:

```text
UNAWAKENED
   ↓
ASCENDED
   OR
SEVERED
```

- **Ascension** is the soul-enhanced path. A character who chooses it is **Ascended**.
- **Severence** is the mutually exclusive alternate path. A character who chooses it is **Severed**.
- Ordinary characters cannot naturally hold both paths at once.
- The decision is explicit, heavily confirmed, server-authoritative, auditable and not reversible through ordinary respec systems.
- The chosen supernatural path persists across Rekindling unless a later Owner-approved story system explicitly changes that rule.

These are supernatural identity systems, not Disciplines, bloodlines, races or inherited classes.

---

## 2. Ascension

Ascension represents a persistent supernatural enhancement of the character through the soul.

Under ordinary rules:

- an Ascended character cannot become Severed;
- an Ascended character has one current Ascension identity at a time;
- an Ascension may define branches, passives, Skills, triggers, strengths, weaknesses and audiovisual identity;
- Ascension Skills remain explicitly bounded and sit outside normal Discipline Skill capacity when the authored rules grant them;
- changing or replacing a bound Ascension, if ever allowed by authored progression, requires an explicit high-friction confirmation flow;
- combat power from Ascension is gameplay-earned and follows AUREVANE's anti-pay-to-win policy.

Ascension is **not hereditary**. AUREVANE does not use a bloodline system for this feature.

The architecture should support a broad long-term catalog without forcing every Ascension into the same package template. Quality and distinct build identity matter more than catalog size.

---

## 3. Severence

Severence is the permanent alternative supernatural route.

Under ordinary rules:

- a Severed character cannot use Ascension;
- Severence provides its own authored supernatural power package rather than a generic always-on “Severed damage bonus”;
- Severence may use manually activated temporary combat states, readiness conditions, durations, recovery windows and meaningful vulnerability where that produces good tactical play;
- the former Mantle transformation design space is absorbed into Severence rather than remaining a third named system;
- Severence Skills or temporary states remain server-authoritative, bounded, readable in PvP and compatible with deterministic battle snapshots;
- combat power from Severence is gameplay-earned and follows the same anti-pay-to-win policy.

The mature Severence catalog should expand only after the first representative implementation proves readable, fun and sustainable.

---

## 4. Shared rules

Both paths must:

- use versioned, server-authoritative content;
- remain readable in combat, spectation, logs, Inspect and saved snapshots;
- declare explicit source labels so players can distinguish Discipline, Resonance, Essence, Ascension, Severence, equipment and prestige effects;
- define acquisition, legality, cooldown/readiness, effect ordering and PvP rules;
- support safe Master Panel authoring, publication, rollback and emergency disablement;
- avoid hidden client authority;
- avoid premium-only combat power.

Normal build language is therefore:

```text
CHARACTER ATTRIBUTES
+
PRIMARY DISCIPLINE
+
OPTIONAL SECONDARY DISCIPLINE
+
DISCIPLINE SKILLS
+
RESONANCE OR PURE ESSENCE
+
ASCENSION OR SEVERENCE
+
EQUIPMENT + EQUIPMENT SKILLS
+
BOUNDED PRESTIGE / VETERAN EDGE
```

---

## 5. Anomalies

Owner-created **Anomalies** remain exceptional audited states and do not weaken the normal fork.

The anomaly model should use the new terminology:

- **Cross-Path Anomaly** — Ascension + Severence on one character;
- **Dual-Ascension Anomaly** — more than one Ascension identity where the runtime explicitly supports it;
- **Dual-Severence Anomaly** — more than one Severence power package where the runtime explicitly supports it.

These states are never normal loot, random progression, trade goods or automatic rewards.

---

## 6. Implementation and migration rules

For all new work:

- use **Ascension**, **Ascended**, **Severence**, and **Severed**;
- do not add new player-facing or future-facing references to Soulmark, Soulmarked, Mantle, Soul-Severed or Severance;
- future database fields, enums, analytics dimensions, content IDs, permissions and Master Panel labels should use the new terminology unless compatibility with already-shipped persisted data requires a migration alias;
- if a historical migration, commit, release note or compatibility field must retain an old identifier, mark it as legacy and keep the current player-facing term separate;
- do not silently reintroduce Mantle as a separate power family.

The supernatural implementation remains a later roadmap system. This specification establishes the vocabulary and direction now so Phase 5+ work does not branch from obsolete terminology.
