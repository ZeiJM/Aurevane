# AUREVANE — Project Governance, Complexity & Delivery Standard

**Status:** Binding cross-cutting project standard subordinate to `docs/GAME_MASTER_PLAN.md` and compatible with the domain specifications, `docs/AI_DEVELOPMENT_QUALITY_MANDATE.md`, `docs/ENGINEERING_EXECUTION_STANDARD.md`, `docs/TECH_ARCHITECTURE.md`, and product-validation roadmap.

**Direction approved:** 2026-08-16.

AUREVANE now has enough approved systems that a major project risk is no longer lack of ideas. It is uncontrolled interaction between good ideas, document sprawl, implementation drift, and scaling content faster than the project can reason about or produce it safely.

> **Preserve the full AUREVANE vision, but make complexity earn its place, make authority easy to find, and require evidence before systems, content, or implementation concurrency multiply.**

---

## 1. Authority Layers

When several documents touch the same work, use this hierarchy:

1. `docs/GAME_MASTER_PLAN.md` — product identity and approved top-level game design.
2. Canonical domain specification — detailed rules for the system being changed.
3. Cross-cutting standards — engineering, quality, responsive, media, product experience, lore, security, and this governance standard.
4. Binding roadmap / validation extension — sequencing and evidence gates.
5. Current `docs/PHASE_*_TICKETS.md` — exact phase/ticket scope.
6. Current GitHub issue/PR — concrete implementation and release acceptance.
7. `TASKS.md` — current implementation ledger; it reports reality and never redefines design.

A lower layer must not silently contradict a higher layer. If same-level authorities conflict, resolve the conflict in the repository before implementation continues.

---

## 2. Canonical Authority Registry

This is a routing index, not a duplicate specification.

| Domain | Primary authority / required companions |
|---|---|
| Product identity / core game | `docs/GAME_MASTER_PLAN.md` |
| Engineering quality | `docs/AI_DEVELOPMENT_QUALITY_MANDATE.md`, `docs/ENGINEERING_EXECUTION_STANDARD.md`, `docs/TECH_ARCHITECTURE.md` |
| Phase sequencing | `docs/ROADMAP.md`, current `docs/PHASE_*_TICKETS.md` |
| Product evidence / expansion | `docs/ROADMAP_PRODUCT_VALIDATION.md`, `docs/PRODUCT_STRATEGY_AND_COMMERCIAL_VALIDATION.md` |
| Combat | `docs/COMBAT.md` |
| Battle presentation | `docs/BATTLE_INTERFACE.md`, `docs/ROADMAP_BATTLE_INTERFACE.md` |
| Combat AI / Tactical Hall | `docs/COMBAT_AI_TRAINING.md` |
| Character progression / Rekindling | `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, `docs/LONG_HORIZON_PACING_VALIDATION.md` |
| Wayfarer’s Practice | `docs/OFFLINE_PROGRESSION.md` |
| Items / inventory / loadouts | `docs/ITEMS_INVENTORY_LOADOUTS.md` |
| Stat expression | `docs/STAT_DRIVEN_BUILDCRAFT.md`, `docs/ROADMAP_STAT_DRIVEN_BUILDCRAFT.md` |
| Equipment Weight / Load | `docs/EQUIPMENT_LOAD_AND_BUILD_PHYSICS.md`, `docs/ROADMAP_EQUIPMENT_LOAD_AND_BUILD_PHYSICS.md`, `docs/ROADMAP_MIGHT_LOAD_HANDLING.md` |
| Mantles | `docs/MANTLES.md`, `docs/ROADMAP_MANTLES.md` |
| World / story / lore | `docs/WORLD.md`, `docs/LORE_BIBLE.md` |
| Tavern social world / Roadwright / chat | `docs/TAVERN_SOCIAL_WORLD.md`, `docs/ROADMAP_TAVERN_SOCIAL_WORLD.md` |
| Page/content experience | `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md` |
| Visual direction | `docs/ART_BIBLE.md`, `docs/VISUAL_EXPERIENCE_EVOLUTION.md`, `docs/ROADMAP_VISUAL_EXPERIENCE.md` |
| Audio direction | `docs/AUDIO_BIBLE.md` |
| Media operations | `docs/MEDIA_PIPELINE.md`, `docs/ASSET_STUDIO_AND_MEDIA_OPERATIONS.md`, `docs/ROADMAP_MEDIA_OPERATIONS.md` |
| Master Panel | `docs/MASTER_PANEL.md` plus applicable domain specification |
| Social presence | `docs/SOCIAL_PRESENCE.md`, `docs/ROADMAP_SOCIAL_PRESENCE.md` |
| Public News / Manual | `docs/PUBLIC_NEWS_AND_MANUAL.md`, `docs/PLAYER_MANUAL.md`, `docs/ROADMAP_PUBLIC_INFORMATION.md` |
| Public Rules | `docs/PUBLIC_RULES.md`, `docs/ROADMAP_PUBLIC_RULES.md` |
| Monetization | `docs/MONETIZATION.md` |
| Responsive/accessibility | `docs/RESPONSIVE_EXPERIENCE_STANDARD.md` |

When a new permanent authoritative document is approved, update this registry during the next consolidation/reconciliation pass.

---

## 3. Documentation Lifecycle

Do not create a new authority merely because a new idea exists. Prefer, in order:

1. extend an existing canonical domain specification;
2. extend an existing roadmap/validation document;
3. add a focused addendum only when the concern genuinely spans domains or the parent would become materially harder to use;
4. create a new permanent authority only when it owns a durable responsibility no existing document cleanly owns.

Every new authority must state what it owns, what it does not own, higher/sibling authorities, and conflict behavior.

Run a documentation consolidation review before major phases, before Closed Alpha, when a domain accumulates overlapping addenda, and after major evidence-driven redesigns. Fold mature rules back into parent specs where practical, remove duplicated wording, mark obsolete docs superseded, and preserve history in Git rather than keeping multiple active truths.

The target is **fewer clearer authorities over time**.

---

# EXECUTION TRUTH

## 4. One Active Implementation Ticket Means One

There should be one canonical **ACTIVE implementation ticket** for the main product line.

Allowed in parallel: design/documentation work that does not alter active runtime architecture, review/audit, release verification, and tiny isolated proofs explicitly approved by the Owner.

Not normally allowed:

- substantial implementation of ticket N+1 before ticket N passes its required gates;
- long-lived stacked branches accumulating a second implementation stream;
- two branches implementing the same gameplay boundary;
- future schema/runtime work merely because its types are easy to imagine.

A stacked draft may exist briefly when a dependency is internally code-sealed and the stack is clearly marked. It must never merge before its dependency, and it must stop expanding if the dependency changes.

---

## 5. Dependency Completion Rule

Before dependent implementation expands materially, the dependency should normally have passed all applicable domain tests, typecheck/lint/build, database/security regressions, browser acceptance, required external Preview/release verification, and merge/reconciliation gate.

If infrastructure temporarily blocks one external gate, the Owner may explicitly allow limited stacked work, but the issue/PR and `TASKS.md` must distinguish **ACTIVE**, **STACKED DRAFT**, **BLOCKED**, and **COMPLETE**.

---

## 6. Repository Truth Reconciliation

Before every new implementation ticket, inspect current `main`, recent commits, `TASKS.md`, the current phase ticket spec, open implementation PRs/issues, relevant branches, and recently merged roadmap/design work.

If the repository disagrees with planning, reconcile first. Examples:

- `TASKS.md` says Phase 1 while `main` already contains Phase 2;
- a prerequisite was originally worded as “before Phase 2” but engine-only work already advanced while the prerequisite still matters before the player-facing validation milestone;
- an old draft PR assumes architecture later work replaced;
- a stacked branch depends on acceptance criteria that changed.

Correct status/sequencing honestly rather than pretending the mismatch never happened.

Mandatory reconciliation gates occur at phase boundaries, before the first player-facing vertical of a major system, after significant overlapping-agent activity, before external validation cohorts, before public payment enablement, and before Closed Alpha.

---

# COMBAT COMPLEXITY BUDGET

## 7. Depth Is Not Simultaneous Complexity

The engine may eventually support Movement, Jump, elevation, facing, cover, hazards, objectives, resources, statuses, Reactions, equipment, Load, Disciplines, Confluences, Soulmarks, Mantles, initiative manipulation, items, summons, terrain transformation, PvP timing, and more.

That does not mean every encounter should foreground every system.

> **The engine may be deep; each decision should still present a readable number of important questions.**

Each encounter/map should identify a small set of **foreground mechanics** — the interactions it specifically asks the player to notice and reason about.

Guideline:

- tutorials/first-use encounters introduce one major new concept at a time where practical;
- early encounters combine a small number of learned concepts;
- normal mature fights usually foreground roughly **2–4 tactical ideas**;
- advanced bosses, Expeditions and high-level PvP may exceed that only after the underlying systems are learned and the presentation remains readable.

These are cognitive-design targets, not engine limits.

---

## 8. Combat UI Information Budget

Preserve the board-first doctrine. Always-visible information should be limited to what is needed for the immediate decision: battlefield, actor/resources, initiative, objective, command deck, selected action/target forecast, and concise relevant statuses.

Deep logs, detailed terrain/status rules, Tactical Records and historical analysis belong in contextual/expandable inspection.

A new mechanic does not automatically earn a permanent meter, sidebar, icon row or modal.

Every significant combat-content ticket should answer:

- What are this encounter’s foreground mechanics?
- What prior knowledge does it assume?
- What does it teach?
- What counterplay is readable before commitment?
- Which UI information is permanent versus contextual?
- Can players explain why outcomes happened?
- Does the mechanic create a decision rather than another number to track?

---

# BUILDCRAFT / COMBINATORIAL COMPLEXITY

## 9. Build Axes Interact Selectively

AUREVANE’s build depth may draw from attributes/stats, Current/Legacy Disciplines, Confluences, Arts, Traits, Reaction, Movement Art, Soulmark, equipment/items, Weight/Load, Mantles, later Veteran Edge, party composition, and map context.

Cross-system synergy is encouraged, but **not every element must interact with every axis**. Content should have a clear primary identity and only the relationships that make it strategically richer.

---

## 10. Interaction Fan-Out Review

When adding a mechanic/content definition, estimate interaction fan-out:

- how many actions/statuses/tags can trigger it?;
- how many Confluences/Soulmarks/items consume the same tags?;
- can it recursively generate actions, turns, resources or refunds?;
- does it alter universal Movement/Action/initiative rules?;
- does it create PvP override cases?;
- does AI need new understanding?;
- does it create Manual/News/balance-tooling burden?

High-fan-out mechanics require proportionally stronger tests, simulation, analytics and authoring constraints. Broad behavior should prefer reusable typed primitives/tags over dozens of bespoke pairwise exceptions.

---

## 11. Interaction Graph and Content Linting

Before content scale makes manual reasoning unreliable, build machine-readable interaction/dependency tooling over stable content IDs/tags.

It should eventually answer questions such as:

- what can trigger/consume this status/tag/effect?;
- what Confluences reference this Discipline/tag?;
- what equipment depends on a stat/Load state?;
- which maps favor a Movement/Jump profile?;
- which Mantle Paths depend on these conditions?;
- which Manual articles/AI profiles are affected by a rule?

As content scales, automated linting/simulation should detect classes of errors such as missing required Confluences, dead references, impossible requirements, recursive extra-action/turn loops, unbounded resource/refund chains, invalid targets, unsafe stat/Load breakpoints, unreachable objectives, missing acquisition paths, expired-event-only build power, suspicious mandatory concentration, dead major stats/tags, AI capability mismatches, and missing production media/manual relationships.

Simulation supplements human playtesting; it does not prove fun.

---

## 12. Roster Expansion Pays Its Interaction Cost

The staged Discipline expansion remains **4 → 6–8 → 12 → 16 → later toward 36**.

Before each band expands, review total interaction cost: Confluences, Arts/Traits/Reactions/Movement, Soulmark/equipment relationships, AI coverage, media, tests/simulation, Manual/Codex, PvP matchups, and unresolved underused content.

A new Discipline is not approved merely because its individual kit sounds good; it must justify the network of work it creates.

---

# CONTENT PRODUCTION THROUGHPUT

## 13. Quality Ambition Needs Production Evidence

AUREVANE deliberately expects gameplay, AI, art, audio, lore, UI, documentation and operations to reach production quality together. Therefore content throughput is a product constraint.

Measure representative packages once production repeats enough to make measurement useful:

- Discipline: concept → data → tests → AI → Confluences → equipment interactions → media → Manual/Codex → balance → polished playable state;
- enemy: identity → rules → AI → encounter → media → rewards → discovery/docs → tests;
- region/settlement: world design → navigation → NPCs/activities → quests/events → environment media → live variants → operations hooks;
- boss/Expedition: mechanics → maps → AI/director → loot → narrative → VFX/audio → replay/debug → balance/accessibility/tests.

Useful metrics include concept-to-first-playable time, first-playable-to-production-ready time, bespoke-code count, regression defects, media count, interaction count, AI/test burden, docs burden, balance iterations, and reuse percentage.

Optimize for **high-quality content at a sustainable repeatable cost**, not raw quantity.

If a content type is too expensive at planned scale: improve tooling/reusable primitives, reduce unnecessary bespoke fan-out, improve media/authoring operations, and reduce planned quantity before accepting generic filler.

---

# LONG-HORIZON PACING

## 14. The 180-Day Default Is an Evidence-Tested Production Hypothesis

AUREVANE should remain a game where a permanent character matters for months/years rather than being solved in a weekend.

The existing approximately **180-day / six-month First Horizon and Rekindling target remains the current production planning default**.

However, by explicit Owner direction, the numeric value is a **pacing hypothesis to validate**, not an untouchable sacred constant.

Do not casually shorten it because one tester dislikes waiting. Do not preserve it if representative cohort evidence shows it harms an otherwise healthy long-form game.

Before materially changing the production default, review progression simulation, accelerated QA, cohort progression velocity, retention/return behavior by band, meaningful-play-versus-waiting time, access to advanced content before First Horizon, Mastery/build pacing, event/season cadence, goal clarity, returning-player experience, PvP/economy effects, and qualitative long-term feedback.

Any change must preserve the invariant:

> **First-cycle completion is a long-form achievement made of meaningful play, not a short XP sprint and not months of dead waiting.**

Serious Expeditions, PvP, strong builds, major story and advanced gear must be able to matter well before final Rekindling eligibility when gameplay progression supports them.

For the narrow numeric-pacing refinement and change-control rule, `docs/LONG_HORIZON_PACING_VALIDATION.md` is authoritative until its policy is consolidated back into the primary progression/roadmap documents.

---

# ROADMAP / OPERATIONS IMPLICATIONS

## 15. Complexity Tooling Timing

- **Phase 1–2:** keep the grammar small; no giant simulation platform. Track dependencies explicitly in typed definitions/tests.
- **Phase 3:** buildcraft/content schemas should expose stable IDs/tags/relationships suitable for later graphing. Add first interaction-lint checks where the Current/Legacy/Confluence/Soulmark system needs them.
- **Phase 4:** before roster expansion beyond the first representative set, interaction coverage/linting and content-throughput review become explicit expansion gates.
- **Phase 5:** measure representative world/story content throughput and keep optional retention features subordinate to PV-3 rather than using them to hide a weak core loop.
- **Phases 6–8:** extend graph/simulation coverage to party, Expedition and PvP interactions; enforce foreground-complexity/readability testing.
- **Phase 9:** large roster expansion requires mature interaction/dependency tooling and sustainable content-throughput evidence.
- **Phases 11–12:** economy/nation expansion requires the same dependency/throughput discipline.
- **Phase 13:** Master Panel/Balance Lab exposes interaction/dependency impact, content completeness and throughput/health analytics where useful.
- **Phase 15:** harden performance, scale, exploit simulation, content validation, and operational recovery.

---

## 16. Ticket Impact Template

For any ticket that materially expands combat/build/content complexity, explicitly consider:

```text
AUTHORITY
- canonical domain spec(s)?
- conflicting/stale addendum?

COMPLEXITY
- new foreground mechanic?
- new permanent UI information?
- interaction fan-out?
- recursive/loop risks?

CONTENT IMPACT
- Confluences / items / Soulmarks / Mantles / AI affected?
- media affected?
- Manual / News affected?
- acquisition affected?

DELIVERY
- production-throughput impact?
- reusable primitive or bespoke exception?
- evidence required before scaling?

REPOSITORY TRUTH
- current active ticket correct?
- dependency actually complete?
- TASKS / issue / PR status synchronized?
```

---

## 17. Success Condition

This standard succeeds when AUREVANE can become very deep without becoming impossible to understand, balance, test, author, operate, or finish.

The mature game should feel rich because systems interact **meaningfully**, not because every screen exposes every rule and every content object has a bespoke exception.