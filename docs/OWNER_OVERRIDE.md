# AUREVANE — Owner Override & Exceptional Authority

**Status:** Authoritative Master Panel expansion subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/MASTER_PANEL.md` and `docs/ANOMALIES.md`.

**Reconciled:** 2026-08-23.

This document defines the protected Owner's ultimate operational authority over game-controlled state, including deliberate grants or exceptional configurations that ordinary players could not normally earn or possess.

The design goal is:

> If AUREVANE can safely represent a game state, the protected Owner should ultimately be able to create, correct or revoke that state through the Master Panel without routine production database editing.

Owner power is server-authoritative, explicit, audited and bounded by representational integrity.

---

## 1. Owner authority levels

The finished `/master` experience distinguishes:

1. **Normal operation** — use the same validated game rules as players.
2. **Support override** — correct/grant legitimate states without normal acquisition.
3. **Exceptional Owner override** — deliberately bypass selected eligibility/exclusivity rules and create normally impossible but safely represented states.

The protected Owner is the root game-operations authority.

---

## 2. What the Owner may eventually grant or manipulate

Through explicit commands, the Owner may eventually grant/revoke or set, where the domain supports it:

- items/equipment;
- currencies;
- XP/levels;
- Discipline Mastery;
- Primary/Secondary eligibility/state through validated workflows;
- Skills;
- Resonance/Essence discovery/state where appropriate;
- Soulmarks and branch state;
- Soul-Severed/Mantle state;
- quest/story/world flags;
- region/Expedition/event access;
- titles/badges/cosmetics;
- Chronicle/Archive discoveries;
- achievements;
- Rekindling/Memory Carryover/Veteran Edge state;
- account entitlements;
- internal QA/test capabilities;
- staff roles/permissions;
- temporary/permanent special-case gameplay entitlements;
- protected **Anomaly exceptional states** defined by `docs/ANOMALIES.md`.

The Owner may also revoke erroneous state where safe reversal exists.

---

## 3. Bypass grants

The Master Panel must support explicit bypass acquisition for registered content.

Examples:

- grant high-level gear to a test character;
- mark a Discipline mastered without normal Mastery XP;
- grant a Skill without normal unlock;
- grant a Soulmark before its normal story moment;
- grant a title/event reward outside its original window;
- set exact progression state for QA/support;
- grant retired/internal content where structurally safe.

The audit layer should distinguish:

```text
EARNED_NORMALLY
SUPPORT_GRANTED
OWNER_OVERRIDDEN
OWNER_ANOMALY
```

---

## 4. Explicit bypass scopes

Prefer narrowly modeled bypass flags rather than one global `ignore_everything` switch.

Conceptual examples:

```text
BYPASS_LEVEL_REQUIREMENT
BYPASS_STORY_REQUIREMENT
BYPASS_QUEST_REQUIREMENT
BYPASS_DISCIPLINE_REQUIREMENT
BYPASS_MASTERY_REQUIREMENT
BYPASS_REKINDLING_REQUIREMENT
BYPASS_EVENT_WINDOW
BYPASS_REGION_ACCESS
BYPASS_SEASON_AVAILABILITY
BYPASS_ACQUISITION_RULE
ALLOW_RETIRED_CONTENT
ALLOW_INTERNAL_TEST_CONTENT
ALLOW_NONSTANDARD_LOADOUT
ALLOW_SUPERNATURAL_EXCLUSIVITY_OVERRIDE
```

Not every command exposes every bypass.

The UI must show which ordinary rules are being overridden before confirmation.

---

## 5. Registered content versus arbitrary content

Owner power remains strongest when the state still references valid registered content.

Registered content may include live, unpublished, hidden/internal, retired, event and test content.

If the Owner wants something that does not exist at all, preferred flow is:

```text
CREATE CONTENT DRAFT
  ↓
VALIDATE / PREVIEW
  ↓
MARK INTERNAL OR PUBLISH
  ↓
OWNER GRANT
```

The panel should not become a raw SQL/JavaScript console.

---

## 6. Exceptional Character State system

Some Owner goals require a character state that ordinary progression forbids.

The Master Panel should support protected **Exceptional Character State** metadata for:

- internal testing;
- events/showcases;
- support recovery;
- special public characters;
- deliberate Owner-created exceptions.

Examples include:

- nonstandard loadouts;
- content before normal requirements;
- special test combinations;
- inaccessible location placement;
- unreleased registered content;
- **Anomaly supernatural combinations**.

Owner authority may bypass gameplay eligibility, but the runtime must never accept incoherent state that breaks persistence/combat integrity.

If a requested state is not safely representable, the Owner must be offered a supported representation, content/config change, or isolated test environment rather than corrupt production data.

---

## 7. Canonical Anomaly override

`docs/ANOMALIES.md` is authoritative.

An **Anomaly** is a protected Owner-created exceptional character state that bypasses normal supernatural exclusivity.

Initial approved forms:

```text
CROSS_FORK     = Soulmark + Mantle
DUAL_SOULMARK  = two Soulmarks
DUAL_MANTLE    = two Mantles
```

An Anomaly cannot be earned/found/crafted/traded/purchased/rolled or unlocked through normal gameplay.

The Unwritten Reach does not grant Anomalies.

The only canonical creation/revocation path is protected Owner authority through Master Panel / Owner Override.

---

## 8. Anomaly workflow

Recommended high-power workflow:

```text
SELECT CHARACTER
  ↓
OPEN ANOMALY / EXCEPTIONAL STATE CONSOLE
  ↓
SELECT ANOMALY TYPE
  ↓
SELECT REGISTERED SOULMARK / MANTLE COMPONENTS
  ↓
SHOW NORMAL EXCLUSIVITY BEING OVERRIDDEN
  ↓
SHOW COMBAT / PVP / LOADOUT WARNINGS
  ↓
ENTER REQUIRED REASON
  ↓
OWNER RE-AUTHENTICATES
  ↓
EXPLICIT CONFIRMATION
  ↓
SERVER VALIDATES REPRESENTATIONAL INTEGRITY
  ↓
ATOMIC MUTATION
  ↓
AUDIT + PROVENANCE
```

Recommended permission:

```text
owner.anomaly.manage
```

This permission is Owner-only by default and is not automatically inherited by Administrator, Support, Balance, Content or Live Event roles.

---

## 9. Exceptional-state provenance

Exceptional state should carry metadata equivalent to:

```text
exceptional_state = true
exceptional_state_source = OWNER_OVERRIDE | OWNER_ANOMALY
exceptional_state_reason = required text
exceptional_state_created_by = owner identity
exceptional_state_created_at = server timestamp
exceptional_state_expires_at = optional
```

Anomaly-specific state additionally records type, component IDs and version/revision.

This enables support understanding, analytics filtering, ranked integrity, expiration and incident review.

---

## 10. Ranked PvP integrity

Default rule:

> A character with an active gameplay-affecting exceptional override is ineligible for standard ranked PvP unless a specific approved policy normalizes or explicitly allows that exact state.

For Anomalies, standard ranked exclusion is the default.

Special event/showcase queues may explicitly allow them under transparent rules.

The Master Panel must display why a character is considered standard or exceptional for competitive purposes.

---

## 11. Economy/currency overrides

Owner commands may include:

```text
grant_currency
remove_currency
set_currency_exact
grant_item
revoke_item
issue_compensation_bundle
create_support_package
```

Large economic actions should show current value, proposed value, delta, reason and warnings.

Anomalies are not normal tradable/economic grants.

---

## 12. Progression Override Console

Guided controls may include:

- advance level;
- grant XP;
- complete Horizon milestone;
- master Discipline;
- unlock build system;
- grant endgame qualification;
- grant Rekindling eligibility;
- perform/reverse support correction.

Exact controls may set level, XP, Mastery stage, milestone flags and cycle metadata within validated boundaries.

Large changes should preview downstream consequences.

---

## 13. Special permissions/capabilities

Examples:

```text
internal.qa
internal.debug_view
alpha.access
beta.access
creator.status
partner.status
event.actor
tournament.official
private.realm.access
content.preview.access
```

Capabilities support scope, duration, reason, expiration and audit.

---

## 14. Break-Glass God Mode

Break-Glass is a set of narrowly modeled privileged operations, not generic SQL.

Potential operations:

- force grant normally unobtainable registered content;
- force revoke;
- force exact progression/economy state;
- force quest/story/location recovery;
- force event eligibility;
- force entitlement;
- force special loadout flag;
- force repair broken active-session state;
- force restore a supported safe snapshot;
- force create/revoke an approved Anomaly through the dedicated Anomaly command path.

Every Break-Glass action requires Owner identity, re-authentication, explicit reason, warning, audit, before/after data where practical, rate limiting and server-side execution.

---

## 15. Owner Override is not hidden unlogged manipulation

Every privileged mutation remains attributable internally.

This protects against:

- accidental corruption;
- staff abuse;
- forgotten test grants;
- polluted analytics;
- unexplained economy/progression state;
- impossible support investigations.

The Owner has ultimate operational authority **and** ultimate traceability.

---

## 16. Analytics/test hygiene

Owner-overridden accounts/states must be filterable.

Examples:

- exclude internal QA from progression medians;
- exclude test currency from economy dashboards;
- exclude nonstandard PvP from normal balance data;
- exclude Owner Anomalies from ordinary supernatural prevalence/performance metrics unless intentionally analyzing them.

---

## 17. Implementation timing

### Phase 0–2

Preserve authorization/audit architecture and avoid schemas that assume every state must originate from normal acquisition.

### Phase 3–4

Buildcraft uses authoritative commands/stable IDs/versioning so future exceptional states can safely reference registered content.

### Phase 5

When Soulmark/Severance/Mantle foundations are built, ensure the representation does not make future safe Owner-created Anomalies impossible. A minimal Owner-only test override may be built only if required to verify the supernatural model.

### Phase 8

Competitive legality recognizes exceptional state and standard-ranked exclusion.

### Phase 13

Complete Owner Override / Anomaly Console / inspection / grant / revoke / audit workflows.

### Phase 15

Hardening covers authorization, concurrency, migration, PvP, analytics and privilege-escalation attempts.

---

## 18. Permanent rules

1. The Owner is the root game-operations authority.
2. Privileged changes use server-authoritative validated commands.
3. Normal support grants and exceptional Owner overrides are distinct.
4. Eligibility may be bypassed; representational integrity may not.
5. Every high-impact mutation has provenance/audit.
6. Anomaly means the Owner-created supernatural exception defined in `docs/ANOMALIES.md`.
7. Only the protected Owner may create/revoke Anomalies by default.
8. Ordinary gameplay cannot manufacture an Anomaly.
9. Standard ranked PvP excludes gameplay-affecting Anomalies by default.
10. No raw production database editing is required for routine Owner operations once the relevant Master Panel tools exist.