# AUREVANE — Technology & Language Policy

**Status:** Authoritative engineering guidance subordinate to `docs/GAME_MASTER_PLAN.md` and `docs/TECH_ARCHITECTURE.md`.

## 1. Goal

AUREVANE should use modern, high-quality technology that is appropriate for a long-lived production browser RPG.

"Modern" does **not** mean blindly adopting the newest preview, nightly, canary, release candidate, or fashionable language. The target is the strongest practical production stack: current, secure, performant, well-supported, maintainable, and compatible with the game's architecture and deployment environment.

The project should prefer proven modern stable/LTS releases and deliberately evaluate newer majors when they become production-ready.

## 2. Primary Languages

### TypeScript — primary application and game-service language

TypeScript is the default language for:

- browser/game UI;
- Next.js server code;
- authoritative domain services;
- game rules and shared packages;
- realtime adapters;
- validation;
- workers where the TypeScript/Node runtime is appropriate;
- tests and development tooling.

Use strict TypeScript. Prefer modern ECMAScript and ESM-compatible patterns. Do not introduce plain JavaScript for ordinary application code when TypeScript is practical.

The reason is architectural cohesion: shared types and validation can span browser, server, game-core packages, tooling, and tests without forcing multiple runtime ecosystems into the core product.

### SQL / PostgreSQL — authoritative relational data language

Use PostgreSQL and SQL for:

- schemas and constraints;
- migrations;
- indexes;
- Row Level Security policies where applicable;
- transactional database operations;
- set-based data operations that are best expressed in the database.

Do not move correctness-critical relational constraints into application code merely to avoid SQL.

### CSS — presentation language

Use modern CSS capabilities and the project's UI/design-system conventions for styling. Prefer platform capabilities over unnecessary styling dependencies when they meet the design requirement cleanly.

## 3. Additional Languages Are Allowed Only When They Earn Their Place

AUREVANE is not ideologically locked to one language. Use another language when it provides a material, demonstrated advantage that outweighs the operational cost of another toolchain.

Examples:

- **Rust / WebAssembly or native Rust services:** consider for a measured performance hotspot, specialized deterministic simulation, compression/processing, or another case where profiling shows a real advantage. Do not introduce Rust merely because it is fast in theory.
- **Python:** acceptable for isolated offline analytics, content tooling, data science, or simulation workflows when its ecosystem clearly improves the task. Do not make core gameplay authority depend on a Python service without a strong architectural reason.
- **Shell/YAML/TOML/JSON:** configuration and automation only where appropriate.

Any new runtime language in production requires an architectural decision explaining why the existing TypeScript/PostgreSQL stack is insufficient, what operational burden is added, and how the service/tool is tested and deployed.

## 4. Stable Production Baseline

The foundation currently targets the following production-grade generation of tooling:

- Node.js 24 LTS line for the production runtime;
- TypeScript 6 stable line;
- Next.js 16.2 Active LTS line;
- React 19.2 stable line;
- PostgreSQL/Supabase for persistent relational data, auth/realtime/storage where selected by architecture;
- pnpm + Turborepo for the monorepo/toolchain.

Exact pinned package versions remain governed by `docs/DEPENDENCY_POLICY.md` and committed manifests/lockfiles.

A newer release is not automatically better for AUREVANE. For example, a newer Node **Current** line or Next.js **Preview** line should not replace a supported LTS/stable production line simply to increase the version number.

## 5. Upgrade Standard

Technology should remain modern over the lifetime of the project rather than freezing the 2026 stack permanently.

At meaningful phase gates and before major public releases, review:

- Node.js supported LTS lines;
- Next.js active/maintenance support status and security releases;
- React stable releases;
- TypeScript stable releases and compiler migration guidance;
- PostgreSQL/Supabase compatibility and security guidance;
- pnpm/Turborepo/tooling support;
- critical dependency security advisories.

Rules:

1. Apply urgent security fixes promptly after compatibility verification.
2. Review compatible patch/minor upgrades regularly.
3. Major runtime/framework/compiler upgrades receive a focused ticket and full quality gate.
4. Do not combine a large framework/runtime migration with unrelated gameplay work.
5. Do not use canary/nightly/preview/RC software in the production baseline without an explicit architectural reason and rollback plan.
6. Upgrade because the new version improves security, support, performance, developer effectiveness, or required capability—not because it is fashionable.
7. Remove deprecated language/compiler/framework patterns before they become forced migrations where practical.

## 6. Performance and Effectiveness Rule

Choose technology based on the actual bottleneck.

Do not assume changing languages fixes poor architecture. Before introducing a faster runtime/language, investigate:

- algorithmic complexity;
- database/query design;
- indexes;
- network waterfalls;
- excessive client JavaScript;
- unnecessary hydration;
- caching;
- serialization/payload size;
- realtime subscription design;
- asset delivery;
- background-job architecture;
- concurrency and transaction design.

A well-architected TypeScript/PostgreSQL system is preferable to a fragmented multi-language system that is theoretically faster but harder to operate.

## 7. Browser and Server Modernity

Use modern platform features when they are stable and supported by the project's browser/runtime targets.

Prefer:

- server-side authority and React Server Components where they improve the architecture;
- standards-based Web APIs;
- modern ESM modules;
- strict typing and schema validation;
- native browser capabilities where appropriate;
- streaming/caching/code-splitting mechanisms supported by the chosen stable framework;
- current cryptographic/security primitives provided by maintained platforms/libraries.

Avoid unnecessary legacy compatibility layers unless real users require them.

## 8. AI Coding Rule

Coding agents must not silently replace the technology stack, downgrade versions, introduce an additional production language, or adopt experimental framework/runtime features simply because they are newer.

Before significant technology changes, the agent must:

1. inspect the currently pinned versions and architecture;
2. verify current authoritative vendor/project documentation;
3. compare stable/LTS options rather than relying on memory;
4. identify compatibility/security implications;
5. create a focused upgrade/migration ticket when appropriate;
6. run the full quality gate before completion.

For ordinary implementation work, agents must also follow `docs/ENGINEERING_EXECUTION_STANDARD.md`. Technology choice, architecture, and code style should minimize unnecessary runtime cost, dependencies, duplicated work, client JavaScript, database round trips, network payloads, and maintenance burden while preserving correctness and clarity.

## 9. Clean Implementation Rule

The best technology stack still fails if implementation is wasteful or messy.

AUREVANE therefore requires:

- the smallest coherent change that fully satisfies the ticket;
- reuse of existing project capabilities before adding parallel systems;
- no unnecessary dependencies;
- no speculative abstractions without a current need;
- no duplicate source of truth for game rules or validation;
- thin server boundaries and clear domain-service ownership;
- bounded database queries and payloads;
- avoidance of obvious N+1 query patterns;
- deliberately small Client Component/client-state boundaries;
- no dead/debug/obsolete code left behind after completed replacement;
- measured optimization of meaningful bottlenecks rather than speculative micro-optimization;
- a cleanup/efficiency review before completion.

High quality should come from discipline and clarity, not from code volume or framework complexity.

The detailed standard is `docs/ENGINEERING_EXECUTION_STANDARD.md`.

## 10. Decision Principle

The target is not "the newest code."

The target is **the best modern production engineering choice for AUREVANE at that point in time**.

That means the project should stay near the leading edge of stable web engineering while avoiding fragile hype-driven migrations.

The same principle applies inside the codebase: choose the **cleanest effective implementation with the least unnecessary complexity and waste** that still preserves AUREVANE's quality, security, performance, and future growth.
