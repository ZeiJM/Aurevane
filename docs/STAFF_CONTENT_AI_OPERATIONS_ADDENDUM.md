# AUREVANE — Staff Publications & AI Content Studio Addendum

**Status:** Owner-approved authoritative operations addendum.

**Direction approved:** 2026-08-18.

This addendum is subordinate only to `docs/GAME_MASTER_PLAN.md` and the fixed-role authority in `docs/GAME_MASTER_PLAN_LIVE_EVENTS_STAFF_ADDENDUM.md`.

Where older documents describe broad role templates such as Administrator, Story Editor, Balance Designer, or AI QA roles, the fixed staff model remains authoritative:

```text
GAME OWNER
MODERATOR
CONTENT STAFF
EVENT STAFF
```

Granular capabilities may be granted without creating new role classes.

This addendum locks:

- editable **Manual** and **News** surfaces inside `/master`;
- role-safe publication workflows;
- an **AI Content Studio / AI Database** for reusable non-player combat definitions;
- direct integration of AI content with Events, encounters, Tactical Hall, bosses, and simulations;
- no live generative-model dependency for actual combat decisions.

---

# 1. Public Communications Module

`/master` includes a **Public Communications** module with:

```text
PUBLIC COMMUNICATIONS
├ News
├ Manual
├ Publication Calendar
├ Review / Preview
└ Revision History
```

News and Manual remain separate content domains but share safe rich-content blocks, versioning, audit, scheduling, preview, and rollback.

---

# 2. Manual Editing

Authorized staff can create and maintain the public Adventurer's Guide and protected staff documentation.

### Content Staff default scope

Content Staff may normally:

- create/edit Manual article drafts;
- edit released-system explanatory copy;
- maintain glossary terminology;
- attach approved media/diagrams/screenshots;
- set keywords and cross-links;
- set accessibility text;
- preview public/progression-gated presentation;
- review diffs/version history;
- flag an article for review;
- update stale article copy caused by a released content change.

Content Staff does **not** automatically receive production publish authority.

Production publication uses either:

- GAME OWNER; or
- an explicit capability such as `documentation.manual.publish` / approved `content.production_publish`.

### Event Staff manual scope

Event Staff may edit event-specific operational/help drafts only when required by an event workflow and when the relevant capability is granted.

They do not automatically gain broad Manual editing rights merely because they can run events.

### Moderator scope

Moderator may read the protected staff procedures relevant to moderation but does not normally edit public Manual content.

---

# 3. News Editing

### Content Staff

Content Staff may normally:

- draft News posts;
- edit copy/presentation;
- attach approved images;
- prepare patch-note formatting;
- prepare development/community updates;
- link current Manual articles;
- preview anonymous/mobile/desktop views.

Production publication still requires Owner or explicit production-publish capability.

### Event Staff

Event Staff may normally create/edit **event-linked News drafts** from the event workflow, including:

- announcement copy;
- event dates sourced from authoritative event timing;
- participation guidance;
- public reward summary;
- aftermath summary;
- linked Manual/help references.

If `events.production_publish` is granted, Event Staff may publish event-scoped News within configured scope. This does not grant general balance/system publication authority.

### GAME OWNER

Game Owner can create/edit/schedule/publish/correct/archive/rollback all News and Manual content.

---

# 4. Publication Safety

All public communication writes are:

- authenticated;
- server-authorized;
- structured/validated;
- versioned;
- previewable;
- auditable;
- rollback-capable.

No staff editor accepts arbitrary JavaScript, SQL, unsanitized HTML, or secret server data.

Public reads expose only explicitly published content.

---

# 5. AI Content Studio / AI Database

The Master Panel eventually includes a reusable **AI Content Studio** backed by a versioned AI content database.

This is not a generative AI model controlling battles.

It is the authoritative catalog used to define **what an AI-controlled combatant is allowed to have and how it tends to make decisions**.

Conceptually:

```text
AI COMBATANT DEFINITION
+
SKILL LOADOUT
+
PASSIVE/EFFECT PACKAGE
+
EQUIPMENT / STATS
+
AI PROFILE
+
INTELLIGENCE GRADE
+
KNOWLEDGE POLICY
+
OBJECTIVE / TEAM ROLE
+
ENCOUNTER OVERRIDES
=
NON-PLAYER COMBAT BEHAVIOR
```

The actual battle still goes through legal-action enumeration and deterministic server logic.

---

# 6. Reusable AI Database Objects

The AI Content Studio should manage reusable objects such as:

### AI Profile

Defines behavioral priorities:

- aggression;
- survival;
- target selection;
- focus fire;
- ally protection;
- objective priority;
- resource conservation;
- control/displacement preference;
- mobility preference;
- hazard avoidance;
- finishing behavior;
- setup/payoff preference;
- risk tolerance;
- lookahead/candidate budgets;
- coordination intensity;
- fallback behavior.

### Intelligence Grade

Defines reasoning quality, separate from raw stats.

Player-facing baseline remains compatible with:

```text
Recruit
Trained
Veteran
Elite
Master
```

Event/internal definitions may use bounded variants but must map to understandable reasoning budgets.

### AI Skill Package

A reusable set of legal Skills available to the AI.

Skills use the same authoritative Skill definitions as players where appropriate. AI-only Skills may exist for monsters/bosses when explicitly authored.

### AI Passive Package

Reusable typed passive effects, including:

- stat/resource changes;
- trigger effects;
- combo rules;
- resistances/weaknesses;
- terrain behavior;
- summon behavior;
- information-control/reveal abilities;
- event-specific modifiers;
- boss-phase passives.

Do not create a second untyped passive engine only for AI.

### Knowledge Policy

Defines which battle information the AI is legally allowed to know.

This is especially important when player effects hide MP, stats, cooldowns, equipment details, or other information.

### Objective Profile

Defines priorities for:

- elimination;
- capture/hold;
- escort;
- survival;
- escape;
- protect target;
- destroy object;
- interrupt ritual;
- boss mechanics;
- event-specific objectives.

### Team Profile

Defines coordination patterns such as formation, focus reservation, support protection, control chains, retreat/rally, and target assignment.

### Loadout Template

References:

- level/stat template;
- Primary/Secondary or monster archetype where relevant;
- Skills;
- passives;
- equipment;
- Soulmark/Mantle-like NPC mechanics only if the authored NPC rules permit them;
- AI Profile;
- Intelligence Grade cap;
- tags/media.

---

# 7. AI Character / Enemy Builder

Authorized staff can create an AI combatant draft by selecting from the reusable database.

Suggested builder flow:

```text
IDENTITY
name / enemy family / tags / presentation
        ↓
STATS
level + stat template + allowed overrides
        ↓
SKILLS
choose approved Skills
        ↓
PASSIVES
choose approved passive packages
        ↓
BEHAVIOR
AI Profile + Intelligence Grade
        ↓
KNOWLEDGE
what may this AI legally know?
        ↓
OBJECTIVE
what does it care about in this encounter?
        ↓
TEAM ROLE
how does it coordinate?
        ↓
PREVIEW / SIMULATE
        ↓
PUBLISH / ASSIGN
```

All selections resolve stable IDs and published versions rather than copying arbitrary client text into combat state.

---

# 8. Staff Authority for AI Design

### GAME OWNER

Full AI Content Studio authority:

- create/edit any AI profile/object;
- create global Skills/passives where the content domain permits;
- edit Intelligence Grade parameters;
- edit Knowledge Policies;
- publish/rollback;
- create hidden/internal/event-only profiles;
- emergency-disable;
- assign content globally;
- run unrestricted simulations.

### EVENT STAFF

Event Staff should be powerful enough to build interesting event encounters without source-code edits.

Default event-safe abilities may include:

- select published enemy/AI templates;
- clone a published template into an **event-scoped draft**;
- select approved Skills from the event-allowed catalog;
- select approved passives/modifiers;
- choose an allowed Intelligence Grade;
- choose approved AI Profiles/archetypes;
- set bounded stat/level scaling within event configuration limits;
- set objective/team role;
- preview the encounter;
- run event-scoped simulations;
- attach the AI definition to event phases/encounters;
- publish with the event when `events.production_publish` permits.

Event Staff may **not by default**:

- create arbitrary new core combat primitives;
- make AI omniscient by editing Knowledge Policy outside approved choices;
- change global player Skill definitions;
- alter production-wide Intelligence Grade algorithms;
- publish a global AI Profile used by unrelated content;
- bypass hard balance/security caps.

The Owner may grant a specific explicit capability such as `ai.design_advanced` or `ai.publish_global` if needed without creating another staff role.

### CONTENT STAFF

Content Staff normally manages AI-facing presentation:

- names/descriptions;
- portraits/icons;
- telegraph copy;
- VFX/SFX/media references;
- spoiler/public documentation;
- accessibility text.

Mechanical AI editing requires an explicit capability such as `ai.design_selected`.

### MODERATOR

No normal AI design authority.

---

# 9. Event Panel Integration

The Event Builder should not require staff to leave the event workflow for routine encounter authoring.

Event encounters can embed/select AI content through a bounded sub-panel:

```text
EVENT PHASE
  ↓
ENCOUNTER
  ↓
Enemy Set
  ├ Enemy Definition
  ├ Skill Package
  ├ Passive Package
  ├ AI Profile
  ├ Intelligence Grade
  ├ Objective Profile
  ├ Team Profile
  └ Event Modifier Package
```

Event Staff can preview the complete resolved encounter before publication.

The event stores/pins the chosen content versions so a later AI edit does not silently mutate an already running event unless an explicit safe live-update path is used.

---

# 10. AI Skills and Passives Use Shared Game Grammar

AI-controlled units should reuse the same:

- Effect Catalog;
- Target Spec;
- Action Economy;
- cooldown engine;
- status rules;
- terrain rules;
- visibility rules;
- summon rules;
- damage/heal/barrier formulas;
- versioning framework.

AI-only content is allowed, but it is still authored through these typed primitives.

This is crucial for Event Staff: they can compose unusual encounters safely without arbitrary scripting.

---

# 11. AI Level Versus Intelligence

The AI Studio must present **raw power** and **decision quality** as separate dimensions.

Example:

```text
Enemy Level: 70
Stats: Durable Level-70 Template
Intelligence: Recruit
```

versus:

```text
Enemy Level: 40
Stats: Standard Level-40 Template
Intelligence: Master
```

Both can be difficult in different ways.

Staff UI must never label a hidden stat multiplier as `AI difficulty`.

---

# 12. AI Information Concealment Rules

AI must consume a **viewer-filtered knowledge projection**.

If a player effect hides exact MP or derived stats from enemies, normal AI does not read those concealed exact values unless its authored perception/reveal mechanic legally defeats the concealment.

This preserves the fairness contract:

> AI is strong because it reasons better, not because server code secretly gives it forbidden information.

Special bosses may have explicit supernatural perception passives, but those are normal readable game mechanics with counterplay/telegraphing where appropriate.

---

# 13. AI Studio Validation

Before an AI draft can publish, validate:

- all referenced Skills/passives exist and are allowed;
- Intelligence Grade is permitted for the content scope;
- Knowledge Policy does not exceed staff authority;
- stats stay inside configured bounds;
- no illegal Skill/resource combination;
- no infinite trigger/cooldown/resource loop detected by static checks;
- objective is compatible with encounter rules;
- all content versions are published/available;
- spoiler visibility is correct;
- fallback behavior exists;
- estimated decision budget stays within safe limits.

High-risk configurations produce blocking errors or Owner-only overrides with audit.

---

# 14. Simulation and Test Workflow

AI Content Studio connects to the Combat AI Lab.

Staff can:

- test one AI against a player/test build;
- run AI-vs-AI;
- repeat an exact seed;
- compare versions;
- batch simulate;
- inspect action frequency;
- inspect resource/cooldown use;
- inspect objective behavior;
- inspect decision reason tags;
- inspect illegal/fallback attempts;
- compare outcome metrics.

Simulation is advisory. Human combat testing remains required for fairness/fun.

---

# 15. AI Content Lifecycle

AI definitions use:

```text
DRAFT
↓
VALIDATED
↓
PREVIEW / SIMULATION
↓
PUBLISHED
↓
RETIRED
```

Every published battle/event pins exact relevant versions.

Rollback restores a prior valid version without deleting history.

---

# 16. Master Panel Navigation

The mature `/master` navigation should include, as underlying systems become real:

```text
Overview
Live Events
Public Communications
Story / World Content
Character / Build Content
AI Content Studio
Combat AI Lab
Expeditions
PvP & Seasons
Economy
Players & Support
Moderation
Media / Asset Studio
Staff & Permissions
Audit Log
System / Feature Flags
```

Module visibility derives from the fixed role(s) + explicit capabilities.

---

# 17. Audit Requirements

AI/publication mutations record:

- actor principal;
- effective role/capability;
- environment;
- target content IDs;
- before/after version;
- reason/change note where required;
- related event/release where applicable;
- publish result;
- correlation/request ID.

Event-scoped AI edits additionally identify the Event definition/run they affect.

---

# 18. Definition of Success

This system succeeds when:

- staff can update News and Manual without source-code edits;
- publication remains safe and reviewable;
- Event Staff can build varied enemies/encounters from approved game components;
- AI power, skills/passives, intelligence, knowledge and objectives are independently configurable;
- AI still obeys the same legal combat engine and visibility rules;
- global/high-risk AI changes remain protected;
- event AI versions are pinned and reproducible;
- the Owner can simulate, publish, rollback and emergency-disable AI content;
- no new public staff role classes are introduced.
