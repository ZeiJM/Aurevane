# AUREVANE — Owner Override & Exceptional Authority

**Status:** Authoritative Master Panel expansion subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/MASTER_PANEL.md`.

**Direction approved:** 2026-08-15.

This document defines the protected Owner's ultimate operational authority over game-controlled state, including the ability to deliberately grant, create, equip, unlock, or force states that an ordinary player could not legitimately earn or would not normally be eligible to possess.

The design goal is simple:

> If AUREVANE can represent a game state, the protected Owner should ultimately be able to create or correct that state through the Master Panel without needing a developer for routine operations.

This power must remain server-authoritative, explicit, auditable, and safe enough that exceptional Owner actions do not silently corrupt unrelated systems.

---

## 1. Owner Authority Principle

The Owner is not merely a high-level moderator.

The Owner is the root game-operations authority.

The finished `/master` experience must support three distinct levels of intervention:

1. **Normal operation** — use the same validated progression/content/economy rules as players.
2. **Support override** — correct or grant legitimate states without requiring the normal acquisition path.
3. **Exceptional Owner override** — deliberately bypass selected game eligibility/acquisition rules and create unusual or normally impossible player states when the Owner intends to do so.

The system must not pretend that an Owner can only do what an ordinary player can do.

---

## 2. What the Owner Must Be Able to Grant

The Owner should eventually be able to grant or revoke, through explicit commands:

- items and equipment;
- currencies;
- XP and levels;
- Discipline Mastery;
- mastered Discipline status;
- Legacy eligibility;
- Arts, Traits, Reactions, and Movement Arts where their data model allows direct unlocks;
- Confluence discoveries or access;
- Soulmarks and Soulmark branch progress;
- quest progress and completion state;
- story flags;
- world access;
- region/node access;
- Expedition access and qualification;
- event eligibility;
- event participation credit;
- PvP queue eligibility where appropriate;
- titles;
- badges;
- cosmetics;
- Chronicle marks;
- Archive/lore discoveries;
- achievements;
- Rekindling state;
- Memory Carryover state;
- Veteran Edge unlocks;
- special account entitlements;
- staff roles;
- granular permissions;
- internal QA/test capabilities;
- alpha/beta/creator/partner/event access;
- temporary or permanent special-case gameplay entitlements.

The Owner can also revoke erroneous states where the domain supports safe reversal.

---

## 3. Bypass Grants — Things the Player Did Not Earn

The Master Panel must explicitly support **bypass acquisition**.

Examples:

- grant a level-100 item to a level-3 test character;
- mark a Discipline as mastered without the character earning Mastery XP;
- unlock a Confluence without the normal discovery requirement;
- grant a Soulmark before the normal story moment;
- grant a title from an event the player never attended;
- give a cosmetic that is no longer publicly obtainable;
- grant access to a locked region;
- grant a Veteran Edge to an internal test account without a completed Rekindling;
- grant a quest reward without completing the quest;
- grant an unreleased test entitlement to a QA account;
- grant a retired item to a collector or support case;
- grant an event-only reward outside its event window;
- set a player to an exact progression milestone for testing or recovery.

The action UI should clearly distinguish:

- **earned normally**;
- **support granted**;
- **Owner overridden**.

The player-facing game does not need to expose this provenance unless a specific feature requires it, but the audit/support systems must know the origin.

---

## 4. Eligibility Bypass Flags

Owner override commands should support explicit bypass scopes rather than one mysterious global `ignore_everything` switch.

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
BYPASS_PUBLICATION_VISIBILITY
ALLOW_RETIRED_CONTENT
ALLOW_INTERNAL_TEST_CONTENT
ALLOW_DUPLICATE_UNIQUE_GRANT
ALLOW_NONSTANDARD_LOADOUT
```

Not every command exposes every bypass.

The UI should show exactly which rules are being ignored before confirmation.

---

## 5. Registered Content vs Truly Arbitrary Data

Owner authority should be enormous, but the game should still distinguish between:

### Registered content

Content that exists in AUREVANE's content system, including:

- live content;
- unpublished content;
- hidden/internal content;
- retired content;
- old versioned content where safe;
- event content;
- test content.

The Owner may deliberately grant registered content outside ordinary rules.

### New arbitrary content

If the Owner wants an item, Art, title, modifier, or entitlement that does not exist at all, the preferred workflow is:

```text
CREATE CONTENT DRAFT
  ↓
VALIDATE / PREVIEW
  ↓
MARK INTERNAL OR PUBLISH
  ↓
OWNER GRANT
```

This keeps the game schema coherent while still allowing the Owner to invent new things through the Master Panel once the relevant editors exist.

The panel should not require a developer merely because a special reward was not previously part of normal progression.

---

## 6. Impossible or Nonstandard Character States

Some Owner use cases require more than bypassing acquisition.

The Master Panel should eventually support a protected **Exceptional Character State** system for internal testing, events, demonstrations, support recovery, or deliberate special characters.

Examples may include:

- equipping content before its normal level requirement;
- temporarily exceeding normal inventory limits;
- assigning a normally unavailable Soulmark/Discipline combination;
- allowing an internal test character to use content not yet publicly released;
- enabling a special event NPC/player avatar state;
- granting a normally mutually exclusive cosmetic/presentation combination;
- forcing a specific quest/story state for QA;
- placing a character into an otherwise inaccessible location;
- enabling a nonstandard loadout for controlled testing.

The engine must not be required to support logically incoherent data that cannot be represented safely.

If an impossible combination would violate a hard invariant required by combat/persistence integrity, the Owner should be offered one of three paths:

1. use a supported override representation;
2. create a special content/config rule that makes the state valid;
3. use an isolated test/sandbox environment.

"Ultimate control" means the Owner can achieve the operational goal, not that the production database becomes intentionally corruptible.

---

## 7. Exceptional State Marker

Characters or objects carrying rule-bypassing states should be internally markable with metadata such as:

```text
exceptional_state = true
exceptional_state_source = OWNER_OVERRIDE
exceptional_state_reason = "Tournament showcase build"
exceptional_state_expires_at = optional
exceptional_state_created_by = owner user id
exceptional_state_created_at = timestamp
```

This allows:

- support staff to understand unusual state;
- analytics to exclude test anomalies;
- ranked systems to detect nonstandard combat state;
- clean expiration of temporary overrides;
- auditing and incident review.

---

## 8. Ranked PvP Integrity

Owner-granted power must not accidentally contaminate competitive integrity.

Default rule:

**A character with an active gameplay-affecting exceptional override should be ineligible for standard ranked PvP unless the Owner explicitly enables ranked eligibility for that exact state or the state is known to be competitively normalized.**

Examples:

- a manually granted normal cosmetic does not affect ranked eligibility;
- a manually granted normally obtainable Discipline may still be legal if the loadout is otherwise valid;
- a level-3 character force-equipped with level-100 gear should not silently enter normal ranked;
- an internal test-only Art should block standard ranked by default;
- tournament/showcase queues may explicitly allow special rule packages.

The Master Panel should display why a character is considered standard or exceptional for competitive purposes.

---

## 9. Owner-Created Special Characters and Event Roles

A future Owner workflow may create special accounts/characters for:

- event actors;
- world bosses controlled by staff;
- story appearances;
- tournament officials;
- community demonstrations;
- QA/test scenarios;
- creator showcases;
- seasonal characters;
- hidden mystery interactions.

These identities can receive unusual entitlements, loadouts, cosmetics, names/titles, world access, or presentation states without pretending they were earned through ordinary gameplay.

Special characters must be clearly separable internally from normal player progression for analytics and support.

---

## 10. Economy and Currency Overrides

The Owner can grant or remove currency and items even when the player did not earn them.

Preferred commands include:

```text
grant_currency
remove_currency
set_currency_exact
issue_compensation_bundle
grant_item
revoke_item
grant_loot_bundle
create_support_package
```

For large economic changes, the panel should show:

- current balance;
- proposed balance;
- delta;
- expected economic significance;
- reason;
- whether the action exceeds normal support thresholds.

Owner authority can override warnings, but the action remains audited.

---

## 11. Progression Override Console

For a selected character, the Owner should eventually be able to manipulate progression through both guided and exact controls.

Guided controls:

- advance to next level;
- grant a specified XP amount;
- complete a Horizon milestone;
- master selected Discipline;
- unlock selected build system;
- grant endgame qualification;
- grant Rekindling eligibility;
- perform or reverse an authorized support correction.

Exact controls:

- set level;
- set XP within validated numeric bounds;
- set Mastery stage/XP;
- set configured milestone flags;
- set cycle/Rekindling metadata;
- set selected qualification state.

The panel must show downstream consequences before applying large changes.

---

## 12. Content-Version Grants

When content is versioned, the Owner may need to choose which version to grant.

The UI should prefer the current active version but may permit the protected Owner to select:

- current production version;
- prior valid version;
- staging/internal version;
- retired version when safe.

If old content is structurally incompatible with the current runtime, the panel should block the grant and explain why rather than generating broken state.

---

## 13. Special Permissions and Capability Grants

The Owner can grant capabilities that are not player progression at all.

Examples:

```text
internal.qa
internal.debug_view
alpha.access
beta.access
creator.status
partner.status
event.actor
world.event.participant
tournament.official
moderation.access
staff.master_panel.access
private.realm.access
content.preview.access
```

Capabilities should support:

- permanent or temporary duration;
- environment scope;
- optional region/system scope;
- reason;
- expiration;
- audit history.

The Owner can revoke them immediately.

---

## 14. Force Grant Workflow

A high-power override should use a deliberate workflow:

```text
SELECT PLAYER / TARGET
  ↓
SELECT OWNER OVERRIDE ACTION
  ↓
CHOOSE CONTENT / VALUE / STATE
  ↓
SELECT BYPASS RULES
  ↓
SHOW NORMAL REQUIREMENTS BEING IGNORED
  ↓
SHOW DOWNSTREAM WARNINGS
  ↓
ENTER REASON
  ↓
RE-AUTHENTICATE IF HIGH RISK
  ↓
CONFIRM
  ↓
SERVER VALIDATES REPRESENTATIONAL INTEGRITY
  ↓
ATOMIC AUTHORITATIVE MUTATION
  ↓
AUDIT + PROVENANCE RECORD
  ↓
OPTIONAL REALTIME PLAYER REFRESH
```

Warnings inform the Owner; they do not silently reduce Owner authority.

---

## 15. Break-Glass God Mode

For rare situations, the Owner should have a **Break-Glass God Mode** section.

This is not a generic SQL console.

It is a collection of highly privileged, narrowly modeled operations that can bypass normal business rules while preserving data integrity.

Potential examples:

- force grant normally unobtainable registered content;
- force revoke an item regardless of acquisition source;
- force exact currency balance;
- force progression state;
- force story/quest recovery;
- force location recovery;
- force event eligibility;
- force entitlement;
- force special loadout flag;
- force content visibility for a target account;
- force emergency compensation;
- force clear a corrupted active-session pointer;
- force detach a character from a broken queue/instance;
- force restore a prior safe state snapshot where supported.

Every God Mode action requires:

- Owner identity;
- re-authentication;
- explicit reason;
- prominent warning;
- immutable audit record;
- before/after snapshot where practical;
- rate limiting;
- correlation/request ID;
- server-side execution.

---

## 16. Owner Override Does Not Mean Hidden Cheating

If the Owner creates a special public-facing character or reward, the system should support doing so intentionally.

But the operational design should not depend on secret unlogged manipulation.

Every privileged mutation remains attributable internally.

This protects the project from:

- accidental corruption;
- staff abuse;
- forgotten test grants;
- unexplained economic anomalies;
- impossible support investigations.

The Owner has ultimate power **and** ultimate traceability.

---

## 17. Delegation

Ordinary staff should not automatically receive Owner override powers.

Granular permissions may include:

```text
owner.override.view
owner.override.support_grant
owner.override.progression
owner.override.economy
owner.override.content
owner.override.story
owner.override.entitlements
owner.override.exceptional_state
owner.override.break_glass
owner.override.ranked_exception
```

The protected Owner implicitly has all of them.

Most high-risk bypasses should remain Owner-only unless explicitly delegated.

---

## 18. Analytics Exclusion and Test Hygiene

Owner-overridden accounts/states should be taggable for analytics.

Examples:

- exclude internal QA from progression medians;
- exclude test currency grants from economy health dashboards;
- exclude nonstandard PvP from normal balance statistics;
- exclude test lore unlocks from community discovery races;
- exclude staff-created event actors from population analytics.

This prevents powerful Owner tools from polluting the telemetry used to balance the live game.

---

## 19. Implementation Timing

### Phase 0

- preserve authorization architecture capable of protected Owner-only actions;
- preserve immutable audit patterns;
- avoid schemas that assume every state must have a normal acquisition record.

### Phase 1

- player support view can begin with safe read-only character inspection;
- progression services should expose authoritative commands rather than direct browser writes.

### Phase 5

- first `/master` shell and live-ops tools;
- support special event eligibility and controlled story/world corrections where needed.

### Phases 8–12

- extend overrides to PvP, economy, guild/nation, endgame, and live content systems as those domains exist.

### Phase 13

Build the complete Owner Override console:

- player lookup;
- exact state inspection;
- force grants;
- acquisition bypass;
- special permissions/entitlements;
- nonstandard-state management;
- ranked-integrity warnings;
- analytics exclusion;
- Break-Glass God Mode;
- full audit/history/reversal support where safe.

---

## 20. Definition of Success

The Owner Override system succeeds when:

- the Owner can grant things a player did not earn;
- the Owner can grant content outside normal timing/eligibility rules;
- the Owner can create special QA/event/support states;
- the Owner can deliberately bypass acquisition and progression requirements;
- the Owner can create unusual but representable character states;
- the game clearly distinguishes ordinary, support-granted, and exceptional state internally;
- competitive queues protect themselves from unintended special-state contamination;
- analytics can exclude manipulated test states;
- every high-power mutation is server-authoritative and auditable;
- no routine developer/database intervention is required for game states the Master Panel is designed to control;
- the Owner remains able to override warnings when the action is intentional.
