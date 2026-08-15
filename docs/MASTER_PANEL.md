# AUREVANE — Owner, Staff & Master Panel Specification

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md`.

**Direction approved:** 2026-08-15.

The Master Panel is AUREVANE's operational control center. It must let the owner run the game, safely delegate responsibilities, publish story and events, rebalance content, respond to problems, moderate players, and make controlled live changes without requiring routine source-code edits or direct database access.

The full panel is a later roadmap phase, but the permissions and operational model must be anticipated earlier and the minimum tools required by each game system should arrive with that system.

## 1. Primary Goal

The owner should eventually be able to operate AUREVANE as a live game through `/master`.

That includes:

- seeing what is happening now;
- creating and delegating staff roles;
- controlling exactly what each staff member can do;
- pushing world events and story updates;
- editing data-driven content;
- tuning balance safely;
- scheduling changes;
- previewing changes before production;
- enabling/disabling troubled features;
- reviewing analytics and server health;
- moderating players;
- auditing every privileged action;
- rolling back content mistakes.

The panel is not permission to bypass normal game integrity. It is a safer interface over the same authoritative services and publishing systems.

## 2. Design Principles

### Owner authority

There is one protected **Owner** authority for the project. Owner-level access is the highest privilege tier and cannot be granted casually by ordinary staff-management actions.

### Delegation without giving away the keys

Staff receive only the permissions required for their job. An Event Staff member should be able to run events without gaining economy, staff-management, secret, or destructive system access.

### Permissions, not UI hiding

The server enforces every privileged action. Hidden routes, hidden buttons, or client-side role values are never security boundaries.

### No routine direct database editing

Operational changes use validated commands, editors, publishing workflows, and audited actions. Direct production database access is an exceptional engineering operation, not normal game administration.

### Draft, preview, publish, rollback

Important content should follow the Master Plan's versioning model instead of being instantly overwritten in production.

### Audit everything important

Every privileged mutation must be attributable to a person, time, reason, target, and before/after state where practical.

### Environment separation

Local, staging/preview, and production remain distinct. Staff should be able to test event and content changes outside production before publication.

## 3. Role Model

AUREVANE should use **role templates backed by granular permissions**.

Do not hard-code business logic such as `if role === "event_staff"`. Server authorization should ask whether the authenticated staff identity has the required permission for the target environment/action.

Suggested role templates:

### Player

Normal account. No staff access.

### Owner

Project owner/root authority.

Typical capabilities:

- all Master Panel permissions;
- manage staff and role templates;
- grant/revoke privileged access;
- production publish/rollback;
- feature flags and maintenance controls;
- balance/economy/system controls;
- audit access;
- emergency actions.

Owner-only actions should be deliberately small and clearly identified.

### Administrator / Operations Lead

Broad delegated operational authority without automatically receiving owner-only identity/ownership powers.

### Live Event Manager

Creates, previews, schedules, starts, monitors, resolves, and stops approved world/live events within allowed scopes.

### Narrative / Story Editor

Edits dialogue, quests, story arcs, story flags, NPC narrative content, and event-linked narrative content. Publication rights may be separate from edit rights.

### Balance Designer

Edits data-driven balance values, reviews analytics, runs simulations where available, prepares balance packages, and publishes only when granted the corresponding publish permission.

### Content Editor

Works with items, enemies, encounters, loot tables, locations, Disciplines, or other assigned content domains.

### Moderator / Support

Handles reports, moderation, account support, communication restrictions, and narrowly scoped support actions. This role should not automatically receive game-balance or economy-edit permissions.

### Analyst / Observer

Read-only access to selected analytics, health, event, or content views.

Role templates are defaults. The owner can later create custom roles from explicit permissions.

## 4. Permission Domains

The exact schema is implemented later, but architecture should anticipate permissions similar to:

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
content.confluences.edit
content.soulmarks.edit
content.items.edit
content.enemies.edit
content.world.edit
content.expeditions.edit
content.loot.edit
content.publish

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

Permissions may also be scoped by environment and, later if useful, by content domain or region.

## 5. Owner-Protected Actions

Some actions deserve stricter treatment than ordinary admin operations.

Examples:

- changing Owner identity;
- granting high-level staff-management privileges;
- deleting/retiring critical production content in bulk;
- production-wide destructive rollback;
- disabling core authentication/security controls;
- exceptional direct economic interventions above configured support limits;
- changing security-sensitive system configuration.

High-risk actions should require re-authentication and explicit confirmation. Selected actions may later support two-person approval, but do not overengineer this before the team size justifies it.

## 6. Master Panel Navigation

The full panel should grow toward:

- **Overview** — players online, activity, errors, health, active events, season;
- **Live World** — events, schedules, world state, announcements, Chronicle;
- **Story** — arcs, quests, dialogue, story flags, NPC narrative state;
- **Character Content** — Disciplines, Arts, Traits, Confluences, Soulmarks;
- **World Content** — regions, nodes, NPCs, enemies, bosses, encounters, stores;
- **Expeditions** — templates, rooms, modifiers, bosses, loot;
- **Balance Lab** — analytics, values, comparisons, simulations, staged balance packages;
- **PvP & Seasons** — queues, rotations, tournaments, seasonal configuration;
- **Guild/Nation Ops** — added when those systems exist;
- **Economy** — telemetry and controlled economic configuration;
- **Players & Support** — account inspection and controlled support actions;
- **Moderation** — reports, sanctions, chat/social tools;
- **Media / Asset Studio** — art/audio pipeline and publication;
- **Feature Flags** — safe system enable/disable controls;
- **System** — health, maintenance, worker status, errors;
- **Staff & Permissions** — staff accounts, roles, permission grants;
- **Audit Log** — searchable history of privileged actions.

Do not build empty fake sections before their underlying systems exist.

## 7. Live Event Panel

The Live Event panel is a major requirement, not a decorative admin page.

Authorized staff should eventually be able to:

1. choose an event template or create a draft;
2. set title, summary, internal notes, affected regions/nodes, and timing;
3. attach quests, encounters, objectives, NPC changes, map markers, modifiers, and approved reward tables;
4. attach announcement, art, ambience, and music references where relevant;
5. preview the event in staging or a safe preview mode;
6. validate dependencies and conflicts;
7. schedule it or publish it immediately if authorized;
8. monitor participation and progress;
9. trigger approved phase transitions when an event supports manual progression;
10. stop or emergency-disable it if necessary;
11. resolve/close it;
12. publish aftermath content;
13. review the complete audit and analytics record.

### Event statuses

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

### Event safeguards

Before production publication, validate at minimum:

- required content exists and is published;
- referenced regions/nodes are valid;
- start/end rules are coherent;
- reward tables are valid;
- incompatible feature flags are not disabled;
- no obvious overlapping exclusive world-state mutation conflicts exist;
- rollback/cleanup behavior exists where required.

## 8. Story Operations Panel

Narrative staff should be able to build continuing story without source-code edits for ordinary content.

Capabilities eventually include:

- story arcs and chapters;
- quest creation/editing;
- dialogue trees;
- NPC narrative states;
- global and player-specific story flags;
- prerequisites and branching conditions;
- event-linked story stages;
- scheduled releases;
- preview as a test character/state;
- localization-ready text fields where practical;
- draft/review/publish/rollback;
- history/diff view.

Published changes must respect pinned versions for players already inside content where changing mid-session would create inconsistency.

## 9. Balance Lab and Quick Edits

The owner and authorized balance staff need to make frequent, controlled adjustments without editing TypeScript.

Examples:

- ability coefficients;
- MP costs;
- cooldowns;
- enemy stats;
- encounter weights;
- XP/Mastery curves;
- drop weights;
- shop prices;
- Expedition modifiers;
- PvP coefficients;
- Confluence values;
- level cap and other approved configuration.

A quick edit still follows safety rules.

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

Balance edits should produce a new content/config version. Long-running battles/Expeditions should not silently mutate underneath players if the affected system pins content versions.

## 10. Publishing Workflow

Important content follows:

```text
DRAFT → PREVIEW → PUBLISH
```

Expanded operational states may include:

```text
DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PUBLISHED → RETIRED
```

Do not require every small team to use a heavyweight enterprise approval process. The system should support owner-only rapid publication now and stronger review workflows later.

Every publish operation should record:

- actor;
- timestamp;
- environment;
- content IDs/versions;
- diff or old/new values where practical;
- reason/change note;
- result.

## 11. Rollback

Rollback is a first-class requirement.

For versioned content, the panel should make it possible to select a prior valid version and republish it as a new version or restore the active pointer safely.

Rollback must not mean deleting history.

If a world event has already granted rewards or altered durable player state, rollback of its configuration does not automatically erase legitimate player transactions. Compensating operations must be explicit and audited.

## 12. Feature Flags and Emergency Controls

The Master Plan already requires feature flags. The owner should be able to safely disable affected systems without taking down the entire game.

Examples:

- ranked queues;
- 2v2;
- trading;
- marketplace;
- a specific Discipline/Art/Soulmark/Confluence;
- a specific Expedition;
- guilds;
- nation warfare;
- chat;
- an active event.

Emergency controls must be server-enforced and audited.

## 13. Player Support and Moderation

The panel should eventually provide controlled support tools such as:

- player/account lookup;
- character summary;
- recent authoritative actions where appropriate;
- sanctions and their history;
- chat/messaging restrictions;
- report review;
- notes/tickets;
- narrowly scoped support grants or corrections through authoritative commands;
- reversal/compensation workflows where systems support them.

Avoid raw inventory or currency field editing as the normal support workflow. Corrections should call domain services so constraints, idempotency, and audit records remain intact.

## 14. Audit Log

Administrative actions record at minimum:

- staff user ID;
- effective role/permission;
- timestamp;
- environment;
- action type;
- target type and ID;
- reason/change note where required;
- previous value/version where practical;
- new value/version where practical;
- request/correlation ID;
- success/failure result.

Audit data must not be editable by ordinary staff whose actions it records.

The owner needs searchable filters by actor, action, target, time, and domain.

## 15. Security Requirements

Staff access is high-value access.

Eventually require appropriate protections such as:

- server-side authorization on every operation;
- secure session handling;
- re-authentication for sensitive actions;
- MFA for privileged staff when the authentication stack supports it cleanly;
- least-privilege permissions;
- environment-scoped access;
- rate limiting for destructive or high-volume actions;
- CSRF protections where applicable;
- no service-role credential in browser code;
- no secrets displayed in the panel;
- audit trails;
- staff access revocation that takes effect promptly.

## 16. Architecture Direction

Conceptually, privileged operations should flow like:

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
Version + audit record
  ↓
Realtime invalidation/notification where useful
```

The panel never writes arbitrary trusted values directly from the client into authoritative tables.

## 17. Progressive Implementation

The Master Panel is delivered in layers.

### Phase 0 — Architecture only

- auth and authorization boundaries must support future staff separation;
- audit/logging patterns should not block privileged operations later;
- no need to build the full staff UI during F0.2.

### Phase 5 — Live World / Story MVP

Build the first genuinely useful staff operations slice:

- protected `/master` shell for owner/authorized staff;
- initial permission framework;
- event drafts/scheduling/publishing;
- announcements;
- event/world-state status;
- story/quest/dialogue operations required for continuing world content;
- audit trail for these actions;
- preview/staging workflow.

This ensures the world can become lively when the world feature itself arrives.

### Phases 6–8 — Multiplayer operations

Add party/Expedition/PvP event controls, rotations, tournament scheduling, season operations, and relevant health views.

### Phase 10 — Social/moderation operations

Add reports, moderation, guild/social administration, and support workflows.

### Phase 11 — Economy operations

Add economic telemetry, marketplace health, controlled economy configuration, and safe support/compensation tools.

### Phase 12 — Nation operations

Add campaign/event controls and political-season tooling.

### Phase 13 — Complete Master Panel

Consolidate and polish the full owner operating system:

- comprehensive editors;
- staff/permission administration;
- Balance Lab;
- simulation;
- complete Asset Studio/audio manager;
- economic analytics;
- advanced moderation;
- version history/rollback UX;
- owner dashboards and operational workflows.

## 18. Definition of Success

The Master Panel succeeds when the owner can operate AUREVANE without becoming the bottleneck for every safe routine change, while still retaining final control.

Specifically:

- the owner can delegate event, story, balance, moderation, and content work independently;
- staff cannot exceed their granted permissions;
- ordinary live content changes do not require a code deployment;
- balance and story changes are previewable and reversible;
- production operations are auditable;
- dangerous systems have kill switches;
- staff do not need direct database credentials;
- the panel grows with the game instead of appearing only after every player-facing system is already complete.
