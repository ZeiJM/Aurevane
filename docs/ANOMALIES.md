# AUREVANE — Anomalies: Owner-Granted Exceptional Character States

**Status:** Owner-approved authoritative design specification.

**Direction clarified:** 2026-08-23.

**Authority:** Subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`, `docs/OWNER_OVERRIDE.md`, `docs/MASTER_PANEL.md`, `docs/ROADMAP.md`, and the applicable combat/PvP specifications.

This document defines **Anomaly** as a protected Owner-created exception to AUREVANE's normal character rules. It is not a frontier reward, loot rarity, hidden acquisition path, contraband system, or normal progression feature.

---

# 1. Canonical definition

An **Anomaly** is a character whose supernatural state has been deliberately placed into a normally impossible or mutually exclusive configuration by the protected game Owner through an audited Master Panel / Owner Override workflow.

The intended examples are:

- **Soulmark + Mantle** on the same character;
- **two Soulmarks** on the same character;
- **two Mantles** on the same character.

Future exceptional combinations may be added only by explicit Owner approval and only when the runtime can represent them safely.

Anomaly is therefore a **provenance/state designation**, not a normal rarity tier.

---

# 2. Normal supernatural rule remains strict

For ordinary characters, AUREVANE preserves the canonical fork:

```text
UNAWAKENED
   ↓
SOULMARKED
   OR
SOUL_SEVERED
```

Normal progression does not permit a player to naturally obtain both branches at once.

Normal characters must obey the currently approved limits for Soulmarks and Mantles.

The existence of Anomalies does **not** weaken or reinterpret the ordinary rule. It creates an explicit Owner-only exception around it.

---

# 3. Owner-only acquisition

An Anomaly cannot be:

- earned through quests;
- found in the Unwritten Reach;
- dropped by enemies or bosses;
- crafted;
- traded;
- purchased;
- rolled randomly;
- unlocked by Rekindling;
- awarded by an automated event;
- granted by ordinary support staff;
- obtained through an undocumented gameplay exploit.

The only canonical creation path is:

> **Protected Owner → Master Panel / Owner Override → explicit Anomaly grant.**

The Owner may use this power for an exceptionally rare public character, a special event/showcase identity, internal testing, narrative experimentation, or another deliberate exceptional purpose.

Rarity is controlled by Owner discretion, not a drop rate.

---

# 4. Initial supported Anomaly classes

## Cross-Fork Anomaly

A character simultaneously possesses a valid Soulmark state and valid Mantle capability despite the ordinary Soulmarked/Soul-Severed exclusivity rule.

Example:

```text
SOULMARK A
+
MANTLE A
```

## Dual-Soulmark Anomaly

A character possesses two separately identifiable Soulmarks at once.

Example:

```text
SOULMARK A
+
SOULMARK B
```

The engine must define how branches, passive effects, Skills, duplicate tags and conflicting triggers compose before this state can be enabled.

## Dual-Mantle Anomaly

A character possesses two Mantles at once.

Example:

```text
MANTLE A
+
MANTLE B
```

Possessing two Mantles does not automatically imply simultaneous manifestation. Manifestation rules, durations, Afterstrain and whether one or both can be active at once must be explicitly represented and reviewed before a specific combination is granted.

---

# 5. Anomaly is not a license for corrupt state

Owner authority may bypass **gameplay eligibility**, but not representational integrity.

An Anomaly must still use valid registered content IDs, valid versions, safe relationships and server-authoritative state.

If a requested combination cannot be represented safely, the system must block the grant until the runtime/content model supports that combination deliberately.

Do not solve Anomalies with direct production SQL or a generic `ignore_everything` flag.

---

# 6. Master Panel workflow

The eventual Anomaly workflow should be a protected Owner-only operation:

```text
SELECT CHARACTER
  ↓
OPEN EXCEPTIONAL STATE / ANOMALY CONSOLE
  ↓
SELECT ANOMALY CLASS
  ↓
SELECT REGISTERED SOULMARK / MANTLE COMPONENTS
  ↓
PREVIEW NORMAL RULES BEING OVERRIDDEN
  ↓
PREVIEW COMBAT / LOADOUT / PVP CONSEQUENCES
  ↓
ENTER REASON
  ↓
OWNER RE-AUTHENTICATION
  ↓
EXPLICIT CONFIRMATION
  ↓
ATOMIC SERVER-AUTHORITATIVE MUTATION
  ↓
IMMUTABLE AUDIT + PROVENANCE
```

Recommended protected permission:

```text
owner.anomaly.manage
```

This permission is **Owner-only by default**. Administrator, support, content and balance roles do not receive it merely because they have broad operational access.

---

# 7. Required provenance

Every Anomaly must have authoritative metadata equivalent to:

```text
is_anomaly = true
anomaly_type = CROSS_FORK | DUAL_SOULMARK | DUAL_MANTLE | FUTURE_APPROVED_TYPE
anomaly_components = stable registered content IDs
anomaly_created_by = protected Owner identity
anomaly_created_at = server timestamp
anomaly_reason = required Owner-entered reason
anomaly_expires_at = optional
anomaly_revoked_at = optional
anomaly_revision = version
```

The exact schema may differ, but equivalent provenance is mandatory.

Anomaly grants/revocations must be traceable through the normal privileged audit system.

---

# 8. Revocation and correction

The Owner must be able to safely:

- inspect the current Anomaly configuration;
- remove one exceptional component;
- return the character to a normal valid supernatural branch;
- replace an Anomaly component;
- expire a temporary Anomaly;
- repair an invalidated combination after content-version changes.

Revocation must be atomic and must not strand ghost Skills, passives, Mantle state, cooldowns, snapshots or equipment interactions.

---

# 9. Battle and build integration

Anomalies do not get a parallel combat engine.

Their Soulmark/Mantle Skills and effects reuse normal:

- targeting;
- AP costs;
- cooldowns;
- requirements;
- effects;
- statuses;
- combat-event ordering;
- battle logs;
- AI legality where applicable;
- battle snapshots.

The exceptional part is **ownership/combination legality**, not arbitrary client-controlled combat behavior.

Every unusual interaction between Anomaly components must be deterministic, bounded and regression-tested.

---

# 10. PvP integrity

Gameplay-affecting Anomalies are **ineligible for standard ranked PvP by default**.

A competitive mode may explicitly define one of these policies:

```text
DISALLOWED
NORMALIZED
SPECIAL_EVENT_ONLY
EXPLICITLY_ALLOWED
```

If a PvP mode permits an Anomaly, opponents must receive the player-facing information necessary for fair decision-making. An allowed Anomaly must never function as undisclosed hidden power.

Tournament rules can prohibit or normalize Anomalies independently of casual/event modes.

---

# 11. Analytics and balance

Anomaly characters must be identifiable in telemetry so they do not silently contaminate normal balance/progression conclusions.

Default analytics treatment should allow:

- excluding Anomaly battles from ordinary balance aggregates;
- filtering Anomaly economy/progression data;
- analyzing special-event Anomaly performance separately;
- tracing every exceptional grant to its provenance.

Do not rebalance the normal game around an Owner-created exceptional character.

---

# 12. Player-facing presentation

Whether an Anomaly is publicly identified can depend on context and Owner intent, but fairness takes priority over secrecy.

Possible presentation surfaces include:

- profile designation;
- special title/frame treatment;
- Chronicle/event description;
- battle pre-match disclosure in modes where the Anomaly is legal;
- Inspect/source labels for exceptional Soulmark/Mantle components.

A public Anomaly can be intentionally mysterious without making combat state deceptive.

---

# 13. Relationship to the Unwritten Reach

**None is required.**

The Unwritten Reach may contain rare discoveries, legendary explorers, strange lore, Veyr encounters and unstable geography, but it is **not the normal source of Anomalies**.

Do not write future frontier content that rewards players with Cross-Fork, Dual-Soulmark or Dual-Mantle Anomaly states unless the Owner explicitly redesigns this specification.

Frontier rarity and Anomaly status are separate systems.

---

# 14. Relationship to Rekindling

Rekindling does not automatically create, upgrade or unlock an Anomaly.

If the Owner grants an Anomaly to a character, persistence across Rekindling must be an explicit property of that grant/state and must respect the intended special-character purpose.

Do not make repeated Rekindling a hidden route to Anomaly status.

---

# 15. Roadmap placement

Anomaly support depends on mature supernatural state representation.

- **Phase 3–4:** no Anomaly implementation required; build/combat schemas should remain extensible.
- **Phase 5:** Soulmark/Severance/Mantle foundations must avoid schema choices that make safe exceptional representation impossible. A minimal Owner-only test override may be built only if needed to verify the supernatural model.
- **Phase 8:** competitive legality policy must recognize exceptional state.
- **Phase 13:** complete Master Panel Anomaly Console / Owner-only grant, revoke, audit and inspection workflows.
- **Phase 15:** security, concurrency, migration, analytics, PvP and exploit hardening for exceptional states.

---

# 16. Permanent guardrails

1. Anomaly means **Owner-granted exceptional character state**.
2. It is not frontier loot, contraband, a hidden quest reward or a random rarity tier.
3. Normal Soulmark/Severance/Mantle exclusivity remains canonical for ordinary players.
4. Initial Anomaly forms are Soulmark + Mantle, two Soulmarks, and two Mantles.
5. Only the protected Owner may create/revoke Anomalies by default.
6. Every Anomaly is server-authoritative, atomic, versioned and audited.
7. Owner override may bypass eligibility, never database integrity.
8. Standard ranked PvP excludes gameplay-affecting Anomalies by default.
9. Analytics must distinguish exceptional characters from normal population data.
10. Anomaly rarity comes from Owner discretion and scarcity, not grind or RNG.
11. Anomaly state is never sold as normal player power.
12. Future Anomaly types require explicit Owner approval.