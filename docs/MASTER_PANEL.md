# AUREVANE — Owner, Staff & Master Panel Specification

**Status:** Authoritative operations specification subordinate to `docs/GAME_MASTER_PLAN.md` and its owner-approved domain specifications.

**Initial direction approved:** 2026-08-15.  
**Terminology/current-state synchronization:** 2026-08-19.

The Master Panel is AUREVANE's protected operational control center. It must let the Owner run the game, delegate responsibilities safely, publish story/events, rebalance content, respond to problems, moderate players, and make controlled live changes without routine source-code edits or direct production-database manipulation.

The full panel is a later roadmap phase, but each major system should arrive with the minimum safe operational tooling it needs.

Current character/build terminology throughout the Master Panel is:

- Primary Discipline;
- optional mastered Secondary Discipline;
- Skill / Discipline Skill / Equipment Skill;
- Resonance;
- Essence / Discipline Essence;
- Soulmark;
- The Severance / Soul-Severed / Mantle;
- six universal attributes: Might, Finesse, Vitality, Agility, Intellect, Resolve;
- Battle Hall / AI Sparring;
- Passive Training.

Do not create new Owner tooling around the retired Current/Legacy/Art/Confluence/separate Trait-Reaction-Movement Art-Ultimate model.

---

## 1. Primary Goal

The Owner should eventually be able to operate AUREVANE through `/master`, including:

- see current game/server activity;
- create/delegate staff roles;
- control granular permissions;
- operate world events/story releases;
- edit data-driven content;
- tune balance safely;
- schedule/preview changes;
- enable/disable troubled features;
- review analytics/server health;
- moderate/support players;
- audit privileged actions;
- roll back content mistakes.

The panel is not permission to bypass game integrity. It is a safer interface over authoritative services/publishing systems.

---

## 2. Design Principles

### Owner authority

One protected Owner authority is the highest privilege tier.

### Least-privilege delegation

Staff receive only permissions required for their work.

### Permissions, not UI hiding

Server authorization protects every privileged action. Hidden routes/buttons/client role values are not security.

### No routine direct database editing

Operational changes use validated commands, editors, publishing workflows and audits.

### Draft → preview → publish → rollback

Important content is versioned rather than silently overwritten.

### Audit important mutations

Privileged changes are attributable to actor, time, reason, target and before/after state where practical.

### Environment separation

Local, staging/preview and production remain distinct.

---

## 3. Role Model

Use role templates backed by granular permissions rather than hard-coded business logic such as `if role === event_staff`.

Suggested templates:

- **Player** — no staff access.
- **Owner** — root game-operations authority.
- **Administrator / Operations Lead** — broad delegated authority without Owner-only identity powers.
- **Live Event Manager** — approved world/live-event operations.
- **Narrative / Story Editor** — dialogue/quests/arcs/story state.
- **Balance Designer** — balance values, analytics, simulations, staged balance packages.
- **Content Editor** — assigned content domains.
- **Moderator / Support** — reports, sanctions and narrow support actions.
- **Analyst / Observer** — selected read-only operational data.

Custom roles may later be built from explicit permissions.

---

## 4. Permission Domains

Architecture should anticipate permissions such as:

```text
master.access
staff.view
staff.manage
staff.roles.manage

audit.view
analytics.view
system.health.view
system.maintenance.manage
feature_flags.manage

liveops.events.view
liveops.events.edit
liveops.events.schedule
liveops.events.publish
liveops.events.stop
liveops.announcements.manage

story.view
story.edit
story.publish
quests.edit
quests.publish
dialogue.edit
dialogue.publish

balance.view
balance.edit
balance.publish
balance.simulate

content.disciplines.edit
content.skills.edit
content.resonances.edit
content.essences.edit
content.soulmarks.edit
content.mantles.edit
content.items.edit
content.effects.edit
content.enemies.edit
content.world.edit
content.expeditions.edit
content.loot.edit
content.publish

combat_ai.view
combat_ai.edit
combat_ai.simulate
combat_ai.publish
battle_hall.configure

progression.view
progression.edit
progression.publish
passive_training.configure
rekindling.configure

pvp.rotations.manage
pvp.tournaments.manage
seasons.manage

economy.view
economy.config.edit
economy.config.publish
support.grants.issue

moderation.reports.view
moderation.chat.manage
moderation.suspend
moderation.ban

media.view
media.edit
media.approve
media.publish
```

Permissions may be environment/content-domain scoped.

---

## 5. Owner-Protected / Break-Glass Actions

High-risk examples:

- changing Owner identity;
- granting high-level staff-management privileges;
- bulk retiring critical production content;
- production-wide destructive rollback;
- disabling security-sensitive controls;
- exceptional economic/player-state interventions;
- bypassing ordinary eligibility through approved Owner Override mechanisms.

Require re-authentication/explicit confirmation where appropriate. Break-Glass actions are rare, validated and immutably audited.

---

## 6. Master Panel Navigation

The full panel should grow toward:

- **Overview** — online players, activity, errors, health, events, season.
- **Live World** — events, schedules, world state, announcements, Chronicle.
- **Story** — arcs, quests, dialogue, flags, NPC narrative state.
- **Character Content** — Disciplines, Skills, Resonances, Essences, Soulmarks, Mantles.
- **Items & Effects** — Item Studio, Effect Catalog, equipment/consumables/acquisition.
- **World Content** — regions, nodes, NPCs, enemies, bosses, encounters, stores.
- **Expeditions** — templates, rooms, modifiers, bosses, loot.
- **Combat Content** — targeting/effects/costs/terrain/status/action definitions where safely authorable.
- **Combat AI Lab / Battle Hall** — profiles, records, simulations, practice configuration.
- **Progression** — XP/Mastery, Horizons, Passive Training, Rekindling/Veteran Edge.
- **Balance Lab** — analytics, values, comparisons, simulations, staged packages.
- **PvP & Seasons** — queues, rotations, tournaments, seasonal config.
- **Guild/Nation Ops** — when those systems exist.
- **Economy** — telemetry/configuration.
- **Players & Support** — inspection/corrections.
- **Moderation** — reports/sanctions/social tools.
- **Media / Asset Studio** — art/audio pipeline/publication.
- **Feature Flags** — system/content kill switches.
- **System** — health, maintenance, workers, errors.
- **Staff & Permissions** — roles/grants.
- **Audit Log** — searchable privileged history.

Do not build empty fake sections before their underlying systems exist.

---

## 7. Live Event Panel

Authorized staff eventually can:

1. create/select an event draft;
2. set title/summary/internal notes/regions/timing;
3. attach quests, encounters, objectives, NPC changes, map markers, modifiers and reward tables;
4. attach approved art/audio/announcement references;
5. preview safely;
6. validate dependencies/conflicts;
7. schedule/publish if authorized;
8. monitor participation;
9. trigger approved phase transitions;
10. emergency-stop if required;
11. resolve/close;
12. publish aftermath;
13. review audit/analytics.

Event states can include:

```text
DRAFT
PREVIEW
SCHEDULED
LIVE
RESOLVING
ENDED
ARCHIVED
CANCELLED
EMERGENCY_STOPPED
```

Validate dependencies, timing, rewards, feature flags, world-state conflicts and cleanup/rollback before production publication.

---

## 8. Story Operations

Narrative operations eventually support:

- story arcs/chapters;
- quests/dialogue;
- NPC narrative states;
- global/player story flags;
- prerequisites/branches;
- event-linked stages;
- scheduled releases;
- test-character/state preview;
- localization-ready text;
- draft/review/publish/rollback;
- history/diff.

Content must respect spoiler/canon controls and pinned versions where changing live content mid-session would create inconsistency.

---

## 9. Character Content & Balance Operations

Authorized staff can work with versioned current definitions such as:

- Primary Discipline base profiles;
- Discipline Mastery/unlock rules;
- Discipline Skills;
- Skill AE/MP/resource costs;
- cooldowns;
- targeting/effects;
- Resonance triggers/caps/PvE-PvP tuning;
- Essence Skills;
- Soulmark branches;
- Mantle content;
- equipment/effects;
- XP/Mastery curves;
- Passive Training plans/rates;
- enemy/boss stats;
- loot/drop weights;
- Expedition modifiers;
- PvP coefficients;
- level/Horizon/Rekindling configuration.

Current player-facing names/descriptions should live with the same versioned definitions that drive mechanics where practical so wording can be corrected without becoming a second mechanical truth source.

Recommended workflow:

```text
EDIT DRAFT
  ↓
VALIDATE
  ↓
VIEW DIFF
  ↓
PREVIEW / SIMULATE WHERE AVAILABLE
  ↓
PUBLISH NOW OR SCHEDULE
  ↓
MONITOR
  ↓
ROLL BACK IF NEEDED
```

Long-running battles/Expeditions should remain pinned to appropriate content/rules versions.

---

## 10. Resonance & Essence Editors

### Resonance Editor

Authoring fields may include:

- eligible Discipline pair;
- directional condition only where genuinely needed;
- name/description;
- trigger/conditions/effects;
- caps/cooldowns;
- tags;
- VFX/SFX;
- PvE/PvP tuning;
- enabled/version state.

Publishing a new Discipline should flag missing Resonance coverage against the released roster.

### Essence Editor

Per-Discipline pure-path content includes:

- Essence Skill definition;
- AE/resource cost;
- targeting;
- effect sequence;
- cooldown;
- tags;
- visuals/audio;
- PvE/PvP tuning;
- enabled/version state.

Publishing a mature Discipline should flag missing pure-Discipline Essence coverage.

Neither editor reintroduces a separate Ultimate or Confluence Art system.

---

## 11. Publishing & Rollback

Important content follows:

```text
DRAFT → PREVIEW → PUBLISH
```

Larger workflows may add review/approval/scheduling/retirement.

Publish records actor, timestamp, environment, content/version, diff, reason and result.

Rollback restores/repoints a prior valid version without deleting history.

Configuration rollback does not automatically erase legitimate durable player transactions already caused by a live event/reward; compensating actions are explicit/audited.

---

## 12. Feature Flags & Emergency Controls

Server-enforced audited flags can disable:

- ranked/2v2;
- trading/marketplace;
- a specific Discipline;
- a specific Skill;
- a specific Resonance;
- a specific Essence;
- a specific Soulmark;
- a specific Mantle;
- a specific item/effect;
- an AI profile/Battle Hall record;
- a specific Expedition;
- guilds/nation warfare/chat;
- an active event.

Broken content should not require shutting down the whole game.

---

## 13. Player Support & Moderation

Authorized support views can inspect appropriate current state such as:

- account/identity metadata;
- Character XP/level/Horizon/cycle age;
- six attributes;
- Discipline Mastery;
- Primary/Secondary build state;
- selected Discipline Skills;
- resolved Resonance or Essence route;
- Soulmarked vs Soul-Severed state and legal supernatural configuration;
- equipment/inventory/currencies;
- Passive Training state/report history;
- quests/story/Archive;
- event eligibility/participation;
- PvP rating/history;
- recent authoritative actions where appropriate.

Corrections use narrow authoritative domain commands rather than raw field editing.

Moderation supports report review, sanctions, communication restrictions and audited notes/workflows.

---

## 14. Audit Log

Record at minimum:

- staff user ID;
- effective permission;
- timestamp;
- environment;
- action type;
- target type/ID;
- reason where required;
- previous/new value/version where practical;
- correlation/request ID;
- success/failure.

Ordinary staff cannot edit the audit history that records their actions.

---

## 15. Security Requirements

Privileged operations require:

- server-side authorization;
- secure sessions;
- re-authentication for high-risk actions;
- MFA when supported cleanly;
- least privilege;
- environment scoping;
- appropriate rate limits;
- CSRF protections where applicable;
- no service-role credentials in browser code;
- no secret exposure;
- prompt access revocation;
- audit trails.

---

## 16. Architecture Direction

Conceptually:

```text
STAFF BROWSER
  ↓
Authenticated Master Panel request
  ↓
Server boundary
  ↓
Permission check
  ↓
Schema/content validation
  ↓
Domain / publishing service
  ↓
Transaction where required
  ↓
Version + audit
  ↓
Realtime invalidation/notification where useful
```

The panel never turns browser input into blindly trusted database values.

---

## 17. Progressive Implementation

### Phase 0 — Architecture

Prepare auth/authorization/audit boundaries without building the full UI.

### Phase 3/4 — Buildcraft/content minimum controls

As Primary/Secondary, Skills, Resonance, Essence, supernatural systems and richer items appear, ship the minimum safe authoring/validation/kill-switch controls required to operate their released content.

### Phase 5 — Live World / Story MVP

Build protected `/master` shell, initial permissions, events, announcements, story/quest/dialogue operations, audits and preview/staging needed for continuing world content.

### Phases 6–8 — Multiplayer operations

Add party/Expedition/PvP event controls, rotations, tournament/season operations and health views.

### Phase 10 — Social/moderation

Add reports, guild/social administration and support workflows.

### Phase 11 — Economy

Add marketplace/economy telemetry, controlled configuration and compensation tools.

### Phase 12 — Nations

Add campaign/event/political-season operations.

### Phase 13 — Complete Master Panel

Consolidate/polish:

- comprehensive editors;
- staff/permission administration;
- Discipline/Skill/Resonance/Essence/Soulmark/Mantle operations;
- Item Studio/Effect Catalog;
- Combat Content Studio;
- Combat AI Lab/Battle Hall configuration;
- Pacing Simulator/Passive Training/Rekindling controls;
- Balance Lab/simulation;
- complete Asset Studio/Audio Manager;
- economic analytics;
- advanced moderation/support;
- version history/rollback;
- Owner dashboards;
- narrative/spoiler controls.

### Phase 15 — Hardening

Validate permissions, audit integrity, publishing/rollback, Break-Glass, abuse/rate limits, concurrency, content validation, simulation safety and recovery workflows.

---

## 18. Owner Command Center

The protected Owner is the root operations authority for game-controlled state that can reasonably be administered through software.

The Owner can eventually:

- inspect players/characters/authoritative progression;
- manage roles/permissions;
- manage content/live operations;
- grant/revoke supported exceptional entitlements/state;
- repair stuck states through authoritative commands;
- pause/disable broken features/content;
- inspect server/economy/balance/AI analytics;
- publish/rollback content;
- run simulations/previews;
- use Break-Glass for supported emergencies.

Owner authority still respects hard persistence/runtime invariants and leaves immutable audit provenance.

---

## 19. Documentation & Help Impact

Master Panel editors should flag relevant public/staff documentation when a changed definition affects player-facing rules.

Examples:

- Skill cost change → Combat/Skill Manual review;
- Resonance/Essence change → Buildcraft Manual review;
- Passive Training rate change → Training Manual review;
- PvP override → queue rules review;
- Horizon/Rekindling change → progression docs review;
- event/story change → spoiler/publication checks.

This prevents operational tuning from silently making the Manual wrong.

---

## 20. Definition of Success

The Master Panel succeeds when:

- Owner can operate AUREVANE without being the bottleneck for every routine safe change;
- staff cannot exceed permissions;
- normal content/balance/story changes do not require code deployment;
- current build vocabulary/mechanics are represented accurately;
- Skills, Resonances, Essences, supernatural content, items and AI use typed/versioned editors rather than arbitrary scripts;
- player corrections use authoritative domain commands;
- production operations are auditable;
- dangerous systems have kill switches;
- staff do not need direct production credentials;
- the panel grows progressively with the game rather than arriving only after every player system is complete.

## 21. Battle Narration Authoring Contract

The future Combat Content / Skill editor must edit the existing typed `SkillNarrationTemplate` contract rather than inventing a separate prose system. The first authorable fields are optional `Hit`, `Miss`, and `Critical` short narration variants. `Critical` remains dormant until the combat engine exposes an authoritative critical outcome; blocked/dodged/parried fields must not be added speculatively.

The editor must provide an allow-listed token picker for `{actor}`, `{target}`, `{ability}`, and `{damage}`, sample preview, unknown-token validation, generic fallback preview, Draft -> Preview -> Publish -> Rollback, version history, and audit provenance. Narration is presentation metadata attached to versioned Skill content and is never read by combat resolution.

Status authoring should likewise expose plain-language lifecycle/effect descriptions only for mechanics that actually exist. Do not build stacking-status authoring UI until a released status supports stacking behavior that players need to understand.
