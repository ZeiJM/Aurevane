# AUREVANE — Master Plan Addendum: Staff Roles, Planned Training & Persistent Live Events

**Status:** Authoritative Master Plan addendum.

**Direction approved:** 2026-08-17.

This addendum is subordinate only to `docs/GAME_MASTER_PLAN.md` and is the current authority for the subjects below.

Where this document conflicts with earlier wording in `docs/MASTER_PANEL.md`, `docs/LIVING_ECONOMY_SOCIAL_IDENTITY.md`, `docs/ROADMAP_LIVING_ECONOMY_SOCIAL_IDENTITY.md`, `docs/OFFLINE_PROGRESSION.md`, or other older supporting documents, **this addendum wins for staff role structure, planned Wayfarer's Practice windows, and persistent live-event operations**.

---

# PART I — CURRENT IMPLEMENTATION DECISION

## 1. Do Not Roll the Project Back to Phase 1

AUREVANE has already entered Phase 2 implementation. Newly approved Phase 1 foundation work must therefore be handled as a **targeted Phase 1 backfill**, not by pretending the implementation is still in Phase 1 or restarting completed Phase 2 work.

Correct sequencing:

```text
CURRENT PHASE 2 IMPLEMENTATION
  ↓
small explicit Phase 1 backfill ticket for Wayfarer's Practice foundation
  ↓
validate against existing character/progression state
  ↓
continue Phase 2 normally
```

The backfill should happen before the project travels much farther because offline accrual touches character timestamps, progression transactions, telemetry, and later Discipline Mastery. It is small enough to insert without redesigning combat.

This does **not** pull professions, Vowbond, Trade House, full staff operations, or the persistent event system into Phase 2.

---

# PART II — WAYFARER'S PRACTICE REVISION

## 2. Planned Practice Windows

Remove **`Until I Return`** completely.

The planned practice choices are exactly:

- **Short**;
- **Overnight**;
- **Extended**.

Exact durations remain data-driven. Initial tuning target:

```text
Short       ~3 hours
Overnight   ~8 hours
Extended    ~24 hours
```

These are presentation/tuning defaults, never client-authoritative reward timers.

## 3. Window Behavior

A selected practice window applies the selected practice focus for that planned amount of legitimate server-measured offline time.

If the player returns early:

- only legitimate elapsed offline time is credited.

If the player stays away longer than the chosen window:

- the planned focus ends at the configured window boundary;
- remaining eligible offline time falls back to **Balanced Practice** under normal bank caps/accrual curves;
- already earned progress is never destroyed;
- specialist focus does not continue indefinitely merely because the player stayed offline.

This gives the duration choice meaning while protecting the six-month progression path.

## 4. One-Absence Intent

`Set Practice` is an intention for the character's **next meaningful offline absence**, not a permanent automation rule.

After the corresponding Training Report is generated/claimed, the explicit plan is consumed. If the player later leaves without setting another plan, automatic Balanced Practice is the safe fallback.

Target feeling:

> “Before I go to bed, what should I train tonight?”

without punishing the player for forgetting.

## 5. Phase 1 Backfill Scope

The retroactive Phase 1 ticket should implement only the minimum that current character progression can support cleanly:

- authoritative character activity/accrual timestamps;
- server-authoritative offline threshold;
- Balanced Practice;
- `Short`, `Overnight`, and `Extended` planned windows;
- prospective `Set Practice` command;
- deterministic Character XP accrual at a deliberately low rate;
- initial Rested Momentum representation;
- idempotent Training Report generation/claim;
- basic Training Report UI;
- explicit-plan versus automatic-fallback telemetry;
- no direct Might/Finesse/Intellect/Resolve passive growth;
- no profession XP;
- no materials/currency/items from passive practice;
- no event participation credit.

Discipline Focus remains a Phase 3 extension because Discipline/Mastery must exist first.

Recovery & Study may mature in Phase 3 when Rested Momentum can be balanced against real active progression.

---

# PART III — SIMPLE STAFF MODEL

## 6. Exactly Four Authority Classes

AUREVANE uses exactly four authority classes:

```text
GAME OWNER
MODERATOR
CONTENT STAFF
EVENT STAFF
```

A normal player has no staff authority and is not another staff role.

Do not create public role templates such as Administrator, Operations Lead, Story Editor, Balance Designer, Analyst, Support Staff, or Live Event Manager.

If a person needs an unusual power, the Game Owner grants a **specific capability** to that account instead of inventing another role name.

## 7. Multiple Delegated Roles

A staff account may hold more than one delegated role when genuinely needed.

Examples:

- a trusted person may be both Content Staff and Event Staff;
- Moderator does not automatically imply Event Staff;
- adding a second role adds only that role's capability set;
- revoking one role removes that role's capabilities while preserving unrelated grants.

The protected Game Owner does not need delegated staff roles to receive Owner power.

## 8. Game Owner

The Game Owner is the root operational authority.

The protected Owner account:

- has complete Master Panel access;
- grants/revokes all delegated roles;
- grants/revokes allowed special capabilities;
- controls production publication policy;
- controls economy, balance, progression, feature flags, support corrections, security-sensitive operations, and emergency controls;
- can operate all content/event/moderation domains;
- can inspect the complete audit trail;
- cannot be demoted/replaced by ordinary staff actions.

The intended Owner character is **Zei**.

Owner authorization is tied to the authenticated account/user principal, never to the text `Zei`.

### Owner badge

Official badge: **WORLDWRIGHT**.

Visual direction:

- solar gold;
- deep violet;
- distinctive AUREVANE keystone/crown/sigil;
- icon + text so authority never depends on color alone.

The badge is presentation derived from authority. It never grants authority.

## 9. Moderator

Moderator protects the player community.

Normal capabilities may include:

- review player reports;
- inspect relevant moderation history;
- moderate chat/messages under policy;
- warn players;
- mute/communication-restrict players;
- apply temporary suspensions within configured limits;
- add internal moderation notes;
- escalate to the Game Owner;
- view sanctions/history;
- perform narrowly scoped safety actions during events without editing event state.

Moderator does **not** automatically receive:

- item/currency grants;
- economy editing;
- content editing;
- event creation;
- event reward editing;
- balance editing;
- staff management;
- feature-flag controls;
- raw database access.

Permanent bans may be an Owner-configurable Moderator capability. Default production policy may require either Owner approval or an explicit elevated Moderator capability.

### Moderator badge

- sapphire/aether blue;
- silver edge;
- shield/ward icon;
- label `MODERATOR`.

## 10. Content Staff

Content Staff makes AUREVANE look, read, and feel polished.

Normal capabilities may include approved work on:

- item names/descriptions/flavor text;
- NPC descriptions and non-mechanical presentation copy;
- event banners/illustrations/portraits/icons/thumbnails/map art;
- approved media/audio references;
- accessibility copy such as alt text/captions;
- cosmetic presentation metadata;
- Codex/manual copy;
- approved dialogue/narrative text domains granted by the Owner;
- preview/staging;
- version history/diffs for their content.

Content Staff does **not** automatically change:

- item stats/effects;
- combat coefficients;
- XP/progression curves;
- economy prices/drop rates;
- loot probability;
- event objectives/rewards;
- feature flags;
- player inventory/currency;
- moderation sanctions;
- staff roles.

The Owner may grant a specific Content Staff account an extra named capability without creating another public role.

### Content Staff badge

- luminous teal/emerald;
- pearl or soft-gold edge;
- quill/star/brush-like AUREVANE icon;
- label `CONTENT STAFF`.

## 11. Event Staff

Event Staff operates the living world through the persistent event system below.

Normal capabilities may include:

- create event drafts from approved building blocks;
- preview events;
- schedule approved events;
- start/operate approved production events within configured scope;
- monitor participation and health;
- advance manual phases where allowed;
- pause/stop events within granted scope;
- resolve events;
- publish configured aftermath presentation;
- attach approved rewards, titles, media, quests, encounters, resource sites, world effects, and announcements;
- inspect event analytics/audit history.

Event Staff never receives arbitrary scripting, SQL, raw database access, unlimited item grants, unrestricted currency creation, staff management, or security controls.

High-risk event powers remain Owner-gated, including:

- permanent canon/world-state changes;
- unusually valuable reward packages;
- premium entitlements;
- production-wide destructive changes;
- bypassing conflict validation;
- editing raw combat/economy/progression coefficients outside approved event modifier catalogs.

### Event Staff badge

- radiant amber/ember-gold;
- aether-blue accent;
- pulse/starburst/calendar-sigil icon;
- label `EVENT STAFF`.

## 12. Special Capability Grants Without Role Explosion

The Game Owner may grant/revoke explicit account capabilities, for example:

```text
moderation.permanent_ban
content.story_copy
content.production_publish
events.production_publish
events.global_scope
events.reward_titles
events.emergency_stop
balance.edit_selected
support.issue_compensation
```

Rules:

- every special grant is explicit and auditable;
- a special grant does not create another public role;
- it can be revoked promptly;
- staff cannot grant themselves powers;
- staff cannot grant powers to others unless a future bounded delegation mechanism is explicitly designed;
- Owner replacement/root security/unrestricted staff management are never ordinary special grants.

---

# PART IV — MASTER PANEL ACCESS

## 13. Protected `/master`

Continue using one protected `/master` area inside AUREVANE.

The Profile/Account menu may expose `Master Panel` to Zei and an appropriate staff entry to delegated staff. This is navigation only.

Every privileged page, loader, API route, server action, RPC, mutation, and domain command re-checks the authenticated principal's **current effective capabilities** server-side.

Hiding a button is never authorization.

## 14. Module Visibility

### Game Owner

All available modules.

### Moderator

Moderation, reports, relevant player/support views, moderation history.

### Content Staff

Only permitted content/media/editor surfaces, preview/staging, publication/history views.

### Event Staff

Live Events, required event dependencies, event announcements, event analytics, event history, and only the related tools needed to operate events.

Multi-role staff see the union of authorized modules.

## 15. Revocation and Session Safety

- capabilities are evaluated at the server boundary;
- privileged requests do not trust long-lived browser role flags;
- grant/access versioning or equivalent invalidates stale access;
- revoked users lose access even with an old `/master` tab open;
- MFA/step-up authentication should protect privileged access when supported;
- sensitive actions require reason/confirmation;
- privileged mutations are fully audited;
- no service-role/database secret appears in browser code.

---

# PART V — PERSISTENT LIVE EVENT SYSTEM

## 16. Meaning of Persistent

A persistent event is a server-authoritative live-world event whose state survives browser closes, player absence, deploys, worker restarts, and ordinary server restarts.

An event may run for minutes, hours, days, or weeks and may progress through several phases.

Persistence has three layers:

1. **runtime persistence** — event/phase state survives infrastructure restart;
2. **participant persistence** — contribution, eligibility, claims, and history remain trustworthy;
3. **world-history persistence** — Chronicle and approved aftermath remember the event.

Persistent does not automatically mean permanent canon change.

## 17. Definition vs Run

Keep authored definition separate from the live occurrence:

```text
EVENT TEMPLATE
  ↓
VERSIONED EVENT DEFINITION
  ↓
EVENT RUN
  ↓
PHASES / OBJECTIVES / WORLD EFFECTS
  ↓
PLAYER + COMMUNITY CONTRIBUTION
  ↓
RESOLUTION
  ↓
AFTERMATH + CHRONICLE
```

### Event Template

Reusable safe starting structure for a family of events.

### Event Definition

Versioned authored configuration containing scope, phases, objectives, effects, rewards, presentation, timing, dependencies, and cleanup rules.

### Event Run

One actual occurrence. Recurrence creates a new run and never reuses participant claim state from an older run.

### Event Phase

Named stage with objectives, world effects, messaging, and transition rules.

### Participant Ledger

Per character/account authoritative participation, contribution, eligibility, reward claim, and provenance.

## 18. Event Families

Support building blocks for:

- World Crisis;
- Regional Event;
- Narrative Event;
- Community Objective;
- Legendary Hunt;
- Expedition Event;
- PvP Event;
- Seasonal Event;
- Nation Event;
- Profession/Gathering Event;
- Merchant/Discovery Micro Event;
- Lore Revelation Event;
- Community Crafting/Contribution Event.

A single event may compose several families.

## 19. Event Scope

Every event declares explicit scope:

- global;
- nation;
- region;
- node/location;
- Expedition;
- PvP queue/ruleset;
- player cohort/eligibility group;
- story-state cohort.

Event Staff cannot silently broaden a scoped event beyond their granted authority.

## 20. Event Phases

An event may have one or many phases.

Example:

```text
PHASE 1 — Omen
announcement + map clue + altered ambience

PHASE 2 — Mobilization
quests + gathering + community contributions

PHASE 3 — Crisis
encounters / boss / expedition / PvP objective

PHASE 4 — Resolution
outcome computed from authoritative objectives

PHASE 5 — Aftermath
NPC/world presentation + Chronicle + final rewards
```

Not every event needs five phases. Micro events can have one live phase and an ending.

## 21. Phase Transitions

Allowed transition triggers:

- scheduled time;
- event elapsed time;
- community threshold;
- objective completion;
- explicit approved Event Staff command;
- Owner command;
- validated world/story condition.

A transition is a server transaction/domain command and must be idempotent.

No client may declare a phase complete.

## 22. Objective Catalog

Events compose existing authoritative game services instead of creating a parallel progression engine.

Objective types may include:

- defeat approved enemy/encounter targets;
- complete approved quests;
- complete Expedition objectives;
- participate in approved PvP activity;
- gather event materials;
- craft/contribute requested goods;
- discover/reveal locations;
- interact with world objects;
- protect/escort/hold an objective;
- community threshold contribution;
- choose among authored narrative options;
- solve a staged lore/community discovery.

Every contribution must be validated by the authoritative source system and deduplicated.

## 23. World Effect Catalog

Event Staff selects from safe, typed effects rather than writing arbitrary scripts.

Examples:

- activate/deactivate a map marker;
- open/close an event node;
- add approved encounters to a pool;
- activate an event quest/dialogue package;
- change approved NPC presentation/state;
- enable a special vendor inventory;
- alter an approved Expedition modifier pool;
- activate a PvP ruleset/rotation;
- activate approved Resource Sites;
- change ambience/music/media references;
- publish World Pulse/announcement content;
- apply bounded event-specific reward/loot modifiers;
- apply approved region presentation variants.

High-risk permanent world/canon effects require Owner authority.

## 24. Reward Model

Events use normal reward services.

Possible rewards:

- Crowns within approved budgets;
- normal items/materials;
- event cosmetics;
- collectible earned titles;
- Chronicle recognition;
- profession materials;
- event currency only when a real event economy requires it;
- lore/Archive unlocks;
- access to aftermath content.

Guardrails:

- rewards are versioned and budget-validated;
- claims are idempotent;
- one event cannot silently mint unbounded economy value;
- Event Staff chooses only from reward types/limits they are permitted to use;
- unusually valuable packages require Owner approval;
- no short one-time event grants irreplaceable meta-defining combat power;
- meaningful build-enabling items recur or have alternate acquisition paths.

## 25. Participation Tiers

Where useful, rewards may use transparent participation tiers such as:

- participated;
- meaningful contribution;
- major contribution;
- exceptional achievement.

Do not reward only the top 0.1% if the event is presented as a cooperative world event.

Contribution formulas must resist trivial spam and should cap/reduce repetitive low-value actions.

## 26. Community Outcomes

Events may resolve differently based on community performance.

Possible outcomes:

- success;
- partial success;
- failure;
- branch A/B based on authored choice.

Outcomes may change:

- temporary region state;
- follow-up quests;
- Chronicle history;
- cosmetics/titles;
- later event intensity;
- vendor/encounter availability;
- narrative flavor.

They should not permanently destroy core gameplay access or make the central canon impossible to continue.

## 27. Event Calendar and Recurrence

The Master Panel includes a calendar/timeline view.

It should show:

- scheduled events;
- active events;
- affected scopes;
- major reward windows;
- recurring templates;
- conflicts;
- planned announcements;
- event dependencies.

Recurrence examples:

- every weekend;
- one week each season;
- owner-triggered only;
- recurring after a cooldown;
- annual/anniversary event.

Each occurrence creates a new Event Run with separate contribution/claim state.

## 28. Conflict Detection

Before scheduling/publishing, validate conflicts such as:

- two events trying to own one exclusive location state;
- incompatible PvP rotations;
- contradictory NPC state;
- overlapping story packages with incompatible canon stage;
- duplicate unique reward grants;
- mutually exclusive Resource Site/world modifiers;
- disabled feature dependencies;
- event end before start;
- phase transition with impossible prerequisites.

The panel should explain the conflict and block unsafe publication unless an explicit Owner-only override exists.

## 29. Preview and Simulation

Event Staff should be able to preview an event in staging/safe preview mode with:

- selected test progression state;
- selected nation/region;
- test event clock;
- phase jumping;
- objective completion simulation;
- reward preview;
- map marker preview;
- announcements/media preview;
- dependency validation;
- cleanup preview.

Preview never writes production player progression/economy state.

## 30. Live Operations Dashboard

While an event is live, Event Staff sees:

- current phase;
- time remaining / next scheduled transition;
- participant count;
- community progress;
- objective health;
- reward claim counts;
- error/rejection rate;
- suspicious contribution patterns;
- affected scopes;
- active world effects;
- recent phase transitions/actions;
- pause/stop controls if permitted.

The dashboard never becomes raw database access.

## 31. Pause, Stop, Recovery

Every persistent event needs explicit operational recovery rules.

### Pause

Stops eligible progression/transitions without deleting state. Useful for incident investigation.

### Emergency Stop

Immediately removes/neutralizes active event effects according to safe cleanup rules while preserving audit/participant history.

### Resume

Only from a valid paused state and with current definition/dependencies still valid.

### End Early

Runs configured resolution/cleanup policy and records why the event ended early.

### Recover After Infrastructure Restart

The server reloads authoritative run state and deterministically catches up any time-based transitions that should have occurred, without double rewards or repeated phase effects.

## 32. Event Cleanup

An event definition explicitly declares cleanup for temporary effects.

Examples:

- remove markers;
- restore encounter pools;
- retire temporary vendors;
- close event nodes;
- stop ambience overrides;
- close event contribution endpoints;
- preserve Chronicle/participant history;
- keep approved aftermath quests/world presentation.

Cleanup is idempotent.

## 33. Event Security and Exploit Prevention

Requirements:

- all state/clock/eligibility/contribution is server-authoritative;
- contributions originate from authoritative gameplay outcomes;
- reward claims are idempotent;
- event-run IDs separate repeat occurrences;
- reconnect cannot duplicate rewards/contributions;
- phase changes cannot be client-forced;
- staff cannot inject arbitrary scripts/SQL;
- reward budgets and content references are validated;
- staff actions are permission-checked and audited;
- suspicious contribution velocity is observable/rate-limited;
- test/preview runs are impossible to claim in production;
- Event Staff cannot expose unreleased spoiler/canon content without the required grant.

## 34. Event Titles

Events may grant collectible earned titles.

Event Staff may attach only existing approved title definitions unless separately granted title-definition permission.

Owner may create or approve prestigious special titles.

Event titles use normal Display Title rules and never impersonate official authority badges.

## 35. Event Presentation

Player-facing surfaces may include:

- World Pulse;
- Events panel;
- strategic map markers;
- region/node banners;
- quest journal;
- event progress panel;
- Chronicle after completion;
- restrained login/return summary when relevant.

Do not flood the map or home screen. Event markers participate in the player's map-layer filters.

## 36. Analytics

Track at minimum:

- impressions/awareness;
- participation rate;
- start-to-meaningful-contribution conversion;
- participation by level/progression band/nation;
- objective completion rates;
- phase timing;
- community progress curves;
- reward issuance/claim rates;
- economy output;
- title/cosmetic acquisition;
- event-related retention/return behavior;
- errors/abandonment;
- suspicious contribution;
- staff interventions/pauses/stops;
- recurrence fatigue.

## 37. Definition of Success

The system succeeds when Event Staff can make AUREVANE feel alive without needing routine code deployments, while the Game Owner retains final control and players cannot exploit staff tooling or event state for illegitimate progression.

A successful persistent event can be drafted, previewed, scheduled, run across several phases, survive a restart, record player/community progress, resolve, clean up temporary state, leave an aftermath/Chronicle entry, and be safely repeated later as a new run.