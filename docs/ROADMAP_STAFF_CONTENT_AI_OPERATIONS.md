# AUREVANE — Roadmap: Public Communications & AI Content Studio

**Authority:** Binding roadmap integration for `docs/STAFF_CONTENT_AI_OPERATIONS_ADDENDUM.md`.

**Direction approved:** 2026-08-18.

---

# Phase 1–2 — Foundation / No Scope Inflation

Do not build the full staff AI database or publishing suite during current combat validation.

Preserve architecture for:

- versioned content IDs;
- safe rich-content publication;
- server-side capability checks;
- AI Profile references;
- Skill/passive source tags;
- deterministic AI version pinning;
- viewer-filtered AI knowledge.

The existing public `/news` and `/manual` foundation remains valid.

---

# Phase 3 — AI Metadata Compatibility

As Disciplines/Skills/cooldowns become real:

- replace stale AI metadata that assumes Arts/Traits/Reactions/Ultimates with generic Skill/passive/tag semantics;
- define per-Skill AI usage metadata;
- define AI loadout references using stable Skill IDs;
- ensure Intelligence Grade stays independent from enemy Level/stats;
- implement Knowledge Filter compatibility with information-concealment mechanics;
- preserve deterministic reason tags and version pinning.

No full staff AI authoring UI required yet.

---

# Phase 4 — Representative AI Content Definitions

For the first playable Discipline/enemy cohort:

- author reusable AI Profiles;
- author representative Skill Packages;
- author Passive Packages;
- author Objective/Team Profiles;
- build benchmark scenarios;
- prove that one enemy can switch Intelligence Grade without hidden stat changes;
- prove that AI respects concealed information.

These can initially be developer-authored data definitions before the complete staff editor exists.

---

# Phase 5 — First Useful Staff Public Communications + Event AI Composition

When the living world/event system becomes real, ship the first useful `/master` operational slices.

## Public Communications MVP

Add:

```text
Public Communications
├ News
└ Manual
```

Content Staff:

- draft/edit Manual;
- draft/edit News;
- attach approved media;
- preview;
- review history.

Event Staff:

- create/edit event-linked News drafts from Event Builder;
- attach event Manual/help references;
- preview public event communications.

Production publish remains Owner or explicit production-publish capability.

## Event AI composition MVP

Event Staff can select approved:

- Enemy Definitions;
- Skill Packages;
- Passive Packages;
- AI Profiles;
- Intelligence Grades;
- Objective Profiles;
- Team Profiles;
- bounded level/stat scaling.

The event pins exact versions.

Do not yet expose unrestricted global AI editing.

---

# Phase 6 — Co-op AI/Team Profiles

Expand reusable AI content for:

- squad roles;
- team coordination;
- ally-protection behavior;
- multi-unit objectives;
- party-aware encounter scaling;
- event/co-op preview simulations.

Event Staff can compose approved team profiles within event scope.

---

# Phase 7 — Expedition/Boss AI Authoring Depth

Expand AI Content Studio data model for:

- boss-phase directors;
- Expedition modifiers;
- multiphase objective behavior;
- summon/teleport/terrain-aware profiles;
- longer resource/cooldown planning;
- advanced event AI templates.

Add event/Expedition-safe simulation presets.

---

# Phase 8 — PvP-Like AI and Visibility Safety

Validate:

- AI cannot read information hidden by player mechanics;
- AI public-information rules match PvP viewer projections where applicable;
- practice AI can use PvP-like rules without being presented as human players;
- queue-normalized content does not silently alter AI intelligence.

---

# Phase 9 — Catalog Scale

As the roster grows:

- every released Discipline has AI usage metadata;
- every major enemy family has a meaningful behavior identity;
- AI Profile/Package reuse prevents one bespoke code path per enemy;
- event-safe catalogs remain searchable/filterable;
- deprecated components show dependency warnings before retirement.

---

# Phase 10 — Mature Public Communications Workflow

Add:

- scheduled Manual/News publication;
- publication calendar;
- corrections/supersession;
- stale-article detection;
- linked News/Manual dependencies;
- richer preview;
- role/capability-aware review queues;
- public/share metadata where appropriate.

Fixed role model remains unchanged.

---

# Phase 13 — Complete AI Content Studio / Combat AI Lab

Build the mature operational tools.

## AI Content Studio

Owner/full-authorized capability:

- AI Profile editor;
- Intelligence Grade parameters;
- Skill Package editor;
- Passive Package editor;
- Knowledge Policy editor;
- Objective/Team Profile editor;
- enemy/loadout builder;
- global assignment inspection;
- versioning/diff/rollback;
- hidden/internal definitions;
- emergency disable.

Event Staff:

- event-scoped AI draft composition from approved catalogs;
- bounded mechanical changes;
- event simulation;
- event publication according to granted scope.

Content Staff:

- presentation/media/copy by default;
- selected mechanical AI editing only through explicit capability.

## Combat AI Lab

Add:

- AI-vs-AI;
- batch simulation;
- version comparison;
- benchmark corpus;
- heatmaps/action frequencies;
- performance/decision metrics;
- fallback/illegal-attempt diagnostics.

## Public Communications complete

Finalize:

- News Editor;
- Manual Editor;
- publication calendar;
- revision history;
- protected staff operations manual;
- drift/dependency warnings;
- safe rollback.

---

# Phase 15 — Hardening

Test:

- unauthorized News/Manual publication;
- draft/spoiler leakage;
- rich-content injection;
- stale staff capability use;
- invalid AI component publication;
- AI Knowledge Policy privilege escalation;
- event-scoped profile escaping into global content;
- event version mutation during live runs;
- AI reading concealed player state;
- infinite trigger/cooldown/resource loops;
- AI decision latency under worst-case content;
- rollback/version reproduction;
- audit completeness.
