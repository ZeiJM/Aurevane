# AUREVANE — Phase 2 Closeout Audit

**Audit date:** 2026-09-02  
**Baseline:** `main` at `7ab9f3c1d4f2cb456ca1297da5f299806bb754f9`  
**Status:** pre-closeout preparation only; Phase 2 remains open pending the Owner's final separate test and explicit closure decision.

## Objective

Prepare the repository and implementation plan for a clean transition into Phase 3 without destabilizing the current known-good Phase-2 battle platform.

The governing rule for this audit is conservative:

> Remove only artifacts whose purpose is demonstrably complete and whose deletion cannot affect current runtime behavior. Preserve any runtime candidate unless current evidence proves it is unused and normal validation can cover the deletion.

## Current implementation truth

Phase 2 has delivered substantially more than the original tactical-combat minimum. The current reusable platform includes:

- deterministic server-authoritative tactical combat;
- the 100-AP Action Economy;
- movement/pathing/terrain/elevation/facing;
- target/requirement/effect/status foundations;
- persisted/reconnect-safe battle sessions;
- PvE Recruit AI and Battle Hall sparring;
- direct PvP lobbies and shared battles;
- multi-combatant formats;
- battle communication, timing and reconnect foundations;
- keyed read-only spectation with spectator presence/chat/logs/Inspect;
- responsive desktop/mobile battle presentation;
- shared PvE/PvP battlefield presentation;
- stable cockpit action categories and slot-owned hotkey foundations;
- same-slot HP/MP Recovery swapping as an early reusable Skill-selection proof;
- battle logs, forecasts and Inspect;
- current performance/index hardening recorded in the roadmap.

This means Phase 3 should build **on top of** the current battle platform rather than recreate battle UI, PvP, spectation, hotkeys or action-selection surfaces.

## Phase-3 credit discovered during the audit

The project has already delivered a small but important amount of Phase-3-adjacent infrastructure:

### Reusable now

- four battle cockpit operational categories: `movement`, `attack`, `defense`, `heal`;
- stable slot keybind identities that survive visible action changes;
- action-selector versus action-execution separation;
- artwork/media hooks for cockpit actions;
- shared PvE/PvP cockpit behavior;
- HP Recovery / MP Recovery swapping in one category;
- existing preview/target/confirm routing through authoritative combat paths.

### Still Phase-3 work

The above does **not** provide:

- mature versioned Discipline definitions;
- Primary base-stat profiles;
- Secondary authority;
- independent attunement cooldowns;
- mature Skill schema;
- generic server cooldown engine;
- persistent legal 8-pure / 6-mixed Skill capacity;
- Resonance;
- Essence;
- canonical committed build snapshots across AI/PvP/loadouts;
- representative PV-2 buildcraft slice.

Therefore the Phase-3 ticket sequence remains valid, beginning at P3.1, but P3.3/P3.4 must explicitly **reuse** the existing cockpit surface rather than replacing it.

## Repository hygiene findings

### Safe to remove now

The following are historical scaffolding with no player/runtime authority:

1. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part02`
2. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part03`
3. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part04`
4. `.bootstrap/GAME_MASTER_PLAN.md.gz.b64.part05`
5. `.github/workflows/bootstrap-master-plan.yml`
6. `.github/workflows/format-auth-shell-once.yml`
7. `.github/final-format-auth-shell.trigger`

Why removal is safe:

- the canonical `docs/GAME_MASTER_PLAN.md` already exists;
- the bootstrap workflow exists only to reconstruct that document from split payloads;
- the authenticated-shell formatter is explicitly one-shot and branch-specific;
- its trigger literally says `Remove before merge`;
- none of these files participate in the Next.js runtime, combat domain, Supabase migrations, battle authority or Vercel app runtime.

The bootstrap remnants are additionally undesirable because the payload set is now only historical reconstruction material; keeping write-capable one-shot workflows indefinitely expands repository surface without product value.

### Runtime candidates deliberately not removed in this audit

An older external-review branch (#338) identified several battle components as apparently dead and proposed additional React/lint fixes. That branch is stale relative to current `main`, which has since received substantial battle-hotkey and shared-presentation work.

This audit therefore does **not** delete runtime components solely because #338 once identified them as unused. If those candidates are revisited later, deletion should require current import/reference evidence and normal lint/typecheck/test/browser validation.

This choice favors current functionality over cosmetic repository minimalism.

## Open-work boundary

At audit time:

- PV-1 / Phase-2 human validation issue #105 remains open;
- the Owner has stated one additional separate test remains before the final phase decision;
- PR #363 contains the active contained repeated-Finish-Turn hotkey stabilization work;
- this closeout audit does not modify or absorb PR #363.

No Phase-3 runtime implementation is activated by this audit.

## Documentation reconciliation

`TASKS.md` is updated to:

- mark the project as final Phase-2 stabilization / pre-Phase-3 closeout;
- record the pending separate Owner test;
- identify PR #363 as a separate active contained correction;
- give early-compatible Phase-3 credit to the cockpit foundations;
- preserve the explicit P3.1 start point after Phase-2 closure.

`docs/ROADMAP_COCKPIT_SKILL_SLOTS.md` is updated to make the central integration rule explicit:

- four cockpit categories are presentation/action-selection categories;
- they are **not** the persistent build capacity;
- canonical Phase 3 remains pure 8 + Essence versus mixed 6 + Resonance;
- battle cockpit options derive from the complete committed build snapshot;
- AI action enumeration must also derive from that complete authoritative snapshot, not only the four currently visible cockpit cards.

## Quality actions recommended before P3.1

Required before Phase-3 runtime code begins:

1. finish the Owner's final Phase-2 test;
2. reconcile PR #363 based on that evidence;
3. explicitly close or retain PV-1 issue #105 factually;
4. rerun/reconcile the roadmap's Phase-2 performance/scaling checkpoint if new evidence has changed since 2026-08-26;
5. merge the closeout documentation/hygiene only under the project's normal deployment-authorization rule, because `main` is Vercel-deploying;
6. then activate P3.1 and preserve current battle/PvP/spectator/cockpit infrastructure.

Optional later hygiene:

- revisit stale runtime-component candidates only with fresh import/reference proof;
- close stale/superseded pull requests once their replacement/supersession is unambiguous;
- keep temporary one-shot workflows/triggers out of `main` after future maintenance tasks.

## Phase-3 starting posture

Phase 3 should be treated as a build-authority/data-model expansion that plugs into an already mature battle platform.

The first implementation focus remains:

```text
P3.1
Persistent build authority
+ versioned Discipline definitions
+ Primary Discipline
+ Primary base-stat profiles
+ deterministic derived-stat recomputation
+ Profile preview/commit flow
```

Do not start by rebuilding the cockpit, PvP, spectation, battle layout or basic action execution. Those are assets to reuse.
