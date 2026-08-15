# AUREVANE — Clean & Efficient Engineering Execution Standard

**Status:** Authoritative engineering-quality refinement subordinate to `docs/GAME_MASTER_PLAN.md`, `docs/AI_DEVELOPMENT_QUALITY_MANDATE.md`, and `docs/TECH_ARCHITECTURE.md`.

**Direction approved:** 2026-08-15.

This document defines how AUREVANE code and implementation work should remain **clean, efficient, neat, understandable, maintainable, and production-minded** as the project grows.

The project already requires high quality. This standard adds a stricter execution rule:

> A correct implementation is not enough if it is needlessly messy, wasteful, duplicated, overcomplicated, bloated, or difficult to maintain.

The desired result is the **smallest clean solution that fully satisfies the ticket, preserves architecture, performs well, and remains easy for another strong engineer to understand and extend**.

---

## 1. Core Principle — Quality Without Waste

AUREVANE should be built with professional quality while avoiding unnecessary engineering weight.

For every implementation, optimize simultaneously for:

1. correctness;
2. clarity;
3. maintainability;
4. runtime efficiency;
5. development efficiency;
6. security;
7. testability;
8. consistency with existing architecture;
9. minimal unnecessary complexity.

Do not confuse quality with quantity of code.

A shorter implementation is not automatically better, but every added abstraction, file, dependency, query, state layer, indirection, and runtime cost must earn its place.

---

## 2. The Smallest Correct Change Rule

Implement the **smallest coherent change** that completely satisfies the ticket.

Prefer:

- extending an existing service rather than creating a parallel service;
- extending a validated schema rather than inventing a second validation path;
- using an existing UI primitive rather than creating a nearly identical component;
- adding one focused helper rather than a general-purpose framework;
- changing only files actually required by the ticket;
- preserving stable public interfaces where possible.

Avoid:

- unrelated refactors during feature work;
- broad formatting churn;
- speculative future scaffolding;
- duplicate temporary systems;
- renaming large areas simply because another naming style is preferred;
- replacing working code without a measurable benefit.

A pull request should be easy to understand because its diff tells one coherent story.

---

## 3. Clean Code Means Obvious Code

Code should reveal intent without requiring archaeology.

Prefer:

- precise names;
- small focused functions;
- explicit domain terminology;
- narrow interfaces;
- direct control flow;
- clear error paths;
- consistent return shapes;
- typed boundaries;
- obvious ownership of state.

Avoid:

- clever one-liners that hide behavior;
- deeply nested conditionals when the logic can be flattened cleanly;
- generic names such as `data`, `thing`, `handler2`, `temp`, or `misc` when a domain name exists;
- boolean-parameter combinations that create unreadable call sites;
- functions that perform unrelated responsibilities;
- implicit mutation that is difficult to trace;
- hidden global side effects.

The best implementation should make the next change easier, not harder.

---

## 4. One Responsibility Per Layer

Keep responsibilities in the correct place.

### UI

Owns presentation, interaction state, accessibility, and user feedback.

It does not own authoritative game calculations.

### Route / server boundary

Owns authentication, authorization, request parsing, validation, and translation into domain commands.

It should remain thin.

### Domain service

Owns the authoritative use-case workflow and business invariants.

### Pure game rules

Own deterministic calculations that can be tested without network/UI/database machinery where practical.

### Repository/database layer

Owns persistence concerns, transactions, queries, and database-specific behavior.

### Worker

Owns durable asynchronous and scheduled processing that should not depend on a browser session.

Do not collapse these layers merely to save a few lines of code.

Do not create extra layers that add no real separation of responsibility.

---

## 5. Avoid Duplicate Sources of Truth

AUREVANE should not maintain the same rule in several places.

Avoid duplicating:

- progression formulas;
- permission rules;
- balance constants;
- item definitions;
- status behavior;
- validation schemas;
- unlock requirements;
- PvP rules;
- manual values that can render from structured configuration;
- server and client copies of authoritative calculations.

Prefer one authoritative definition with intentionally derived presentation data.

If duplication is temporarily unavoidable, document why and how drift is prevented.

---

## 6. No Dead Architecture

Do not create code for hypothetical future requirements unless the current ticket genuinely needs the interface boundary now.

Avoid:

- empty services created "for later";
- unused abstractions;
- feature flags for nonexistent features;
- generic plugin frameworks before plugins exist;
- placeholder repositories that wrap a single trivial function without adding a boundary;
- interfaces with one implementation when no meaningful substitution/test boundary exists;
- unused exported types;
- commented-out old implementations;
- abandoned migration paths left indefinitely.

Future readiness means leaving clean extension points, not prebuilding unknown futures.

---

## 7. Delete Obsolete Code Safely

When a new implementation legitimately replaces an old path, remove obsolete code once compatibility and migration requirements are satisfied.

Do not leave:

- `old-*` files;
- `v2` implementations beside unused originals;
- duplicate components;
- dead feature toggles;
- unreachable branches;
- obsolete TODOs;
- unused imports/exports;
- stale tests that no longer assert meaningful behavior.

Repository cleanliness is part of quality.

Never delete code merely to make a diff smaller if it still has a real caller or migration role.

---

## 8. Dependency Restraint

Every dependency creates maintenance, security, bundle, upgrade, and cognitive cost.

Before adding one, ask:

- Does the project already have this capability?
- Can the platform/framework solve it cleanly?
- Is the library maintained and production-ready?
- Does it materially reduce complexity?
- What does it add to client bundle or runtime footprint?
- Does it introduce another architecture or state-management model?
- Is the license acceptable?

Do not install a package for a ten-line utility that is clearer and safer to own directly.

Do not reimplement mature complex functionality merely to avoid a justified dependency.

---

## 9. Frontend Efficiency

The browser should receive only what it needs.

Prefer:

- Server Components/server rendering where appropriate;
- small deliberate Client Component boundaries;
- localized state rather than unnecessary global state;
- derived state instead of storing duplicate copies;
- code splitting for expensive optional surfaces;
- lazy loading where it improves real experience;
- efficient list rendering;
- stable keys;
- bounded realtime subscriptions;
- optimized approved media assets.

Avoid:

- marking large trees `use client` for convenience;
- fetching the same data independently from multiple child components;
- unnecessary hydration;
- repeated expensive calculations during render;
- global stores for local form/UI state;
- excessive effects used to synchronize state that could be derived directly;
- polling when an existing event/invalidation mechanism is appropriate;
- massive payloads just because the endpoint can return them.

Memoization is a tool, not decoration. Use it where it solves a real rerender/calculation problem.

---

## 10. API and Server Efficiency

Server boundaries should be predictable and economical.

Prefer:

- validated minimal inputs;
- narrow response payloads;
- one authoritative use-case service per command;
- explicit transaction boundaries;
- batched work where safe;
- idempotency for retryable valuable operations;
- pagination for potentially large collections;
- bounded fan-out;
- background workers for expensive asynchronous tasks.

Avoid:

- chatty request chains when one server operation can perform the coherent use case;
- returning full records when only a few fields are needed;
- request handlers containing large amounts of game logic;
- repeated authorization/database lookups that can be safely consolidated;
- synchronous long-running work inside interactive request paths.

---

## 11. Database Efficiency

Database correctness and database efficiency must be designed together.

Prefer:

- selecting only needed columns when practical;
- bounded result sets;
- pagination;
- set-based operations;
- joins or intentional batch queries instead of N+1 patterns;
- indexes that match real filtering/join/sort patterns;
- unique and check constraints for durable invariants;
- transactions for atomic multi-step changes;
- query plans reviewed for genuinely hot/large paths;
- durable job queues/worker patterns for large background tasks.

Avoid:

- unbounded table scans in normal gameplay paths;
- loading an entire inventory/history/feed when one page is required;
- issuing one query per row in a loop;
- adding indexes blindly to every column;
- using application loops where a clear set-based database operation is safer and faster;
- storing easily derived duplicate data without a justified performance/integrity reason.

Every denormalization must have a clear ownership and synchronization rule.

---

## 12. Algorithmic Efficiency

Choose algorithms appropriate to expected data size and frequency.

Before optimizing, understand:

- input size;
- execution frequency;
- latency sensitivity;
- memory cost;
- whether the path is client, server, worker, or offline tooling.

Avoid obvious accidental quadratic work in hot paths when a simple map/set/indexed approach is available.

Do not replace readable linear work over ten items with elaborate machinery simply to improve theoretical complexity.

Efficiency should be proportional to the real problem.

---

## 13. Network Efficiency

Network cost directly affects browser-game responsiveness.

Prefer:

- compact typed payloads;
- request coalescing where appropriate;
- caching with explicit invalidation semantics;
- conditional/refetch-on-change behavior;
- realtime events that notify clients to refetch authoritative state where appropriate;
- media formats/dimensions suited to their actual display use.

Avoid:

- redundant round trips;
- giant JSON snapshots for small state changes;
- sending secret/internal fields to clients;
- refetching large screens because one small field changed when a narrower strategy is available;
- aggressive realtime broadcasting of data that does not need realtime delivery.

---

## 14. Runtime and Memory Hygiene

Persistent browser sessions and multiplayer services must not accumulate avoidable work.

Watch for:

- leaked event listeners;
- abandoned timers;
- duplicate subscriptions;
- unbounded caches;
- unbounded in-memory histories;
- retained large objects after navigation;
- worker jobs that can grow without limits;
- arrays/logs that append forever.

Every long-lived collection needs an intentional retention/bounding strategy.

---

## 15. Error Handling Should Be Central and Useful

Do not scatter inconsistent `try/catch` blocks merely to silence failures.

Prefer:

- known domain errors with stable categories;
- appropriate boundary translation into player-safe messages;
- structured internal logging;
- explicit recovery/retry behavior;
- no swallowed exceptions;
- no duplicate logging of the same failure at every layer.

Errors should preserve enough context to diagnose the real problem without exposing secrets.

---

## 16. Types and Validation Should Reduce Work

TypeScript and validation should make code simpler, not ceremonial.

Prefer:

- strict types;
- discriminated unions for meaningful state variants;
- schemas at external boundaries;
- generated/inferred types where they eliminate duplication safely;
- domain-specific identifiers/types when they prevent real category mistakes.

Avoid:

- `any` as an escape hatch;
- repeated casts that hide an incorrect model;
- re-declaring the same shape in several layers;
- massive generic type machinery that is harder to understand than the runtime problem;
- validating the same trusted internal object repeatedly at every function call.

Validate untrusted boundaries strongly, then keep trusted internal paths straightforward.

---

## 17. Comments and Documentation

Code should not need comments that merely narrate syntax.

Useful comments explain:

- why a non-obvious decision exists;
- a security invariant;
- a protocol/database constraint;
- a deliberately unusual tradeoff;
- a compatibility/migration reason;
- a source-of-truth rule.

Avoid comments that become stale copies of the code.

Public/domain APIs should be understandable from names, types, and focused documentation.

Architectural decisions with lasting consequences belong in project docs/ADRs, not buried only in comments.

---

## 18. Tests Must Be Clean Too

Tests are production engineering assets.

Prefer:

- deterministic tests;
- small focused assertions;
- reusable fixtures/builders where they reduce repetition;
- explicit scenario names;
- testing behavior rather than implementation trivia;
- coverage of invalid/edge/concurrent cases where relevant.

Avoid:

- huge setup copied into every test;
- tests that depend on execution order;
- arbitrary sleeps;
- brittle snapshots of irrelevant markup;
- tests that duplicate the implementation algorithm;
- mocks so deep that the real behavior is never exercised.

A flaky test is a defect, not normal background noise.

---

## 19. Clean Migration Discipline

Database/schema migrations should be focused and reversible/recoverable where practical.

A migration should:

- make one coherent schema evolution;
- preserve existing valid data;
- avoid destructive ambiguity;
- include backfill logic deliberately when required;
- keep deploy-order compatibility in mind;
- be tested against realistic existing state where risk warrants it.

Do not hide unrelated schema cleanup inside a gameplay migration.

---

## 20. Efficient Reuse, Not Forced Reuse

Reuse code when the underlying behavior is truly the same.

Do not force two domain concepts through one abstraction merely because they look similar today.

Good reuse removes duplication while preserving clarity.

Bad reuse creates conditional-heavy "universal" components/services that understand every feature in the game.

The goal is **cohesion**, not maximum abstraction.

---

## 21. File and Module Hygiene

A file should have a clear reason to exist.

Split a file when it owns multiple meaningful responsibilities or has become difficult to navigate/test.

Do not split every ten lines into a separate file simply to achieve small file sizes.

Avoid generic dumping grounds such as:

- `utils.ts`;
- `helpers.ts`;
- `common.ts`;
- `misc.ts`;

when domain-specific modules provide clearer ownership.

Exports should be intentional. Do not turn every internal helper into public package API.

---

## 22. Naming and Repository Organization

Follow existing project conventions unless there is a strong reason to improve them deliberately.

Prefer names that identify:

- domain;
- purpose;
- ownership;
- state/lifecycle where relevant.

Examples:

- `resolveCombatAction` is better than `process`;
- `publishWorldEvent` is better than `doEvent`;
- `characterProgressionService` is better than `gameUtils`.

New folders/modules should fit the existing feature-oriented structure rather than inventing a second organizational scheme.

---

## 23. No Incidental Architecture Churn

Feature tickets must not silently become architecture rewrites.

If a ticket exposes an architectural problem:

1. make the smallest safe change needed for the ticket if feasible;
2. record the broader issue;
3. create/propose a focused refactor ticket if the larger change has real value.

A major refactor can be correct and still be the wrong change for the current ticket.

---

## 24. Refactoring Standard

Refactor when it materially improves:

- correctness;
- maintainability;
- security;
- testability;
- performance;
- removal of meaningful duplication;
- ability to implement the assigned requirement safely.

Do not refactor merely to express personal style.

A refactor should preserve behavior unless behavior change is explicitly part of the ticket.

Add or preserve tests that prove this.

---

## 25. Performance by Evidence

Do not guess at performance problems when measurement is available.

Use appropriate evidence such as:

- browser performance tools;
- server timings;
- query counts;
- database query plans;
- bundle analysis;
- memory profiles;
- load tests;
- realtime connection/subscription metrics;
- worker queue telemetry.

Fix the biggest meaningful bottleneck first.

Do not spend hours micro-optimizing code that is not on a relevant path.

---

## 26. Efficiency Is End-to-End

An implementation can be locally fast and globally wasteful.

Evaluate the complete path:

```text
PLAYER ACTION
  ↓
UI STATE
  ↓
NETWORK REQUEST
  ↓
AUTH / VALIDATION
  ↓
DOMAIN LOGIC
  ↓
DATABASE / CACHE
  ↓
RESULT PAYLOAD
  ↓
CLIENT UPDATE / REALTIME
```

Look for duplicate work across layers, not only inside one function.

---

## 27. Ticket Cleanliness Requirement

Every implementation ticket must explicitly consider:

- What existing code can be reused?
- What is the smallest coherent change?
- Are any new abstractions/dependencies actually necessary?
- Does the implementation duplicate an existing rule or data source?
- Are database/network operations bounded and efficient?
- Is unnecessary client JavaScript/state being introduced?
- Is any obsolete code left behind?
- Does the diff contain unrelated churn?
- Is the implementation straightforward for another engineer to follow?

If the answer reveals unnecessary complexity, clean it before completion.

---

## 28. Cleanliness Review Before Completion

Before calling a ticket done, perform a deliberate cleanup pass.

Check for:

- unused imports;
- unused exports;
- dead code;
- duplicate helpers;
- temporary debug code;
- stray logs;
- commented-out code;
- weak names;
- excessive nesting;
- avoidable state duplication;
- overly broad types;
- unnecessary dependencies;
- repeated database calls;
- N+1 queries;
- unbounded reads;
- redundant API calls;
- unnecessary rerenders/subscriptions;
- stale TODOs introduced by the ticket;
- files touched only by accidental formatting.

The cleanup pass is part of implementation, not optional polish.

---

## 29. Efficiency Regression Rule

A ticket should not introduce a known substantial efficiency regression merely because it passes functional tests.

If the clean correct implementation necessarily has a temporary performance limitation, document:

- what the limitation is;
- why it is acceptable at the current phase;
- what scale triggers remediation;
- what future ticket or architecture path addresses it.

Temporary limitations must be intentional, not accidental.

---

## 30. Definition of Done — Clean & Efficient Addendum

In addition to the project's existing Definition of Done, a meaningful implementation is not complete until the applicable checks below pass.

### Cleanliness

- The implementation has one clear responsibility per module/layer.
- No obvious duplicate path/source of truth was introduced.
- No dead/debug/temporary code remains unless intentionally documented.
- Names and control flow are straightforward.
- The diff contains no unrelated churn.

### Efficiency

- Database access is bounded and avoids obvious N+1 behavior.
- Network payloads/round trips are proportionate to the use case.
- Client-side code/state/hydration is no larger than necessary.
- Realtime/background work is bounded.
- No obvious high-frequency quadratic or repeated expensive work was added.

### Maintainability

- Existing project patterns were reused where appropriate.
- New abstraction/dependency cost is justified.
- Tests are readable and deterministic.
- A future engineer can identify where the behavior lives.

### Verification

- Typecheck/lint/tests/build pass as applicable.
- Relevant runtime behavior was inspected where possible.
- Performance-sensitive changes were measured or reasonably reviewed at the appropriate project stage.

---

## 31. Engineering Review Questions

Before merging, ask:

**Correctness** — Does it do exactly what the ticket requires?

**Simplicity** — Is there a simpler solution with the same correctness and extensibility?

**Duplication** — Did we create a second way to do something that already exists?

**Placement** — Is each piece of logic in the right layer/module?

**Data** — Are queries and payloads bounded to what is actually needed?

**Browser cost** — Are we shipping avoidable JavaScript, state, hydration, media, or rerenders?

**Server cost** — Are we repeating authorization, queries, serialization, or calculations unnecessarily?

**Scale** — Does the implementation have an obvious failure mode at realistic future load?

**Readability** — Can another senior engineer understand the implementation quickly?

**Cleanup** — Did temporary/debug/dead code get removed?

If an answer is materially poor, improve the implementation before merging.

---

## 32. AI Coding Agent Rule

Every coding agent working on AUREVANE must treat this document as a standing implementation constraint.

The agent must not optimize for:

- maximum lines written;
- maximum number of files changed;
- maximum abstraction;
- maximum number of dependencies;
- finishing a ticket by piling another workaround onto existing debt.

The agent should optimize for:

> **maximum correct value delivered with minimum necessary complexity and waste.**

This does not mean rushing.

It means building the right thing cleanly the first time.

---

## 33. Final Standard

AUREVANE code should feel intentionally engineered.

When a system is complete, the desired impression is:

- the architecture is obvious;
- the code is compact without being cryptic;
- expensive work is deliberate;
- state ownership is clear;
- database/network behavior is sensible;
- abstractions are justified;
- tests explain behavior;
- the repository remains tidy;
- future changes have a clear home.

The project should remain **high quality because it is disciplined, not because it is bloated**.
